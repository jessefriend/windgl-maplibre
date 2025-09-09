'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var maplibreGlStyleSpec = require('@maplibre/maplibre-gl-style-spec');

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);

  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  var program = gl.createProgram();

  var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  var wrapper = { program: program };

  var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (var i = 0; i < numAttributes; i++) {
    var attribute = gl.getActiveAttrib(program, i);
    wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
  }
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (var i$1 = 0; i$1 < numUniforms; i$1++) {
    var uniform = gl.getActiveUniform(program, i$1);
    wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
  }

  return wrapper;
}

function createTexture(gl, filter, data, width, height) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  if (data instanceof Uint8Array) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function bindTexture(gl, texture, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function createBuffer(gl, data) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function bindAttribute(gl, buffer, attribute, numComponents) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

function bindFramebuffer(gl, framebuffer, texture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  if (texture) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
  }
}

function matrixInverse(matrix) {
  return new window.DOMMatrixReadOnly(matrix).inverse().toFloat32Array();
}

var tile2WSG84 = function (c, z) { return c / Math.pow(2, z); };

var tile = function (z, x, y, wrap) {
  if ( wrap === void 0 ) wrap = 0;

  return ({
  z: z,
  x: x,
  y: y,
  wrap: wrap,
  toString: function toString() {
    return (z + "/" + x + "/" + y);
  },
  parent: function parent() {
    if (z > 0) { return tile(z - 1, x >> 1, y >> 1, wrap); }
    else { return tile(z, x, y, wrap); }
  },
  children: function children() {
    return [
      tile(z + 1, x * 2, y * 2, wrap),
      tile(z + 1, x * 2 + 1, y * 2, wrap),
      tile(z + 1, x * 2 + 1, y * 2 + 1, wrap),
      tile(z + 1, x * 2, y * 2 + 1, wrap)
    ];
  },
  siblings: function siblings() {
    var this$1$1 = this;

    return z === 0
      ? []
      : this.parent()
          .children()
          .filter(function (t) { return !this$1$1.isEqual(t); });
  },
  isEqual: function isEqual(other) {
    other.x === x && other.y === y && other.z === z && other.wrap === wrap;
  },
  wgs84UnitBounds: function wgs84UnitBounds() {
    return [
      tile2WSG84(x, z),
      tile2WSG84(y, z),
      tile2WSG84(x + 1, z),
      tile2WSG84(y + 1, z)
    ];
  },
  viewMatrix: function viewMatrix(scale) {
    if ( scale === void 0 ) scale = 1;

    return new window.DOMMatrix()
      .translate(
        tile2WSG84(x, z) + wrap - tile2WSG84((scale - 1) / 2, z),
        tile2WSG84(y, z) - tile2WSG84((scale - 1) / 2, z)
      )
      .scale(
        (tile2WSG84(x + 1, z) - tile2WSG84(x, z)) * scale,
        (tile2WSG84(y + 1, z) - tile2WSG84(y, z)) * scale
      )
      .toFloat32Array();
  },
  isRoot: function isRoot() {
    return z === 0;
  },
  neighbor: function neighbor(hor, ver) {
    if (z === 0) {
      return tile(0, 0, 0, wrap + hor);
    }
    var max = Math.pow(2, z);
    return tile(
      z,
      (x + hor + max) % max,
      (y + ver + max) % max,
      x + hor < 0 ? wrap - 1 : x + hor > max ? wrap + 1 : wrap
    );
  },
  quadrant: function quadrant() {
    return [x % 2, y % 2];
  }
});
};

var tileID = tile;

/**
 * Abstract base class handling MapLibre/Mapbox custom-layer plumbing
 * and common bookkeeping.
 */
var Layer = function Layer(propertySpec, opts) {
  var this$1$1 = this;

  opts = opts || {};

  // Extract id/source without object rest/spread
  var id = opts.id;
  var source = opts.source;

  // Build `options` by copying everything except id/source
  var options = {};
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
  Object.keys(this.propertySpec).forEach(function (spec) {
    this$1$1.setProperty(spec, options[spec] || this$1$1.propertySpec[spec].default);
  });
};

/**
 * Update a property using a style expression.
 */
Layer.prototype.setProperty = function setProperty (prop, value) {
  var spec = this.propertySpec[prop];
  if (!spec) { return; }
  var expr = maplibreGlStyleSpec.expression.createPropertyExpression(value, spec);
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
};

// Child classes can interact with style properties in 2 ways:
// Either as a camelCased instance variable or by declaring a
// setter function which receives the *expression* and evaluates it.
Layer.prototype._setPropertyValue = function _setPropertyValue (prop, value) {
  var name = prop
    .split("-")
    .map(function (a) { return a[0].toUpperCase() + a.slice(1); })
    .join("");
  var setterName = "set" + name;
  if (this[setterName]) {
    this[setterName](value);
  } else {
    this[name[0].toLowerCase() + name.slice(1)] = value.evaluate({
      zoom: this.map && this.map.getZoom()
    });
  }
};

// Build a 16x16 color ramp texture for data-driven colors (GPU-friendly lookup)
Layer.prototype.buildColorRamp = function buildColorRamp (expr) {
  var colors = new Uint8Array(256 * 4);
  var range = 1;
  if (expr.kind === "source" || expr.kind === "composite") {
    var u = this.windData.uMax - this.windData.uMin;
    var v = this.windData.vMax - this.windData.vMin;
    range = Math.sqrt(u * u + v * v);
  }

  for (var i = 0; i < 256; i++) {
    var color = expr.evaluate(
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
  this.colorRampTexture = createTexture(
    this.gl,
    this.gl.LINEAR,
    colors,
    16,
    16
  );
};

// data management
Layer.prototype.setWind = function setWind (windData) {
  this.windData = windData;
  if (this.map) {
    this._initialize();
    this.map.triggerRepaint();
  }
};

Layer.prototype.computeVisibleTiles = function computeVisibleTiles (pixelToGridRatio, tileSize, ref) {
    var maxzoom = ref.maxzoom;
    var minzoom = ref.minzoom;

  var pixels = this.gl.canvas.height * this.map.getZoom();
  var actualZoom = pixels / (tileSize * pixelToGridRatio);

  var practicalZoom = Math.max(
    Math.min(maxzoom, Math.floor(actualZoom)),
    minzoom
  );

  var bounds = this.map.getBounds();
  var tileCount = Math.pow( 2, practicalZoom );

  var top = Math.floor(((90 - bounds.getNorth()) / 180) * tileCount);
  var bottom = Math.ceil(((90 - bounds.getSouth()) / 180) * tileCount);
  var left = Math.floor(((bounds.getWest() + 180) / 360) * tileCount);
  var right = Math.ceil(((bounds.getEast() + 180) / 360) * tileCount);

  var tiles = [];
  for (var y = top; y < bottom; y++) {
    for (var x = left; x < right; x++) {
      var properX = x % tileCount;
      if (properX < 0) { properX += tileCount; }
      tiles.push(
        tileID(practicalZoom, properX, y, Math.floor(x / tileCount))
      );
    }
  }
  return tiles;
};

Layer.prototype.tileLoaded = function tileLoaded (tile) {
  this._tiles[tile] = tile;
  this.map.triggerRepaint();
};

// lifecycle

// called by MapLibre/Mapbox custom layer
Layer.prototype.onAdd = function onAdd (map, gl) {
  this.gl = gl;
  this.map = map;
  if (this.windData) {
    this._initialize();
  }
};

// This runs once we have both GL context and data
Layer.prototype._initialize = function _initialize () {
    var this$1$1 = this;

  this.initialize(this.map, this.gl);
  Object.entries(this._propsOnInit).forEach(function (ref) {
      var k = ref[0];
      var v = ref[1];

    this$1$1._setPropertyValue(k, v);
  });
  this._propsOnInit = {};
  this.zoom();

  // bind/remove safely later
  this._onZoom = this.zoom.bind(this);
  this._onMove = this.move.bind(this);
  this.map.on("zoom", this._onZoom);
  this.map.on("move", this._onMove);
};

// Update zoom-dependent properties
Layer.prototype.zoom = function zoom () {
    var this$1$1 = this;

  Object.entries(this._zoomUpdatable).forEach(function (ref) {
      var k = ref[0];
      var v = ref[1];

    this$1$1._setPropertyValue(k, v);
  });
};

// Finds all tiles that should be loaded from the server. Overridden in subclasses if needed.
Layer.prototype.computeLoadableTiles = function computeLoadableTiles () {
  return this.computeVisibleTiles(
    this.pixelToGridRatio,
    Math.min(this.windData.width, this.windData.height),
    this.windData
  );
};

Layer.prototype.move = function move () {
    var this$1$1 = this;

  var tiles = this.computeLoadableTiles();
  tiles.forEach(function (tile) {
    if (!this$1$1._tiles[tile]) {
      this$1$1.source.loadTile(tile, this$1$1.tileLoaded.bind(this$1$1));
    }
  });
};

// Called when the map is destroyed or the GL context is lost.
Layer.prototype.onRemove = function onRemove (map) {
  if (this._onZoom) { map.off("zoom", this._onZoom); }
  if (this._onMove) { map.off("move", this._onMove); }
  delete this._onZoom;
  delete this._onMove;
  delete this.gl;
  delete this.map;
};

// called by MapLibre/Mapbox each frame
Layer.prototype.render = function render (gl, matrix) {
    var this$1$1 = this;

  if (!this.windData) { return; }
  this.computeVisibleTiles(
    this.pixelToGridRatio,
    Math.min(this.windData.width, this.windData.height),
    this.windData
  ).forEach(function (tile) {
    var texture = this$1$1._tiles[tile];
    if (!texture) { return; }
    this$1$1.draw(gl, matrix, texture, tile.viewMatrix());
  });
};

var Layer$1 = Layer;

var sampleFill$1 = function (gl) { return createProgram(gl, "precision mediump float;vec2 i(vec2 b){float a=-180.*b.y+90.;a=(180.-57.29578*log(tan(.785398+a*3.141593/360.)))/360.;return vec2(b.x,a);}vec2 f(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform mat4 u_matrix,u_offset;attribute vec2 a_pos;varying vec2 g;void main(){vec2 b=f(a_pos,u_offset),a=i(b);g=a,gl_Position=u_matrix*vec4(a,0,1);}", "precision mediump float;vec2 j(vec2 b){float a=radians(180.-b.y*360.);a=114.591559*atan(exp(a))-90.,a=a/-180.+.5;return vec2(b.x,a);}vec2 f(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform vec2 u_wind_res,u_wind_min,u_wind_max;uniform float u_opacity;uniform sampler2D u_wind,u_color_ramp;uniform mat4 u_offset_inverse;varying vec2 g;vec2 d(const vec2 a){return texture2D(u_wind,a).rg;}vec2 k(const vec2 e){vec2 a=1./u_wind_res,b=floor(e*u_wind_res)*a,c=fract(e*u_wind_res),h=d(b),l=d(b+vec2(a.x,0)),m=d(b+vec2(0,a.y)),n=d(b+a);return mix(mix(h,l,c.x),mix(m,n,c.x),c.y);}vec2 o(const vec2 a){return mix(u_wind_min,u_wind_max,k(a));}float p(const vec2 a){return length(o(a))/length(u_wind_max);}void main(){vec2 b=j(g),c=f(b,u_offset_inverse);float a=p(c);vec2 e=vec2(fract(16.*a),floor(16.*a)/16.);vec4 h=texture2D(u_color_ramp,e);gl_FragColor=vec4(floor(255.*h*u_opacity)/255.);}"); };

var SampleFill = /*@__PURE__*/(function (Layer) {
  function SampleFill(options) {
    Layer.call(
      this, {
        "sample-fill-color": {
          type: "color",
          default: [
            "interpolate",
            ["linear"],
            ["get", "speed"],
            0.0,
            "#3288bd",
            10,
            "#66c2a5",
            20,
            "#abdda4",
            30,
            "#e6f598",
            40,
            "#fee08b",
            50,
            "#fdae61",
            60,
            "#f46d43",
            100.0,
            "#d53e4f"
          ],
          doc: "The color of each pixel of this layer",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "sample-opacity": {
          type: "number",
          default: 1,
          minimum: 0,
          maximum: 1,
          transition: true,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.pixelToGridRatio = 20;
  }

  if ( Layer ) SampleFill.__proto__ = Layer;
  SampleFill.prototype = Object.create( Layer && Layer.prototype );
  SampleFill.prototype.constructor = SampleFill;

  SampleFill.prototype.initialize = function initialize (map, gl) {
    this.backgroundProgram = sampleFill$1(gl);

    this.quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );
  };

  SampleFill.prototype.setSampleFillColor = function setSampleFillColor (expr) {
    this.buildColorRamp(expr);
  };

  SampleFill.prototype.draw = function draw (gl, matrix, tile, offset) {
    var opacity = this.sampleOpacity;
    var program = this.backgroundProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    bindTexture(gl, tile.getTexture(gl), 0);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_opacity, opacity);
    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniformMatrix4fv(
      program.u_offset_inverse,
      false,
      matrixInverse(offset)
    );
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return SampleFill;
}(Layer$1));

function sampleFill (options) { return new SampleFill(options); }

var particleUpdate = function (gl) { return createProgram(gl, "precision highp float;const vec3 i=vec3(12.9898,78.233,4375.85453);attribute vec2 a_pos;varying vec2 l;void main(){l=a_pos,gl_Position=vec4(1.-2.*a_pos,0.,1.);}", "precision highp float;vec2 k(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_particles,u_wind_top_left,u_wind_top_center,u_wind_top_right,u_wind_middle_left,u_wind_middle_center,u_wind_middle_right,u_wind_bottom_left,u_wind_bottom_center,u_wind_bottom_right;uniform bool u_initialize;uniform mat4 u_data_matrix;uniform float u_rand_seed,u_speed_factor,u_drop_rate,u_drop_rate_bump;uniform vec2 u_wind_res,u_wind_min,u_wind_max;const vec3 i=vec3(12.9898,78.233,4375.85453);float m(const vec2 b){float a=dot(i.xy,b);return fract(sin(a)*(i.z+a));}vec2 e(const vec2 a){return a.x>1.&&a.y>1.?texture2D(u_wind_bottom_right,a-vec2(1.,1.)).rg:a.x>0.&&a.y>1.?texture2D(u_wind_bottom_center,a-vec2(0.,1.)).rg:a.y>1.?texture2D(u_wind_bottom_left,a-vec2(-1.,1.)).rg:a.x>1.&&a.y>0.?texture2D(u_wind_middle_right,a-vec2(1.,0.)).rg:a.x>0.&&a.y>0.?texture2D(u_wind_middle_center,a-vec2(0.,0.)).rg:a.y>0.?texture2D(u_wind_middle_left,a-vec2(-1.,0.)).rg:a.x>1.?texture2D(u_wind_top_right,a-vec2(1.,-1.)).rg:a.x>0.?texture2D(u_wind_top_center,a-vec2(0.,-1.)).rg:texture2D(u_wind_top_left,a-vec2(-1.,-1.)).rg;}vec2 n(const vec2 d){vec2 a=1./u_wind_res,b=floor(d*u_wind_res)*a,c=fract(d*u_wind_res),f=e(b),g=e(b+vec2(a.x,0)),h=e(b+vec2(0,a.y)),j=e(b+a);return mix(mix(f,g,c.x),mix(h,j,c.x),c.y);}vec2 o(vec4 a){return vec2(a.r/255.+a.b,a.g/255.+a.a);}varying vec2 l;vec2 s(vec2 a){vec2 d=k(a,u_data_matrix),b=mix(u_wind_min,u_wind_max,n(d));float f=length(b)/max(1e-6,length(u_wind_max));vec2 g=vec2(b.x,-b.y)*1e-4*u_speed_factor;a=fract(1.+a+g);vec2 c=(a+l)*u_rand_seed;float h=u_drop_rate+f*u_drop_rate_bump+smoothstep(.24,.5,length(a-vec2(.5))*.7),j=step(1.-h,m(c));vec2 p=vec2(.5*m(c+1.3)+.25,.5*m(c+2.1)+.25);return mix(a,p,j);}void main(){vec4 c=texture2D(u_particles,l);vec2 a=o(c);a=s(a);if(u_initialize)for(int b=0;b<100;b++)a=s(a);gl_FragColor=vec4(fract(a*255.),floor(a*255.)/255.);}"); };

var particleDraw = function (gl) { return createProgram(gl, "precision highp float;vec2 t(vec2 b){float a=-180.*b.y+90.;a=(180.-57.29578*log(tan(.785398+a*3.141593/360.)))/360.;return vec2(b.x,a);}vec2 k(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_particles;uniform mat4 u_matrix,u_offset;uniform float u_particles_res,u_particle_size;const vec3 i=vec3(12.9898,78.233,4375.85453);vec2 o(vec4 a){return vec2(a.r/255.+a.b,a.g/255.+a.a);}attribute float a_index;varying vec2 q;void main(){float a=u_particles_res;vec2 c=vec2(fract(a_index/a),floor(a_index/a)/a);vec4 d=texture2D(u_particles,c);vec2 b=o(d),f=k(b,u_offset),g=t(f);vec4 h=u_matrix*vec4(g,0.,1.);gl_Position=h,gl_PointSize=max(1.,u_particle_size),q=b;}", "precision highp float;vec2 k(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_color_ramp,u_wind_top_left,u_wind_top_center,u_wind_top_right,u_wind_middle_left,u_wind_middle_center,u_wind_middle_right,u_wind_bottom_left,u_wind_bottom_center,u_wind_bottom_right;uniform mat4 u_data_matrix;uniform vec2 u_wind_res,u_wind_min,u_wind_max;const vec3 i=vec3(12.9898,78.233,4375.85453);vec2 e(const vec2 a){return a.x>1.&&a.y>1.?texture2D(u_wind_bottom_right,a-vec2(1.,1.)).rg:a.x>0.&&a.y>1.?texture2D(u_wind_bottom_center,a-vec2(0.,1.)).rg:a.y>1.?texture2D(u_wind_bottom_left,a-vec2(-1.,1.)).rg:a.x>1.&&a.y>0.?texture2D(u_wind_middle_right,a-vec2(1.,0.)).rg:a.x>0.&&a.y>0.?texture2D(u_wind_middle_center,a-vec2(0.,0.)).rg:a.y>0.?texture2D(u_wind_middle_left,a-vec2(-1.,0.)).rg:a.x>1.?texture2D(u_wind_top_right,a-vec2(1.,-1.)).rg:a.x>0.?texture2D(u_wind_top_center,a-vec2(0.,-1.)).rg:texture2D(u_wind_top_left,a-vec2(-1.,-1.)).rg;}vec2 n(const vec2 d){vec2 a=1./u_wind_res,b=floor(d*u_wind_res)*a,c=fract(d*u_wind_res),f=e(b),g=e(b+vec2(a.x,0)),h=e(b+vec2(0,a.y)),j=e(b+a);return mix(mix(f,g,c.x),mix(h,j,c.x),c.y);}varying vec2 q;uniform float u_alpha;void main(){vec2 f=gl_PointCoord*2.-1.;float a=length(f),g=smoothstep(1.,.5,a),h=smoothstep(1.,.2,a)*.6,j=smoothstep(1.,0.,a)*.2,c=g*.4+h+j;if(c<=5e-3)discard;vec2 p=k(q,u_data_matrix),u=mix(u_wind_min,u_wind_max,n(p));float d=clamp(length(u)/max(1e-6,length(u_wind_max)),0.,1.);vec2 v=vec2(fract(16.*d),floor(16.*d)/16.);vec4 w=texture2D(u_color_ramp,v);float b=c*u_alpha;if(b<3e-3)discard;gl_FragColor=vec4(w.rgb*b,b);}"); };

var trailFade = function (gl) { return createProgram(gl, "precision highp float;const vec3 i=vec3(12.9898,78.233,4375.85453);attribute vec2 a_position;varying vec2 r;void main(){r=a_position*.5+.5,gl_Position=vec4(a_position,0.,1.);}", "precision highp float;const vec3 i=vec3(12.9898,78.233,4375.85453);uniform sampler2D u_texture;uniform float u_fade,u_bias,u_cutoff;varying vec2 r;void main(){vec4 a=texture2D(u_texture,r);float b=a.a*u_fade-u_bias;b=floor(b*1000.)/1000.,a.a=max(0.,b),a.rgb*=u_fade;if(a.a<u_cutoff)discard;if(a.a<.01)a.a=0.,a.rgb=vec3(0.);gl_FragColor=a;}"); };

/**
 * Weatherlayers-style trails:
 * - Particle heads are rendered as POINTS each frame
 * - Trails are accumulated in an offscreen FBO (trailTexture)
 * - Fade is time-based: multiply by exp(-dt/tau) and subtract a small bias*dt
 * - Composite back to the map with premultiplied alpha
 */
var Particles = /*@__PURE__*/(function (Layer) {
  function Particles(options) {
    Layer.call(
      this, {
        "particle-color": {
          type: "color",
          default: "white",
          expression: { interpolated: true, parameters: ["zoom", "feature"] },
          "property-type": "data-driven",
        },
        "particle-speed": {
          type: "number",
          minimum: 0,
          default: 0.75,
          transition: true,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant",
        },
        "particle-size": {
          type: "number",
          minimum: 0.1,
          default: 2.0,
          transition: true,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant",
        },
        "particle-trail": {
          // Visual intensity/persistence knob (0..1)
          type: "number",
          minimum: 0.01,
          maximum: 1.0,
          default: 0.3,
          transition: true,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant",
        },
        "trail-substeps": {
          type: "number",
          minimum: 1,
          maximum: 20,
          default: 8,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant",
        },
        "number-particles": {
          type: "number",
          minimum: 1000,
          maximum: 100000,
          default: 10000,
          expression: { interpolated: false, parameters: [] },
          "property-type": "data-constant",    
        },
      },
      options
    );

    this.pixelToGridRatio = 20;
    this.tileSize = 1024;

    this.dropRate = 0.003;
    this.dropRateBump = 0.01;    

    this._particleTiles = {};

    // time-base for fade
    this._fadePrevTime = null;
  }

  if ( Layer ) Particles.__proto__ = Layer;
  Particles.prototype = Object.create( Layer && Layer.prototype );
  Particles.prototype.constructor = Particles;

  Particles.prototype.visibleParticleTiles = function visibleParticleTiles () {
    return this.computeVisibleTiles(2, this.tileSize, {
      minzoom: 0,
      maxzoom: this.windData.maxzoom + 3,
    });
  };

  Particles.prototype.setParticleColor = function setParticleColor (expr) {
    this.buildColorRamp(expr);
  };

  Particles.prototype.initializeParticleTile = function initializeParticleTile () {
    var particleStateTexture0 = createTexture(
      this.gl,
      this.gl.NEAREST,
      this._randomParticleState,
      this.particleStateResolution,
      this.particleStateResolution
    );
    var particleStateTexture1 = createTexture(
      this.gl,
      this.gl.NEAREST,
      this._randomParticleState,
      this.particleStateResolution,
      this.particleStateResolution
    );
    return { particleStateTexture0: particleStateTexture0, particleStateTexture1: particleStateTexture1, updated: false };
  };

  Particles.prototype.move = function move () {
    Layer.prototype.move.call(this);
    var tiles = this.visibleParticleTiles();

    // dispose offscreen textures for tiles that left view
    var keys = Object.keys(this._particleTiles);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var stillVisible = false;
      for (var i = 0; i < tiles.length; i++) {
        if (tiles[i].toString() === key) {
          stillVisible = true;
          break;
        }
      }
      if (!stillVisible) {
        var p = this._particleTiles[key];
        this.gl.deleteTexture(p.particleStateTexture0);
        this.gl.deleteTexture(p.particleStateTexture1);
        delete this._particleTiles[key];
      }
    }

    // allocate new tiles
    for (var j = 0; j < tiles.length; j++) {
      var tile = tiles[j];
      if (!this._particleTiles[tile]) {
        this._particleTiles[tile] = this.initializeParticleTile();
      }
    }
  };

  Particles.prototype.initializeParticles = function initializeParticles (gl, count) {    
    var particleRes = (this.particleStateResolution = Math.ceil(Math.sqrt(count)));
    this._numParticles = particleRes * particleRes;

    this._randomParticleState = new Uint8Array(this._numParticles * 4);
    for (var i = 0; i < this._randomParticleState.length; i++) {
      this._randomParticleState[i] = Math.floor(Math.random() * 256);
    }

    var particleIndices = new Float32Array(this._numParticles);
    for (var i$1 = 0; i$1 < this._numParticles; i$1++) { particleIndices[i$1] = i$1; }
    this.particleIndexBuffer = createBuffer(gl, particleIndices);
  };

  Particles.prototype.initialize = function initialize (map, gl) {
    var this$1$1 = this;
 
    this.updateProgram = particleUpdate(gl);
    this.drawProgram = particleDraw(gl);
    this.fadeProgram = trailFade(gl);

    this.framebuffer = gl.createFramebuffer();

    this._particlesInitialized = false;

    // Quad for particle update pass
    this.quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    // Fullscreen quad for fade/composite
    this.fadeQuadBuffer = createBuffer(
      gl,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    );

    this.nullTexture = createTexture(gl, gl.NEAREST, new Uint8Array([0, 0, 0, 0]), 1, 1);
    this.nullTile = { getTexture: function () { return this$1$1.nullTexture; } };

    // Trail FBOs
    this.setupTrailRendering(gl);

    // Clear trails when camera/view changes
    var self = this;
    this._clearTrails = function () {
      if (!self.trailFramebuffer || !self.tempTrailFramebuffer) { return; }
      var vp = gl.getParameter(gl.VIEWPORT);
      var fbos = [self.trailFramebuffer, self.tempTrailFramebuffer];
      for (var fi = 0; fi < fbos.length; fi++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[fi]);
        gl.disable(gl.SCISSOR_TEST);
        gl.colorMask(true, true, true, true);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(vp[0], vp[1], vp[2], vp[3]);
      self._trailReadyFrames = 0;
      self._frameCount = 0; // Reset frame counter
    };
    ["movestart", "zoomstart", "rotatestart", "pitchstart", "styledata", "resize", "sourcedata", "moveend", "zoomend"].forEach(
      function (evt) { return map.on(evt, this$1$1._clearTrails); }
    );

    // Transparent clears
    gl.clearColor(0, 0, 0, 0);

    // Color ramp bootstrap (fallback to white ramp)
    if (!this.colorRampTexture) {
      try {
        this.setParticleColor(this.properties["particle-color"].default);
      } catch (e) {
        var ramp = new Uint8Array(256 * 4);
        for (var i = 0; i < 256; i++) {
          ramp[i * 4 + 0] = 255;
          ramp[i * 4 + 1] = 255;
          ramp[i * 4 + 2] = 255;
          ramp[i * 4 + 3] = 255;
        }
        this.colorRampTexture = createTexture(gl, gl.LINEAR, ramp, 256, 1);
      }
    }

    this._onResize = function () { return this$1$1.setupTrailRendering(gl); };
    map.on("resize", this._onResize);

    // Keep references
    this.gl = gl;
    this._fadePrevTime =
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  };

  Particles.prototype.setupTrailRendering = function setupTrailRendering (gl) {
    var canvas = gl.canvas;
    // Much more aggressive resolution scaling for high zooms
    var currentZoom = this.map && this.map.getZoom ? this.map.getZoom() : 0;
    
    // Enhanced scaling curve - goes up to 6x at very high zooms
    var resolutionScale;
    if (currentZoom <= 6) {
      resolutionScale = Math.max(1.0, 1.0 + (currentZoom / 6.0)); // 1x to 2x
    } else if (currentZoom <= 12) {
      resolutionScale = 2.0 + ((currentZoom - 6) / 6.0) * 2.0; // 2x to 4x
    } else {
      resolutionScale = 4.0 + Math.min(2.0, (currentZoom - 12) / 4.0 * 2.0); // 4x to 6x
    }
    
    var width = Math.max(1, Math.floor(canvas.width * resolutionScale));
    var height = Math.max(1, Math.floor(canvas.height * resolutionScale));

    // cleanup old
    if (this.trailTexture) {
      gl.deleteTexture(this.trailTexture);
      gl.deleteTexture(this.tempTrailTexture);
      gl.deleteFramebuffer(this.trailFramebuffer);
      gl.deleteFramebuffer(this.tempTrailFramebuffer);
    }

    function mkTex() {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Use LINEAR filtering to smooth out pixelation
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      return tex;
    }

    this.trailTexture = mkTex();
    this.tempTrailTexture = mkTex();

    this.trailFramebuffer = gl.createFramebuffer();
    this.tempTrailFramebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.trailTexture,
      0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.tempTrailTexture,
      0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this._trailWidth = width;
    this._trailHeight = height;
    this._trailResolutionScale = resolutionScale;
    this._trailReadyFrames = 0;
  };

  // -------- simulation prerender --------
  Particles.prototype.prerender = function prerender (gl) {
    if (!this.windData) { return; }

    // Initialize particles on first prerender when properties are available
    if (!this._particlesInitialized) {
      var numParticles = this.numberParticles;
      this.initializeParticles(gl, numParticles);
      this._particlesInitialized = true;
    }

    gl.disable(gl.BLEND);

    var tiles = this.visibleParticleTiles();
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var found = this.findAssociatedDataTiles(tile);
      if (found) {
        this.update(gl, this._particleTiles[tile], found);
        this._particleTiles[tile].updated = true;
      }
    }

    gl.enable(gl.BLEND);
    this.map.triggerRepaint();
  };

  // -------- draw --------
  Particles.prototype.render = function render (gl, matrix) {
    if (!this.windData) { return; }

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);

    this.renderWithTrails(gl, matrix);
  };

  Particles.prototype.renderWithTrails = function renderWithTrails (gl, matrix) {    
    if (!this.trailFramebuffer) { return; }

    // Get current zoom for trail adjustments
    var currentZoom = this.map && this.map.getZoom ? this.map.getZoom() : 0;
    var zoomFactor = Math.max(0.5, Math.min(2.0, currentZoom / 10.0));

    // --- compute dt for time-based fade ---
    var now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    var dt = 16.7;
    if (this._fadePrevTime != null) { dt = now - this._fadePrevTime; }
    this._fadePrevTime = now;
    dt = Math.max(0.0, Math.min(200.0, dt)) / 1000.0;

    // Keep existing fade parameters
    var trailSetting = this.particleTrail || 0.3;
    var baseTau = 0.4 + 0.6 * trailSetting;
    var tau = baseTau * (0.5 + 1.5 * zoomFactor);
    var biasPerSec = (0.08 + 0.05 * (1.0 - trailSetting)) / zoomFactor;
    var fadeFactor = Math.exp(-dt / Math.max(1e-4, tau));
    var biasDt = biasPerSec * dt;
    var cutoff = Math.max(0.015, 0.035 / zoomFactor);

    // A) Clear temp buffer first
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.viewport(0, 0, this._trailWidth, this._trailHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // B) Fade old trails into temp FBO
    gl.useProgram(this.fadeProgram.program);
    bindTexture(gl, this.trailTexture, 0);
    bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    gl.uniform1f(this.fadeProgram.u_fade, fadeFactor);
    gl.uniform1f(this.fadeProgram.u_bias, biasDt);
    gl.uniform1f(this.fadeProgram.u_cutoff, cutoff);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // C) Stamp current heads additively into temp FBO
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    gl.useProgram(this.drawProgram.program);

    // Increase stamp intensity to make trails more visible
    var baseStampAlpha = 0.06 + 0.08 * trailSetting; // Increased from 0.04+0.06 to 0.06+0.08
    var stampAlpha = baseStampAlpha * (0.8 + 0.7 * zoomFactor);
    gl.uniform1f(this.drawProgram.u_alpha, stampAlpha);

    var tiles = this.visibleParticleTiles();
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var found = this.findAssociatedDataTiles(tile);
      if (!found) { continue; }
      this._drawPoints(gl, matrix, this._particleTiles[tile], tile.viewMatrix(2), found, 1.0);
    }

    // D) Swap trail buffers
    var ttex = this.trailTexture;
    this.trailTexture = this.tempTrailTexture;
    this.tempTrailTexture = ttex;

    var tfbo = this.trailFramebuffer;
    this.trailFramebuffer = this.tempTrailFramebuffer;
    this.tempTrailFramebuffer = tfbo;

    // E) Composite to screen with proper scaling for high-res trails
    var vp = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.fadeProgram.program);
    bindTexture(gl, this.trailTexture, 0);
    bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    gl.uniform1f(this.fadeProgram.u_fade, 1.0);
    gl.uniform1f(this.fadeProgram.u_bias, 0.0);
    gl.uniform1f(this.fadeProgram.u_cutoff, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // F) Draw particle heads with reduced brightness for smooth transition
    gl.useProgram(this.drawProgram.program);
    var headAlpha = 0.25 + 0.15 * zoomFactor; // Reduced from 0.4+0.2 to 0.25+0.15
    gl.uniform1f(this.drawProgram.u_alpha, headAlpha);

    for (var j = 0; j < tiles.length; j++) {
      var tile2 = tiles[j];
      var found2 = this.findAssociatedDataTiles(tile2);
      if (!found2) { continue; }
      // Smaller size boost for more subtle head appearance
      this._drawPoints(gl, matrix, this._particleTiles[tile2], tile2.viewMatrix(2), found2, 1.0 + 0.1 * zoomFactor);
    }

    // Periodic clearing with zoom adjustment
    this._frameCount = (this._frameCount || 0) + 1;
    var clearInterval = Math.floor(300 + 200 * zoomFactor);
    if (this._frameCount % clearInterval === 0) {
      this._clearTrails();
    }
  };

  Particles.prototype._drawPoints = function _drawPoints (gl, matrix, tile, offset, data, sizeBoost) {
    // bind state + ramp
    bindTexture(gl, tile.particleStateTexture0, 0);
    bindTexture(gl, this.colorRampTexture, 1);

    // wind textures for color ramp sampling
    bindTexture(gl, data.tileTopLeft.getTexture(gl), 2);
    bindTexture(gl, data.tileTopCenter.getTexture(gl), 3);
    bindTexture(gl, data.tileTopRight.getTexture(gl), 4);
    bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 5);
    bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 6);
    bindTexture(gl, data.tileMiddleRight.getTexture(gl), 7);
    bindTexture(gl, data.tileBottomLeft.getTexture(gl), 8);
    bindTexture(gl, data.tileBottomCenter.getTexture(gl), 9);
    bindTexture(gl, data.tileBottomRight.getTexture(gl), 10);

    // attributes
    bindAttribute(gl, this.particleIndexBuffer, this.drawProgram.a_index, 1);

    // samplers
    gl.uniform1i(this.drawProgram.u_particles, 0);
    gl.uniform1i(this.drawProgram.u_color_ramp, 1);
    gl.uniform1i(this.drawProgram.u_wind_top_left, 2);
    gl.uniform1i(this.drawProgram.u_wind_top_center, 3);
    gl.uniform1i(this.drawProgram.u_wind_top_right, 4);
    gl.uniform1i(this.drawProgram.u_wind_middle_left, 5);
    gl.uniform1i(this.drawProgram.u_wind_middle_center, 6);
    gl.uniform1i(this.drawProgram.u_wind_middle_right, 7);
    gl.uniform1i(this.drawProgram.u_wind_bottom_left, 8);
    gl.uniform1i(this.drawProgram.u_wind_bottom_center, 9);
    gl.uniform1i(this.drawProgram.u_wind_bottom_right, 10);

    // uniforms
    gl.uniform1f(this.drawProgram.u_particles_res, this.particleStateResolution);
    gl.uniformMatrix4fv(this.drawProgram.u_matrix, false, matrix);
    gl.uniformMatrix4fv(this.drawProgram.u_offset, false, offset);

    // Enhanced particle sizing that accounts for high-res trail buffers
    var currentZoom = this.map && this.map.getZoom ? this.map.getZoom() : 0;
    var baseTrailWidth = 1.0; // Slightly smaller base for better proportions
    
    // More sophisticated zoom scaling
    var zoomScale = Math.max(1.0, Math.pow(1.6, (currentZoom - 3) * 0.4)); // Exponential growth
    
    // Account for trail buffer resolution - particles need to be larger in high-res buffers
    var resolutionScale = this._trailResolutionScale || 1.0;
    var resolutionCompensation = Math.sqrt(resolutionScale); // Square root scaling for better visual balance
    
    var trailWidthPx = baseTrailWidth * zoomScale * resolutionCompensation;
    
    // Match particle size to trail width, then apply size boost
    var sizePx = Math.max(1.0, trailWidthPx * this.particleSize * sizeBoost);
    gl.uniform1f(this.drawProgram.u_particle_size, sizePx);

    gl.uniform2f(this.drawProgram.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(this.drawProgram.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(this.drawProgram.u_data_matrix, false, data.matrix);

    var vp = gl.getParameter(gl.VIEWPORT);
    gl.uniform2f(this.drawProgram.u_viewport, vp[2], vp[3]);
    
    var numParticles = this.numberParticles || this._numParticles;  

    gl.drawArrays(gl.POINTS, 0, numParticles);
  };

  Particles.prototype.update = function update (gl, tile, data) {
    bindFramebuffer(gl, this.framebuffer, tile.particleStateTexture1);
    gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);

    var program = this.updateProgram;
    gl.useProgram(program.program);

    bindTexture(gl, tile.particleStateTexture0, 0);

    bindTexture(gl, data.tileTopLeft.getTexture(gl), 1);
    bindTexture(gl, data.tileTopCenter.getTexture(gl), 2);
    bindTexture(gl, data.tileTopRight.getTexture(gl), 3);
    bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 4);
    bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 5);
    bindTexture(gl, data.tileMiddleRight.getTexture(gl), 6);
    bindTexture(gl, data.tileBottomLeft.getTexture(gl), 7);
    bindTexture(gl, data.tileBottomCenter.getTexture(gl), 8);
    bindTexture(gl, data.tileBottomRight.getTexture(gl), 9);

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

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

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

    // ping-pong swap
    var temp = tile.particleStateTexture0;
    tile.particleStateTexture0 = tile.particleStateTexture1;
    tile.particleStateTexture1 = temp;
  };

  // ------- Tile helpers (used by prerender/render) -------
  Particles.prototype.computeLoadableTiles = function computeLoadableTiles () {
    var result = {};
    var add = function (tile) {
      result[tile] = tile;
    };
    var vis = this.visibleParticleTiles();
    for (var i = 0; i < vis.length; i++) {
      var t = vis[i];
      var matrix = new DOMMatrix();
      while (!t.isRoot()) {
        if (t.z <= this.windData.maxzoom) { break; }
        var q = t.quadrant();
        matrix.translateSelf(0.5 * q[0], 0.5 * q[1]);
        matrix.scaleSelf(0.5);
        t = t.parent();
      }

      matrix.translateSelf(-0.5, -0.5);
      matrix.scaleSelf(2, 2);

      var tl = matrix.transformPoint(new window.DOMPoint(0, 0));
      var br = matrix.transformPoint(new window.DOMPoint(1, 1));

      add(t);

      if (tl.x < 0 && tl.y < 0) { add(t.neighbor(-1, -1)); }
      if (tl.x < 0) { add(t.neighbor(-1, 0)); }
      if (tl.x < 0 && br.y > 1) { add(t.neighbor(-1, 1)); }

      if (br.x > 1 && tl.y < 0) { add(t.neighbor(1, -1)); }
      if (br.x > 1) { add(t.neighbor(1, 0)); }
      if (br.x > 1 && br.y > 1) { add(t.neighbor(1, 1)); }

      if (tl.y < 0) { add(t.neighbor(0, -1)); }
      if (br.y > 1) { add(t.neighbor(0, 1)); }
    }
    return Object.values(result);
  };

  Particles.prototype.findAssociatedDataTiles = function findAssociatedDataTiles (tileID) {
    var t = tileID;
    var found;
    var matrix = new DOMMatrix();
    while (!t.isRoot()) {
      if ((found = this._tiles[t])) { break; }
      var q = t.quadrant();
      matrix.translateSelf(0.5 * q[0], 0.5 * q[1]);
      matrix.scaleSelf(0.5);
      t = t.parent();
    }
    if (!found) { return; }

    var tileTopLeft = this._tiles[found.neighbor(-1, -1)];
    var tileTopCenter = this._tiles[found.neighbor(0, -1)];
    var tileTopRight = this._tiles[found.neighbor(1, -1)];
    var tileMiddleLeft = this._tiles[found.neighbor(-1, 0)];
    var tileMiddleCenter = found;
    var tileMiddleRight = this._tiles[found.neighbor(1, 0)];
    var tileBottomLeft = this._tiles[found.neighbor(-1, 1)];
    var tileBottomCenter = this._tiles[found.neighbor(0, 1)];
    var tileBottomRight = this._tiles[found.neighbor(1, 1)];

    matrix.translateSelf(-0.5, -0.5);
    matrix.scaleSelf(2, 2);

    var tl = matrix.transformPoint(new window.DOMPoint(0, 0));
    var br = matrix.transformPoint(new window.DOMPoint(1, 1));

    if (!tileMiddleCenter) { return; }

    if (tl.x < 0 && tl.y < 0 && !tileTopLeft) { return; }
    if (tl.x < 0 && !tileMiddleLeft) { return; }
    if (tl.x < 0 && br.y > 1 && !tileBottomLeft) { return; }

    if (br.x > 1 && tl.y < 0 && !tileTopRight) { return; }
    if (br.x > 1 && !tileMiddleRight) { return; }
    if (br.x > 1 && br.y > 1 && !tileBottomRight) { return; }

    if (tl.y < 0 && !tileTopCenter) { return; }
    if (br.y > 1 && !tileBottomCenter) { return; }

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
      tileBottomRight: tileBottomRight || this.nullTile,
    };
  };

  return Particles;
}(Layer$1));

function particles (options) { return new Particles(options); }

var arrow$1 = function (gl) { return createProgram(gl, "precision mediump float;uniform vec2 u_dimensions,u_wind_min,u_wind_max;uniform mat4 u_matrix,u_offset;uniform sampler2D u_wind;attribute vec2 a_pos,a_corner;varying vec2 g;varying float h,f;vec2 m(vec2 b){float a=-180.*b.y+90.;a=(180.-57.29578*log(tan(.785398+a*3.141593/360.)))/360.;return vec2(b.x,a);}vec2 n(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}vec2 o(const vec2 a){return texture2D(u_wind,a).rg;}vec2 p(const vec2 a){return mix(u_wind_min,u_wind_max,o(a));}mat2 q(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}void main(){vec2 c=.45/u_dimensions,a=mod(a_pos/u_dimensions,vec2(1,1)),b=p(a);f=length(b)/length(u_wind_max);float d=atan(b.x,b.y);g=a_corner,h=length(b)/length(u_wind_max),a+=q(d)*a_corner*c,a.x*=u_dimensions.x/u_dimensions.y;vec2 e=n(a,u_offset),i=m(e);gl_Position=u_matrix*vec4(i,0,1);}", "precision mediump float;uniform sampler2D u_color_ramp;uniform vec4 u_halo_color;varying vec2 g;varying float h,f;float j(vec3 a,int d){float b=atan(a.x,a.y)+3.141593,c=6.283185/float(d),e=cos(floor(.5+b/c)*c-b)*length(a.xy);return e;}mat3 k(vec2 a){return mat3(1./a.x,0,0,0,1./a.y,0,0,0,1);}mat3 l(vec2 a){return mat3(1,0,a.x,0,1,a.y,0,0,1);}float r(vec3 a,float b){return min(j(a*k(vec2(.3)),3),j(a*l(vec2(0.,b/2.))*k(vec2(.2,b)),4));}void main(){vec3 d=vec3(g,1);float a=mix(.25,4.,h),b=r(d*l(vec2(0,-a/2.)),a),c=1.-smoothstep(.4,.405,b),e=1.-smoothstep(.43,.435,b)-c;vec2 i=vec2(fract(16.*f),floor(16.*f)/16.);vec4 s=texture2D(u_color_ramp,i);gl_FragColor=s*c+e*u_halo_color;}"); };

var Arrows = /*@__PURE__*/(function (Layer) {
  function Arrows(options) {
    Layer.call(
      this, {
        "arrow-min-size": {
          type: "number",
          minimum: 1,
          default: 40,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        },
        "arrow-color": {
          type: "color",
          default: "white",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "arrow-halo-color": {
          type: "color",
          default: "rgba(0,0,0,0)",
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.pixelToGridRatio = 25;
  }

  if ( Layer ) Arrows.__proto__ = Layer;
  Arrows.prototype = Object.create( Layer && Layer.prototype );
  Arrows.prototype.constructor = Arrows;

  Arrows.prototype.initialize = function initialize (map, gl) {
    this.arrowsProgram = arrow$1(gl);
    this.initializeGrid();
  };

  Arrows.prototype.setArrowColor = function setArrowColor (expr) {
    this.buildColorRamp(expr);
  };

  Arrows.prototype.initializeGrid = function initializeGrid () {
    this.cols = this.windData.width;
    this.rows = this.windData.height;
    var numTriangles = this.rows * this.cols * 2;
    var numVertices = numTriangles * 3;
    var positions = new Float32Array(2 * numVertices);
    var corners = new Float32Array(2 * numVertices);
    for (var i = 0; i < this.cols; i++) {
      for (var j = 0; j < this.rows; j++) {
        var index = (i * this.rows + j) * 12;
        positions.set([i, j, i, j, i, j, i, j, i, j, i, j], index);
        corners.set([-1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1], index);
      }
    }
    this.positionsBuffer = createBuffer(this.gl, positions);
    this.cornerBuffer = createBuffer(this.gl, corners);
  };

  /**
   * This figures out the ideal number or rows and columns to show.
   *
   * NB: Returns [cols, rows] as that is [x,y] which makes more sense.
   */
  Arrows.prototype.computeDimensions = function computeDimensions (gl, map, minSize, cols, rows) {
    // If we are rendering multiple copies of the world, then we only care
    // about the square in the middle, as other code will take care of the
    // aditional coppies.
    var ref =
      map.getBounds().getEast() - 180 - (map.getBounds().getWest() + 180) > 0
        ? [gl.canvas.height, gl.canvas.height]
        : [gl.canvas.width, gl.canvas.height];
    var w = ref[0];
    var h = ref[1];

    var z = map.getZoom();

    // Either we show the grid size of the data, or we show fewer such
    // that these should be about ~minSize.
    return [
      Math.min(Math.floor((Math.floor(z + 1) * w) / minSize), cols) - 1,
      Math.min(Math.floor((Math.floor(z + 1) * h) / minSize), rows) - 1
    ];
  };

  Arrows.prototype.draw = function draw (gl, matrix, tile, offset) {
    var program = this.arrowsProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.positionsBuffer, program.a_pos, 2);
    bindAttribute(gl, this.cornerBuffer, program.a_corner, 2);

    bindTexture(gl, tile.getTexture(gl), 0);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);
    var ref = this.computeDimensions(
      gl,
      this.map,
      this.arrowMinSize,
      this.cols,
      this.rows
    );
    var cols = ref[0];
    var rows = ref[1];
    gl.uniform2f(program.u_dimensions, cols, rows);

    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniform4f(
      program.u_halo_color,
      this.arrowHaloColor.r,
      this.arrowHaloColor.g,
      this.arrowHaloColor.b,
      this.arrowHaloColor.a
    );

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    // if these were put in a smarter order, we could optimize this call further
    gl.drawArrays(gl.TRIANGLES, 0, this.rows * Math.floor(cols) * 6);
  };

  return Arrows;
}(Layer$1));

function arrow (options) { return new Arrows(options); }

function getJSON(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = "json";
  xhr.open("get", url, true);
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      callback(xhr.response);
    } else {
      throw new Error(xhr.statusText);
    }
  };
  xhr.send();
}

function source (relUrl) {
  var url = new URL(relUrl, window.location);
  /**
   * A note on how this works:
   * 0. At any moment we can recieve a request for a tile.
   * 1. Before we can fulfil such a request, we need to load metadata. So we store tile requests that were issued before
   *    metadata was loaded and once it loads we issue requests for the tiles once that is done.
   * 2. If metadata is loaded, we check if there already has been a request for the same tile. If yes, we simply add
   *    the callback to the queue, otherwise we save the callback and load the image.
   * 3. When an image is loaded we store the data in a cache and empty the queue of all relevant callbacks by calling them.
   * 4. If there is already data in the cache, simply call the callback right away.
   */
  var tileRequests = {};
  var data;
  var requestsBeforeMetadataLoaded = new Set();
  var cache = {};
  var dataCallbacks = [];

  getJSON(url, function (windData) {
    data = windData;
    dataCallbacks.forEach(function (cb) { return cb(data); });
    requestsBeforeMetadataLoaded.forEach(function (tile) {
      if (cache[tile]) {
        var req;
        while ((req = tileRequests[tile].pop())) {
          dispatchCallback(tile, req);
        }
      } else {
        load(tile);
      }
    });
    requestsBeforeMetadataLoaded = [];
  });

  function dispatchCallback(tile, cb) {
    cb(Object.assign(tile, { getTexture: cache[tile] }));
  }

  function load(tile) {
    var windImage = new Image();
    var tileUrl = new URL(
      data.tiles[0]
        .replace(/{z}/g, tile.z)
        .replace(/{x}/g, tile.x)
        .replace(/{y}/g, tile.y),
      url
    );
    if (tileUrl.origin !== window.location.origin) {
      windImage.crossOrigin = "anonymous";
    }
    windImage.src = tileUrl;
    windImage.onload = function () {
      var texture;
      cache[tile] = function (gl) {
        if (texture) { return texture; }
        texture = createTexture(gl, gl.LINEAR, windImage);
        return texture;
      };
      var req;
      while ((req = tileRequests[tile].pop())) {
        dispatchCallback(tile, req);
      }
    };
  }

  return {
    metadata: function metadata(cb) {
      if (data) {
        cb(data);
      } else {
        dataCallbacks.push(cb);
      }
    },
    loadTile: function loadTile(tile, cb) {
      if (cache[tile]) {
        dispatchCallback(tile, cb);
      } else {
        if (data) {
          if (tileRequests[tile]) {
            tileRequests[tile].push(cb);
          } else {
            tileRequests[tile] = [cb];
            load(tile);
          }
        } else {
          tileRequests[tile] = (tileRequests[tile] || []).concat([cb]);
          requestsBeforeMetadataLoaded.add(tile);
        }
      }
    }
  };
}

exports.arrow = arrow;
exports.particles = particles;
exports.sampleFill = sampleFill;
exports.source = source;
