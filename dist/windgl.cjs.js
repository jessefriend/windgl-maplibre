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

var particleUpdate = function (gl) { return createProgram(gl, "precision highp float;attribute vec2 a_pos;varying vec2 h;void main(){h=a_pos,gl_Position=vec4(1.-2.*a_pos,0,1);}const vec3 f=vec3(12.9898,78.233,4375.85453);", "precision highp float;vec2 g(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_particles,u_wind_top_left,u_wind_top_center,u_wind_top_right,u_wind_middle_left,u_wind_middle_center,u_wind_middle_right,u_wind_bottom_left,u_wind_bottom_center,u_wind_bottom_right;uniform vec2 u_wind_res,u_wind_min,u_wind_max;uniform bool u_initialize;uniform mat4 u_data_matrix;uniform float u_rand_seed,u_speed_factor,u_drop_rate,u_drop_rate_bump;varying vec2 h;const vec3 f=vec3(12.9898,78.233,4375.85453);float i(const vec2 b){float a=dot(f.xy,b);return fract(sin(a)*(f.z+a));}vec2 e(const vec2 a){return a.x>1.&&a.y>1.?texture2D(u_wind_bottom_right,a-vec2(1,1)).rg:a.x>0.&&a.y>1.?texture2D(u_wind_bottom_center,a-vec2(0,1)).rg:a.y>1.?texture2D(u_wind_bottom_left,a-vec2(-1,1)).rg:a.x>1.&&a.y>0.?texture2D(u_wind_middle_right,a-vec2(1,0)).rg:a.x>0.&&a.y>0.?texture2D(u_wind_middle_center,a-vec2(0,0)).rg:a.y>0.?texture2D(u_wind_middle_left,a-vec2(-1,0)).rg:a.x>1.?texture2D(u_wind_top_right,a-vec2(1,-1)).rg:a.x>0.?texture2D(u_wind_top_center,a-vec2(0,-1)).rg:texture2D(u_wind_top_left,a-vec2(-1,-1)).rg;}vec2 p(const vec2 d){vec2 a=1./u_wind_res,b=floor(d*u_wind_res)*a,c=fract(d*u_wind_res),j=e(b),k=e(b+vec2(a.x,0)),l=e(b+vec2(0,a.y)),m=e(b+a);return mix(mix(j,k,c.x),mix(l,m,c.x),c.y);}vec2 o(vec2 a){vec2 d=g(a,u_data_matrix),b=mix(u_wind_min,u_wind_max,p(d));float j=length(b)/length(u_wind_max);vec2 k=vec2(b.x,-b.y)*1e-4*u_speed_factor;a=fract(1.+a+k);vec2 c=(a+h)*u_rand_seed;float l=u_drop_rate+j*u_drop_rate_bump+smoothstep(.24,.5,length(a-vec2(.5,.5))*.7),m=step(1.-l,i(c));vec2 q=vec2(.5*i(c+1.3)+.25,.5*i(c+2.1)+.25);return mix(a,q,m);}void main(){vec4 b=texture2D(u_particles,h);vec2 a=vec2(b.r/255.+b.b,b.g/255.+b.a);a=o(a);if(u_initialize)for(int c=0;c<100;c++)a=o(a);gl_FragColor=vec4(fract(a*255.),floor(a*255.)/255.);}"); };

var particleDraw = function (gl) { return createProgram(gl, "precision highp float;vec2 r(vec2 b){float a=-180.*b.y+90.;a=(180.-57.29578*log(tan(.785398+a*3.141593/360.)))/360.;return vec2(b.x,a);}vec2 g(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_particles;uniform mat4 u_matrix,u_offset;uniform float u_particles_res,u_particle_size;const vec3 f=vec3(12.9898,78.233,4375.85453);attribute float a_index;varying vec2 n;void main(){vec4 a=texture2D(u_particles,vec2(fract(a_index/u_particles_res),floor(a_index/u_particles_res)/u_particles_res));vec2 b=vec2(a.r/255.+a.b,a.g/255.+a.a),c=g(b,u_offset),d=r(c);n=b,gl_PointSize=u_particle_size,gl_Position=u_matrix*vec4(d,0,1);}", "precision highp float;vec2 g(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_wind_top_left,u_wind_top_center,u_wind_top_right,u_wind_middle_left,u_wind_middle_center,u_wind_middle_right,u_wind_bottom_left,u_wind_bottom_center,u_wind_bottom_right,u_color_ramp;uniform vec2 u_wind_min,u_wind_max;uniform mat4 u_data_matrix;uniform float u_trail_alpha;const vec3 f=vec3(12.9898,78.233,4375.85453);vec2 e(const vec2 a){return a.x>1.&&a.y>1.?texture2D(u_wind_bottom_right,a-vec2(1,1)).rg:a.x>0.&&a.y>1.?texture2D(u_wind_bottom_center,a-vec2(0,1)).rg:a.y>1.?texture2D(u_wind_bottom_left,a-vec2(-1,1)).rg:a.x>1.&&a.y>0.?texture2D(u_wind_middle_right,a-vec2(1,0)).rg:a.x>0.&&a.y>0.?texture2D(u_wind_middle_center,a-vec2(0,0)).rg:a.y>0.?texture2D(u_wind_middle_left,a-vec2(-1,0)).rg:a.x>1.?texture2D(u_wind_top_right,a-vec2(1,-1)).rg:a.x>0.?texture2D(u_wind_top_center,a-vec2(0,-1)).rg:texture2D(u_wind_top_left,a-vec2(-1,-1)).rg;}varying vec2 n;void main(){vec2 c=mix(u_wind_min,u_wind_max,e(g(n,u_data_matrix)));float a=length(c)/length(u_wind_max);vec2 d=vec2(fract(16.*a),floor(16.*a)/16.);vec4 b=texture2D(u_color_ramp,d);gl_FragColor=vec4(b.rgb,b.a*u_trail_alpha);}"); };

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
var Particles = /*@__PURE__*/(function (Layer) {
  function Particles(options) {
    Layer.call(
      this, {
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
        "particle-trail": {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.005,
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
    this.tileSize = 1024;

    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
    this._numParticles = 65536;
    // This layer manages 2 kinds of tiles: data tiles (the same as other layers) and particle state tiles
    this._particleTiles = {};

    // Trail effect properties
    this.trailEnabled = false;
    this.trailFadeRate = 0.98; // Higher = longer trails (0.9-0.99)
  }

  if ( Layer ) Particles.__proto__ = Layer;
  Particles.prototype = Object.create( Layer && Layer.prototype );
  Particles.prototype.constructor = Particles;

  Particles.prototype.visibleParticleTiles = function visibleParticleTiles () {
    return this.computeVisibleTiles(2, this.tileSize, {
      minzoom: 0,
      maxzoom: this.windData.maxzoom + 3 // how much overzoom to allow?
    });
  };

  Particles.prototype.setParticleColor = function setParticleColor (expr) {
    this.buildColorRamp(expr);
  };

  Particles.prototype.initializeParticleTile = function initializeParticleTile () {
    // textures to hold the particle state for the current and the next frame
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
    var this$1$1 = this;

    Layer.prototype.move.call(this);
    var tiles = this.visibleParticleTiles();
    Object.keys(this._particleTiles).forEach(function (tile) {
      if (tiles.filter(function (t) { return t.toString() == tile; }).length === 0) {
        // cleanup
        this$1$1.gl.deleteTexture(tile.particleStateTexture0);
        this$1$1.gl.deleteTexture(tile.particleStateTexture1);
        delete this$1$1._particleTiles[tile];
      }
    });
    tiles.forEach(function (tile) {
      if (!this$1$1._particleTiles[tile]) {
        this$1$1._particleTiles[tile] = this$1$1.initializeParticleTile();
      }
    });
  };

  Particles.prototype.initializeParticles = function initializeParticles (gl, count) {
    var particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(count)
    ));
    this._numParticles = particleRes * particleRes;

    this._randomParticleState = new Uint8Array(this._numParticles * 4);
    for (var i = 0; i < this._randomParticleState.length; i++) {
      this._randomParticleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
    }

    var particleIndices = new Float32Array(this._numParticles);
    for (var i$1 = 0; i$1 < this._numParticles; i$1++) { particleIndices[i$1] = i$1; }
    this.particleIndexBuffer = createBuffer(gl, particleIndices);
  };

  Particles.prototype.initialize = function initialize (map, gl) {
    var this$1$1 = this;

    this.updateProgram = particleUpdate(gl);
    this.drawProgram = particleDraw(gl);

    this.framebuffer = gl.createFramebuffer();

    this.quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.initializeParticles(gl, this._numParticles);

    this.nullTexture = createTexture(
      gl,
      gl.NEAREST,
      new Uint8Array([0, 0, 0, 0]),
      1,
      1
    );

    this.nullTile = {
      getTexture: function () { return this$1$1.nullTexture; }
    };

    // Setup trail rendering components
    this.setupTrailRendering(gl);
  };

  // This is a callback from mapbox for rendering into a texture
  Particles.prototype.prerender = function prerender (gl) {
    var this$1$1 = this;

    if (this.windData) {
      var blendingEnabled = gl.isEnabled(gl.BLEND);
      gl.disable(gl.BLEND);
      var tiles = this.visibleParticleTiles();
      tiles.forEach(function (tile) {
        var found = this$1$1.findAssociatedDataTiles(tile);
        if (found) {
          this$1$1.update(gl, this$1$1._particleTiles[tile], found);
          this$1$1._particleTiles[tile].updated = true;
        }
      });
      if (blendingEnabled) { gl.enable(gl.BLEND); }
      this.map.triggerRepaint();
    }
  };

  /**
   * This method computes the ideal data tiles to support our particle tiles
   */
  Particles.prototype.computeLoadableTiles = function computeLoadableTiles () {
    var this$1$1 = this;

    var result = {};
    var add = function (tile) { return (result[tile] = tile); };
    this.visibleParticleTiles().forEach(function (tileID) {
      var t = tileID;
      var matrix = new DOMMatrix();
      while (!t.isRoot()) {
        if (t.z <= this$1$1.windData.maxzoom) { break; }
        var ref = t.quadrant();
        var x = ref[0];
        var y = ref[1];
        matrix.translateSelf(0.5 * x, 0.5 * y);
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
    });
    return Object.values(result);
  };

  Particles.prototype.findAssociatedDataTiles = function findAssociatedDataTiles (tileID) {
    var t = tileID;
    var found;
    var matrix = new DOMMatrix();
    while (!t.isRoot()) {
      if ((found = this._tiles[t])) { break; }
      var ref = t.quadrant();
      var x = ref[0];
      var y = ref[1];
      matrix.translateSelf(0.5 * x, 0.5 * y);
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
      tileBottomRight: tileBottomRight || this.nullTile
    };
  };

  Particles.prototype.update = function update (gl, tile, data) {
    bindFramebuffer(gl, this.framebuffer, tile.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution
    );

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

    // swap the particle state textures so the new one becomes the current one
    var temp = tile.particleStateTexture0;
    tile.particleStateTexture0 = tile.particleStateTexture1;
    tile.particleStateTexture1 = temp;
  };

  // Add a main render method that decides between normal and trail rendering
  Particles.prototype.render = function render (gl, matrix) {
    if (!this.windData) { return; }

    var particleTrail = this.particleTrail || 0.05;
    if (particleTrail > 0) {
      this.renderWithTrails(gl, matrix);
    } else {
      this.renderNormal(gl, matrix);
    }
  };

  // Normal rendering without trails
  Particles.prototype.renderNormal = function renderNormal (gl, matrix) {
    var this$1$1 = this;

    this.visibleParticleTiles().forEach(function (tile) {
      var found = this$1$1.findAssociatedDataTiles(tile);
      if (!found) { return; } // Add this null check

      this$1$1.draw(gl, matrix, this$1$1._particleTiles[tile], tile.viewMatrix(2), found);
    });
  };

  Particles.prototype.setupTrailRendering = function setupTrailRendering (gl) {
    var canvas = gl.canvas;
    this.trailCanvas = Math.min(canvas.width, canvas.height, 1024);
    
    // Create empty texture data instead of null
    var emptyData = new Uint8Array(this.trailCanvas * this.trailCanvas * 4);
    // Fill with transparent black
    emptyData.fill(0);
    
    // Create trail accumulation textures with proper data
    this.trailTexture = createTexture(gl, gl.LINEAR, emptyData, this.trailCanvas, this.trailCanvas);
    this.tempTrailTexture = createTexture(gl, gl.LINEAR, emptyData, this.trailCanvas, this.trailCanvas);
    
    // Create framebuffers
    this.trailFramebuffer = gl.createFramebuffer();
    this.tempTrailFramebuffer = gl.createFramebuffer();
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.trailTexture, 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tempTrailTexture, 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // Create fade shader for trail decay
    this.createFadeShader(gl);
    
    this.trailEnabled = true;
  };

  Particles.prototype.createFadeShader = function createFadeShader (gl) {
    var vertexSource = "\n      attribute vec2 a_position;\n      varying vec2 v_texCoord;\n      void main() {\n        v_texCoord = a_position * 0.5 + 0.5;\n        gl_Position = vec4(a_position, 0.0, 1.0);\n      }\n    ";
    
    var fragmentSource = "\n      precision mediump float;\n      uniform sampler2D u_texture;\n      uniform float u_fade;\n      varying vec2 v_texCoord;\n      void main() {\n        vec4 color = texture2D(u_texture, v_texCoord);\n        gl_FragColor = vec4(color.rgb, color.a * u_fade);\n      }\n    ";
    
    this.fadeProgram = createProgram(gl, vertexSource, fragmentSource);
    this.fadeQuadBuffer = createBuffer(gl, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]));
  };

  // Trail rendering with accumulation
  Particles.prototype.renderWithTrails = function renderWithTrails (gl, matrix) {
    var this$1$1 = this;
    var assign, assign$1;

    if (!this.fadeProgram || !this.trailTexture) {
      // Fallback to normal rendering if trails aren't set up
      this.renderNormal(gl, matrix);
      return;
    }

    var viewport = gl.getParameter(gl.VIEWPORT);
    
    // 1. Fade existing trail texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.viewport(0, 0, this.trailCanvas, this.trailCanvas);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(this.fadeProgram.program);
    bindTexture(gl, this.trailTexture, 0);
    bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    // Fade rate based on particle trail setting (higher = longer trails)
    var fadeRate = 0.75 + (this.particleTrail * 0.04); // 0.95 to 0.99
    gl.uniform1f(this.fadeProgram.u_fade, fadeRate);
    
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // 2. Render new particles to the faded trail buffer
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    this.visibleParticleTiles().forEach(function (tile) {
      var found = this$1$1.findAssociatedDataTiles(tile);
      if (!found) { return; }
      this$1$1.draw(gl, matrix, this$1$1._particleTiles[tile], tile.viewMatrix(2), found);
    });
    
    // Swap textures for next frame
    (assign = [this.tempTrailTexture, this.trailTexture], this.trailTexture = assign[0], this.tempTrailTexture = assign[1]);
    (assign$1 = [this.tempTrailFramebuffer, this.trailFramebuffer], this.trailFramebuffer = assign$1[0], this.tempTrailFramebuffer = assign$1[1]);
    
    // 3. Render accumulated trail texture to main screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
    
    gl.useProgram(this.fadeProgram.program);
    bindTexture(gl, this.trailTexture, 0);
    bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    gl.uniform1f(this.fadeProgram.u_fade, 1.0);
    
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    gl.disable(gl.BLEND);
  };

  // Update the draw method to handle wind data properly
  Particles.prototype.draw = function draw (gl, matrix, tile, offset, data) {
    var program = this.drawProgram;
    gl.useProgram(program.program);

    // Bind particle state texture
    bindTexture(gl, tile.particleStateTexture0, 0);
    bindTexture(gl, this.colorRampTexture, 1);

    // Bind wind data textures
    bindTexture(gl, data.tileTopLeft.getTexture(gl), 2);
    bindTexture(gl, data.tileTopCenter.getTexture(gl), 3);
    bindTexture(gl, data.tileTopRight.getTexture(gl), 4);
    bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 5);
    bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 6);
    bindTexture(gl, data.tileMiddleRight.getTexture(gl), 7);
    bindTexture(gl, data.tileBottomLeft.getTexture(gl), 8);
    bindTexture(gl, data.tileBottomCenter.getTexture(gl), 9);
    bindTexture(gl, data.tileBottomRight.getTexture(gl), 10);

    bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);

    // Set texture uniforms
    gl.uniform1i(program.u_particles, 0);
    gl.uniform1i(program.u_color_ramp, 1);
    gl.uniform1i(program.u_wind_top_left, 2);
    gl.uniform1i(program.u_wind_top_center, 3);
    gl.uniform1i(program.u_wind_top_right, 4);
    gl.uniform1i(program.u_wind_middle_left, 5);
    gl.uniform1i(program.u_wind_middle_center, 6);
    gl.uniform1i(program.u_wind_middle_right, 7);
    gl.uniform1i(program.u_wind_bottom_left, 8);
    gl.uniform1i(program.u_wind_bottom_center, 9);
    gl.uniform1i(program.u_wind_bottom_right, 10);

    // Set other uniforms
    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);
    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniform1f(program.u_particle_size, this.particleSize);

    // Set wind data uniforms
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_data_matrix, false, data.matrix);

    // For trails, use full opacity - the fading happens in the framebuffer
    gl.uniform1f(program.u_trail_alpha, 1.0);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
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
