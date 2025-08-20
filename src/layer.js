import * as util from "./util";
import { expression } from "@maplibre/maplibre-gl-style-spec";
import tileID from "./tileID";

/**
 * Abstract base class handling MapLibre/Mapbox custom-layer plumbing
 * and common bookkeeping.
 */
export default class Layer {
  constructor(propertySpec, opts) {
    opts = opts || {};

    // Extract id/source without object rest/spread
    const id = opts.id;
    const source = opts.source;

    // Build `options` by copying everything except id/source
    const options = {};
    for (var k in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, k) && k !== "id" && k !== "source") {
        options[k] = opts[k];
      }
    }

    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";
    this.source = source;
    this.propertySpec = propertySpec;

    this._zoomUpdatable = {};
    this._propsOnInit = {};
    this.tileZoomOffset = 0;
    this._tiles = {};

    this.source.metadata(this.setWind.bind(this));

    // Initialize default values
    Object.keys(this.propertySpec).forEach(spec => {
      this.setProperty(spec, options[spec] || this.propertySpec[spec].default);
    });
  }

  /**
   * Update a property using a style expression.
   */
  setProperty(prop, value) {
    const spec = this.propertySpec[prop];
    if (!spec) return;
    const expr = expression.createPropertyExpression(value, spec);
    if (expr.result === "success") {
      switch (expr.value.kind) {
        case "camera":
        case "composite":
          return (this._zoomUpdatable[prop] = expr.value);
        default:
          if (this.map) {
            return this._setPropertyValue(prop, expr.value);
          } else {
            return (this._propsOnInit[prop] = expr.value);
          }
      }
    } else {
      throw new Error(expr.value);
    }
  }

  // Child classes can interact with style properties in 2 ways:
  // Either as a camelCased instance variable or by declaring a
  // setter function which receives the *expression* and evaluates it.
  _setPropertyValue(prop, value) {
    const name = prop
      .split("-")
      .map(a => a[0].toUpperCase() + a.slice(1))
      .join("");
    const setterName = "set" + name;
    if (this[setterName]) {
      this[setterName](value);
    } else {
      this[name[0].toLowerCase() + name.slice(1)] = value.evaluate({
        zoom: this.map && this.map.getZoom()
      });
    }
  }

  // Build a 16x16 color ramp texture for data-driven colors (GPU-friendly lookup)
  buildColorRamp(expr) {
    const colors = new Uint8Array(256 * 4);
    let range = 1;
    if (expr.kind === "source" || expr.kind === "composite") {
      const u = this.windData.uMax - this.windData.uMin;
      const v = this.windData.vMax - this.windData.vMin;
      range = Math.sqrt(u * u + v * v);
    }

    for (let i = 0; i < 256; i++) {
      const color = expr.evaluate(
        expr.kind === "constant" || expr.kind === "source"
          ? {}
          : { zoom: this.map.zoom },
        { properties: { speed: (i / 255) * range } }
      );
      colors[i * 4 + 0] = color.r * 255;
      colors[i * 4 + 1] = color.g * 255;
      colors[i * 4 + 2] = color.b * 255;
      colors[i * 4 + 3] = color.a * 255;
    }
    this.colorRampTexture = util.createTexture(
      this.gl,
      this.gl.LINEAR,
      colors,
      16,
      16
    );
  }

  // data management
  setWind(windData) {
    this.windData = windData;
    if (this.map) {
      this._initialize();
      this.map.triggerRepaint();
    }
  }

  computeVisibleTiles(pixelToGridRatio, tileSize, { maxzoom, minzoom }) {
    const pixels = this.gl.canvas.height * this.map.getZoom();
    const actualZoom = pixels / (tileSize * pixelToGridRatio);

    const practicalZoom = Math.max(
      Math.min(maxzoom, Math.floor(actualZoom)),
      minzoom
    );

    const bounds = this.map.getBounds();
    const tileCount = 2 ** practicalZoom;

    const top = Math.floor(((90 - bounds.getNorth()) / 180) * tileCount);
    const bottom = Math.ceil(((90 - bounds.getSouth()) / 180) * tileCount);
    const left = Math.floor(((bounds.getWest() + 180) / 360) * tileCount);
    const right = Math.ceil(((bounds.getEast() + 180) / 360) * tileCount);

    const tiles = [];
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        let properX = x % tileCount;
        if (properX < 0) properX += tileCount;
        tiles.push(
          tileID(practicalZoom, properX, y, Math.floor(x / tileCount))
        );
      }
    }
    return tiles;
  }

  tileLoaded(tile) {
    this._tiles[tile] = tile;
    this.map.triggerRepaint();
  }

  // lifecycle

  // called by MapLibre/Mapbox custom layer
  onAdd(map, gl) {
    this.gl = gl;
    this.map = map;
    if (this.windData) {
      this._initialize();
    }
  }

  // This runs once we have both GL context and data
  _initialize() {
    this.initialize(this.map, this.gl);
    Object.entries(this._propsOnInit).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
    this._propsOnInit = {};
    this.zoom();

    // bind/remove safely later
    this._onZoom = this.zoom.bind(this);
    this._onMove = this.move.bind(this);
    this.map.on("zoom", this._onZoom);
    this.map.on("move", this._onMove);
  }

  // Update zoom-dependent properties
  zoom() {
    Object.entries(this._zoomUpdatable).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
  }

  // Finds all tiles that should be loaded from the server. Overridden in subclasses if needed.
  computeLoadableTiles() {
    return this.computeVisibleTiles(
      this.pixelToGridRatio,
      Math.min(this.windData.width, this.windData.height),
      this.windData
    );
  }

  move() {
    const tiles = this.computeLoadableTiles();
    tiles.forEach(tile => {
      if (!this._tiles[tile]) {
        this.source.loadTile(tile, this.tileLoaded.bind(this));
      }
    });
  }

  // Called when the map is destroyed or the GL context is lost.
  onRemove(map) {
    if (this._onZoom) map.off("zoom", this._onZoom);
    if (this._onMove) map.off("move", this._onMove);
    delete this._onZoom;
    delete this._onMove;
    delete this.gl;
    delete this.map;
  }

  // called by MapLibre/Mapbox each frame
  render(gl, matrix) {
    if (!this.windData) return;
    this.computeVisibleTiles(
      this.pixelToGridRatio,
      Math.min(this.windData.width, this.windData.height),
      this.windData
    ).forEach(tile => {
      const texture = this._tiles[tile];
      if (!texture) return;
      this.draw(gl, matrix, texture, tile.viewMatrix());
    });
  }
}
