import * as util from "./util";
import Layer, { customLayerMatrix, isUnsupportedProjection } from "./layer";

import { particleUpdate, particleDraw } from "./shaders/particles.glsl";

/**
 * This layer simulates a particles system where the particles move according
 * to the forces of the wind. This is achieved in a two step rendering process:
 *
 * 1. First the particle positions are updated. These are stored in a texure
 *    where the BR channels encode x and AG encode the y position. The `update`
 *    function invokes a shader that updates the positions and renders them back
 *    into a texure. This whole simulation happens in global WSG84 coordinates.
 *
 * 2. In the `draw` phase, actual points are drawn on screen. Their positions
 *    are read from the texture and are projected into pseudo-mercator coordinates
 *    and their final position is computed based on the map viewport.
 */
class Particles extends Layer {
  constructor(options) {
    super(
      {
        "particle-color": {
          type: "color",
          default: "white",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "particle-speed": {
          type: "number",
          minimum: 0,
          default: 0.75,
          transition: true,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        },
        "particle-size": {
          type: "number",
          minimum: 0.1,
          default: 2.0,
          transition: true,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        },
        "particle-altitude": {
          type: "number",
          minimum: 0,
          default: 0,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        },
        "number-particles": {
          type: "number",
          minimum: 1,
          default: 65536,
          // Deliberately not zoom-dependent: changing the count reallocates the
          // index buffer and every particle state texture.
          expression: {
            interpolated: false,
            parameters: []
          },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.pixelToGridRatio = 20;
    // Opt in at construction: MapLibre chooses the depth mode before render().
    this.particleTerrain = !!options && options["particle-terrain"] === true;
    if (this.particleTerrain) this.renderingMode = "3d";
    this.terrainMapSize = 256;
    this.terrainBounds = [0, 0, 1, 1];
    this._terrainRevision = 0;
    this.tileSize = 1024;
    // Particle tiles may overzoom well past the data: the wind field is
    // interpolated, and a finer grid is what keeps particles inside the viewport
    // at high map zooms.
    this.maxParticleZoom = 20;

    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
    this._numParticles = 65536;
    // The requested count, before it is rounded up to a square texture.
    this._requestedParticles = 65536;
    // This layer manages 2 kinds of tiles: data tiles (the same as other layers) and particle state tiles
    this._particleTiles = {};
  }

  /**
   * Picks the zoom level for the particle simulation grid, so that one particle
   * tile covers roughly `tileSize * 2` screen pixels.
   *
   * MapLibre's world is `512 * 2^zoom` pixels across, so:
   *     2^particleZoom = worldPixels / (tileSize * 2)
   *
   * This has to track the map zoom, because the simulation works in coordinates
   * relative to the tile: a tile that is much larger than the viewport both spreads
   * the particles too thinly to see and makes them appear to move far too fast.
   * (The original heuristic, `canvas height * zoom`, stops tracking above roughly
   * zoom 6 and the layer goes blank.)
   */
  particleTileZoom() {
    const worldPixels = 512 * 2 ** this.map.getZoom();
    const zoom = Math.log2(worldPixels / (this.tileSize * 2));
    return Math.max(0, Math.min(this.maxParticleZoom, Math.floor(zoom)));
  }

  visibleParticleTiles() {
    return this.tilesForZoom(this.particleTileZoom());
  }

  setParticleColor(expr) {
    this.buildColorRamp(expr);
  }

  // Changing the count invalidates the index buffer and every particle state
  // texture, since those are sized from the resolution.
  setNumberParticles(expr) {
    const count = Math.max(1, Math.round(expr.evaluate({})));
    if (count === this._requestedParticles) return;
    this._requestedParticles = count;
    if (!this.gl) return; // initialize() will pick it up
    this.initializeParticles(this.gl, count);
    this.dropParticleTiles();
    this.move();
    this.map.triggerRepaint();
  }

  dropParticleTiles() {
    Object.keys(this._particleTiles).forEach(key => {
      const state = this._particleTiles[key];
      this.gl.deleteTexture(state.particleStateTexture0);
      this.gl.deleteTexture(state.particleStateTexture1);
      if (state.terrainTexture) this.gl.deleteTexture(state.terrainTexture);
      delete this._particleTiles[key];
    });
  }

  initializeParticleTile() {
    // textures to hold the particle state for the current and the next frame
    const particleStateTexture0 = util.createTexture(
      this.gl,
      this.gl.NEAREST,
      this._randomParticleState,
      this.particleStateResolution,
      this.particleStateResolution
    );
    const particleStateTexture1 = util.createTexture(
      this.gl,
      this.gl.NEAREST,
      this._randomParticleState,
      this.particleStateResolution,
      this.particleStateResolution
    );
    return { particleStateTexture0, particleStateTexture1, updated: false };
  }

  move() {
    super.move();
    const tiles = this.visibleParticleTiles();
    Object.keys(this._particleTiles).forEach(tile => {
      if (tiles.filter(t => t.toString() == tile).length === 0) {
        // cleanup - note `tile` is the string key, the state lives in the value
        const state = this._particleTiles[tile];
        this.gl.deleteTexture(state.particleStateTexture0);
        this.gl.deleteTexture(state.particleStateTexture1);
        if (state.terrainTexture) this.gl.deleteTexture(state.terrainTexture);
        delete this._particleTiles[tile];
      }
    });
    tiles.forEach(tile => {
      if (!this._particleTiles[tile]) {
        this._particleTiles[tile] = this.initializeParticleTile();
      }
    });
  }

  initializeParticles(gl, count) {
    const particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(count)
    ));
    this._numParticles = particleRes * particleRes;

    this._randomParticleState = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < this._randomParticleState.length; i++) {
      this._randomParticleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
    }

    const particleIndices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++) particleIndices[i] = i;
    if (this.particleIndexBuffer) gl.deleteBuffer(this.particleIndexBuffer);
    this.particleIndexBuffer = util.createBuffer(gl, particleIndices);
  }

  initialize(map, gl) {
    this.updateProgram = particleUpdate(gl);
    this.drawProgram = particleDraw(gl);

    this.framebuffer = gl.createFramebuffer();

    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.initializeParticles(gl, this._requestedParticles);

    this.nullTexture = util.createTexture(
      gl,
      gl.NEAREST,
      new Uint8Array([0, 0, 0, 0]),
      1,
      1
    );

    this.nullTile = {
      getTexture: () => this.nullTexture
    };
    this.terrainSupported = this.particleTerrain && !!gl.texStorage2D &&
      !!gl.getExtension("EXT_color_buffer_float");
    if (this.particleTerrain) {
      this._invalidateTerrain = () => { this._terrainRevision++; };
      for (const event of ["move", "sourcedata", "terrain"]) {
        map.on(event, this._invalidateTerrain);
      }
    }
  }

  updateTerrain(gl, args, tile, state) {
    this.terrainActive = this.particleTerrain && !!this.map.getTerrain();
    this.terrainReady = !this.terrainActive;
    if (!this.terrainActive) return;
    if (!this.terrainSupported || !args || !args.renderTerrainHeightMap) {
      if (!this._terrainWarning) {
        console.warn("windgl: terrain particles require MapLibre 6.13+ and EXT_color_buffer_float; particles are hidden while terrain is enabled.");
        this._terrainWarning = true;
      }
      return;
    }
    if (state.terrainRevision === this._terrainRevision) {
      this.terrainReady = true;
      return;
    }
    if (!state.terrainTexture) {
      state.terrainTexture = gl.createTexture();
      util.bindTexture(gl, state.terrainTexture, 11);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, this.terrainMapSize, this.terrainMapSize);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const offset = tile.viewMatrix(2);
    const mercatorY = y => {
      const latitude = 90 - 180 * y;
      const radians = Math.max(-85.051129, Math.min(85.051129, latitude)) * Math.PI / 180;
      return (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2;
    };
    // Local height maps retain mountain detail even when a low camera angle
    // stretches the viewport bounds far towards the horizon.
    state.terrainBounds = [
      offset[12], mercatorY(offset[13]),
      offset[12] + offset[0], mercatorY(offset[13] + offset[5])
    ];
    args.renderTerrainHeightMap({
      texture: state.terrainTexture, width: this.terrainMapSize,
      height: this.terrainMapSize, bounds: state.terrainBounds
    });
    state.terrainRevision = this._terrainRevision;
    this.terrainReady = true;
  }

  onRemove(map) {
    if (this._invalidateTerrain) {
      for (const event of ["move", "sourcedata", "terrain"]) {
        map.off(event, this._invalidateTerrain);
      }
      delete this._invalidateTerrain;
    }
    if (this.gl) this.dropParticleTiles();
    super.onRemove(map);
  }

  // This is a callback from mapbox for rendering into a texture
  prerender(gl, args) {
    if (this.windData) {
      if (isUnsupportedProjection(args)) return;
      const capabilities = [gl.BLEND, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.CULL_FACE, gl.SCISSOR_TEST];
      const enabled = capabilities.map(capability => gl.isEnabled(capability));
      const framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const viewport = gl.getParameter(gl.VIEWPORT);
      const colorMask = gl.getParameter(gl.COLOR_WRITEMASK);
      gl.colorMask(true, true, true, true);
      const tiles = this.visibleParticleTiles();
      tiles.forEach(tile => {
        const found = this.findAssociatedDataTiles(tile);
        if (found) {
          this.updateTerrain(gl, args, tile, this._particleTiles[tile]);
          // The height-map renderer uses MapLibre's VAOs and depth/stencil state.
          // Simulation draws into its own texture, not into the terrain.
          if (gl.bindVertexArray) gl.bindVertexArray(null);
          capabilities.forEach(capability => gl.disable(capability));
          gl.colorMask(true, true, true, true);
          this.update(gl, this._particleTiles[tile], found);
          this._particleTiles[tile].updated = true;
        }
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(...viewport);
      gl.colorMask(...colorMask);
      capabilities.forEach((capability, i) => {
        if (enabled[i]) gl.enable(capability);
        else gl.disable(capability);
      });
      this.map.triggerRepaint();
    }
  }

  /**
   * This method computes the ideal data tiles to support our particle tiles
   */
  computeLoadableTiles() {
    const result = {};
    const add = tile => (result[tile] = tile);
    this.visibleParticleTiles().forEach(tileID => {
      let t = tileID;
      let matrix = new DOMMatrix();
      while (!t.isRoot()) {
        if (t.z <= this.windData.maxzoom) break;
        const [x, y] = t.quadrant();
        matrix.translateSelf(0.5 * x, 0.5 * y);
        matrix.scaleSelf(0.5);
        t = t.parent();
      }

      matrix.translateSelf(-0.5, -0.5);
      matrix.scaleSelf(2, 2);

      const tl = matrix.transformPoint(new window.DOMPoint(0, 0));
      const br = matrix.transformPoint(new window.DOMPoint(1, 1));

      add(t);

      if (tl.x < 0 && tl.y < 0) add(t.neighbor(-1, -1));
      if (tl.x < 0) add(t.neighbor(-1, 0));
      if (tl.x < 0 && br.y > 1) add(t.neighbor(-1, 1));

      if (br.x > 1 && tl.y < 0) add(t.neighbor(1, -1));
      if (br.x > 1) add(t.neighbor(1, 0));
      if (br.x > 1 && br.y > 1) add(t.neighbor(1, 1));

      if (tl.y < 0) add(t.neighbor(0, -1));
      if (br.y > 1) add(t.neighbor(0, 1));
    });
    return Object.values(result);
  }

  findAssociatedDataTiles(tileID) {
    let t = tileID;
    let found;
    let matrix = new DOMMatrix();
    // Walk up towards the root looking for a loaded data tile. The root itself
    // has to be tested too, otherwise nothing ever renders at low zooms.
    for (;;) {
      if ((found = this._tiles[t])) break;
      if (t.isRoot()) break;
      const [x, y] = t.quadrant();
      matrix.translateSelf(0.5 * x, 0.5 * y);
      matrix.scaleSelf(0.5);
      t = t.parent();
    }
    if (!found) return;
    const tileTopLeft = this._tiles[found.neighbor(-1, -1)];
    const tileTopCenter = this._tiles[found.neighbor(0, -1)];
    const tileTopRight = this._tiles[found.neighbor(1, -1)];
    const tileMiddleLeft = this._tiles[found.neighbor(-1, 0)];
    const tileMiddleCenter = found;
    const tileMiddleRight = this._tiles[found.neighbor(1, 0)];
    const tileBottomLeft = this._tiles[found.neighbor(-1, 1)];
    const tileBottomCenter = this._tiles[found.neighbor(0, 1)];
    const tileBottomRight = this._tiles[found.neighbor(1, 1)];
    matrix.translateSelf(-0.5, -0.5);
    matrix.scaleSelf(2, 2);

    const tl = matrix.transformPoint(new window.DOMPoint(0, 0));
    const br = matrix.transformPoint(new window.DOMPoint(1, 1));

    if (!tileMiddleCenter) return;

    if (tl.x < 0 && tl.y < 0 && !tileTopLeft) return;
    if (tl.x < 0 && !tileMiddleLeft) return;
    if (tl.x < 0 && br.y > 1 && !tileBottomLeft) return;

    if (br.x > 1 && tl.y < 0 && !tileTopRight) return;
    if (br.x > 1 && !tileMiddleRight) return;
    if (br.x > 1 && br.y > 1 && !tileBottomRight) return;

    if (tl.y < 0 && !tileTopCenter) return;
    if (br.y > 1 && !tileBottomCenter) return;

    return {
      matrix: matrix.toFloat32Array(),
      tileTopLeft: tileTopLeft || this.nullTile,
      tileTopCenter: tileTopCenter || this.nullTile,
      tileTopRight: tileTopRight || this.nullTile,
      tileMiddleLeft: tileMiddleLeft || this.nullTile,
      tileMiddleCenter: tileMiddleCenter,
      tileMiddleRight: tileMiddleRight || this.nullTile,
      tileBottomLeft: tileBottomLeft || this.nullTile,
      tileBottomCenter: tileBottomCenter || this.nullTile,
      tileBottomRight: tileBottomRight || this.nullTile
    };
  }

  update(gl, tile, data) {
    util.bindFramebuffer(gl, this.framebuffer, tile.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution
    );

    const program = this.updateProgram;
    gl.useProgram(program.program);

    util.bindTexture(gl, tile.particleStateTexture0, 0);

    util.bindTexture(gl, data.tileTopLeft.getTexture(gl), 1);
    util.bindTexture(gl, data.tileTopCenter.getTexture(gl), 2);
    util.bindTexture(gl, data.tileTopRight.getTexture(gl), 3);
    util.bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 4);
    util.bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 5);
    util.bindTexture(gl, data.tileMiddleRight.getTexture(gl), 6);
    util.bindTexture(gl, data.tileBottomLeft.getTexture(gl), 7);
    util.bindTexture(gl, data.tileBottomCenter.getTexture(gl), 8);
    util.bindTexture(gl, data.tileBottomRight.getTexture(gl), 9);

    gl.uniform1i(program.u_particles, 0);

    gl.uniform1i(program.u_wind_top_left, 1);
    gl.uniform1i(program.u_wind_top_center, 2);
    gl.uniform1i(program.u_wind_top_right, 3);
    gl.uniform1i(program.u_wind_middle_left, 4);
    gl.uniform1i(program.u_wind_middle_center, 5);
    gl.uniform1i(program.u_wind_middle_right, 6);
    gl.uniform1i(program.u_wind_bottom_left, 7);
    gl.uniform1i(program.u_wind_bottom_center, 8);
    gl.uniform1i(program.u_wind_bottom_right, 9);

    util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_speed_factor, this.particleSpeed);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
    gl.uniform1i(program.u_initialize, +!tile.updated);
    gl.uniformMatrix4fv(program.u_data_matrix, false, data.matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // swap the particle state textures so the new one becomes the current one
    const temp = tile.particleStateTexture0;
    tile.particleStateTexture0 = tile.particleStateTexture1;
    tile.particleStateTexture1 = temp;
  }

  render(gl, args) {
    if (this.windData) {
      if (this.warnOnUnsupportedProjection(args)) return;
      if (this.terrainActive && !this.terrainReady) return;
      const matrix = customLayerMatrix(args);
      this.visibleParticleTiles().forEach(tile => {
        const found = this.findAssociatedDataTiles(tile);
        if (!found) return;

        this.draw(
          gl,
          matrix,
          this._particleTiles[tile],
          tile.viewMatrix(2),
          found
        );
      });
    }
  }

  draw(gl, matrix, tile, offset, data) {
    const program = this.drawProgram;
    gl.useProgram(program.program);
    util.bindTexture(gl, tile.particleStateTexture0, 0);
    util.bindTexture(gl, data.tileTopLeft.getTexture(gl), 1);
    util.bindTexture(gl, data.tileTopCenter.getTexture(gl), 2);
    util.bindTexture(gl, data.tileTopRight.getTexture(gl), 3);
    util.bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 4);
    util.bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 5);
    util.bindTexture(gl, data.tileMiddleRight.getTexture(gl), 6);
    util.bindTexture(gl, data.tileBottomLeft.getTexture(gl), 7);
    util.bindTexture(gl, data.tileBottomCenter.getTexture(gl), 8);
    util.bindTexture(gl, data.tileBottomRight.getTexture(gl), 9);
    util.bindTexture(gl, this.colorRampTexture, 10);
    util.bindTexture(gl, tile.terrainTexture || this.nullTexture, 11);

    util.bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);

    gl.uniform1i(program.u_particles, 0);
    gl.uniform1i(program.u_wind_top_left, 1);
    gl.uniform1i(program.u_wind_top_center, 2);
    gl.uniform1i(program.u_wind_top_right, 3);
    gl.uniform1i(program.u_wind_middle_left, 4);
    gl.uniform1i(program.u_wind_middle_center, 5);
    gl.uniform1i(program.u_wind_middle_right, 6);
    gl.uniform1i(program.u_wind_bottom_left, 7);
    gl.uniform1i(program.u_wind_bottom_center, 8);
    gl.uniform1i(program.u_wind_bottom_right, 9);
    gl.uniform1i(program.u_color_ramp, 10);
    gl.uniform1i(program.u_terrain, 11);
    gl.uniform1i(program.u_terrain_enabled, +!!this.terrainActive);
    gl.uniform4fv(program.u_terrain_bounds, tile.terrainBounds || this.terrainBounds);
    gl.uniform1f(program.u_terrain_size, this.terrainMapSize);
    gl.uniform1f(program.u_particle_altitude, this.particleAltitude);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);

    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniformMatrix4fv(
      program.u_offset_inverse,
      false,
      util.matrixInverse(offset)
    );

    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);
    gl.uniformMatrix4fv(program.u_data_matrix, false, data.matrix);

    gl.uniform1f(program.u_particle_size, this.particleSize);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }
}

export default options => new Particles(options);
