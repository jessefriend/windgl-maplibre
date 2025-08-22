(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.windGL = {}));
})(this, (function (exports) { 'use strict';

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

  function extendBy(output) {
      var inputs = [], len = arguments.length - 1;
      while ( len-- > 0 ) inputs[ len ] = arguments[ len + 1 ];

      for (var i = 0, list = inputs; i < list.length; i += 1) {
          var input = list[i];

        for (var k in input) {
              output[k] = input[k];
          }
      }
      return output;
  }

  var ExpressionParsingError = /*@__PURE__*/(function (Error) {
    function ExpressionParsingError(key, message) {
          Error.call(this, message);
          this.message = message;
          this.key = key;
      }

    if ( Error ) ExpressionParsingError.__proto__ = Error;
    ExpressionParsingError.prototype = Object.create( Error && Error.prototype );
    ExpressionParsingError.prototype.constructor = ExpressionParsingError;

    return ExpressionParsingError;
  }(Error));

  /**
   * Tracks `let` bindings during expression parsing.
   * @private
   */
  var Scope = function Scope(parent, bindings) {
        if ( bindings === void 0 ) bindings = [];

        this.parent = parent;
        this.bindings = {};
        for (var i = 0, list = bindings; i < list.length; i += 1) {
            var ref = list[i];
          var name = ref[0];
          var expression = ref[1];

          this.bindings[name] = expression;
        }
    };
    Scope.prototype.concat = function concat (bindings) {
        return new Scope(this, bindings);
    };
    Scope.prototype.get = function get (name) {
        if (this.bindings[name]) {
            return this.bindings[name];
        }
        if (this.parent) {
            return this.parent.get(name);
        }
        throw new Error((name + " not found in scope."));
    };
    Scope.prototype.has = function has (name) {
        if (this.bindings[name])
            { return true; }
        return this.parent ? this.parent.has(name) : false;
    };

  var NullType = { kind: 'null' };
  var NumberType = { kind: 'number' };
  var StringType = { kind: 'string' };
  var BooleanType = { kind: 'boolean' };
  var ColorType = { kind: 'color' };
  var ProjectionDefinitionType = { kind: 'projectionDefinition' };
  var ObjectType = { kind: 'object' };
  var ValueType = { kind: 'value' };
  var ErrorType = { kind: 'error' };
  var CollatorType = { kind: 'collator' };
  var FormattedType = { kind: 'formatted' };
  var PaddingType = { kind: 'padding' };
  var ResolvedImageType = { kind: 'resolvedImage' };
  var VariableAnchorOffsetCollectionType = { kind: 'variableAnchorOffsetCollection' };
  function array(itemType, N) {
      return {
          kind: 'array',
          itemType: itemType,
          N: N
      };
  }
  function typeToString(type) {
      if (type.kind === 'array') {
          var itemType = typeToString(type.itemType);
          return typeof type.N === 'number' ?
              ("array<" + itemType + ", " + (type.N) + ">") :
              type.itemType.kind === 'value' ? 'array' : ("array<" + itemType + ">");
      }
      else {
          return type.kind;
      }
  }
  var valueMemberTypes = [
      NullType,
      NumberType,
      StringType,
      BooleanType,
      ColorType,
      ProjectionDefinitionType,
      FormattedType,
      ObjectType,
      array(ValueType),
      PaddingType,
      ResolvedImageType,
      VariableAnchorOffsetCollectionType
  ];
  /**
   * Returns null if `t` is a subtype of `expected`; otherwise returns an
   * error message.
   * @private
   */
  function checkSubtype(expected, t) {
      if (t.kind === 'error') {
          // Error is a subtype of every type
          return null;
      }
      else if (expected.kind === 'array') {
          if (t.kind === 'array' &&
              ((t.N === 0 && t.itemType.kind === 'value') || !checkSubtype(expected.itemType, t.itemType)) &&
              (typeof expected.N !== 'number' || expected.N === t.N)) {
              return null;
          }
      }
      else if (expected.kind === t.kind) {
          return null;
      }
      else if (expected.kind === 'value') {
          for (var i = 0, list = valueMemberTypes; i < list.length; i += 1) {
              var memberType = list[i];

            if (!checkSubtype(memberType, t)) {
                  return null;
              }
          }
      }
      return ("Expected " + (typeToString(expected)) + " but found " + (typeToString(t)) + " instead.");
  }
  function isValidType(provided, allowedTypes) {
      return allowedTypes.some(function (t) { return t.kind === provided.kind; });
  }
  function isValidNativeType(provided, allowedTypes) {
      return allowedTypes.some(function (t) {
          if (t === 'null') {
              return provided === null;
          }
          else if (t === 'array') {
              return Array.isArray(provided);
          }
          else if (t === 'object') {
              return provided && !Array.isArray(provided) && typeof provided === 'object';
          }
          else {
              return t === typeof provided;
          }
      });
  }
  /**
   * Verify whether the specified type is of the same type as the specified sample.
   *
   * @param provided Type to verify
   * @param sample Sample type to reference
   * @returns `true` if both objects are of the same type, `false` otherwise
   * @example basic types
   * if (verifyType(outputType, ValueType)) {
   *     // type narrowed to:
   *     outputType.kind; // 'value'
   * }
   * @example array types
   * if (verifyType(outputType, array(NumberType))) {
   *     // type narrowed to:
   *     outputType.kind; // 'array'
   *     outputType.itemType; // NumberTypeT
   *     outputType.itemType.kind; // 'number'
   * }
   */
  function verifyType(provided, sample) {
      if (provided.kind === 'array' && sample.kind === 'array') {
          return provided.itemType.kind === sample.itemType.kind && typeof provided.N === 'number';
      }
      return provided.kind === sample.kind;
  }

  // See https://observablehq.com/@mbostock/lab-and-rgb
  var Xn = 0.96422, Yn = 1, Zn = 0.82521, t0 = 4 / 29, t1 = 6 / 29, t2 = 3 * t1 * t1, t3 = t1 * t1 * t1, deg2rad = Math.PI / 180, rad2deg = 180 / Math.PI;
  function constrainAngle(angle) {
      angle = angle % 360;
      if (angle < 0) {
          angle += 360;
      }
      return angle;
  }
  function rgbToLab(ref) {
      var r = ref[0];
      var g = ref[1];
      var b = ref[2];
      var alpha = ref[3];

      r = rgb2xyz(r);
      g = rgb2xyz(g);
      b = rgb2xyz(b);
      var x, z;
      var y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn);
      if (r === g && g === b) {
          x = z = y;
      }
      else {
          x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
          z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
      }
      var l = 116 * y - 16;
      return [(l < 0) ? 0 : l, 500 * (x - y), 200 * (y - z), alpha];
  }
  function rgb2xyz(x) {
      return (x <= 0.04045) ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }
  function xyz2lab(t) {
      return (t > t3) ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }
  function labToRgb(ref) {
      var l = ref[0];
      var a = ref[1];
      var b = ref[2];
      var alpha = ref[3];

      var y = (l + 16) / 116, x = isNaN(a) ? y : y + a / 500, z = isNaN(b) ? y : y - b / 200;
      y = Yn * lab2xyz(y);
      x = Xn * lab2xyz(x);
      z = Zn * lab2xyz(z);
      return [
          xyz2rgb(3.1338561 * x - 1.6168667 * y - 0.4906146 * z), // D50 -> sRGB
          xyz2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
          xyz2rgb(0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
          alpha ];
  }
  function xyz2rgb(x) {
      x = (x <= 0.00304) ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
      return (x < 0) ? 0 : (x > 1) ? 1 : x; // clip to 0..1 range
  }
  function lab2xyz(t) {
      return (t > t1) ? t * t * t : t2 * (t - t0);
  }
  function rgbToHcl(rgbColor) {
      var ref = rgbToLab(rgbColor);
      var l = ref[0];
      var a = ref[1];
      var b = ref[2];
      var alpha = ref[3];
      var c = Math.sqrt(a * a + b * b);
      var h = Math.round(c * 10000) ? constrainAngle(Math.atan2(b, a) * rad2deg) : NaN;
      return [h, c, l, alpha];
  }
  function hclToRgb(ref) {
      var h = ref[0];
      var c = ref[1];
      var l = ref[2];
      var alpha = ref[3];

      h = isNaN(h) ? 0 : h * deg2rad;
      return labToRgb([l, Math.cos(h) * c, Math.sin(h) * c, alpha]);
  }
  // https://drafts.csswg.org/css-color-4/#hsl-to-rgb
  function hslToRgb(ref) {
      var h = ref[0];
      var s = ref[1];
      var l = ref[2];
      var alpha = ref[3];

      h = constrainAngle(h);
      s /= 100;
      l /= 100;
      function f(n) {
          var k = (n + h / 30) % 12;
          var a = s * Math.min(l, 1 - l);
          return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      }
      return [f(0), f(8), f(4), alpha];
  }

  /**
   * CSS color parser compliant with CSS Color 4 Specification.
   * Supports: named colors, `transparent` keyword, all rgb hex notations,
   * rgb(), rgba(), hsl() and hsla() functions.
   * Does not round the parsed values to integers from the range 0..255.
   *
   * Syntax:
   *
   * <alpha-value> = <number> | <percentage>
   *         <hue> = <number> | <angle>
   *
   *         rgb() = rgb( <percentage>{3} [ / <alpha-value> ]? ) | rgb( <number>{3} [ / <alpha-value> ]? )
   *         rgb() = rgb( <percentage>#{3} , <alpha-value>? )    | rgb( <number>#{3} , <alpha-value>? )
   *
   *         hsl() = hsl( <hue> <percentage> <percentage> [ / <alpha-value> ]? )
   *         hsl() = hsl( <hue>, <percentage>, <percentage>, <alpha-value>? )
   *
   * Caveats:
   *   - <angle> - <number> with optional `deg` suffix; `grad`, `rad`, `turn` are not supported
   *   - `none` keyword is not supported
   *   - comments inside rgb()/hsl() are not supported
   *   - legacy color syntax rgba() is supported with an identical grammar and behavior to rgb()
   *   - legacy color syntax hsla() is supported with an identical grammar and behavior to hsl()
   *
   * @param input CSS color string to parse.
   * @returns Color in sRGB color space, with `red`, `green`, `blue`
   * and `alpha` channels normalized to the range 0..1,
   * or `undefined` if the input is not a valid color string.
   */
  function parseCssColor(input) {
      input = input.toLowerCase().trim();
      if (input === 'transparent') {
          return [0, 0, 0, 0];
      }
      // 'white', 'black', 'blue'
      var namedColorsMatch = namedColors[input];
      if (namedColorsMatch) {
          var r = namedColorsMatch[0];
          var g = namedColorsMatch[1];
          var b = namedColorsMatch[2];
          return [r / 255, g / 255, b / 255, 1];
      }
      // #f0c, #f0cf, #ff00cc, #ff00ccff
      if (input.startsWith('#')) {
          var hexRegexp = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
          if (hexRegexp.test(input)) {
              var step = input.length < 6 ? 1 : 2;
              var i = 1;
              return [
                  parseHex(input.slice(i, i += step)),
                  parseHex(input.slice(i, i += step)),
                  parseHex(input.slice(i, i += step)),
                  parseHex(input.slice(i, i + step) || 'ff') ];
          }
      }
      // rgb(128 0 0), rgb(50% 0% 0%), rgba(255,0,255,0.6), rgb(255 0 255 / 60%), rgb(100% 0% 100% /.6)
      if (input.startsWith('rgb')) {
          var rgbRegExp = /^rgba?\(\s*([\de.+-]+)(%)?(?:\s+|\s*(,)\s*)([\de.+-]+)(%)?(?:\s+|\s*(,)\s*)([\de.+-]+)(%)?(?:\s*([,\/])\s*([\de.+-]+)(%)?)?\s*\)$/;
          var rgbMatch = input.match(rgbRegExp);
          if (rgbMatch) {
              rgbMatch[0];
              var r$1 = rgbMatch[1];
              var rp = rgbMatch[2];
              var f1 = rgbMatch[3];
              var g$1 = rgbMatch[4];
              var gp = rgbMatch[5];
              var f2 = rgbMatch[6];
              var b$1 = rgbMatch[7];
              var bp = rgbMatch[8];
              var f3 = rgbMatch[9];
              var a = rgbMatch[10];
              var ap = rgbMatch[11];
              var argFormat = [f1 || ' ', f2 || ' ', f3].join('');
              if (argFormat === '  ' ||
                  argFormat === '  /' ||
                  argFormat === ',,' ||
                  argFormat === ',,,') {
                  var valFormat = [rp, gp, bp].join('');
                  var maxValue = (valFormat === '%%%') ? 100 :
                      (valFormat === '') ? 255 : 0;
                  if (maxValue) {
                      var rgba = [
                          clamp(+r$1 / maxValue, 0, 1),
                          clamp(+g$1 / maxValue, 0, 1),
                          clamp(+b$1 / maxValue, 0, 1),
                          a ? parseAlpha(+a, ap) : 1 ];
                      if (validateNumbers(rgba)) {
                          return rgba;
                      }
                      // invalid numbers
                  }
                  // values must be all numbers or all percentages
              }
              return; // comma optional syntax requires no commas at all
          }
      }
      // hsl(120 50% 80%), hsla(120deg,50%,80%,.9), hsl(12e1 50% 80% / 90%)
      var hslRegExp = /^hsla?\(\s*([\de.+-]+)(?:deg)?(?:\s+|\s*(,)\s*)([\de.+-]+)%(?:\s+|\s*(,)\s*)([\de.+-]+)%(?:\s*([,\/])\s*([\de.+-]+)(%)?)?\s*\)$/;
      var hslMatch = input.match(hslRegExp);
      if (hslMatch) {
          hslMatch[0];
          var h = hslMatch[1];
          var f1$1 = hslMatch[2];
          var s = hslMatch[3];
          var f2$1 = hslMatch[4];
          var l = hslMatch[5];
          var f3$1 = hslMatch[6];
          var a$1 = hslMatch[7];
          var ap$1 = hslMatch[8];
          var argFormat$1 = [f1$1 || ' ', f2$1 || ' ', f3$1].join('');
          if (argFormat$1 === '  ' ||
              argFormat$1 === '  /' ||
              argFormat$1 === ',,' ||
              argFormat$1 === ',,,') {
              var hsla = [
                  +h,
                  clamp(+s, 0, 100),
                  clamp(+l, 0, 100),
                  a$1 ? parseAlpha(+a$1, ap$1) : 1 ];
              if (validateNumbers(hsla)) {
                  return hslToRgb(hsla);
              }
              // invalid numbers
          }
          // comma optional syntax requires no commas at all
      }
  }
  function parseHex(hex) {
      return parseInt(hex.padEnd(2, hex), 16) / 255;
  }
  function parseAlpha(a, asPercentage) {
      return clamp(asPercentage ? (a / 100) : a, 0, 1);
  }
  function clamp(n, min, max) {
      return Math.min(Math.max(min, n), max);
  }
  /**
   * The regular expression for numeric values is not super specific, and it may
   * happen that it will accept a value that is not a valid number. In order to
   * detect and eliminate such values this function exists.
   *
   * @param array Array of uncertain numbers.
   * @returns `true` if the specified array contains only valid numbers, `false` otherwise.
   */
  function validateNumbers(array) {
      return !array.some(Number.isNaN);
  }
  /**
   * To generate:
   * - visit {@link https://www.w3.org/TR/css-color-4/#named-colors}
   * - run in the console:
   * @example
   * copy(`{\n${[...document.querySelector('.named-color-table tbody').children].map((tr) => `${tr.cells[2].textContent.trim()}: [${tr.cells[4].textContent.trim().split(/\s+/).join(', ')}],`).join('\n')}\n}`);
   */
  var namedColors = {
      aliceblue: [240, 248, 255],
      antiquewhite: [250, 235, 215],
      aqua: [0, 255, 255],
      aquamarine: [127, 255, 212],
      azure: [240, 255, 255],
      beige: [245, 245, 220],
      bisque: [255, 228, 196],
      black: [0, 0, 0],
      blanchedalmond: [255, 235, 205],
      blue: [0, 0, 255],
      blueviolet: [138, 43, 226],
      brown: [165, 42, 42],
      burlywood: [222, 184, 135],
      cadetblue: [95, 158, 160],
      chartreuse: [127, 255, 0],
      chocolate: [210, 105, 30],
      coral: [255, 127, 80],
      cornflowerblue: [100, 149, 237],
      cornsilk: [255, 248, 220],
      crimson: [220, 20, 60],
      cyan: [0, 255, 255],
      darkblue: [0, 0, 139],
      darkcyan: [0, 139, 139],
      darkgoldenrod: [184, 134, 11],
      darkgray: [169, 169, 169],
      darkgreen: [0, 100, 0],
      darkgrey: [169, 169, 169],
      darkkhaki: [189, 183, 107],
      darkmagenta: [139, 0, 139],
      darkolivegreen: [85, 107, 47],
      darkorange: [255, 140, 0],
      darkorchid: [153, 50, 204],
      darkred: [139, 0, 0],
      darksalmon: [233, 150, 122],
      darkseagreen: [143, 188, 143],
      darkslateblue: [72, 61, 139],
      darkslategray: [47, 79, 79],
      darkslategrey: [47, 79, 79],
      darkturquoise: [0, 206, 209],
      darkviolet: [148, 0, 211],
      deeppink: [255, 20, 147],
      deepskyblue: [0, 191, 255],
      dimgray: [105, 105, 105],
      dimgrey: [105, 105, 105],
      dodgerblue: [30, 144, 255],
      firebrick: [178, 34, 34],
      floralwhite: [255, 250, 240],
      forestgreen: [34, 139, 34],
      fuchsia: [255, 0, 255],
      gainsboro: [220, 220, 220],
      ghostwhite: [248, 248, 255],
      gold: [255, 215, 0],
      goldenrod: [218, 165, 32],
      gray: [128, 128, 128],
      green: [0, 128, 0],
      greenyellow: [173, 255, 47],
      grey: [128, 128, 128],
      honeydew: [240, 255, 240],
      hotpink: [255, 105, 180],
      indianred: [205, 92, 92],
      indigo: [75, 0, 130],
      ivory: [255, 255, 240],
      khaki: [240, 230, 140],
      lavender: [230, 230, 250],
      lavenderblush: [255, 240, 245],
      lawngreen: [124, 252, 0],
      lemonchiffon: [255, 250, 205],
      lightblue: [173, 216, 230],
      lightcoral: [240, 128, 128],
      lightcyan: [224, 255, 255],
      lightgoldenrodyellow: [250, 250, 210],
      lightgray: [211, 211, 211],
      lightgreen: [144, 238, 144],
      lightgrey: [211, 211, 211],
      lightpink: [255, 182, 193],
      lightsalmon: [255, 160, 122],
      lightseagreen: [32, 178, 170],
      lightskyblue: [135, 206, 250],
      lightslategray: [119, 136, 153],
      lightslategrey: [119, 136, 153],
      lightsteelblue: [176, 196, 222],
      lightyellow: [255, 255, 224],
      lime: [0, 255, 0],
      limegreen: [50, 205, 50],
      linen: [250, 240, 230],
      magenta: [255, 0, 255],
      maroon: [128, 0, 0],
      mediumaquamarine: [102, 205, 170],
      mediumblue: [0, 0, 205],
      mediumorchid: [186, 85, 211],
      mediumpurple: [147, 112, 219],
      mediumseagreen: [60, 179, 113],
      mediumslateblue: [123, 104, 238],
      mediumspringgreen: [0, 250, 154],
      mediumturquoise: [72, 209, 204],
      mediumvioletred: [199, 21, 133],
      midnightblue: [25, 25, 112],
      mintcream: [245, 255, 250],
      mistyrose: [255, 228, 225],
      moccasin: [255, 228, 181],
      navajowhite: [255, 222, 173],
      navy: [0, 0, 128],
      oldlace: [253, 245, 230],
      olive: [128, 128, 0],
      olivedrab: [107, 142, 35],
      orange: [255, 165, 0],
      orangered: [255, 69, 0],
      orchid: [218, 112, 214],
      palegoldenrod: [238, 232, 170],
      palegreen: [152, 251, 152],
      paleturquoise: [175, 238, 238],
      palevioletred: [219, 112, 147],
      papayawhip: [255, 239, 213],
      peachpuff: [255, 218, 185],
      peru: [205, 133, 63],
      pink: [255, 192, 203],
      plum: [221, 160, 221],
      powderblue: [176, 224, 230],
      purple: [128, 0, 128],
      rebeccapurple: [102, 51, 153],
      red: [255, 0, 0],
      rosybrown: [188, 143, 143],
      royalblue: [65, 105, 225],
      saddlebrown: [139, 69, 19],
      salmon: [250, 128, 114],
      sandybrown: [244, 164, 96],
      seagreen: [46, 139, 87],
      seashell: [255, 245, 238],
      sienna: [160, 82, 45],
      silver: [192, 192, 192],
      skyblue: [135, 206, 235],
      slateblue: [106, 90, 205],
      slategray: [112, 128, 144],
      slategrey: [112, 128, 144],
      snow: [255, 250, 250],
      springgreen: [0, 255, 127],
      steelblue: [70, 130, 180],
      tan: [210, 180, 140],
      teal: [0, 128, 128],
      thistle: [216, 191, 216],
      tomato: [255, 99, 71],
      turquoise: [64, 224, 208],
      violet: [238, 130, 238],
      wheat: [245, 222, 179],
      white: [255, 255, 255],
      whitesmoke: [245, 245, 245],
      yellow: [255, 255, 0],
      yellowgreen: [154, 205, 50],
  };

  function interpolateNumber(from, to, t) {
      return from + t * (to - from);
  }
  function interpolateArray(from, to, t) {
      return from.map(function (d, i) {
          return interpolateNumber(d, to[i], t);
      });
  }

  /**
   * Checks whether the specified color space is one of the supported interpolation color spaces.
   *
   * @param colorSpace Color space key to verify.
   * @returns `true` if the specified color space is one of the supported
   * interpolation color spaces, `false` otherwise
   */
  function isSupportedInterpolationColorSpace(colorSpace) {
      return colorSpace === 'rgb' || colorSpace === 'hcl' || colorSpace === 'lab';
  }
  /**
   * Color representation used by WebGL.
   * Defined in sRGB color space and pre-blended with alpha.
   * @private
   */
  var Color = function Color(r, g, b, alpha, premultiplied) {
        if ( alpha === void 0 ) alpha = 1;
        if ( premultiplied === void 0 ) premultiplied = true;

        this.r = r;
        this.g = g;
        this.b = b;
        this.a = alpha;
        if (!premultiplied) {
            this.r *= alpha;
            this.g *= alpha;
            this.b *= alpha;
            if (!alpha) {
                // alpha = 0 erases completely rgb channels. This behavior is not desirable
                // if this particular color is later used in color interpolation.
                // Because of that, a reference to original color is saved.
                this.overwriteGetter('rgb', [r, g, b, alpha]);
            }
        }
    };

  var prototypeAccessors = { rgb: { configurable: true },hcl: { configurable: true },lab: { configurable: true } };
    /**
     * Parses CSS color strings and converts colors to sRGB color space if needed.
     * Officially supported color formats:
     * - keyword, e.g. 'aquamarine' or 'steelblue'
     * - hex (with 3, 4, 6 or 8 digits), e.g. '#f0f' or '#e9bebea9'
     * - rgb and rgba, e.g. 'rgb(0,240,120)' or 'rgba(0%,94%,47%,0.1)' or 'rgb(0 240 120 / .3)'
     * - hsl and hsla, e.g. 'hsl(0,0%,83%)' or 'hsla(0,0%,83%,.5)' or 'hsl(0 0% 83% / 20%)'
     *
     * @param input CSS color string to parse.
     * @returns A `Color` instance, or `undefined` if the input is not a valid color string.
     */
    Color.parse = function parse (input) {
        // in zoom-and-property function input could be an instance of Color class
        if (input instanceof Color) {
            return input;
        }
        if (typeof input !== 'string') {
            return;
        }
        var rgba = parseCssColor(input);
        if (rgba) {
            return new (Function.prototype.bind.apply( Color, [ null ].concat( rgba, [false]) ));
        }
    };
    /**
     * Used in color interpolation and by 'to-rgba' expression.
     *
     * @returns Gien color, with reversed alpha blending, in sRGB color space.
     */
    prototypeAccessors.rgb.get = function () {
        var ref = this;
          var r = ref.r;
          var g = ref.g;
          var b = ref.b;
          var a = ref.a;
        var f = a || Infinity; // reverse alpha blending factor
        return this.overwriteGetter('rgb', [r / f, g / f, b / f, a]);
    };
    /**
     * Used in color interpolation.
     *
     * @returns Gien color, with reversed alpha blending, in HCL color space.
     */
    prototypeAccessors.hcl.get = function () {
        return this.overwriteGetter('hcl', rgbToHcl(this.rgb));
    };
    /**
     * Used in color interpolation.
     *
     * @returns Gien color, with reversed alpha blending, in LAB color space.
     */
    prototypeAccessors.lab.get = function () {
        return this.overwriteGetter('lab', rgbToLab(this.rgb));
    };
    /**
     * Lazy getter pattern. When getter is called for the first time lazy value
     * is calculated and then overwrites getter function in given object instance.
     *
     * @example:
     * const redColor = Color.parse('red');
     * let x = redColor.hcl; // this will invoke `get hcl()`, which will calculate
     * // the value of red in HCL space and invoke this `overwriteGetter` function
     * // which in turn will set a field with a key 'hcl' in the `redColor` object.
     * // In other words it will override `get hcl()` from its `Color` prototype
     * // with its own property: hcl = [calculated red value in hcl].
     * let y = redColor.hcl; // next call will no longer invoke getter but simply
     * // return the previously calculated value
     * x === y; // true - `x` is exactly the same object as `y`
     *
     * @param getterKey Getter key
     * @param lazyValue Lazily calculated value to be memoized by current instance
     * @private
     */
    Color.prototype.overwriteGetter = function overwriteGetter (getterKey, lazyValue) {
        Object.defineProperty(this, getterKey, { value: lazyValue });
        return lazyValue;
    };
    /**
     * Used by 'to-string' expression.
     *
     * @returns Serialized color in format `rgba(r,g,b,a)`
     * where r,g,b are numbers within 0..255 and alpha is number within 1..0
     *
     * @example
     * var purple = new Color.parse('purple');
     * purple.toString; // = "rgba(128,0,128,1)"
     * var translucentGreen = new Color.parse('rgba(26, 207, 26, .73)');
     * translucentGreen.toString(); // = "rgba(26,207,26,0.73)"
     */
    Color.prototype.toString = function toString () {
        var ref = this.rgb;
          var r = ref[0];
          var g = ref[1];
          var b = ref[2];
          var a = ref[3];
        return ("rgba(" + ([r, g, b].map(function (n) { return Math.round(n * 255); }).join(',')) + "," + a + ")");
    };
    Color.interpolate = function interpolate (from, to, t, spaceKey) {
          if ( spaceKey === void 0 ) spaceKey = 'rgb';

        switch (spaceKey) {
            case 'rgb': {
                var ref = interpolateArray(from.rgb, to.rgb, t);
                  var r = ref[0];
                  var g = ref[1];
                  var b = ref[2];
                  var alpha = ref[3];
                return new Color(r, g, b, alpha, false);
            }
            case 'hcl': {
                var ref$1 = from.hcl;
                  var hue0 = ref$1[0];
                  var chroma0 = ref$1[1];
                  var light0 = ref$1[2];
                  var alphaF = ref$1[3];
                var ref$2 = to.hcl;
                  var hue1 = ref$2[0];
                  var chroma1 = ref$2[1];
                  var light1 = ref$2[2];
                  var alphaT = ref$2[3];
                // https://github.com/gka/chroma.js/blob/cd1b3c0926c7a85cbdc3b1453b3a94006de91a92/src/interpolator/_hsx.js
                var hue, chroma;
                if (!isNaN(hue0) && !isNaN(hue1)) {
                    var dh = hue1 - hue0;
                    if (hue1 > hue0 && dh > 180) {
                        dh -= 360;
                    }
                    else if (hue1 < hue0 && hue0 - hue1 > 180) {
                        dh += 360;
                    }
                    hue = hue0 + t * dh;
                }
                else if (!isNaN(hue0)) {
                    hue = hue0;
                    if (light1 === 1 || light1 === 0)
                        { chroma = chroma0; }
                }
                else if (!isNaN(hue1)) {
                    hue = hue1;
                    if (light0 === 1 || light0 === 0)
                        { chroma = chroma1; }
                }
                else {
                    hue = NaN;
                }
                var ref$3 = hclToRgb([
                    hue,
                    chroma !== null && chroma !== void 0 ? chroma : interpolateNumber(chroma0, chroma1, t),
                    interpolateNumber(light0, light1, t),
                    interpolateNumber(alphaF, alphaT, t) ]);
                  var r$1 = ref$3[0];
                  var g$1 = ref$3[1];
                  var b$1 = ref$3[2];
                  var alpha$1 = ref$3[3];
                return new Color(r$1, g$1, b$1, alpha$1, false);
            }
            case 'lab': {
                var ref$4 = labToRgb(interpolateArray(from.lab, to.lab, t));
                  var r$2 = ref$4[0];
                  var g$2 = ref$4[1];
                  var b$2 = ref$4[2];
                  var alpha$2 = ref$4[3];
                return new Color(r$2, g$2, b$2, alpha$2, false);
            }
        }
    };

  Object.defineProperties( Color.prototype, prototypeAccessors );
  Color.black = new Color(0, 0, 0, 1);
  Color.white = new Color(1, 1, 1, 1);
  Color.transparent = new Color(0, 0, 0, 0);
  Color.red = new Color(1, 0, 0, 1);

  // Flow type declarations for Intl cribbed from
  // https://github.com/facebook/flow/issues/1270
  var Collator = function Collator(caseSensitive, diacriticSensitive, locale) {
        if (caseSensitive)
            { this.sensitivity = diacriticSensitive ? 'variant' : 'case'; }
        else
            { this.sensitivity = diacriticSensitive ? 'accent' : 'base'; }
        this.locale = locale;
        this.collator = new Intl.Collator(this.locale ? this.locale : [], { sensitivity: this.sensitivity, usage: 'search' });
    };
    Collator.prototype.compare = function compare (lhs, rhs) {
        return this.collator.compare(lhs, rhs);
    };
    Collator.prototype.resolvedLocale = function resolvedLocale () {
        // We create a Collator without "usage: search" because we don't want
        // the search options encoded in our result (e.g. "en-u-co-search")
        return new Intl.Collator(this.locale ? this.locale : [])
            .resolvedOptions().locale;
    };

  var FormattedSection = function FormattedSection(text, image, scale, fontStack, textColor) {
        this.text = text;
        this.image = image;
        this.scale = scale;
        this.fontStack = fontStack;
        this.textColor = textColor;
    };
  var Formatted = function Formatted(sections) {
        this.sections = sections;
    };
    Formatted.fromString = function fromString (unformatted) {
        return new Formatted([new FormattedSection(unformatted, null, null, null, null)]);
    };
    Formatted.prototype.isEmpty = function isEmpty () {
        if (this.sections.length === 0)
            { return true; }
        return !this.sections.some(function (section) { return section.text.length !== 0 ||
            (section.image && section.image.name.length !== 0); });
    };
    Formatted.factory = function factory (text) {
        if (text instanceof Formatted) {
            return text;
        }
        else {
            return Formatted.fromString(text);
        }
    };
    Formatted.prototype.toString = function toString () {
        if (this.sections.length === 0)
            { return ''; }
        return this.sections.map(function (section) { return section.text; }).join('');
    };

  /**
   * A set of four numbers representing padding around a box. Create instances from
   * bare arrays or numeric values using the static method `Padding.parse`.
   * @private
   */
  var Padding = function Padding(values) {
        this.values = values.slice();
    };
    /**
     * Numeric padding values
     * @param input A padding value
     * @returns A `Padding` instance, or `undefined` if the input is not a valid padding value.
     */
    Padding.parse = function parse (input) {
        if (input instanceof Padding) {
            return input;
        }
        // Backwards compatibility: bare number is treated the same as array with single value.
        // Padding applies to all four sides.
        if (typeof input === 'number') {
            return new Padding([input, input, input, input]);
        }
        if (!Array.isArray(input)) {
            return undefined;
        }
        if (input.length < 1 || input.length > 4) {
            return undefined;
        }
        for (var i = 0, list = input; i < list.length; i += 1) {
            var val = list[i];

            if (typeof val !== 'number') {
                return undefined;
            }
        }
        // Expand shortcut properties into explicit 4-sided values
        switch (input.length) {
            case 1:
                input = [input[0], input[0], input[0], input[0]];
                break;
            case 2:
                input = [input[0], input[1], input[0], input[1]];
                break;
            case 3:
                input = [input[0], input[1], input[2], input[1]];
                break;
        }
        return new Padding(input);
    };
    Padding.prototype.toString = function toString () {
        return JSON.stringify(this.values);
    };
    Padding.interpolate = function interpolate (from, to, t) {
        return new Padding(interpolateArray(from.values, to.values, t));
    };

  var RuntimeError = function RuntimeError(message) {
        this.name = 'ExpressionEvaluationError';
        this.message = message;
    };
    RuntimeError.prototype.toJSON = function toJSON () {
        return this.message;
    };

  /** Set of valid anchor positions, as a set for validation */
  var anchors = new Set(['center', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);
  /**
   * Utility class to assist managing values for text-variable-anchor-offset property. Create instances from
   * bare arrays using the static method `VariableAnchorOffsetCollection.parse`.
   * @private
   */
  var VariableAnchorOffsetCollection = function VariableAnchorOffsetCollection(values) {
        this.values = values.slice();
    };
    VariableAnchorOffsetCollection.parse = function parse (input) {
        if (input instanceof VariableAnchorOffsetCollection) {
            return input;
        }
        if (!Array.isArray(input) ||
            input.length < 1 ||
            input.length % 2 !== 0) {
            return undefined;
        }
        for (var i = 0; i < input.length; i += 2) {
            // Elements in even positions should be anchor positions; Elements in odd positions should be offset values
            var anchorValue = input[i];
            var offsetValue = input[i + 1];
            if (typeof anchorValue !== 'string' || !anchors.has(anchorValue)) {
                return undefined;
            }
            if (!Array.isArray(offsetValue) || offsetValue.length !== 2 || typeof offsetValue[0] !== 'number' || typeof offsetValue[1] !== 'number') {
                return undefined;
            }
        }
        return new VariableAnchorOffsetCollection(input);
    };
    VariableAnchorOffsetCollection.prototype.toString = function toString () {
        return JSON.stringify(this.values);
    };
    VariableAnchorOffsetCollection.interpolate = function interpolate (from, to, t) {
        var fromValues = from.values;
        var toValues = to.values;
        if (fromValues.length !== toValues.length) {
            throw new RuntimeError(("Cannot interpolate values of different length. from: " + (from.toString()) + ", to: " + (to.toString())));
        }
        var output = [];
        for (var i = 0; i < fromValues.length; i += 2) {
            // Anchor entries must match
            if (fromValues[i] !== toValues[i]) {
                throw new RuntimeError(("Cannot interpolate values containing mismatched anchors. from[" + i + "]: " + (fromValues[i]) + ", to[" + i + "]: " + (toValues[i])));
            }
            output.push(fromValues[i]);
            // Interpolate the offset values for each anchor
            var ref = fromValues[i + 1];
              var fx = ref[0];
              var fy = ref[1];
            var ref$1 = toValues[i + 1];
              var tx = ref$1[0];
              var ty = ref$1[1];
            output.push([interpolateNumber(fx, tx, t), interpolateNumber(fy, ty, t)]);
        }
        return new VariableAnchorOffsetCollection(output);
    };

  var ResolvedImage = function ResolvedImage(options) {
        this.name = options.name;
        this.available = options.available;
    };
    ResolvedImage.prototype.toString = function toString () {
        return this.name;
    };
    ResolvedImage.fromString = function fromString (name) {
        if (!name)
            { return null; } // treat empty values as no image
        return new ResolvedImage({ name: name, available: false });
    };

  var ProjectionDefinition = function ProjectionDefinition(from, to, transition) {
        this.from = from;
        this.to = to;
        this.transition = transition;
    };
    ProjectionDefinition.interpolate = function interpolate (from, to, t) {
        return new ProjectionDefinition(from, to, t);
    };
    ProjectionDefinition.parse = function parse (input) {
        if (input instanceof ProjectionDefinition) {
            return input;
        }
        if (Array.isArray(input) && input.length === 3 && typeof input[0] === 'string' && typeof input[1] === 'string' && typeof input[2] === 'number') {
            return new ProjectionDefinition(input[0], input[1], input[2]);
        }
        if (typeof input === 'object' && typeof input.from === 'string' && typeof input.to === 'string' && typeof input.transition === 'number') {
            return new ProjectionDefinition(input.from, input.to, input.transition);
        }
        if (typeof input === 'string') {
            return new ProjectionDefinition(input, input, 1);
        }
        return undefined;
    };

  function validateRGBA(r, g, b, a) {
      if (!(typeof r === 'number' && r >= 0 && r <= 255 &&
          typeof g === 'number' && g >= 0 && g <= 255 &&
          typeof b === 'number' && b >= 0 && b <= 255)) {
          var value = typeof a === 'number' ? [r, g, b, a] : [r, g, b];
          return ("Invalid rgba value [" + (value.join(', ')) + "]: 'r', 'g', and 'b' must be between 0 and 255.");
      }
      if (!(typeof a === 'undefined' || (typeof a === 'number' && a >= 0 && a <= 1))) {
          return ("Invalid rgba value [" + ([r, g, b, a].join(', ')) + "]: 'a' must be between 0 and 1.");
      }
      return null;
  }
  function isValue(mixed) {
      if (mixed === null ||
          typeof mixed === 'string' ||
          typeof mixed === 'boolean' ||
          typeof mixed === 'number' ||
          mixed instanceof ProjectionDefinition ||
          mixed instanceof Color ||
          mixed instanceof Collator ||
          mixed instanceof Formatted ||
          mixed instanceof Padding ||
          mixed instanceof VariableAnchorOffsetCollection ||
          mixed instanceof ResolvedImage) {
          return true;
      }
      else if (Array.isArray(mixed)) {
          for (var i = 0, list = mixed; i < list.length; i += 1) {
              var item = list[i];

            if (!isValue(item)) {
                  return false;
              }
          }
          return true;
      }
      else if (typeof mixed === 'object') {
          for (var key in mixed) {
              if (!isValue(mixed[key])) {
                  return false;
              }
          }
          return true;
      }
      else {
          return false;
      }
  }
  function typeOf(value) {
      if (value === null) {
          return NullType;
      }
      else if (typeof value === 'string') {
          return StringType;
      }
      else if (typeof value === 'boolean') {
          return BooleanType;
      }
      else if (typeof value === 'number') {
          return NumberType;
      }
      else if (value instanceof Color) {
          return ColorType;
      }
      else if (value instanceof ProjectionDefinition) {
          return ProjectionDefinitionType;
      }
      else if (value instanceof Collator) {
          return CollatorType;
      }
      else if (value instanceof Formatted) {
          return FormattedType;
      }
      else if (value instanceof Padding) {
          return PaddingType;
      }
      else if (value instanceof VariableAnchorOffsetCollection) {
          return VariableAnchorOffsetCollectionType;
      }
      else if (value instanceof ResolvedImage) {
          return ResolvedImageType;
      }
      else if (Array.isArray(value)) {
          var length = value.length;
          var itemType;
          for (var i = 0, list = value; i < list.length; i += 1) {
              var item = list[i];

            var t = typeOf(item);
              if (!itemType) {
                  itemType = t;
              }
              else if (itemType === t) {
                  continue;
              }
              else {
                  itemType = ValueType;
                  break;
              }
          }
          return array(itemType || ValueType, length);
      }
      else {
          return ObjectType;
      }
  }
  function valueToString(value) {
      var type = typeof value;
      if (value === null) {
          return '';
      }
      else if (type === 'string' || type === 'number' || type === 'boolean') {
          return String(value);
      }
      else if (value instanceof Color || value instanceof ProjectionDefinition || value instanceof Formatted || value instanceof Padding || value instanceof VariableAnchorOffsetCollection || value instanceof ResolvedImage) {
          return value.toString();
      }
      else {
          return JSON.stringify(value);
      }
  }

  var Literal = function Literal(type, value) {
        this.type = type;
        this.value = value;
    };
    Literal.parse = function parse (args, context) {
        if (args.length !== 2)
            { return context.error(("'literal' expression requires exactly one argument, but found " + (args.length - 1) + " instead.")); }
        if (!isValue(args[1]))
            { return context.error('invalid value'); }
        var value = args[1];
        var type = typeOf(value);
        // special case: infer the item type if possible for zero-length arrays
        var expected = context.expectedType;
        if (type.kind === 'array' &&
            type.N === 0 &&
            expected &&
            expected.kind === 'array' &&
            (typeof expected.N !== 'number' || expected.N === 0)) {
            type = expected;
        }
        return new Literal(type, value);
    };
    Literal.prototype.evaluate = function evaluate () {
        return this.value;
    };
    Literal.prototype.eachChild = function eachChild () { };
    Literal.prototype.outputDefined = function outputDefined () {
        return true;
    };

  var types$1 = {
      string: StringType,
      number: NumberType,
      boolean: BooleanType,
      object: ObjectType
  };
  var Assertion = function Assertion(type, args) {
        this.type = type;
        this.args = args;
    };
    Assertion.parse = function parse (args, context) {
        if (args.length < 2)
            { return context.error('Expected at least one argument.'); }
        var i = 1;
        var type;
        var name = args[0];
        if (name === 'array') {
            var itemType;
            if (args.length > 2) {
                var type$1 = args[1];
                if (typeof type$1 !== 'string' || !(type$1 in types$1) || type$1 === 'object')
                    { return context.error('The item type argument of "array" must be one of string, number, boolean', 1); }
                itemType = types$1[type$1];
                i++;
            }
            else {
                itemType = ValueType;
            }
            var N;
            if (args.length > 3) {
                if (args[2] !== null &&
                    (typeof args[2] !== 'number' ||
                        args[2] < 0 ||
                        args[2] !== Math.floor(args[2]))) {
                    return context.error('The length argument to "array" must be a positive integer literal', 2);
                }
                N = args[2];
                i++;
            }
            type = array(itemType, N);
        }
        else {
            if (!types$1[name])
                { throw new Error(("Types doesn't contain name = " + name)); }
            type = types$1[name];
        }
        var parsed = [];
        for (; i < args.length; i++) {
            var input = context.parse(args[i], i, ValueType);
            if (!input)
                { return null; }
            parsed.push(input);
        }
        return new Assertion(type, parsed);
    };
    Assertion.prototype.evaluate = function evaluate (ctx) {
        for (var i = 0; i < this.args.length; i++) {
            var value = this.args[i].evaluate(ctx);
            var error = checkSubtype(this.type, typeOf(value));
            if (!error) {
                return value;
            }
            else if (i === this.args.length - 1) {
                throw new RuntimeError(("Expected value to be of type " + (typeToString(this.type)) + ", but found " + (typeToString(typeOf(value))) + " instead."));
            }
        }
        throw new Error();
    };
    Assertion.prototype.eachChild = function eachChild (fn) {
        this.args.forEach(fn);
    };
    Assertion.prototype.outputDefined = function outputDefined () {
        return this.args.every(function (arg) { return arg.outputDefined(); });
    };

  var types = {
      'to-boolean': BooleanType,
      'to-color': ColorType,
      'to-number': NumberType,
      'to-string': StringType
  };
  /**
   * Special form for error-coalescing coercion expressions "to-number",
   * "to-color".  Since these coercions can fail at runtime, they accept multiple
   * arguments, only evaluating one at a time until one succeeds.
   *
   * @private
   */
  var Coercion = function Coercion(type, args) {
        this.type = type;
        this.args = args;
    };
    Coercion.parse = function parse (args, context) {
        if (args.length < 2)
            { return context.error('Expected at least one argument.'); }
        var name = args[0];
        if (!types[name])
            { throw new Error(("Can't parse " + name + " as it is not part of the known types")); }
        if ((name === 'to-boolean' || name === 'to-string') && args.length !== 2)
            { return context.error('Expected one argument.'); }
        var type = types[name];
        var parsed = [];
        for (var i = 1; i < args.length; i++) {
            var input = context.parse(args[i], i, ValueType);
            if (!input)
                { return null; }
            parsed.push(input);
        }
        return new Coercion(type, parsed);
    };
    Coercion.prototype.evaluate = function evaluate (ctx) {
        switch (this.type.kind) {
            case 'boolean':
                return Boolean(this.args[0].evaluate(ctx));
            case 'color': {
                var input;
                var error;
                for (var i = 0, list = this.args; i < list.length; i += 1) {
                    var arg = list[i];

                    input = arg.evaluate(ctx);
                    error = null;
                    if (input instanceof Color) {
                        return input;
                    }
                    else if (typeof input === 'string') {
                        var c = ctx.parseColor(input);
                        if (c)
                            { return c; }
                    }
                    else if (Array.isArray(input)) {
                        if (input.length < 3 || input.length > 4) {
                            error = "Invalid rgba value " + (JSON.stringify(input)) + ": expected an array containing either three or four numeric values.";
                        }
                        else {
                            error = validateRGBA(input[0], input[1], input[2], input[3]);
                        }
                        if (!error) {
                            return new Color(input[0] / 255, input[1] / 255, input[2] / 255, input[3]);
                        }
                    }
                }
                throw new RuntimeError(error || ("Could not parse color from value '" + (typeof input === 'string' ? input : JSON.stringify(input)) + "'"));
            }
            case 'padding': {
                var input$1;
                for (var i$1 = 0, list$1 = this.args; i$1 < list$1.length; i$1 += 1) {
                    var arg$1 = list$1[i$1];

                    input$1 = arg$1.evaluate(ctx);
                    var pad = Padding.parse(input$1);
                    if (pad) {
                        return pad;
                    }
                }
                throw new RuntimeError(("Could not parse padding from value '" + (typeof input$1 === 'string' ? input$1 : JSON.stringify(input$1)) + "'"));
            }
            case 'variableAnchorOffsetCollection': {
                var input$2;
                for (var i$2 = 0, list$2 = this.args; i$2 < list$2.length; i$2 += 1) {
                    var arg$2 = list$2[i$2];

                    input$2 = arg$2.evaluate(ctx);
                    var coll = VariableAnchorOffsetCollection.parse(input$2);
                    if (coll) {
                        return coll;
                    }
                }
                throw new RuntimeError(("Could not parse variableAnchorOffsetCollection from value '" + (typeof input$2 === 'string' ? input$2 : JSON.stringify(input$2)) + "'"));
            }
            case 'number': {
                var value = null;
                for (var i$3 = 0, list$3 = this.args; i$3 < list$3.length; i$3 += 1) {
                    var arg$3 = list$3[i$3];

                    value = arg$3.evaluate(ctx);
                    if (value === null)
                        { return 0; }
                    var num = Number(value);
                    if (isNaN(num))
                        { continue; }
                    return num;
                }
                throw new RuntimeError(("Could not convert " + (JSON.stringify(value)) + " to number."));
            }
            case 'formatted':
                // There is no explicit 'to-formatted' but this coercion can be implicitly
                // created by properties that expect the 'formatted' type.
                return Formatted.fromString(valueToString(this.args[0].evaluate(ctx)));
            case 'resolvedImage':
                return ResolvedImage.fromString(valueToString(this.args[0].evaluate(ctx)));
            case 'projectionDefinition':
                return this.args[0].evaluate(ctx);
            default:
                return valueToString(this.args[0].evaluate(ctx));
        }
    };
    Coercion.prototype.eachChild = function eachChild (fn) {
        this.args.forEach(fn);
    };
    Coercion.prototype.outputDefined = function outputDefined () {
        return this.args.every(function (arg) { return arg.outputDefined(); });
    };

  /**
   * Rearranges items so that all items in the [left, k] are the smallest.
   * The k-th element will have the (k - left + 1)-th smallest value in [left, right].
   *
   * @template T
   * @param {T[]} arr the array to partially sort (in place)
   * @param {number} k middle index for partial sorting (as defined above)
   * @param {number} [left=0] left index of the range to sort
   * @param {number} [right=arr.length-1] right index
   * @param {(a: T, b: T) => number} [compare = (a, b) => a - b] compare function
   */
  function quickselect(arr, k, left, right, compare) {
      if ( left === void 0 ) left = 0;
      if ( right === void 0 ) right = arr.length - 1;
      if ( compare === void 0 ) compare = defaultCompare;


      while (right > left) {
          if (right - left > 600) {
              var n = right - left + 1;
              var m = k - left + 1;
              var z = Math.log(n);
              var s = 0.5 * Math.exp(2 * z / 3);
              var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
              var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
              var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
              quickselect(arr, k, newLeft, newRight, compare);
          }

          var t = arr[k];
          var i = left;
          /** @type {number} */
          var j = right;

          swap(arr, left, k);
          if (compare(arr[right], t) > 0) { swap(arr, left, right); }

          while (i < j) {
              swap(arr, i, j);
              i++;
              j--;
              while (compare(arr[i], t) < 0) { i++; }
              while (compare(arr[j], t) > 0) { j--; }
          }

          if (compare(arr[left], t) === 0) { swap(arr, left, j); }
          else {
              j++;
              swap(arr, j, right);
          }

          if (j <= k) { left = j + 1; }
          if (k <= j) { right = j - 1; }
      }
  }

  /**
   * @template T
   * @param {T[]} arr
   * @param {number} i
   * @param {number} j
   */
  function swap(arr, i, j) {
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
  }

  /**
   * @template T
   * @param {T} a
   * @param {T} b
   * @returns {number}
   */
  function defaultCompare(a, b) {
      return a < b ? -1 : a > b ? 1 : 0;
  }

  /**
   * Classifies an array of rings into polygons with outer rings and holes
   * @param rings - the rings to classify
   * @param maxRings - the maximum number of rings to include in a polygon, use 0 to include all rings
   * @returns an array of polygons with internal rings as holes
   */
  function classifyRings(rings, maxRings) {
      var len = rings.length;
      if (len <= 1)
          { return [rings]; }
      var polygons = [];
      var polygon;
      var ccw;
      for (var i = 0, list = rings; i < list.length; i += 1) {
          var ring = list[i];

        var area = calculateSignedArea(ring);
          if (area === 0)
              { continue; }
          ring.area = Math.abs(area);
          if (ccw === undefined)
              { ccw = area < 0; }
          if (ccw === area < 0) {
              if (polygon)
                  { polygons.push(polygon); }
              polygon = [ring];
          }
          else {
              polygon.push(ring);
          }
      }
      if (polygon)
          { polygons.push(polygon); }
      // Earcut performance degrades with the # of rings in a polygon. For this
      // reason, we limit strip out all but the `maxRings` largest rings.
      if (maxRings > 1) {
          for (var j = 0; j < polygons.length; j++) {
              if (polygons[j].length <= maxRings)
                  { continue; }
              quickselect(polygons[j], maxRings, 1, polygons[j].length - 1, compareAreas);
              polygons[j] = polygons[j].slice(0, maxRings);
          }
      }
      return polygons;
  }
  function compareAreas(a, b) {
      return b.area - a.area;
  }
  /**
   * Returns the signed area for the polygon ring.  Positive areas are exterior rings and
   * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
   * ordering.
   *
   * @param ring - Exterior or interior ring
   * @returns Signed area
   */
  function calculateSignedArea(ring) {
      var sum = 0;
      for (var i = 0, len = ring.length, j = len - 1, p1 = (void 0), p2 = (void 0); i < len; j = i++) {
          p1 = ring[i];
          p2 = ring[j];
          sum += (p2.x - p1.x) * (p1.y + p2.y);
      }
      return sum;
  }
  /**
   * Returns if there are multiple outer rings.
   * The first ring is an outer ring. Its direction, cw or ccw, defines the direction of outer rings.
   *
   * @param rings - List of rings
   * @returns Are there multiple outer rings
   */
  function hasMultipleOuterRings(rings) {
      // Following https://github.com/mapbox/vector-tile-js/blob/77851380b63b07fd0af3d5a3f144cc86fb39fdd1/lib/vectortilefeature.js#L197
      var len = rings.length;
      for (var i = 0, direction = (void 0); i < len; i++) {
          var area = calculateSignedArea(rings[i]);
          if (area === 0)
              { continue; }
          if (direction === undefined) {
              // Keep the direction of the first ring
              direction = area < 0;
          }
          else if (direction === area < 0) {
              // Same direction as the first ring -> a second outer ring
              return true;
          }
      }
      return false;
  }

  var geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];
  var simpleGeometryType = {
      'Unknown': 'Unknown',
      'Point': 'Point',
      'MultiPoint': 'Point',
      'LineString': 'LineString',
      'MultiLineString': 'LineString',
      'Polygon': 'Polygon',
      'MultiPolygon': 'Polygon'
  };
  var EvaluationContext = function EvaluationContext() {
        this.globals = null;
        this.feature = null;
        this.featureState = null;
        this.formattedSection = null;
        this._parseColorCache = {};
        this.availableImages = null;
        this.canonical = null;
    };
    EvaluationContext.prototype.id = function id () {
        return this.feature && 'id' in this.feature ? this.feature.id : null;
    };
    EvaluationContext.prototype.geometryDollarType = function geometryDollarType () {
        return this.feature ?
            typeof this.feature.type === 'number' ? geometryTypes[this.feature.type] : simpleGeometryType[this.feature.type] :
            null;
    };
    EvaluationContext.prototype.geometryType = function geometryType () {
        var geometryType = this.feature.type;
        if (typeof geometryType !== 'number') {
            return geometryType;
        }
        geometryType = geometryTypes[this.feature.type];
        if (geometryType === 'Unknown') {
            return geometryType;
        }
        var geom = this.geometry();
        var len = geom.length;
        if (len === 1) {
            return geometryType;
        }
        if (geometryType !== 'Polygon') {
            return ("Multi" + geometryType);
        }
        if (hasMultipleOuterRings(geom)) {
            return 'MultiPolygon';
        }
        return 'Polygon';
    };
    EvaluationContext.prototype.geometry = function geometry () {
        return this.feature && 'geometry' in this.feature ? this.feature.geometry : null;
    };
    EvaluationContext.prototype.canonicalID = function canonicalID () {
        return this.canonical;
    };
    EvaluationContext.prototype.properties = function properties () {
        return this.feature && this.feature.properties || {};
    };
    EvaluationContext.prototype.parseColor = function parseColor (input) {
        var cached = this._parseColorCache[input];
        if (!cached) {
            cached = this._parseColorCache[input] = Color.parse(input);
        }
        return cached;
    };

  /**
   * State associated parsing at a given point in an expression tree.
   * @private
   */
  var ParsingContext = function ParsingContext(registry, isConstantFunc, path, expectedType, scope, errors) {
        if ( path === void 0 ) path = [];
        if ( scope === void 0 ) scope = new Scope();
        if ( errors === void 0 ) errors = [];

        this.registry = registry;
        this.path = path;
        this.key = path.map(function (part) { return ("[" + part + "]"); }).join('');
        this.scope = scope;
        this.errors = errors;
        this.expectedType = expectedType;
        this._isConstant = isConstantFunc;
    };
    /**
     * @param expr the JSON expression to parse
     * @param index the optional argument index if this expression is an argument of a parent expression that's being parsed
     * @param options
     * @param options.omitTypeAnnotations set true to omit inferred type annotations.Caller beware: with this option set, the parsed expression's type will NOT satisfy `expectedType` if it would normally be wrapped in an inferred annotation.
     * @private
     */
    ParsingContext.prototype.parse = function parse (expr, index, expectedType, bindings, options) {
          if ( options === void 0 ) options = {};

        if (index) {
            return this.concat(index, expectedType, bindings)._parse(expr, options);
        }
        return this._parse(expr, options);
    };
    ParsingContext.prototype._parse = function _parse (expr, options) {
        if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
            expr = ['literal', expr];
        }
        function annotate(parsed, type, typeAnnotation) {
            if (typeAnnotation === 'assert') {
                return new Assertion(type, [parsed]);
            }
            else if (typeAnnotation === 'coerce') {
                return new Coercion(type, [parsed]);
            }
            else {
                return parsed;
            }
        }
        if (Array.isArray(expr)) {
            if (expr.length === 0) {
                return this.error('Expected an array with at least one element. If you wanted a literal array, use ["literal", []].');
            }
            var op = expr[0];
            if (typeof op !== 'string') {
                this.error(("Expression name must be a string, but found " + (typeof op) + " instead. If you wanted a literal array, use [\"literal\", [...]]."), 0);
                return null;
            }
            var Expr = this.registry[op];
            if (Expr) {
                var parsed = Expr.parse(expr, this);
                if (!parsed)
                    { return null; }
                if (this.expectedType) {
                    var expected = this.expectedType;
                    var actual = parsed.type;
                    // When we expect a number, string, boolean, or array but have a value, wrap it in an assertion.
                    // When we expect a color or formatted string, but have a string or value, wrap it in a coercion.
                    // Otherwise, we do static type-checking.
                    //
                    // These behaviors are overridable for:
                    // * The "coalesce" operator, which needs to omit type annotations.
                    // * String-valued properties (e.g. `text-field`), where coercion is more convenient than assertion.
                    //
                    if ((expected.kind === 'string' || expected.kind === 'number' || expected.kind === 'boolean' || expected.kind === 'object' || expected.kind === 'array') && actual.kind === 'value') {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'assert');
                    }
                    else if ((expected.kind === 'projectionDefinition') && (actual.kind === 'string' || actual.kind === 'array')) {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'coerce');
                    }
                    else if ((expected.kind === 'color' || expected.kind === 'formatted' || expected.kind === 'resolvedImage') && (actual.kind === 'value' || actual.kind === 'string')) {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'coerce');
                    }
                    else if (expected.kind === 'padding' && (actual.kind === 'value' || actual.kind === 'number' || actual.kind === 'array')) {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'coerce');
                    }
                    else if (expected.kind === 'variableAnchorOffsetCollection' && (actual.kind === 'value' || actual.kind === 'array')) {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'coerce');
                    }
                    else if (this.checkSubtype(expected, actual)) {
                        return null;
                    }
                }
                // If an expression's arguments are all literals, we can evaluate
                // it immediately and replace it with a literal value in the
                // parsed/compiled result. Expressions that expect an image should
                // not be resolved here so we can later get the available images.
                if (!(parsed instanceof Literal) && (parsed.type.kind !== 'resolvedImage') && this._isConstant(parsed)) {
                    var ec = new EvaluationContext();
                    try {
                        parsed = new Literal(parsed.type, parsed.evaluate(ec));
                    }
                    catch (e) {
                        this.error(e.message);
                        return null;
                    }
                }
                return parsed;
            }
            return this.error(("Unknown expression \"" + op + "\". If you wanted a literal array, use [\"literal\", [...]]."), 0);
        }
        else if (typeof expr === 'undefined') {
            return this.error('\'undefined\' value invalid. Use null instead.');
        }
        else if (typeof expr === 'object') {
            return this.error('Bare objects invalid. Use ["literal", {...}] instead.');
        }
        else {
            return this.error(("Expected an array, but found " + (typeof expr) + " instead."));
        }
    };
    /**
     * Returns a copy of this context suitable for parsing the subexpression at
     * index `index`, optionally appending to 'let' binding map.
     *
     * Note that `errors` property, intended for collecting errors while
     * parsing, is copied by reference rather than cloned.
     * @private
     */
    ParsingContext.prototype.concat = function concat (index, expectedType, bindings) {
        var path = typeof index === 'number' ? this.path.concat(index) : this.path;
        var scope = bindings ? this.scope.concat(bindings) : this.scope;
        return new ParsingContext(this.registry, this._isConstant, path, expectedType || null, scope, this.errors);
    };
    /**
     * Push a parsing (or type checking) error into the `this.errors`
     * @param error The message
     * @param keys Optionally specify the source of the error at a child
     * of the current expression at `this.key`.
     * @private
     */
    ParsingContext.prototype.error = function error (error$1) {
          var keys = [], len = arguments.length - 1;
          while ( len-- > 0 ) keys[ len ] = arguments[ len + 1 ];

        var key = "" + (this.key) + (keys.map(function (k) { return ("[" + k + "]"); }).join(''));
        this.errors.push(new ExpressionParsingError(key, error$1));
    };
    /**
     * Returns null if `t` is a subtype of `expected`; otherwise returns an
     * error message and also pushes it to `this.errors`.
     * @param expected The expected type
     * @param t The actual type
     * @returns null if `t` is a subtype of `expected`; otherwise returns an error message
     */
    ParsingContext.prototype.checkSubtype = function checkSubtype$1 (expected, t) {
        var error = checkSubtype(expected, t);
        if (error)
            { this.error(error); }
        return error;
    };

  var Let = function Let(bindings, result) {
        this.type = result.type;
        this.bindings = [].concat(bindings);
        this.result = result;
    };
    Let.prototype.evaluate = function evaluate (ctx) {
        return this.result.evaluate(ctx);
    };
    Let.prototype.eachChild = function eachChild (fn) {
        for (var i = 0, list = this.bindings; i < list.length; i += 1) {
            var binding = list[i];

            fn(binding[1]);
        }
        fn(this.result);
    };
    Let.parse = function parse (args, context) {
        if (args.length < 4)
            { return context.error(("Expected at least 3 arguments, but found " + (args.length - 1) + " instead.")); }
        var bindings = [];
        for (var i = 1; i < args.length - 1; i += 2) {
            var name = args[i];
            if (typeof name !== 'string') {
                return context.error(("Expected string, but found " + (typeof name) + " instead."), i);
            }
            if (/[^a-zA-Z0-9_]/.test(name)) {
                return context.error('Variable names must contain only alphanumeric characters or \'_\'.', i);
            }
            var value = context.parse(args[i + 1], i + 1);
            if (!value)
                { return null; }
            bindings.push([name, value]);
        }
        var result = context.parse(args[args.length - 1], args.length - 1, context.expectedType, bindings);
        if (!result)
            { return null; }
        return new Let(bindings, result);
    };
    Let.prototype.outputDefined = function outputDefined () {
        return this.result.outputDefined();
    };

  var Var = function Var(name, boundExpression) {
        this.type = boundExpression.type;
        this.name = name;
        this.boundExpression = boundExpression;
    };
    Var.parse = function parse (args, context) {
        if (args.length !== 2 || typeof args[1] !== 'string')
            { return context.error('\'var\' expression requires exactly one string literal argument.'); }
        var name = args[1];
        if (!context.scope.has(name)) {
            return context.error(("Unknown variable \"" + name + "\". Make sure \"" + name + "\" has been bound in an enclosing \"let\" expression before using it."), 1);
        }
        return new Var(name, context.scope.get(name));
    };
    Var.prototype.evaluate = function evaluate (ctx) {
        return this.boundExpression.evaluate(ctx);
    };
    Var.prototype.eachChild = function eachChild () { };
    Var.prototype.outputDefined = function outputDefined () {
        return false;
    };

  var At = function At(type, index, input) {
        this.type = type;
        this.index = index;
        this.input = input;
    };
    At.parse = function parse (args, context) {
        if (args.length !== 3)
            { return context.error(("Expected 2 arguments, but found " + (args.length - 1) + " instead.")); }
        var index = context.parse(args[1], 1, NumberType);
        var input = context.parse(args[2], 2, array(context.expectedType || ValueType));
        if (!index || !input)
            { return null; }
        var t = input.type;
        return new At(t.itemType, index, input);
    };
    At.prototype.evaluate = function evaluate (ctx) {
        var index = this.index.evaluate(ctx);
        var array = this.input.evaluate(ctx);
        if (index < 0) {
            throw new RuntimeError(("Array index out of bounds: " + index + " < 0."));
        }
        if (index >= array.length) {
            throw new RuntimeError(("Array index out of bounds: " + index + " > " + (array.length - 1) + "."));
        }
        if (index !== Math.floor(index)) {
            throw new RuntimeError(("Array index must be an integer, but found " + index + " instead."));
        }
        return array[index];
    };
    At.prototype.eachChild = function eachChild (fn) {
        fn(this.index);
        fn(this.input);
    };
    At.prototype.outputDefined = function outputDefined () {
        return false;
    };

  var In = function In(needle, haystack) {
        this.type = BooleanType;
        this.needle = needle;
        this.haystack = haystack;
    };
    In.parse = function parse (args, context) {
        if (args.length !== 3) {
            return context.error(("Expected 2 arguments, but found " + (args.length - 1) + " instead."));
        }
        var needle = context.parse(args[1], 1, ValueType);
        var haystack = context.parse(args[2], 2, ValueType);
        if (!needle || !haystack)
            { return null; }
        if (!isValidType(needle.type, [BooleanType, StringType, NumberType, NullType, ValueType])) {
            return context.error(("Expected first argument to be of type boolean, string, number or null, but found " + (typeToString(needle.type)) + " instead"));
        }
        return new In(needle, haystack);
    };
    In.prototype.evaluate = function evaluate (ctx) {
        var needle = this.needle.evaluate(ctx);
        var haystack = this.haystack.evaluate(ctx);
        if (!haystack)
            { return false; }
        if (!isValidNativeType(needle, ['boolean', 'string', 'number', 'null'])) {
            throw new RuntimeError(("Expected first argument to be of type boolean, string, number or null, but found " + (typeToString(typeOf(needle))) + " instead."));
        }
        if (!isValidNativeType(haystack, ['string', 'array'])) {
            throw new RuntimeError(("Expected second argument to be of type array or string, but found " + (typeToString(typeOf(haystack))) + " instead."));
        }
        return haystack.indexOf(needle) >= 0;
    };
    In.prototype.eachChild = function eachChild (fn) {
        fn(this.needle);
        fn(this.haystack);
    };
    In.prototype.outputDefined = function outputDefined () {
        return true;
    };

  var IndexOf = function IndexOf(needle, haystack, fromIndex) {
        this.type = NumberType;
        this.needle = needle;
        this.haystack = haystack;
        this.fromIndex = fromIndex;
    };
    IndexOf.parse = function parse (args, context) {
        if (args.length <= 2 || args.length >= 5) {
            return context.error(("Expected 3 or 4 arguments, but found " + (args.length - 1) + " instead."));
        }
        var needle = context.parse(args[1], 1, ValueType);
        var haystack = context.parse(args[2], 2, ValueType);
        if (!needle || !haystack)
            { return null; }
        if (!isValidType(needle.type, [BooleanType, StringType, NumberType, NullType, ValueType])) {
            return context.error(("Expected first argument to be of type boolean, string, number or null, but found " + (typeToString(needle.type)) + " instead"));
        }
        if (args.length === 4) {
            var fromIndex = context.parse(args[3], 3, NumberType);
            if (!fromIndex)
                { return null; }
            return new IndexOf(needle, haystack, fromIndex);
        }
        else {
            return new IndexOf(needle, haystack);
        }
    };
    IndexOf.prototype.evaluate = function evaluate (ctx) {
        var needle = this.needle.evaluate(ctx);
        var haystack = this.haystack.evaluate(ctx);
        if (!isValidNativeType(needle, ['boolean', 'string', 'number', 'null'])) {
            throw new RuntimeError(("Expected first argument to be of type boolean, string, number or null, but found " + (typeToString(typeOf(needle))) + " instead."));
        }
        var fromIndex;
        if (this.fromIndex) {
            fromIndex = this.fromIndex.evaluate(ctx);
        }
        if (isValidNativeType(haystack, ['string'])) {
            var rawIndex = haystack.indexOf(needle, fromIndex);
            if (rawIndex === -1) {
                return -1;
            }
            else {
                // The index may be affected by surrogate pairs, so get the length of the preceding substring.
                return [].concat( haystack.slice(0, rawIndex) ).length;
            }
        }
        else if (isValidNativeType(haystack, ['array'])) {
            return haystack.indexOf(needle, fromIndex);
        }
        else {
            throw new RuntimeError(("Expected second argument to be of type array or string, but found " + (typeToString(typeOf(haystack))) + " instead."));
        }
    };
    IndexOf.prototype.eachChild = function eachChild (fn) {
        fn(this.needle);
        fn(this.haystack);
        if (this.fromIndex) {
            fn(this.fromIndex);
        }
    };
    IndexOf.prototype.outputDefined = function outputDefined () {
        return false;
    };

  var Match = function Match(inputType, outputType, input, cases, outputs, otherwise) {
        this.inputType = inputType;
        this.type = outputType;
        this.input = input;
        this.cases = cases;
        this.outputs = outputs;
        this.otherwise = otherwise;
    };
    Match.parse = function parse (args, context) {
        if (args.length < 5)
            { return context.error(("Expected at least 4 arguments, but found only " + (args.length - 1) + ".")); }
        if (args.length % 2 !== 1)
            { return context.error('Expected an even number of arguments.'); }
        var inputType;
        var outputType;
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        var cases = {};
        var outputs = [];
        for (var i = 2; i < args.length - 1; i += 2) {
            var labels = args[i];
            var value = args[i + 1];
            if (!Array.isArray(labels)) {
                labels = [labels];
            }
            var labelContext = context.concat(i);
            if (labels.length === 0) {
                return labelContext.error('Expected at least one branch label.');
            }
            for (var i$1 = 0, list = labels; i$1 < list.length; i$1 += 1) {
                var label = list[i$1];

                if (typeof label !== 'number' && typeof label !== 'string') {
                    return labelContext.error('Branch labels must be numbers or strings.');
                }
                else if (typeof label === 'number' && Math.abs(label) > Number.MAX_SAFE_INTEGER) {
                    return labelContext.error(("Branch labels must be integers no larger than " + (Number.MAX_SAFE_INTEGER) + "."));
                }
                else if (typeof label === 'number' && Math.floor(label) !== label) {
                    return labelContext.error('Numeric branch labels must be integer values.');
                }
                else if (!inputType) {
                    inputType = typeOf(label);
                }
                else if (labelContext.checkSubtype(inputType, typeOf(label))) {
                    return null;
                }
                if (typeof cases[String(label)] !== 'undefined') {
                    return labelContext.error('Branch labels must be unique.');
                }
                cases[String(label)] = outputs.length;
            }
            var result = context.parse(value, i, outputType);
            if (!result)
                { return null; }
            outputType = outputType || result.type;
            outputs.push(result);
        }
        var input = context.parse(args[1], 1, ValueType);
        if (!input)
            { return null; }
        var otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
        if (!otherwise)
            { return null; }
        if (input.type.kind !== 'value' && context.concat(1).checkSubtype(inputType, input.type)) {
            return null;
        }
        return new Match(inputType, outputType, input, cases, outputs, otherwise);
    };
    Match.prototype.evaluate = function evaluate (ctx) {
        var input = this.input.evaluate(ctx);
        var output = (typeOf(input) === this.inputType && this.outputs[this.cases[input]]) || this.otherwise;
        return output.evaluate(ctx);
    };
    Match.prototype.eachChild = function eachChild (fn) {
        fn(this.input);
        this.outputs.forEach(fn);
        fn(this.otherwise);
    };
    Match.prototype.outputDefined = function outputDefined () {
        return this.outputs.every(function (out) { return out.outputDefined(); }) && this.otherwise.outputDefined();
    };

  var Case = function Case(type, branches, otherwise) {
        this.type = type;
        this.branches = branches;
        this.otherwise = otherwise;
    };
    Case.parse = function parse (args, context) {
        if (args.length < 4)
            { return context.error(("Expected at least 3 arguments, but found only " + (args.length - 1) + ".")); }
        if (args.length % 2 !== 0)
            { return context.error('Expected an odd number of arguments.'); }
        var outputType;
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        var branches = [];
        for (var i = 1; i < args.length - 1; i += 2) {
            var test = context.parse(args[i], i, BooleanType);
            if (!test)
                { return null; }
            var result = context.parse(args[i + 1], i + 1, outputType);
            if (!result)
                { return null; }
            branches.push([test, result]);
            outputType = outputType || result.type;
        }
        var otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
        if (!otherwise)
            { return null; }
        if (!outputType)
            { throw new Error('Can\'t infer output type'); }
        return new Case(outputType, branches, otherwise);
    };
    Case.prototype.evaluate = function evaluate (ctx) {
        for (var i = 0, list = this.branches; i < list.length; i += 1) {
            var ref = list[i];
            var test = ref[0];
            var expression = ref[1];

            if (test.evaluate(ctx)) {
                return expression.evaluate(ctx);
            }
        }
        return this.otherwise.evaluate(ctx);
    };
    Case.prototype.eachChild = function eachChild (fn) {
        for (var i = 0, list = this.branches; i < list.length; i += 1) {
            var ref = list[i];
            var test = ref[0];
            var expression = ref[1];

            fn(test);
            fn(expression);
        }
        fn(this.otherwise);
    };
    Case.prototype.outputDefined = function outputDefined () {
        return this.branches.every(function (ref) {
            ref[0];
            var out = ref[1];

            return out.outputDefined();
          }) && this.otherwise.outputDefined();
    };

  var Slice = function Slice(type, input, beginIndex, endIndex) {
        this.type = type;
        this.input = input;
        this.beginIndex = beginIndex;
        this.endIndex = endIndex;
    };
    Slice.parse = function parse (args, context) {
        if (args.length <= 2 || args.length >= 5) {
            return context.error(("Expected 3 or 4 arguments, but found " + (args.length - 1) + " instead."));
        }
        var input = context.parse(args[1], 1, ValueType);
        var beginIndex = context.parse(args[2], 2, NumberType);
        if (!input || !beginIndex)
            { return null; }
        if (!isValidType(input.type, [array(ValueType), StringType, ValueType])) {
            return context.error(("Expected first argument to be of type array or string, but found " + (typeToString(input.type)) + " instead"));
        }
        if (args.length === 4) {
            var endIndex = context.parse(args[3], 3, NumberType);
            if (!endIndex)
                { return null; }
            return new Slice(input.type, input, beginIndex, endIndex);
        }
        else {
            return new Slice(input.type, input, beginIndex);
        }
    };
    Slice.prototype.evaluate = function evaluate (ctx) {
        var input = this.input.evaluate(ctx);
        var beginIndex = this.beginIndex.evaluate(ctx);
        var endIndex;
        if (this.endIndex) {
            endIndex = this.endIndex.evaluate(ctx);
        }
        if (isValidNativeType(input, ['string'])) {
            // Indices may be affected by surrogate pairs.
            return [].concat( input ).slice(beginIndex, endIndex).join('');
        }
        else if (isValidNativeType(input, ['array'])) {
            return input.slice(beginIndex, endIndex);
        }
        else {
            throw new RuntimeError(("Expected first argument to be of type array or string, but found " + (typeToString(typeOf(input))) + " instead."));
        }
    };
    Slice.prototype.eachChild = function eachChild (fn) {
        fn(this.input);
        fn(this.beginIndex);
        if (this.endIndex) {
            fn(this.endIndex);
        }
    };
    Slice.prototype.outputDefined = function outputDefined () {
        return false;
    };

  /**
   * Returns the index of the last stop <= input, or 0 if it doesn't exist.
   * @private
   */
  function findStopLessThanOrEqualTo(stops, input) {
      var lastIndex = stops.length - 1;
      var lowerIndex = 0;
      var upperIndex = lastIndex;
      var currentIndex = 0;
      var currentValue, nextValue;
      while (lowerIndex <= upperIndex) {
          currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
          currentValue = stops[currentIndex];
          nextValue = stops[currentIndex + 1];
          if (currentValue <= input) {
              if (currentIndex === lastIndex || input < nextValue) { // Search complete
                  return currentIndex;
              }
              lowerIndex = currentIndex + 1;
          }
          else if (currentValue > input) {
              upperIndex = currentIndex - 1;
          }
          else {
              throw new RuntimeError('Input is not a number.');
          }
      }
      return 0;
  }

  var Step = function Step(type, input, stops) {
        this.type = type;
        this.input = input;
        this.labels = [];
        this.outputs = [];
        for (var i = 0, list = stops; i < list.length; i += 1) {
            var ref = list[i];
          var label = ref[0];
          var expression = ref[1];

          this.labels.push(label);
            this.outputs.push(expression);
        }
    };
    Step.parse = function parse (args, context) {
        if (args.length - 1 < 4) {
            return context.error(("Expected at least 4 arguments, but found only " + (args.length - 1) + "."));
        }
        if ((args.length - 1) % 2 !== 0) {
            return context.error('Expected an even number of arguments.');
        }
        var input = context.parse(args[1], 1, NumberType);
        if (!input)
            { return null; }
        var stops = [];
        var outputType = null;
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        for (var i = 1; i < args.length; i += 2) {
            var label = i === 1 ? -Infinity : args[i];
            var value = args[i + 1];
            var labelKey = i;
            var valueKey = i + 1;
            if (typeof label !== 'number') {
                return context.error('Input/output pairs for "step" expressions must be defined using literal numeric values (not computed expressions) for the input values.', labelKey);
            }
            if (stops.length && stops[stops.length - 1][0] >= label) {
                return context.error('Input/output pairs for "step" expressions must be arranged with input values in strictly ascending order.', labelKey);
            }
            var parsed = context.parse(value, valueKey, outputType);
            if (!parsed)
                { return null; }
            outputType = outputType || parsed.type;
            stops.push([label, parsed]);
        }
        return new Step(outputType, input, stops);
    };
    Step.prototype.evaluate = function evaluate (ctx) {
        var labels = this.labels;
        var outputs = this.outputs;
        if (labels.length === 1) {
            return outputs[0].evaluate(ctx);
        }
        var value = this.input.evaluate(ctx);
        if (value <= labels[0]) {
            return outputs[0].evaluate(ctx);
        }
        var stopCount = labels.length;
        if (value >= labels[stopCount - 1]) {
            return outputs[stopCount - 1].evaluate(ctx);
        }
        var index = findStopLessThanOrEqualTo(labels, value);
        return outputs[index].evaluate(ctx);
    };
    Step.prototype.eachChild = function eachChild (fn) {
        fn(this.input);
        for (var i = 0, list = this.outputs; i < list.length; i += 1) {
            var expression = list[i];

            fn(expression);
        }
    };
    Step.prototype.outputDefined = function outputDefined () {
        return this.outputs.every(function (out) { return out.outputDefined(); });
    };

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  var unitbezier;
  var hasRequiredUnitbezier;

  function requireUnitbezier () {
  	if (hasRequiredUnitbezier) { return unitbezier; }
  	hasRequiredUnitbezier = 1;

  	unitbezier = UnitBezier;

  	function UnitBezier(p1x, p1y, p2x, p2y) {
  	    // Calculate the polynomial coefficients, implicit first and last control points are (0,0) and (1,1).
  	    this.cx = 3.0 * p1x;
  	    this.bx = 3.0 * (p2x - p1x) - this.cx;
  	    this.ax = 1.0 - this.cx - this.bx;

  	    this.cy = 3.0 * p1y;
  	    this.by = 3.0 * (p2y - p1y) - this.cy;
  	    this.ay = 1.0 - this.cy - this.by;

  	    this.p1x = p1x;
  	    this.p1y = p1y;
  	    this.p2x = p2x;
  	    this.p2y = p2y;
  	}

  	UnitBezier.prototype = {
  	    sampleCurveX: function (t) {
  	        // `ax t^3 + bx t^2 + cx t' expanded using Horner's rule.
  	        return ((this.ax * t + this.bx) * t + this.cx) * t;
  	    },

  	    sampleCurveY: function (t) {
  	        return ((this.ay * t + this.by) * t + this.cy) * t;
  	    },

  	    sampleCurveDerivativeX: function (t) {
  	        return (3.0 * this.ax * t + 2.0 * this.bx) * t + this.cx;
  	    },

  	    solveCurveX: function (x, epsilon) {
  	        if (epsilon === undefined) { epsilon = 1e-6; }

  	        if (x < 0.0) { return 0.0; }
  	        if (x > 1.0) { return 1.0; }

  	        var t = x;

  	        // First try a few iterations of Newton's method - normally very fast.
  	        for (var i = 0; i < 8; i++) {
  	            var x2 = this.sampleCurveX(t) - x;
  	            if (Math.abs(x2) < epsilon) { return t; }

  	            var d2 = this.sampleCurveDerivativeX(t);
  	            if (Math.abs(d2) < 1e-6) { break; }

  	            t = t - x2 / d2;
  	        }

  	        // Fall back to the bisection method for reliability.
  	        var t0 = 0.0;
  	        var t1 = 1.0;
  	        t = x;

  	        for (i = 0; i < 20; i++) {
  	            x2 = this.sampleCurveX(t);
  	            if (Math.abs(x2 - x) < epsilon) { break; }

  	            if (x > x2) {
  	                t0 = t;
  	            } else {
  	                t1 = t;
  	            }

  	            t = (t1 - t0) * 0.5 + t0;
  	        }

  	        return t;
  	    },

  	    solve: function (x, epsilon) {
  	        return this.sampleCurveY(this.solveCurveX(x, epsilon));
  	    }
  	};
  	return unitbezier;
  }

  var unitbezierExports = requireUnitbezier();
  var UnitBezier = /*@__PURE__*/getDefaultExportFromCjs(unitbezierExports);

  var Interpolate = function Interpolate(type, operator, interpolation, input, stops) {
        this.type = type;
        this.operator = operator;
        this.interpolation = interpolation;
        this.input = input;
        this.labels = [];
        this.outputs = [];
        for (var i = 0, list = stops; i < list.length; i += 1) {
            var ref = list[i];
          var label = ref[0];
          var expression = ref[1];

          this.labels.push(label);
            this.outputs.push(expression);
        }
    };
    Interpolate.interpolationFactor = function interpolationFactor (interpolation, input, lower, upper) {
        var t = 0;
        if (interpolation.name === 'exponential') {
            t = exponentialInterpolation(input, interpolation.base, lower, upper);
        }
        else if (interpolation.name === 'linear') {
            t = exponentialInterpolation(input, 1, lower, upper);
        }
        else if (interpolation.name === 'cubic-bezier') {
            var c = interpolation.controlPoints;
            var ub = new UnitBezier(c[0], c[1], c[2], c[3]);
            t = ub.solve(exponentialInterpolation(input, 1, lower, upper));
        }
        return t;
    };
    Interpolate.parse = function parse (args, context) {
        var operator = args[0];
          var interpolation = args[1];
          var input = args[2];
          var rest = args.slice(3);
        if (!Array.isArray(interpolation) || interpolation.length === 0) {
            return context.error('Expected an interpolation type expression.', 1);
        }
        if (interpolation[0] === 'linear') {
            interpolation = { name: 'linear' };
        }
        else if (interpolation[0] === 'exponential') {
            var base = interpolation[1];
            if (typeof base !== 'number')
                { return context.error('Exponential interpolation requires a numeric base.', 1, 1); }
            interpolation = {
                name: 'exponential',
                base: base
            };
        }
        else if (interpolation[0] === 'cubic-bezier') {
            var controlPoints = interpolation.slice(1);
            if (controlPoints.length !== 4 ||
                controlPoints.some(function (t) { return typeof t !== 'number' || t < 0 || t > 1; })) {
                return context.error('Cubic bezier interpolation requires four numeric arguments with values between 0 and 1.', 1);
            }
            interpolation = {
                name: 'cubic-bezier',
                controlPoints: controlPoints
            };
        }
        else {
            return context.error(("Unknown interpolation type " + (String(interpolation[0]))), 1, 0);
        }
        if (args.length - 1 < 4) {
            return context.error(("Expected at least 4 arguments, but found only " + (args.length - 1) + "."));
        }
        if ((args.length - 1) % 2 !== 0) {
            return context.error('Expected an even number of arguments.');
        }
        input = context.parse(input, 2, NumberType);
        if (!input)
            { return null; }
        var stops = [];
        var outputType = null;
        if (operator === 'interpolate-hcl' || operator === 'interpolate-lab') {
            outputType = ColorType;
        }
        else if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        for (var i = 0; i < rest.length; i += 2) {
            var label = rest[i];
            var value = rest[i + 1];
            var labelKey = i + 3;
            var valueKey = i + 4;
            if (typeof label !== 'number') {
                return context.error('Input/output pairs for "interpolate" expressions must be defined using literal numeric values (not computed expressions) for the input values.', labelKey);
            }
            if (stops.length && stops[stops.length - 1][0] >= label) {
                return context.error('Input/output pairs for "interpolate" expressions must be arranged with input values in strictly ascending order.', labelKey);
            }
            var parsed = context.parse(value, valueKey, outputType);
            if (!parsed)
                { return null; }
            outputType = outputType || parsed.type;
            stops.push([label, parsed]);
        }
        if (!verifyType(outputType, NumberType) &&
            !verifyType(outputType, ProjectionDefinitionType) &&
            !verifyType(outputType, ColorType) &&
            !verifyType(outputType, PaddingType) &&
            !verifyType(outputType, VariableAnchorOffsetCollectionType) &&
            !verifyType(outputType, array(NumberType))) {
            return context.error(("Type " + (typeToString(outputType)) + " is not interpolatable."));
        }
        return new Interpolate(outputType, operator, interpolation, input, stops);
    };
    Interpolate.prototype.evaluate = function evaluate (ctx) {
        var labels = this.labels;
        var outputs = this.outputs;
        if (labels.length === 1) {
            return outputs[0].evaluate(ctx);
        }
        var value = this.input.evaluate(ctx);
        if (value <= labels[0]) {
            return outputs[0].evaluate(ctx);
        }
        var stopCount = labels.length;
        if (value >= labels[stopCount - 1]) {
            return outputs[stopCount - 1].evaluate(ctx);
        }
        var index = findStopLessThanOrEqualTo(labels, value);
        var lower = labels[index];
        var upper = labels[index + 1];
        var t = Interpolate.interpolationFactor(this.interpolation, value, lower, upper);
        var outputLower = outputs[index].evaluate(ctx);
        var outputUpper = outputs[index + 1].evaluate(ctx);
        switch (this.operator) {
            case 'interpolate':
                switch (this.type.kind) {
                    case 'number':
                        return interpolateNumber(outputLower, outputUpper, t);
                    case 'color':
                        return Color.interpolate(outputLower, outputUpper, t);
                    case 'padding':
                        return Padding.interpolate(outputLower, outputUpper, t);
                    case 'variableAnchorOffsetCollection':
                        return VariableAnchorOffsetCollection.interpolate(outputLower, outputUpper, t);
                    case 'array':
                        return interpolateArray(outputLower, outputUpper, t);
                    case 'projectionDefinition':
                        return ProjectionDefinition.interpolate(outputLower, outputUpper, t);
                }
            case 'interpolate-hcl':
                return Color.interpolate(outputLower, outputUpper, t, 'hcl');
            case 'interpolate-lab':
                return Color.interpolate(outputLower, outputUpper, t, 'lab');
        }
    };
    Interpolate.prototype.eachChild = function eachChild (fn) {
        fn(this.input);
        for (var i = 0, list = this.outputs; i < list.length; i += 1) {
            var expression = list[i];

            fn(expression);
        }
    };
    Interpolate.prototype.outputDefined = function outputDefined () {
        return this.outputs.every(function (out) { return out.outputDefined(); });
    };
  /**
   * Returns a ratio that can be used to interpolate between exponential function
   * stops.
   * How it works: Two consecutive stop values define a (scaled and shifted) exponential function `f(x) = a * base^x + b`, where `base` is the user-specified base,
   * and `a` and `b` are constants affording sufficient degrees of freedom to fit
   * the function to the given stops.
   *
   * Here's a bit of algebra that lets us compute `f(x)` directly from the stop
   * values without explicitly solving for `a` and `b`:
   *
   * First stop value: `f(x0) = y0 = a * base^x0 + b`
   * Second stop value: `f(x1) = y1 = a * base^x1 + b`
   * => `y1 - y0 = a(base^x1 - base^x0)`
   * => `a = (y1 - y0)/(base^x1 - base^x0)`
   *
   * Desired value: `f(x) = y = a * base^x + b`
   * => `f(x) = y0 + a * (base^x - base^x0)`
   *
   * From the above, we can replace the `a` in `a * (base^x - base^x0)` and do a
   * little algebra:
   * ```
   * a * (base^x - base^x0) = (y1 - y0)/(base^x1 - base^x0) * (base^x - base^x0)
   *                     = (y1 - y0) * (base^x - base^x0) / (base^x1 - base^x0)
   * ```
   *
   * If we let `(base^x - base^x0) / (base^x1 base^x0)`, then we have
   * `f(x) = y0 + (y1 - y0) * ratio`.  In other words, `ratio` may be treated as
   * an interpolation factor between the two stops' output values.
   *
   * (Note: a slightly different form for `ratio`,
   * `(base^(x-x0) - 1) / (base^(x1-x0) - 1) `, is equivalent, but requires fewer
   * expensive `Math.pow()` operations.)
   *
   * @private
  */
  function exponentialInterpolation(input, base, lowerValue, upperValue) {
      var difference = upperValue - lowerValue;
      var progress = input - lowerValue;
      if (difference === 0) {
          return 0;
      }
      else if (base === 1) {
          return progress / difference;
      }
      else {
          return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
      }
  }
  var interpolateFactory = {
      color: Color.interpolate,
      number: interpolateNumber,
      padding: Padding.interpolate,
      variableAnchorOffsetCollection: VariableAnchorOffsetCollection.interpolate,
      array: interpolateArray
  };

  var Coalesce = function Coalesce(type, args) {
        this.type = type;
        this.args = args;
    };
    Coalesce.parse = function parse (args, context) {
        if (args.length < 2) {
            return context.error('Expected at least one argument.');
        }
        var outputType = null;
        var expectedType = context.expectedType;
        if (expectedType && expectedType.kind !== 'value') {
            outputType = expectedType;
        }
        var parsedArgs = [];
        for (var i = 0, list = args.slice(1); i < list.length; i += 1) {
            var arg = list[i];

            var parsed = context.parse(arg, 1 + parsedArgs.length, outputType, undefined, { typeAnnotation: 'omit' });
            if (!parsed)
                { return null; }
            outputType = outputType || parsed.type;
            parsedArgs.push(parsed);
        }
        if (!outputType)
            { throw new Error('No output type'); }
        // Above, we parse arguments without inferred type annotation so that
        // they don't produce a runtime error for `null` input, which would
        // preempt the desired null-coalescing behavior.
        // Thus, if any of our arguments would have needed an annotation, we
        // need to wrap the enclosing coalesce expression with it instead.
        var needsAnnotation = expectedType &&
            parsedArgs.some(function (arg) { return checkSubtype(expectedType, arg.type); });
        return needsAnnotation ?
            new Coalesce(ValueType, parsedArgs) :
            new Coalesce(outputType, parsedArgs);
    };
    Coalesce.prototype.evaluate = function evaluate (ctx) {
        var result = null;
        var argCount = 0;
        var requestedImageName;
        for (var i = 0, list = this.args; i < list.length; i += 1) {
            var arg = list[i];

            argCount++;
            result = arg.evaluate(ctx);
            // we need to keep track of the first requested image in a coalesce statement
            // if coalesce can't find a valid image, we return the first image name so styleimagemissing can fire
            if (result && result instanceof ResolvedImage && !result.available) {
                if (!requestedImageName) {
                    requestedImageName = result.name;
                }
                result = null;
                if (argCount === this.args.length) {
                    result = requestedImageName;
                }
            }
            if (result !== null)
                { break; }
        }
        return result;
    };
    Coalesce.prototype.eachChild = function eachChild (fn) {
        this.args.forEach(fn);
    };
    Coalesce.prototype.outputDefined = function outputDefined () {
        return this.args.every(function (arg) { return arg.outputDefined(); });
    };

  function isComparableType(op, type) {
      if (op === '==' || op === '!=') {
          // equality operator
          return type.kind === 'boolean' ||
              type.kind === 'string' ||
              type.kind === 'number' ||
              type.kind === 'null' ||
              type.kind === 'value';
      }
      else {
          // ordering operator
          return type.kind === 'string' ||
              type.kind === 'number' ||
              type.kind === 'value';
      }
  }
  function eq(ctx, a, b) { return a === b; }
  function neq(ctx, a, b) { return a !== b; }
  function lt(ctx, a, b) { return a < b; }
  function gt(ctx, a, b) { return a > b; }
  function lteq(ctx, a, b) { return a <= b; }
  function gteq(ctx, a, b) { return a >= b; }
  function eqCollate(ctx, a, b, c) { return c.compare(a, b) === 0; }
  function neqCollate(ctx, a, b, c) { return !eqCollate(ctx, a, b, c); }
  function ltCollate(ctx, a, b, c) { return c.compare(a, b) < 0; }
  function gtCollate(ctx, a, b, c) { return c.compare(a, b) > 0; }
  function lteqCollate(ctx, a, b, c) { return c.compare(a, b) <= 0; }
  function gteqCollate(ctx, a, b, c) { return c.compare(a, b) >= 0; }
  /**
   * Special form for comparison operators, implementing the signatures:
   * - (T, T, ?Collator) => boolean
   * - (T, value, ?Collator) => boolean
   * - (value, T, ?Collator) => boolean
   *
   * For inequalities, T must be either value, string, or number. For ==/!=, it
   * can also be boolean or null.
   *
   * Equality semantics are equivalent to Javascript's strict equality (===/!==)
   * -- i.e., when the arguments' types don't match, == evaluates to false, != to
   * true.
   *
   * When types don't match in an ordering comparison, a runtime error is thrown.
   *
   * @private
   */
  function makeComparison(op, compareBasic, compareWithCollator) {
      var isOrderComparison = op !== '==' && op !== '!=';
      return /*@__PURE__*/(function () {
        function Comparison(lhs, rhs, collator) {
              this.type = BooleanType;
              this.lhs = lhs;
              this.rhs = rhs;
              this.collator = collator;
              this.hasUntypedArgument = lhs.type.kind === 'value' || rhs.type.kind === 'value';
          }
          Comparison.parse = function parse (args, context) {
              if (args.length !== 3 && args.length !== 4)
                  { return context.error('Expected two or three arguments.'); }
              var op = args[0];
              var lhs = context.parse(args[1], 1, ValueType);
              if (!lhs)
                  { return null; }
              if (!isComparableType(op, lhs.type)) {
                  return context.concat(1).error(("\"" + op + "\" comparisons are not supported for type '" + (typeToString(lhs.type)) + "'."));
              }
              var rhs = context.parse(args[2], 2, ValueType);
              if (!rhs)
                  { return null; }
              if (!isComparableType(op, rhs.type)) {
                  return context.concat(2).error(("\"" + op + "\" comparisons are not supported for type '" + (typeToString(rhs.type)) + "'."));
              }
              if (lhs.type.kind !== rhs.type.kind &&
                  lhs.type.kind !== 'value' &&
                  rhs.type.kind !== 'value') {
                  return context.error(("Cannot compare types '" + (typeToString(lhs.type)) + "' and '" + (typeToString(rhs.type)) + "'."));
              }
              if (isOrderComparison) {
                  // typing rules specific to less/greater than operators
                  if (lhs.type.kind === 'value' && rhs.type.kind !== 'value') {
                      // (value, T)
                      lhs = new Assertion(rhs.type, [lhs]);
                  }
                  else if (lhs.type.kind !== 'value' && rhs.type.kind === 'value') {
                      // (T, value)
                      rhs = new Assertion(lhs.type, [rhs]);
                  }
              }
              var collator = null;
              if (args.length === 4) {
                  if (lhs.type.kind !== 'string' &&
                      rhs.type.kind !== 'string' &&
                      lhs.type.kind !== 'value' &&
                      rhs.type.kind !== 'value') {
                      return context.error('Cannot use collator to compare non-string types.');
                  }
                  collator = context.parse(args[3], 3, CollatorType);
                  if (!collator)
                      { return null; }
              }
              return new Comparison(lhs, rhs, collator);
          };
          Comparison.prototype.evaluate = function evaluate (ctx) {
              var lhs = this.lhs.evaluate(ctx);
              var rhs = this.rhs.evaluate(ctx);
              if (isOrderComparison && this.hasUntypedArgument) {
                  var lt = typeOf(lhs);
                  var rt = typeOf(rhs);
                  // check that type is string or number, and equal
                  if (lt.kind !== rt.kind || !(lt.kind === 'string' || lt.kind === 'number')) {
                      throw new RuntimeError(("Expected arguments for \"" + op + "\" to be (string, string) or (number, number), but found (" + (lt.kind) + ", " + (rt.kind) + ") instead."));
                  }
              }
              if (this.collator && !isOrderComparison && this.hasUntypedArgument) {
                  var lt$1 = typeOf(lhs);
                  var rt$1 = typeOf(rhs);
                  if (lt$1.kind !== 'string' || rt$1.kind !== 'string') {
                      return compareBasic(ctx, lhs, rhs);
                  }
              }
              return this.collator ?
                  compareWithCollator(ctx, lhs, rhs, this.collator.evaluate(ctx)) :
                  compareBasic(ctx, lhs, rhs);
          };
          Comparison.prototype.eachChild = function eachChild (fn) {
              fn(this.lhs);
              fn(this.rhs);
              if (this.collator) {
                  fn(this.collator);
              }
          };
          Comparison.prototype.outputDefined = function outputDefined () {
              return true;
          };

        return Comparison;
      }());
  }
  var Equals = makeComparison('==', eq, eqCollate);
  var NotEquals = makeComparison('!=', neq, neqCollate);
  var LessThan = makeComparison('<', lt, ltCollate);
  var GreaterThan = makeComparison('>', gt, gtCollate);
  var LessThanOrEqual = makeComparison('<=', lteq, lteqCollate);
  var GreaterThanOrEqual = makeComparison('>=', gteq, gteqCollate);

  var CollatorExpression = function CollatorExpression(caseSensitive, diacriticSensitive, locale) {
        this.type = CollatorType;
        this.locale = locale;
        this.caseSensitive = caseSensitive;
        this.diacriticSensitive = diacriticSensitive;
    };
    CollatorExpression.parse = function parse (args, context) {
        if (args.length !== 2)
            { return context.error('Expected one argument.'); }
        var options = args[1];
        if (typeof options !== 'object' || Array.isArray(options))
            { return context.error('Collator options argument must be an object.'); }
        var caseSensitive = context.parse(options['case-sensitive'] === undefined ? false : options['case-sensitive'], 1, BooleanType);
        if (!caseSensitive)
            { return null; }
        var diacriticSensitive = context.parse(options['diacritic-sensitive'] === undefined ? false : options['diacritic-sensitive'], 1, BooleanType);
        if (!diacriticSensitive)
            { return null; }
        var locale = null;
        if (options['locale']) {
            locale = context.parse(options['locale'], 1, StringType);
            if (!locale)
                { return null; }
        }
        return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
    };
    CollatorExpression.prototype.evaluate = function evaluate (ctx) {
        return new Collator(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
    };
    CollatorExpression.prototype.eachChild = function eachChild (fn) {
        fn(this.caseSensitive);
        fn(this.diacriticSensitive);
        if (this.locale) {
            fn(this.locale);
        }
    };
    CollatorExpression.prototype.outputDefined = function outputDefined () {
        // Technically the set of possible outputs is the combinatoric set of Collators produced
        // by all possible outputs of locale/caseSensitive/diacriticSensitive
        // But for the primary use of Collators in comparison operators, we ignore the Collator's
        // possible outputs anyway, so we can get away with leaving this false for now.
        return false;
    };

  var NumberFormat = function NumberFormat(number, locale, currency, minFractionDigits, maxFractionDigits) {
        this.type = StringType;
        this.number = number;
        this.locale = locale;
        this.currency = currency;
        this.minFractionDigits = minFractionDigits;
        this.maxFractionDigits = maxFractionDigits;
    };
    NumberFormat.parse = function parse (args, context) {
        if (args.length !== 3)
            { return context.error('Expected two arguments.'); }
        var number = context.parse(args[1], 1, NumberType);
        if (!number)
            { return null; }
        var options = args[2];
        if (typeof options !== 'object' || Array.isArray(options))
            { return context.error('NumberFormat options argument must be an object.'); }
        var locale = null;
        if (options['locale']) {
            locale = context.parse(options['locale'], 1, StringType);
            if (!locale)
                { return null; }
        }
        var currency = null;
        if (options['currency']) {
            currency = context.parse(options['currency'], 1, StringType);
            if (!currency)
                { return null; }
        }
        var minFractionDigits = null;
        if (options['min-fraction-digits']) {
            minFractionDigits = context.parse(options['min-fraction-digits'], 1, NumberType);
            if (!minFractionDigits)
                { return null; }
        }
        var maxFractionDigits = null;
        if (options['max-fraction-digits']) {
            maxFractionDigits = context.parse(options['max-fraction-digits'], 1, NumberType);
            if (!maxFractionDigits)
                { return null; }
        }
        return new NumberFormat(number, locale, currency, minFractionDigits, maxFractionDigits);
    };
    NumberFormat.prototype.evaluate = function evaluate (ctx) {
        return new Intl.NumberFormat(this.locale ? this.locale.evaluate(ctx) : [], {
            style: this.currency ? 'currency' : 'decimal',
            currency: this.currency ? this.currency.evaluate(ctx) : undefined,
            minimumFractionDigits: this.minFractionDigits ? this.minFractionDigits.evaluate(ctx) : undefined,
            maximumFractionDigits: this.maxFractionDigits ? this.maxFractionDigits.evaluate(ctx) : undefined,
        }).format(this.number.evaluate(ctx));
    };
    NumberFormat.prototype.eachChild = function eachChild (fn) {
        fn(this.number);
        if (this.locale) {
            fn(this.locale);
        }
        if (this.currency) {
            fn(this.currency);
        }
        if (this.minFractionDigits) {
            fn(this.minFractionDigits);
        }
        if (this.maxFractionDigits) {
            fn(this.maxFractionDigits);
        }
    };
    NumberFormat.prototype.outputDefined = function outputDefined () {
        return false;
    };

  var FormatExpression = function FormatExpression(sections) {
        this.type = FormattedType;
        this.sections = sections;
    };
    FormatExpression.parse = function parse (args, context) {
        if (args.length < 2) {
            return context.error('Expected at least one argument.');
        }
        var firstArg = args[1];
        if (!Array.isArray(firstArg) && typeof firstArg === 'object') {
            return context.error('First argument must be an image or text section.');
        }
        var sections = [];
        var nextTokenMayBeObject = false;
        for (var i = 1; i <= args.length - 1; ++i) {
            var arg = args[i];
            if (nextTokenMayBeObject && typeof arg === 'object' && !Array.isArray(arg)) {
                nextTokenMayBeObject = false;
                var scale = null;
                if (arg['font-scale']) {
                    scale = context.parse(arg['font-scale'], 1, NumberType);
                    if (!scale)
                        { return null; }
                }
                var font = null;
                if (arg['text-font']) {
                    font = context.parse(arg['text-font'], 1, array(StringType));
                    if (!font)
                        { return null; }
                }
                var textColor = null;
                if (arg['text-color']) {
                    textColor = context.parse(arg['text-color'], 1, ColorType);
                    if (!textColor)
                        { return null; }
                }
                var lastExpression = sections[sections.length - 1];
                lastExpression.scale = scale;
                lastExpression.font = font;
                lastExpression.textColor = textColor;
            }
            else {
                var content = context.parse(args[i], 1, ValueType);
                if (!content)
                    { return null; }
                var kind = content.type.kind;
                if (kind !== 'string' && kind !== 'value' && kind !== 'null' && kind !== 'resolvedImage')
                    { return context.error('Formatted text type must be \'string\', \'value\', \'image\' or \'null\'.'); }
                nextTokenMayBeObject = true;
                sections.push({ content: content, scale: null, font: null, textColor: null });
            }
        }
        return new FormatExpression(sections);
    };
    FormatExpression.prototype.evaluate = function evaluate (ctx) {
        var evaluateSection = function (section) {
            var evaluatedContent = section.content.evaluate(ctx);
            if (typeOf(evaluatedContent) === ResolvedImageType) {
                return new FormattedSection('', evaluatedContent, null, null, null);
            }
            return new FormattedSection(valueToString(evaluatedContent), null, section.scale ? section.scale.evaluate(ctx) : null, section.font ? section.font.evaluate(ctx).join(',') : null, section.textColor ? section.textColor.evaluate(ctx) : null);
        };
        return new Formatted(this.sections.map(evaluateSection));
    };
    FormatExpression.prototype.eachChild = function eachChild (fn) {
        for (var i = 0, list = this.sections; i < list.length; i += 1) {
            var section = list[i];

            fn(section.content);
            if (section.scale) {
                fn(section.scale);
            }
            if (section.font) {
                fn(section.font);
            }
            if (section.textColor) {
                fn(section.textColor);
            }
        }
    };
    FormatExpression.prototype.outputDefined = function outputDefined () {
        // Technically the combinatoric set of all children
        // Usually, this.text will be undefined anyway
        return false;
    };

  var ImageExpression = function ImageExpression(input) {
        this.type = ResolvedImageType;
        this.input = input;
    };
    ImageExpression.parse = function parse (args, context) {
        if (args.length !== 2) {
            return context.error('Expected two arguments.');
        }
        var name = context.parse(args[1], 1, StringType);
        if (!name)
            { return context.error('No image name provided.'); }
        return new ImageExpression(name);
    };
    ImageExpression.prototype.evaluate = function evaluate (ctx) {
        var evaluatedImageName = this.input.evaluate(ctx);
        var value = ResolvedImage.fromString(evaluatedImageName);
        if (value && ctx.availableImages)
            { value.available = ctx.availableImages.indexOf(evaluatedImageName) > -1; }
        return value;
    };
    ImageExpression.prototype.eachChild = function eachChild (fn) {
        fn(this.input);
    };
    ImageExpression.prototype.outputDefined = function outputDefined () {
        // The output of image is determined by the list of available images in the evaluation context
        return false;
    };

  var Length = function Length(input) {
        this.type = NumberType;
        this.input = input;
    };
    Length.parse = function parse (args, context) {
        if (args.length !== 2)
            { return context.error(("Expected 1 argument, but found " + (args.length - 1) + " instead.")); }
        var input = context.parse(args[1], 1);
        if (!input)
            { return null; }
        if (input.type.kind !== 'array' && input.type.kind !== 'string' && input.type.kind !== 'value')
            { return context.error(("Expected argument of type string or array, but found " + (typeToString(input.type)) + " instead.")); }
        return new Length(input);
    };
    Length.prototype.evaluate = function evaluate (ctx) {
        var input = this.input.evaluate(ctx);
        if (typeof input === 'string') {
            // The length may be affected by surrogate pairs.
            return [].concat( input ).length;
        }
        else if (Array.isArray(input)) {
            return input.length;
        }
        else {
            throw new RuntimeError(("Expected value to be of type string or array, but found " + (typeToString(typeOf(input))) + " instead."));
        }
    };
    Length.prototype.eachChild = function eachChild (fn) {
        fn(this.input);
    };
    Length.prototype.outputDefined = function outputDefined () {
        return false;
    };

  var EXTENT = 8192;
  function getTileCoordinates(p, canonical) {
      var x = mercatorXfromLng(p[0]);
      var y = mercatorYfromLat(p[1]);
      var tilesAtZoom = Math.pow(2, canonical.z);
      return [Math.round(x * tilesAtZoom * EXTENT), Math.round(y * tilesAtZoom * EXTENT)];
  }
  function getLngLatFromTileCoord(coord, canonical) {
      var tilesAtZoom = Math.pow(2, canonical.z);
      var x = (coord[0] / EXTENT + canonical.x) / tilesAtZoom;
      var y = (coord[1] / EXTENT + canonical.y) / tilesAtZoom;
      return [lngFromMercatorXfromLng(x), latFromMercatorY(y)];
  }
  function mercatorXfromLng(lng) {
      return (180 + lng) / 360;
  }
  function lngFromMercatorXfromLng(mercatorX) {
      return mercatorX * 360 - 180;
  }
  function mercatorYfromLat(lat) {
      return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
  }
  function latFromMercatorY(mercatorY) {
      return 360 / Math.PI * Math.atan(Math.exp((180 - mercatorY * 360) * Math.PI / 180)) - 90;
  }
  function updateBBox(bbox, coord) {
      bbox[0] = Math.min(bbox[0], coord[0]);
      bbox[1] = Math.min(bbox[1], coord[1]);
      bbox[2] = Math.max(bbox[2], coord[0]);
      bbox[3] = Math.max(bbox[3], coord[1]);
  }
  function boxWithinBox(bbox1, bbox2) {
      if (bbox1[0] <= bbox2[0])
          { return false; }
      if (bbox1[2] >= bbox2[2])
          { return false; }
      if (bbox1[1] <= bbox2[1])
          { return false; }
      if (bbox1[3] >= bbox2[3])
          { return false; }
      return true;
  }
  function rayIntersect(p, p1, p2) {
      return ((p1[1] > p[1]) !== (p2[1] > p[1])) && (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0]);
  }
  function pointOnBoundary(p, p1, p2) {
      var x1 = p[0] - p1[0];
      var y1 = p[1] - p1[1];
      var x2 = p[0] - p2[0];
      var y2 = p[1] - p2[1];
      return (x1 * y2 - x2 * y1 === 0) && (x1 * x2 <= 0) && (y1 * y2 <= 0);
  }
  // a, b are end points for line segment1, c and d are end points for line segment2
  function segmentIntersectSegment(a, b, c, d) {
      // check if two segments are parallel or not
      // precondition is end point a, b is inside polygon, if line a->b is
      // parallel to polygon edge c->d, then a->b won't intersect with c->d
      var vectorP = [b[0] - a[0], b[1] - a[1]];
      var vectorQ = [d[0] - c[0], d[1] - c[1]];
      if (perp(vectorQ, vectorP) === 0)
          { return false; }
      // If lines are intersecting with each other, the relative location should be:
      // a and b lie in different sides of segment c->d
      // c and d lie in different sides of segment a->b
      if (twoSided(a, b, c, d) && twoSided(c, d, a, b))
          { return true; }
      return false;
  }
  function lineIntersectPolygon(p1, p2, polygon) {
      for (var i = 0, list = polygon; i < list.length; i += 1) {
          // loop through every edge of the ring
          var ring = list[i];

        for (var j = 0; j < ring.length - 1; ++j) {
              if (segmentIntersectSegment(p1, p2, ring[j], ring[j + 1])) {
                  return true;
              }
          }
      }
      return false;
  }
  // ray casting algorithm for detecting if point is in polygon
  function pointWithinPolygon(point, rings, trueIfOnBoundary) {
      if ( trueIfOnBoundary === void 0 ) trueIfOnBoundary = false;

      var inside = false;
      for (var i = 0, list = rings; i < list.length; i += 1) {
          var ring = list[i];

        for (var j = 0; j < ring.length - 1; j++) {
              if (pointOnBoundary(point, ring[j], ring[j + 1]))
                  { return trueIfOnBoundary; }
              if (rayIntersect(point, ring[j], ring[j + 1]))
                  { inside = !inside; }
          }
      }
      return inside;
  }
  function pointWithinPolygons(point, polygons) {
      for (var i = 0, list = polygons; i < list.length; i += 1) {
          var polygon = list[i];

        if (pointWithinPolygon(point, polygon))
              { return true; }
      }
      return false;
  }
  function lineStringWithinPolygon(line, polygon) {
      // First, check if geometry points of line segments are all inside polygon
      for (var i$1 = 0, list = line; i$1 < list.length; i$1 += 1) {
          var point = list[i$1];

        if (!pointWithinPolygon(point, polygon)) {
              return false;
          }
      }
      // Second, check if there is line segment intersecting polygon edge
      for (var i = 0; i < line.length - 1; ++i) {
          if (lineIntersectPolygon(line[i], line[i + 1], polygon)) {
              return false;
          }
      }
      return true;
  }
  function lineStringWithinPolygons(line, polygons) {
      for (var i = 0, list = polygons; i < list.length; i += 1) {
          var polygon = list[i];

        if (lineStringWithinPolygon(line, polygon))
              { return true; }
      }
      return false;
  }
  function perp(v1, v2) {
      return (v1[0] * v2[1] - v1[1] * v2[0]);
  }
  // check if p1 and p2 are in different sides of line segment q1->q2
  function twoSided(p1, p2, q1, q2) {
      // q1->p1 (x1, y1), q1->p2 (x2, y2), q1->q2 (x3, y3)
      var x1 = p1[0] - q1[0];
      var y1 = p1[1] - q1[1];
      var x2 = p2[0] - q1[0];
      var y2 = p2[1] - q1[1];
      var x3 = q2[0] - q1[0];
      var y3 = q2[1] - q1[1];
      var det1 = (x1 * y3 - x3 * y1);
      var det2 = (x2 * y3 - x3 * y2);
      if ((det1 > 0 && det2 < 0) || (det1 < 0 && det2 > 0))
          { return true; }
      return false;
  }

  function getTilePolygon(coordinates, bbox, canonical) {
      var polygon = [];
      for (var i = 0; i < coordinates.length; i++) {
          var ring = [];
          for (var j = 0; j < coordinates[i].length; j++) {
              var coord = getTileCoordinates(coordinates[i][j], canonical);
              updateBBox(bbox, coord);
              ring.push(coord);
          }
          polygon.push(ring);
      }
      return polygon;
  }
  function getTilePolygons(coordinates, bbox, canonical) {
      var polygons = [];
      for (var i = 0; i < coordinates.length; i++) {
          var polygon = getTilePolygon(coordinates[i], bbox, canonical);
          polygons.push(polygon);
      }
      return polygons;
  }
  function updatePoint(p, bbox, polyBBox, worldSize) {
      if (p[0] < polyBBox[0] || p[0] > polyBBox[2]) {
          var halfWorldSize = worldSize * 0.5;
          var shift = (p[0] - polyBBox[0] > halfWorldSize) ? -worldSize : (polyBBox[0] - p[0] > halfWorldSize) ? worldSize : 0;
          if (shift === 0) {
              shift = (p[0] - polyBBox[2] > halfWorldSize) ? -worldSize : (polyBBox[2] - p[0] > halfWorldSize) ? worldSize : 0;
          }
          p[0] += shift;
      }
      updateBBox(bbox, p);
  }
  function resetBBox(bbox) {
      bbox[0] = bbox[1] = Infinity;
      bbox[2] = bbox[3] = -Infinity;
  }
  function getTilePoints(geometry, pointBBox, polyBBox, canonical) {
      var worldSize = Math.pow(2, canonical.z) * EXTENT;
      var shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
      var tilePoints = [];
      for (var i$1 = 0, list$1 = geometry; i$1 < list$1.length; i$1 += 1) {
          var points = list$1[i$1];

        for (var i = 0, list = points; i < list.length; i += 1) {
              var point = list[i];

            var p = [point.x + shifts[0], point.y + shifts[1]];
              updatePoint(p, pointBBox, polyBBox, worldSize);
              tilePoints.push(p);
          }
      }
      return tilePoints;
  }
  function getTileLines(geometry, lineBBox, polyBBox, canonical) {
      var worldSize = Math.pow(2, canonical.z) * EXTENT;
      var shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
      var tileLines = [];
      for (var i$1 = 0, list$1 = geometry; i$1 < list$1.length; i$1 += 1) {
          var line = list$1[i$1];

        var tileLine = [];
          for (var i = 0, list = line; i < list.length; i += 1) {
              var point = list[i];

            var p = [point.x + shifts[0], point.y + shifts[1]];
              updateBBox(lineBBox, p);
              tileLine.push(p);
          }
          tileLines.push(tileLine);
      }
      if (lineBBox[2] - lineBBox[0] <= worldSize / 2) {
          resetBBox(lineBBox);
          for (var i$3 = 0, list$3 = tileLines; i$3 < list$3.length; i$3 += 1) {
              var line$1 = list$3[i$3];

            for (var i$2 = 0, list$2 = line$1; i$2 < list$2.length; i$2 += 1) {
                  var p$1 = list$2[i$2];

                updatePoint(p$1, lineBBox, polyBBox, worldSize);
              }
          }
      }
      return tileLines;
  }
  function pointsWithinPolygons(ctx, polygonGeometry) {
      var pointBBox = [Infinity, Infinity, -Infinity, -Infinity];
      var polyBBox = [Infinity, Infinity, -Infinity, -Infinity];
      var canonical = ctx.canonicalID();
      if (polygonGeometry.type === 'Polygon') {
          var tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
          var tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
          if (!boxWithinBox(pointBBox, polyBBox))
              { return false; }
          for (var i = 0, list = tilePoints; i < list.length; i += 1) {
              var point = list[i];

            if (!pointWithinPolygon(point, tilePolygon))
                  { return false; }
          }
      }
      if (polygonGeometry.type === 'MultiPolygon') {
          var tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
          var tilePoints$1 = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
          if (!boxWithinBox(pointBBox, polyBBox))
              { return false; }
          for (var i$1 = 0, list$1 = tilePoints$1; i$1 < list$1.length; i$1 += 1) {
              var point$1 = list$1[i$1];

            if (!pointWithinPolygons(point$1, tilePolygons))
                  { return false; }
          }
      }
      return true;
  }
  function linesWithinPolygons(ctx, polygonGeometry) {
      var lineBBox = [Infinity, Infinity, -Infinity, -Infinity];
      var polyBBox = [Infinity, Infinity, -Infinity, -Infinity];
      var canonical = ctx.canonicalID();
      if (polygonGeometry.type === 'Polygon') {
          var tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
          var tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
          if (!boxWithinBox(lineBBox, polyBBox))
              { return false; }
          for (var i = 0, list = tileLines; i < list.length; i += 1) {
              var line = list[i];

            if (!lineStringWithinPolygon(line, tilePolygon))
                  { return false; }
          }
      }
      if (polygonGeometry.type === 'MultiPolygon') {
          var tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
          var tileLines$1 = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
          if (!boxWithinBox(lineBBox, polyBBox))
              { return false; }
          for (var i$1 = 0, list$1 = tileLines$1; i$1 < list$1.length; i$1 += 1) {
              var line$1 = list$1[i$1];

            if (!lineStringWithinPolygons(line$1, tilePolygons))
                  { return false; }
          }
      }
      return true;
  }
  var Within = function Within(geojson, geometries) {
        this.type = BooleanType;
        this.geojson = geojson;
        this.geometries = geometries;
    };
    Within.parse = function parse (args, context) {
        if (args.length !== 2)
            { return context.error(("'within' expression requires exactly one argument, but found " + (args.length - 1) + " instead.")); }
        if (isValue(args[1])) {
            var geojson = args[1];
            if (geojson.type === 'FeatureCollection') {
                var polygonsCoords = [];
                for (var i = 0, list = geojson.features; i < list.length; i += 1) {
                    var polygon = list[i];

                    var ref = polygon.geometry;
                      var type = ref.type;
                      var coordinates = ref.coordinates;
                    if (type === 'Polygon') {
                        polygonsCoords.push(coordinates);
                    }
                    if (type === 'MultiPolygon') {
                        polygonsCoords.push.apply(polygonsCoords, coordinates);
                    }
                }
                if (polygonsCoords.length) {
                    var multipolygonWrapper = {
                        type: 'MultiPolygon',
                        coordinates: polygonsCoords
                    };
                    return new Within(geojson, multipolygonWrapper);
                }
            }
            else if (geojson.type === 'Feature') {
                var type$1 = geojson.geometry.type;
                if (type$1 === 'Polygon' || type$1 === 'MultiPolygon') {
                    return new Within(geojson, geojson.geometry);
                }
            }
            else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
                return new Within(geojson, geojson);
            }
        }
        return context.error('\'within\' expression requires valid geojson object that contains polygon geometry type.');
    };
    Within.prototype.evaluate = function evaluate (ctx) {
        if (ctx.geometry() != null && ctx.canonicalID() != null) {
            if (ctx.geometryDollarType() === 'Point') {
                return pointsWithinPolygons(ctx, this.geometries);
            }
            else if (ctx.geometryDollarType() === 'LineString') {
                return linesWithinPolygons(ctx, this.geometries);
            }
        }
        return false;
    };
    Within.prototype.eachChild = function eachChild () { };
    Within.prototype.outputDefined = function outputDefined () {
        return true;
    };

  var TinyQueue = function TinyQueue(data, compare) {
        if ( data === void 0 ) data = [];
        if ( compare === void 0 ) compare = function (a, b) { return (a < b ? -1 : a > b ? 1 : 0); };

        this.data = data;
        this.length = this.data.length;
        this.compare = compare;

        if (this.length > 0) {
            for (var i = (this.length >> 1) - 1; i >= 0; i--) { this._down(i); }
        }
    };

    TinyQueue.prototype.push = function push (item) {
        this.data.push(item);
        this._up(this.length++);
    };

    TinyQueue.prototype.pop = function pop () {
        if (this.length === 0) { return undefined; }

        var top = this.data[0];
        var bottom = this.data.pop();

        if (--this.length > 0) {
            this.data[0] = bottom;
            this._down(0);
        }

        return top;
    };

    TinyQueue.prototype.peek = function peek () {
        return this.data[0];
    };

    TinyQueue.prototype._up = function _up (pos) {
        var ref = this;
          var data = ref.data;
          var compare = ref.compare;
        var item = data[pos];

        while (pos > 0) {
            var parent = (pos - 1) >> 1;
            var current = data[parent];
            if (compare(item, current) >= 0) { break; }
            data[pos] = current;
            pos = parent;
        }

        data[pos] = item;
    };

    TinyQueue.prototype._down = function _down (pos) {
        var ref = this;
          var data = ref.data;
          var compare = ref.compare;
        var halfLength = this.length >> 1;
        var item = data[pos];

        while (pos < halfLength) {
            var bestChild = (pos << 1) + 1; // initially it is the left child
            var right = bestChild + 1;

            if (right < this.length && compare(data[right], data[bestChild]) < 0) {
                bestChild = right;
            }
            if (compare(data[bestChild], item) >= 0) { break; }

            data[pos] = data[bestChild];
            pos = bestChild;
        }

        data[pos] = item;
    };

  // This is taken from https://github.com/mapbox/cheap-ruler/ in order to take only the relevant parts
  // Values that define WGS84 ellipsoid model of the Earth
  var RE = 6378.137; // equatorial radius
  var FE = 1 / 298.257223563; // flattening
  var E2 = FE * (2 - FE);
  var RAD = Math.PI / 180;
  var CheapRuler = function CheapRuler(lat) {
        // Curvature formulas from https://en.wikipedia.org/wiki/Earth_radius#Meridional
        var m = RAD * RE * 1000;
        var coslat = Math.cos(lat * RAD);
        var w2 = 1 / (1 - E2 * (1 - coslat * coslat));
        var w = Math.sqrt(w2);
        // multipliers for converting longitude and latitude degrees into distance
        this.kx = m * w * coslat; // based on normal radius of curvature
        this.ky = m * w * w2 * (1 - E2); // based on meridional radius of curvature
    };
    /**
     * Given two points of the form [longitude, latitude], returns the distance.
     *
     * @param a - point [longitude, latitude]
     * @param b - point [longitude, latitude]
     * @returns distance
     * @example
     * const distance = ruler.distance([30.5, 50.5], [30.51, 50.49]);
     * //=distance
     */
    CheapRuler.prototype.distance = function distance (a, b) {
        var dx = this.wrap(a[0] - b[0]) * this.kx;
        var dy = (a[1] - b[1]) * this.ky;
        return Math.sqrt(dx * dx + dy * dy);
    };
    /**
     * Returns an object of the form {point, index, t}, where point is closest point on the line
     * from the given point, index is the start index of the segment with the closest point,
     * and t is a parameter from 0 to 1 that indicates where the closest point is on that segment.
     *
     * @param line - an array of points that form the line
     * @param p - point [longitude, latitude]
     * @returns the nearest point, its index in the array and the proportion along the line
     * @example
     * const point = ruler.pointOnLine(line, [-67.04, 50.5]).point;
     * //=point
     */
    CheapRuler.prototype.pointOnLine = function pointOnLine (line, p) {
        var minDist = Infinity;
        var minX, minY, minI, minT;
        for (var i = 0; i < line.length - 1; i++) {
            var x = line[i][0];
            var y = line[i][1];
            var dx = this.wrap(line[i + 1][0] - x) * this.kx;
            var dy = (line[i + 1][1] - y) * this.ky;
            var t = 0;
            if (dx !== 0 || dy !== 0) {
                t = (this.wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);
                if (t > 1) {
                    x = line[i + 1][0];
                    y = line[i + 1][1];
                }
                else if (t > 0) {
                    x += (dx / this.kx) * t;
                    y += (dy / this.ky) * t;
                }
            }
            dx = this.wrap(p[0] - x) * this.kx;
            dy = (p[1] - y) * this.ky;
            var sqDist = dx * dx + dy * dy;
            if (sqDist < minDist) {
                minDist = sqDist;
                minX = x;
                minY = y;
                minI = i;
                minT = t;
            }
        }
        return {
            point: [minX, minY],
            index: minI,
            t: Math.max(0, Math.min(1, minT))
        };
    };
    CheapRuler.prototype.wrap = function wrap (deg) {
        while (deg < -180)
            { deg += 360; }
        while (deg > 180)
            { deg -= 360; }
        return deg;
    };

  var MinPointsSize = 100;
  var MinLinePointsSize = 50;
  function compareDistPair(a, b) {
      return b[0] - a[0];
  }
  function getRangeSize(range) {
      return range[1] - range[0] + 1;
  }
  function isRangeSafe(range, threshold) {
      return range[1] >= range[0] && range[1] < threshold;
  }
  function splitRange(range, isLine) {
      if (range[0] > range[1]) {
          return [null, null];
      }
      var size = getRangeSize(range);
      if (isLine) {
          if (size === 2) {
              return [range, null];
          }
          var size1$1 = Math.floor(size / 2);
          return [[range[0], range[0] + size1$1],
              [range[0] + size1$1, range[1]]];
      }
      if (size === 1) {
          return [range, null];
      }
      var size1 = Math.floor(size / 2) - 1;
      return [[range[0], range[0] + size1],
          [range[0] + size1 + 1, range[1]]];
  }
  function getBBox(coords, range) {
      if (!isRangeSafe(range, coords.length)) {
          return [Infinity, Infinity, -Infinity, -Infinity];
      }
      var bbox = [Infinity, Infinity, -Infinity, -Infinity];
      for (var i = range[0]; i <= range[1]; ++i) {
          updateBBox(bbox, coords[i]);
      }
      return bbox;
  }
  function getPolygonBBox(polygon) {
      var bbox = [Infinity, Infinity, -Infinity, -Infinity];
      for (var i$1 = 0, list$1 = polygon; i$1 < list$1.length; i$1 += 1) {
          var ring = list$1[i$1];

        for (var i = 0, list = ring; i < list.length; i += 1) {
              var coord = list[i];

            updateBBox(bbox, coord);
          }
      }
      return bbox;
  }
  function isValidBBox(bbox) {
      return bbox[0] !== -Infinity && bbox[1] !== -Infinity && bbox[2] !== Infinity && bbox[3] !== Infinity;
  }
  // Calculate the distance between two bounding boxes.
  // Calculate the delta in x and y direction, and use two fake points {0.0, 0.0}
  // and {dx, dy} to calculate the distance. Distance will be 0.0 if bounding box are overlapping.
  function bboxToBBoxDistance(bbox1, bbox2, ruler) {
      if (!isValidBBox(bbox1) || !isValidBBox(bbox2)) {
          return NaN;
      }
      var dx = 0.0;
      var dy = 0.0;
      // bbox1 in left side
      if (bbox1[2] < bbox2[0]) {
          dx = bbox2[0] - bbox1[2];
      }
      // bbox1 in right side
      if (bbox1[0] > bbox2[2]) {
          dx = bbox1[0] - bbox2[2];
      }
      // bbox1 in above side
      if (bbox1[1] > bbox2[3]) {
          dy = bbox1[1] - bbox2[3];
      }
      // bbox1 in down side
      if (bbox1[3] < bbox2[1]) {
          dy = bbox2[1] - bbox1[3];
      }
      return ruler.distance([0.0, 0.0], [dx, dy]);
  }
  function pointToLineDistance(point, line, ruler) {
      var nearestPoint = ruler.pointOnLine(line, point);
      return ruler.distance(point, nearestPoint.point);
  }
  function segmentToSegmentDistance(p1, p2, q1, q2, ruler) {
      var dist1 = Math.min(pointToLineDistance(p1, [q1, q2], ruler), pointToLineDistance(p2, [q1, q2], ruler));
      var dist2 = Math.min(pointToLineDistance(q1, [p1, p2], ruler), pointToLineDistance(q2, [p1, p2], ruler));
      return Math.min(dist1, dist2);
  }
  function lineToLineDistance(line1, range1, line2, range2, ruler) {
      var rangeSafe = isRangeSafe(range1, line1.length) && isRangeSafe(range2, line2.length);
      if (!rangeSafe) {
          return Infinity;
      }
      var dist = Infinity;
      for (var i = range1[0]; i < range1[1]; ++i) {
          var p1 = line1[i];
          var p2 = line1[i + 1];
          for (var j = range2[0]; j < range2[1]; ++j) {
              var q1 = line2[j];
              var q2 = line2[j + 1];
              if (segmentIntersectSegment(p1, p2, q1, q2)) {
                  return 0.0;
              }
              dist = Math.min(dist, segmentToSegmentDistance(p1, p2, q1, q2, ruler));
          }
      }
      return dist;
  }
  function pointsToPointsDistance(points1, range1, points2, range2, ruler) {
      var rangeSafe = isRangeSafe(range1, points1.length) && isRangeSafe(range2, points2.length);
      if (!rangeSafe) {
          return NaN;
      }
      var dist = Infinity;
      for (var i = range1[0]; i <= range1[1]; ++i) {
          for (var j = range2[0]; j <= range2[1]; ++j) {
              dist = Math.min(dist, ruler.distance(points1[i], points2[j]));
              if (dist === 0.0) {
                  return dist;
              }
          }
      }
      return dist;
  }
  function pointToPolygonDistance(point, polygon, ruler) {
      if (pointWithinPolygon(point, polygon, true)) {
          return 0.0;
      }
      var dist = Infinity;
      for (var i = 0, list = polygon; i < list.length; i += 1) {
          var ring = list[i];

        var front = ring[0];
          var back = ring[ring.length - 1];
          if (front !== back) {
              dist = Math.min(dist, pointToLineDistance(point, [back, front], ruler));
              if (dist === 0.0) {
                  return dist;
              }
          }
          var nearestPoint = ruler.pointOnLine(ring, point);
          dist = Math.min(dist, ruler.distance(point, nearestPoint.point));
          if (dist === 0.0) {
              return dist;
          }
      }
      return dist;
  }
  function lineToPolygonDistance(line, range, polygon, ruler) {
      if (!isRangeSafe(range, line.length)) {
          return NaN;
      }
      for (var i = range[0]; i <= range[1]; ++i) {
          if (pointWithinPolygon(line[i], polygon, true)) {
              return 0.0;
          }
      }
      var dist = Infinity;
      for (var i$1 = range[0]; i$1 < range[1]; ++i$1) {
          var p1 = line[i$1];
          var p2 = line[i$1 + 1];
          for (var i$2 = 0, list = polygon; i$2 < list.length; i$2 += 1) {
              var ring = list[i$2];

            for (var j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
                  var q1 = ring[k];
                  var q2 = ring[j];
                  if (segmentIntersectSegment(p1, p2, q1, q2)) {
                      return 0.0;
                  }
                  dist = Math.min(dist, segmentToSegmentDistance(p1, p2, q1, q2, ruler));
              }
          }
      }
      return dist;
  }
  function polygonIntersect(poly1, poly2) {
      for (var i$1 = 0, list$1 = poly1; i$1 < list$1.length; i$1 += 1) {
          var ring = list$1[i$1];

        for (var i = 0, list = ring; i < list.length; i += 1) {
              var point = list[i];

            if (pointWithinPolygon(point, poly2, true)) {
                  return true;
              }
          }
      }
      return false;
  }
  function polygonToPolygonDistance(polygon1, polygon2, ruler, currentMiniDist) {
      if ( currentMiniDist === void 0 ) currentMiniDist = Infinity;

      var bbox1 = getPolygonBBox(polygon1);
      var bbox2 = getPolygonBBox(polygon2);
      if (currentMiniDist !== Infinity && bboxToBBoxDistance(bbox1, bbox2, ruler) >= currentMiniDist) {
          return currentMiniDist;
      }
      if (boxWithinBox(bbox1, bbox2)) {
          if (polygonIntersect(polygon1, polygon2)) {
              return 0.0;
          }
      }
      else if (polygonIntersect(polygon2, polygon1)) {
          return 0.0;
      }
      var dist = Infinity;
      for (var i$2 = 0, list$1 = polygon1; i$2 < list$1.length; i$2 += 1) {
          var ring1 = list$1[i$2];

        for (var i = 0, len1 = ring1.length, l = len1 - 1; i < len1; l = i++) {
              var p1 = ring1[l];
              var p2 = ring1[i];
              for (var i$1 = 0, list = polygon2; i$1 < list.length; i$1 += 1) {
                  var ring2 = list[i$1];

                for (var j = 0, len2 = ring2.length, k = len2 - 1; j < len2; k = j++) {
                      var q1 = ring2[k];
                      var q2 = ring2[j];
                      if (segmentIntersectSegment(p1, p2, q1, q2)) {
                          return 0.0;
                      }
                      dist = Math.min(dist, segmentToSegmentDistance(p1, p2, q1, q2, ruler));
                  }
              }
          }
      }
      return dist;
  }
  function updateQueue(distQueue, miniDist, ruler, points, polyBBox, rangeA) {
      if (!rangeA) {
          return;
      }
      var tempDist = bboxToBBoxDistance(getBBox(points, rangeA), polyBBox, ruler);
      // Insert new pair to the queue if the bbox distance is less than
      // miniDist, The pair with biggest distance will be at the top
      if (tempDist < miniDist) {
          distQueue.push([tempDist, rangeA, [0, 0]]);
      }
  }
  function updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, range1, range2) {
      if (!range1 || !range2) {
          return;
      }
      var tempDist = bboxToBBoxDistance(getBBox(pointSet1, range1), getBBox(pointSet2, range2), ruler);
      // Insert new pair to the queue if the bbox distance is less than
      // miniDist, The pair with biggest distance will be at the top
      if (tempDist < miniDist) {
          distQueue.push([tempDist, range1, range2]);
      }
  }
  // Divide and conquer, the time complexity is O(n*lgn), faster than Brute force
  // O(n*n) Most of the time, use index for in-place processing.
  function pointsToPolygonDistance(points, isLine, polygon, ruler, currentMiniDist) {
      if ( currentMiniDist === void 0 ) currentMiniDist = Infinity;

      var miniDist = Math.min(ruler.distance(points[0], polygon[0][0]), currentMiniDist);
      if (miniDist === 0.0) {
          return miniDist;
      }
      var distQueue = new TinyQueue([[0, [0, points.length - 1], [0, 0]]], compareDistPair);
      var polyBBox = getPolygonBBox(polygon);
      while (distQueue.length > 0) {
          var distPair = distQueue.pop();
          if (distPair[0] >= miniDist) {
              continue;
          }
          var range = distPair[1];
          // In case the set size are relatively small, we could use brute-force directly
          var threshold = isLine ? MinLinePointsSize : MinPointsSize;
          if (getRangeSize(range) <= threshold) {
              if (!isRangeSafe(range, points.length)) {
                  return NaN;
              }
              if (isLine) {
                  var tempDist = lineToPolygonDistance(points, range, polygon, ruler);
                  if (isNaN(tempDist) || tempDist === 0.0) {
                      return tempDist;
                  }
                  miniDist = Math.min(miniDist, tempDist);
              }
              else {
                  for (var i = range[0]; i <= range[1]; ++i) {
                      var tempDist$1 = pointToPolygonDistance(points[i], polygon, ruler);
                      miniDist = Math.min(miniDist, tempDist$1);
                      if (miniDist === 0.0) {
                          return 0.0;
                      }
                  }
              }
          }
          else {
              var newRangesA = splitRange(range, isLine);
              updateQueue(distQueue, miniDist, ruler, points, polyBBox, newRangesA[0]);
              updateQueue(distQueue, miniDist, ruler, points, polyBBox, newRangesA[1]);
          }
      }
      return miniDist;
  }
  function pointSetToPointSetDistance(pointSet1, isLine1, pointSet2, isLine2, ruler, currentMiniDist) {
      if ( currentMiniDist === void 0 ) currentMiniDist = Infinity;

      var miniDist = Math.min(currentMiniDist, ruler.distance(pointSet1[0], pointSet2[0]));
      if (miniDist === 0.0) {
          return miniDist;
      }
      var distQueue = new TinyQueue([[0, [0, pointSet1.length - 1], [0, pointSet2.length - 1]]], compareDistPair);
      while (distQueue.length > 0) {
          var distPair = distQueue.pop();
          if (distPair[0] >= miniDist) {
              continue;
          }
          var rangeA = distPair[1];
          var rangeB = distPair[2];
          var threshold1 = isLine1 ? MinLinePointsSize : MinPointsSize;
          var threshold2 = isLine2 ? MinLinePointsSize : MinPointsSize;
          // In case the set size are relatively small, we could use brute-force directly
          if (getRangeSize(rangeA) <= threshold1 && getRangeSize(rangeB) <= threshold2) {
              if (!isRangeSafe(rangeA, pointSet1.length) && isRangeSafe(rangeB, pointSet2.length)) {
                  return NaN;
              }
              var tempDist = (void 0);
              if (isLine1 && isLine2) {
                  tempDist = lineToLineDistance(pointSet1, rangeA, pointSet2, rangeB, ruler);
                  miniDist = Math.min(miniDist, tempDist);
              }
              else if (isLine1 && !isLine2) {
                  var sublibe = pointSet1.slice(rangeA[0], rangeA[1] + 1);
                  for (var i = rangeB[0]; i <= rangeB[1]; ++i) {
                      tempDist = pointToLineDistance(pointSet2[i], sublibe, ruler);
                      miniDist = Math.min(miniDist, tempDist);
                      if (miniDist === 0.0) {
                          return miniDist;
                      }
                  }
              }
              else if (!isLine1 && isLine2) {
                  var sublibe$1 = pointSet2.slice(rangeB[0], rangeB[1] + 1);
                  for (var i$1 = rangeA[0]; i$1 <= rangeA[1]; ++i$1) {
                      tempDist = pointToLineDistance(pointSet1[i$1], sublibe$1, ruler);
                      miniDist = Math.min(miniDist, tempDist);
                      if (miniDist === 0.0) {
                          return miniDist;
                      }
                  }
              }
              else {
                  tempDist = pointsToPointsDistance(pointSet1, rangeA, pointSet2, rangeB, ruler);
                  miniDist = Math.min(miniDist, tempDist);
              }
          }
          else {
              var newRangesA = splitRange(rangeA, isLine1);
              var newRangesB = splitRange(rangeB, isLine2);
              updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[0], newRangesB[0]);
              updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[0], newRangesB[1]);
              updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[1], newRangesB[0]);
              updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[1], newRangesB[1]);
          }
      }
      return miniDist;
  }
  function pointToGeometryDistance(ctx, geometries) {
      var tilePoints = ctx.geometry();
      var pointPosition = tilePoints.flat().map(function (p) { return getLngLatFromTileCoord([p.x, p.y], ctx.canonical); });
      if (tilePoints.length === 0) {
          return NaN;
      }
      var ruler = new CheapRuler(pointPosition[0][1]);
      var dist = Infinity;
      for (var i = 0, list = geometries; i < list.length; i += 1) {
          var geometry = list[i];

        switch (geometry.type) {
              case 'Point':
                  dist = Math.min(dist, pointSetToPointSetDistance(pointPosition, false, [geometry.coordinates], false, ruler, dist));
                  break;
              case 'LineString':
                  dist = Math.min(dist, pointSetToPointSetDistance(pointPosition, false, geometry.coordinates, true, ruler, dist));
                  break;
              case 'Polygon':
                  dist = Math.min(dist, pointsToPolygonDistance(pointPosition, false, geometry.coordinates, ruler, dist));
                  break;
          }
          if (dist === 0.0) {
              return dist;
          }
      }
      return dist;
  }
  function lineStringToGeometryDistance(ctx, geometries) {
      var tileLine = ctx.geometry();
      var linePositions = tileLine.flat().map(function (p) { return getLngLatFromTileCoord([p.x, p.y], ctx.canonical); });
      if (tileLine.length === 0) {
          return NaN;
      }
      var ruler = new CheapRuler(linePositions[0][1]);
      var dist = Infinity;
      for (var i = 0, list = geometries; i < list.length; i += 1) {
          var geometry = list[i];

        switch (geometry.type) {
              case 'Point':
                  dist = Math.min(dist, pointSetToPointSetDistance(linePositions, true, [geometry.coordinates], false, ruler, dist));
                  break;
              case 'LineString':
                  dist = Math.min(dist, pointSetToPointSetDistance(linePositions, true, geometry.coordinates, true, ruler, dist));
                  break;
              case 'Polygon':
                  dist = Math.min(dist, pointsToPolygonDistance(linePositions, true, geometry.coordinates, ruler, dist));
                  break;
          }
          if (dist === 0.0) {
              return dist;
          }
      }
      return dist;
  }
  function polygonToGeometryDistance(ctx, geometries) {
      var tilePolygon = ctx.geometry();
      if (tilePolygon.length === 0 || tilePolygon[0].length === 0) {
          return NaN;
      }
      var polygons = classifyRings(tilePolygon, 0).map(function (polygon) {
          return polygon.map(function (ring) {
              return ring.map(function (p) { return getLngLatFromTileCoord([p.x, p.y], ctx.canonical); });
          });
      });
      var ruler = new CheapRuler(polygons[0][0][0][1]);
      var dist = Infinity;
      for (var i$1 = 0, list$1 = geometries; i$1 < list$1.length; i$1 += 1) {
          var geometry = list$1[i$1];

        for (var i = 0, list = polygons; i < list.length; i += 1) {
              var polygon = list[i];

            switch (geometry.type) {
                  case 'Point':
                      dist = Math.min(dist, pointsToPolygonDistance([geometry.coordinates], false, polygon, ruler, dist));
                      break;
                  case 'LineString':
                      dist = Math.min(dist, pointsToPolygonDistance(geometry.coordinates, true, polygon, ruler, dist));
                      break;
                  case 'Polygon':
                      dist = Math.min(dist, polygonToPolygonDistance(polygon, geometry.coordinates, ruler, dist));
                      break;
              }
              if (dist === 0.0) {
                  return dist;
              }
          }
      }
      return dist;
  }
  function toSimpleGeometry(geometry) {
      if (geometry.type === 'MultiPolygon') {
          return geometry.coordinates.map(function (polygon) {
              return {
                  type: 'Polygon',
                  coordinates: polygon
              };
          });
      }
      if (geometry.type === 'MultiLineString') {
          return geometry.coordinates.map(function (lineString) {
              return {
                  type: 'LineString',
                  coordinates: lineString
              };
          });
      }
      if (geometry.type === 'MultiPoint') {
          return geometry.coordinates.map(function (point) {
              return {
                  type: 'Point',
                  coordinates: point
              };
          });
      }
      return [geometry];
  }
  var Distance = function Distance(geojson, geometries) {
        this.type = NumberType;
        this.geojson = geojson;
        this.geometries = geometries;
    };
    Distance.parse = function parse (args, context) {
        if (args.length !== 2)
            { return context.error(("'distance' expression requires exactly one argument, but found " + (args.length - 1) + " instead.")); }
        if (isValue(args[1])) {
            var geojson = args[1];
            if (geojson.type === 'FeatureCollection') {
                return new Distance(geojson, geojson.features.map(function (feature) { return toSimpleGeometry(feature.geometry); }).flat());
            }
            else if (geojson.type === 'Feature') {
                return new Distance(geojson, toSimpleGeometry(geojson.geometry));
            }
            else if ('type' in geojson && 'coordinates' in geojson) {
                return new Distance(geojson, toSimpleGeometry(geojson));
            }
        }
        return context.error('\'distance\' expression requires valid geojson object that contains polygon geometry type.');
    };
    Distance.prototype.evaluate = function evaluate (ctx) {
        if (ctx.geometry() != null && ctx.canonicalID() != null) {
            if (ctx.geometryType() === 'Point') {
                return pointToGeometryDistance(ctx, this.geometries);
            }
            else if (ctx.geometryType() === 'LineString') {
                return lineStringToGeometryDistance(ctx, this.geometries);
            }
            else if (ctx.geometryType() === 'Polygon') {
                return polygonToGeometryDistance(ctx, this.geometries);
            }
        }
        return NaN;
    };
    Distance.prototype.eachChild = function eachChild () { };
    Distance.prototype.outputDefined = function outputDefined () {
        return true;
    };

  var expressions$1 = {
      // special forms
      '==': Equals,
      '!=': NotEquals,
      '>': GreaterThan,
      '<': LessThan,
      '>=': GreaterThanOrEqual,
      '<=': LessThanOrEqual,
      'array': Assertion,
      'at': At,
      'boolean': Assertion,
      'case': Case,
      'coalesce': Coalesce,
      'collator': CollatorExpression,
      'format': FormatExpression,
      'image': ImageExpression,
      'in': In,
      'index-of': IndexOf,
      'interpolate': Interpolate,
      'interpolate-hcl': Interpolate,
      'interpolate-lab': Interpolate,
      'length': Length,
      'let': Let,
      'literal': Literal,
      'match': Match,
      'number': Assertion,
      'number-format': NumberFormat,
      'object': Assertion,
      'slice': Slice,
      'step': Step,
      'string': Assertion,
      'to-boolean': Coercion,
      'to-color': Coercion,
      'to-number': Coercion,
      'to-string': Coercion,
      'var': Var,
      'within': Within,
      'distance': Distance
  };

  var CompoundExpression = function CompoundExpression(name, type, evaluate, args) {
        this.name = name;
        this.type = type;
        this._evaluate = evaluate;
        this.args = args;
    };
    CompoundExpression.prototype.evaluate = function evaluate (ctx) {
        return this._evaluate(ctx, this.args);
    };
    CompoundExpression.prototype.eachChild = function eachChild (fn) {
        this.args.forEach(fn);
    };
    CompoundExpression.prototype.outputDefined = function outputDefined () {
        return false;
    };
    CompoundExpression.parse = function parse (args, context) {
          var ref$1;

        var op = args[0];
        var definition = CompoundExpression.definitions[op];
        if (!definition) {
            return context.error(("Unknown expression \"" + op + "\". If you wanted a literal array, use [\"literal\", [...]]."), 0);
        }
        // Now check argument types against each signature
        var type = Array.isArray(definition) ?
            definition[0] : definition.type;
        var availableOverloads = Array.isArray(definition) ?
            [[definition[1], definition[2]]] :
            definition.overloads;
        var overloads = availableOverloads.filter(function (ref) {
            var signature = ref[0];

            return (!Array.isArray(signature) || // varags
            signature.length === args.length - 1 // correct param count
        );
          });
        var signatureContext = null;
        for (var i$3 = 0, list = overloads; i$3 < list.length; i$3 += 1) {
            // Use a fresh context for each attempted signature so that, if
            // we eventually succeed, we haven't polluted `context.errors`.
            var ref = list[i$3];
            var params = ref[0];
            var evaluate = ref[1];

            signatureContext = new ParsingContext(context.registry, isExpressionConstant, context.path, null, context.scope);
            // First parse all the args, potentially coercing to the
            // types expected by this overload.
            var parsedArgs = [];
            var argParseFailed = false;
            for (var i = 1; i < args.length; i++) {
                var arg = args[i];
                var expectedType = Array.isArray(params) ?
                    params[i - 1] :
                    params.type;
                var parsed = signatureContext.parse(arg, 1 + parsedArgs.length, expectedType);
                if (!parsed) {
                    argParseFailed = true;
                    break;
                }
                parsedArgs.push(parsed);
            }
            if (argParseFailed) {
                // Couldn't coerce args of this overload to expected type, move
                // on to next one.
                continue;
            }
            if (Array.isArray(params)) {
                if (params.length !== parsedArgs.length) {
                    signatureContext.error(("Expected " + (params.length) + " arguments, but found " + (parsedArgs.length) + " instead."));
                    continue;
                }
            }
            for (var i$1 = 0; i$1 < parsedArgs.length; i$1++) {
                var expected = Array.isArray(params) ? params[i$1] : params.type;
                var arg$1 = parsedArgs[i$1];
                signatureContext.concat(i$1 + 1).checkSubtype(expected, arg$1.type);
            }
            if (signatureContext.errors.length === 0) {
                return new CompoundExpression(op, type, evaluate, parsedArgs);
            }
        }
        if (overloads.length === 1) {
            (ref$1 = context.errors).push.apply(ref$1, signatureContext.errors);
        }
        else {
            var expected$1 = overloads.length ? overloads : availableOverloads;
            var signatures = expected$1
                .map(function (ref) {
                    var params = ref[0];

                    return stringifySignature(params);
              })
                .join(' | ');
            var actualTypes = [];
            // For error message, re-parse arguments without trying to
            // apply any coercions
            for (var i$2 = 1; i$2 < args.length; i$2++) {
                var parsed$1 = context.parse(args[i$2], 1 + actualTypes.length);
                if (!parsed$1)
                    { return null; }
                actualTypes.push(typeToString(parsed$1.type));
            }
            context.error(("Expected arguments of type " + signatures + ", but found (" + (actualTypes.join(', ')) + ") instead."));
        }
        return null;
    };
    CompoundExpression.register = function register (registry, definitions) {
        CompoundExpression.definitions = definitions;
        for (var name in definitions) {
            registry[name] = CompoundExpression;
        }
    };
  function rgba(ctx, ref) {
      var r = ref[0];
      var g = ref[1];
      var b = ref[2];
      var a = ref[3];

      r = r.evaluate(ctx);
      g = g.evaluate(ctx);
      b = b.evaluate(ctx);
      var alpha = a ? a.evaluate(ctx) : 1;
      var error = validateRGBA(r, g, b, alpha);
      if (error)
          { throw new RuntimeError(error); }
      return new Color(r / 255, g / 255, b / 255, alpha, false);
  }
  function has(key, obj) {
      return key in obj;
  }
  function get(key, obj) {
      var v = obj[key];
      return typeof v === 'undefined' ? null : v;
  }
  function binarySearch(v, a, i, j) {
      while (i <= j) {
          var m = (i + j) >> 1;
          if (a[m] === v)
              { return true; }
          if (a[m] > v)
              { j = m - 1; }
          else
              { i = m + 1; }
      }
      return false;
  }
  function varargs(type) {
      return { type: type };
  }
  CompoundExpression.register(expressions$1, {
      'error': [
          ErrorType,
          [StringType],
          function (ctx, ref) {
          var v = ref[0];
   throw new RuntimeError(v.evaluate(ctx)); }
      ],
      'typeof': [
          StringType,
          [ValueType],
          function (ctx, ref) {
            var v = ref[0];

            return typeToString(typeOf(v.evaluate(ctx)));
  }
      ],
      'to-rgba': [
          array(NumberType, 4),
          [ColorType],
          function (ctx, ref) {
              var v = ref[0];

              var ref$1 = v.evaluate(ctx).rgb;
              var r = ref$1[0];
              var g = ref$1[1];
              var b = ref$1[2];
              var a = ref$1[3];
              return [r * 255, g * 255, b * 255, a];
          } ],
      'rgb': [
          ColorType,
          [NumberType, NumberType, NumberType],
          rgba
      ],
      'rgba': [
          ColorType,
          [NumberType, NumberType, NumberType, NumberType],
          rgba
      ],
      'has': {
          type: BooleanType,
          overloads: [
              [
                  [StringType],
                  function (ctx, ref) {
                    var key = ref[0];

                    return has(key.evaluate(ctx), ctx.properties());
  }
              ], [
                  [StringType, ObjectType],
                  function (ctx, ref) {
                    var key = ref[0];
                    var obj = ref[1];

                    return has(key.evaluate(ctx), obj.evaluate(ctx));
  }
              ]
          ]
      },
      'get': {
          type: ValueType,
          overloads: [
              [
                  [StringType],
                  function (ctx, ref) {
                    var key = ref[0];

                    return get(key.evaluate(ctx), ctx.properties());
  }
              ], [
                  [StringType, ObjectType],
                  function (ctx, ref) {
                    var key = ref[0];
                    var obj = ref[1];

                    return get(key.evaluate(ctx), obj.evaluate(ctx));
  }
              ]
          ]
      },
      'feature-state': [
          ValueType,
          [StringType],
          function (ctx, ref) {
            var key = ref[0];

            return get(key.evaluate(ctx), ctx.featureState || {});
  }
      ],
      'properties': [
          ObjectType,
          [],
          function (ctx) { return ctx.properties(); }
      ],
      'geometry-type': [
          StringType,
          [],
          function (ctx) { return ctx.geometryType(); }
      ],
      'id': [
          ValueType,
          [],
          function (ctx) { return ctx.id(); }
      ],
      'zoom': [
          NumberType,
          [],
          function (ctx) { return ctx.globals.zoom; }
      ],
      'heatmap-density': [
          NumberType,
          [],
          function (ctx) { return ctx.globals.heatmapDensity || 0; }
      ],
      'line-progress': [
          NumberType,
          [],
          function (ctx) { return ctx.globals.lineProgress || 0; }
      ],
      'accumulated': [
          ValueType,
          [],
          function (ctx) { return ctx.globals.accumulated === undefined ? null : ctx.globals.accumulated; }
      ],
      '+': [
          NumberType,
          varargs(NumberType),
          function (ctx, args) {
              var result = 0;
              for (var i = 0, list = args; i < list.length; i += 1) {
                  var arg = list[i];

                result += arg.evaluate(ctx);
              }
              return result;
          }
      ],
      '*': [
          NumberType,
          varargs(NumberType),
          function (ctx, args) {
              var result = 1;
              for (var i = 0, list = args; i < list.length; i += 1) {
                  var arg = list[i];

                result *= arg.evaluate(ctx);
              }
              return result;
          }
      ],
      '-': {
          type: NumberType,
          overloads: [
              [
                  [NumberType, NumberType],
                  function (ctx, ref) {
                    var a = ref[0];
                    var b = ref[1];

                    return a.evaluate(ctx) - b.evaluate(ctx);
  }
              ], [
                  [NumberType],
                  function (ctx, ref) {
                    var a = ref[0];

                    return -a.evaluate(ctx);
  }
              ]
          ]
      },
      '/': [
          NumberType,
          [NumberType, NumberType],
          function (ctx, ref) {
            var a = ref[0];
            var b = ref[1];

            return a.evaluate(ctx) / b.evaluate(ctx);
  }
      ],
      '%': [
          NumberType,
          [NumberType, NumberType],
          function (ctx, ref) {
            var a = ref[0];
            var b = ref[1];

            return a.evaluate(ctx) % b.evaluate(ctx);
  }
      ],
      'ln2': [
          NumberType,
          [],
          function () { return Math.LN2; }
      ],
      'pi': [
          NumberType,
          [],
          function () { return Math.PI; }
      ],
      'e': [
          NumberType,
          [],
          function () { return Math.E; }
      ],
      '^': [
          NumberType,
          [NumberType, NumberType],
          function (ctx, ref) {
            var b = ref[0];
            var e = ref[1];

            return Math.pow(b.evaluate(ctx), e.evaluate(ctx));
  }
      ],
      'sqrt': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var x = ref[0];

            return Math.sqrt(x.evaluate(ctx));
  }
      ],
      'log10': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.log(n.evaluate(ctx)) / Math.LN10;
  }
      ],
      'ln': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.log(n.evaluate(ctx));
  }
      ],
      'log2': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.log(n.evaluate(ctx)) / Math.LN2;
  }
      ],
      'sin': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.sin(n.evaluate(ctx));
  }
      ],
      'cos': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.cos(n.evaluate(ctx));
  }
      ],
      'tan': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.tan(n.evaluate(ctx));
  }
      ],
      'asin': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.asin(n.evaluate(ctx));
  }
      ],
      'acos': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.acos(n.evaluate(ctx));
  }
      ],
      'atan': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.atan(n.evaluate(ctx));
  }
      ],
      'min': [
          NumberType,
          varargs(NumberType),
          function (ctx, args) { return Math.min.apply(Math, args.map(function (arg) { return arg.evaluate(ctx); })); }
      ],
      'max': [
          NumberType,
          varargs(NumberType),
          function (ctx, args) { return Math.max.apply(Math, args.map(function (arg) { return arg.evaluate(ctx); })); }
      ],
      'abs': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.abs(n.evaluate(ctx));
  }
      ],
      'round': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
              var n = ref[0];

              var v = n.evaluate(ctx);
              // Javascript's Math.round() rounds towards +Infinity for halfway
              // values, even when they're negative. It's more common to round
              // away from 0 (e.g., this is what python and C++ do)
              return v < 0 ? -Math.round(-v) : Math.round(v);
          }
      ],
      'floor': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.floor(n.evaluate(ctx));
  }
      ],
      'ceil': [
          NumberType,
          [NumberType],
          function (ctx, ref) {
            var n = ref[0];

            return Math.ceil(n.evaluate(ctx));
  }
      ],
      'filter-==': [
          BooleanType,
          [StringType, ValueType],
          function (ctx, ref) {
            var k = ref[0];
            var v = ref[1];

            return ctx.properties()[k.value] === v.value;
  }
      ],
      'filter-id-==': [
          BooleanType,
          [ValueType],
          function (ctx, ref) {
            var v = ref[0];

            return ctx.id() === v.value;
  }
      ],
      'filter-type-==': [
          BooleanType,
          [StringType],
          function (ctx, ref) {
            var v = ref[0];

            return ctx.geometryDollarType() === v.value;
  }
      ],
      'filter-<': [
          BooleanType,
          [StringType, ValueType],
          function (ctx, ref) {
              var k = ref[0];
              var v = ref[1];

              var a = ctx.properties()[k.value];
              var b = v.value;
              return typeof a === typeof b && a < b;
          }
      ],
      'filter-id-<': [
          BooleanType,
          [ValueType],
          function (ctx, ref) {
              var v = ref[0];

              var a = ctx.id();
              var b = v.value;
              return typeof a === typeof b && a < b;
          }
      ],
      'filter->': [
          BooleanType,
          [StringType, ValueType],
          function (ctx, ref) {
              var k = ref[0];
              var v = ref[1];

              var a = ctx.properties()[k.value];
              var b = v.value;
              return typeof a === typeof b && a > b;
          }
      ],
      'filter-id->': [
          BooleanType,
          [ValueType],
          function (ctx, ref) {
              var v = ref[0];

              var a = ctx.id();
              var b = v.value;
              return typeof a === typeof b && a > b;
          }
      ],
      'filter-<=': [
          BooleanType,
          [StringType, ValueType],
          function (ctx, ref) {
              var k = ref[0];
              var v = ref[1];

              var a = ctx.properties()[k.value];
              var b = v.value;
              return typeof a === typeof b && a <= b;
          }
      ],
      'filter-id-<=': [
          BooleanType,
          [ValueType],
          function (ctx, ref) {
              var v = ref[0];

              var a = ctx.id();
              var b = v.value;
              return typeof a === typeof b && a <= b;
          }
      ],
      'filter->=': [
          BooleanType,
          [StringType, ValueType],
          function (ctx, ref) {
              var k = ref[0];
              var v = ref[1];

              var a = ctx.properties()[k.value];
              var b = v.value;
              return typeof a === typeof b && a >= b;
          }
      ],
      'filter-id->=': [
          BooleanType,
          [ValueType],
          function (ctx, ref) {
              var v = ref[0];

              var a = ctx.id();
              var b = v.value;
              return typeof a === typeof b && a >= b;
          }
      ],
      'filter-has': [
          BooleanType,
          [ValueType],
          function (ctx, ref) {
            var k = ref[0];

            return k.value in ctx.properties();
  }
      ],
      'filter-has-id': [
          BooleanType,
          [],
          function (ctx) { return (ctx.id() !== null && ctx.id() !== undefined); }
      ],
      'filter-type-in': [
          BooleanType,
          [array(StringType)],
          function (ctx, ref) {
            var v = ref[0];

            return v.value.indexOf(ctx.geometryDollarType()) >= 0;
  }
      ],
      'filter-id-in': [
          BooleanType,
          [array(ValueType)],
          function (ctx, ref) {
            var v = ref[0];

            return v.value.indexOf(ctx.id()) >= 0;
  }
      ],
      'filter-in-small': [
          BooleanType,
          [StringType, array(ValueType)],
          // assumes v is an array literal
          function (ctx, ref) {
            var k = ref[0];
            var v = ref[1];

            return v.value.indexOf(ctx.properties()[k.value]) >= 0;
  }
      ],
      'filter-in-large': [
          BooleanType,
          [StringType, array(ValueType)],
          // assumes v is a array literal with values sorted in ascending order and of a single type
          function (ctx, ref) {
            var k = ref[0];
            var v = ref[1];

            return binarySearch(ctx.properties()[k.value], v.value, 0, v.value.length - 1);
  }
      ],
      'all': {
          type: BooleanType,
          overloads: [
              [
                  [BooleanType, BooleanType],
                  function (ctx, ref) {
                    var a = ref[0];
                    var b = ref[1];

                    return a.evaluate(ctx) && b.evaluate(ctx);
  }
              ],
              [
                  varargs(BooleanType),
                  function (ctx, args) {
                      for (var i = 0, list = args; i < list.length; i += 1) {
                          var arg = list[i];

                        if (!arg.evaluate(ctx))
                              { return false; }
                      }
                      return true;
                  }
              ]
          ]
      },
      'any': {
          type: BooleanType,
          overloads: [
              [
                  [BooleanType, BooleanType],
                  function (ctx, ref) {
                    var a = ref[0];
                    var b = ref[1];

                    return a.evaluate(ctx) || b.evaluate(ctx);
  }
              ],
              [
                  varargs(BooleanType),
                  function (ctx, args) {
                      for (var i = 0, list = args; i < list.length; i += 1) {
                          var arg = list[i];

                        if (arg.evaluate(ctx))
                              { return true; }
                      }
                      return false;
                  }
              ]
          ]
      },
      '!': [
          BooleanType,
          [BooleanType],
          function (ctx, ref) {
            var b = ref[0];

            return !b.evaluate(ctx);
  }
      ],
      'is-supported-script': [
          BooleanType,
          [StringType],
          // At parse time this will always return true, so we need to exclude this expression with isGlobalPropertyConstant
          function (ctx, ref) {
              var s = ref[0];

              var isSupportedScript = ctx.globals && ctx.globals.isSupportedScript;
              if (isSupportedScript) {
                  return isSupportedScript(s.evaluate(ctx));
              }
              return true;
          }
      ],
      'upcase': [
          StringType,
          [StringType],
          function (ctx, ref) {
            var s = ref[0];

            return s.evaluate(ctx).toUpperCase();
  }
      ],
      'downcase': [
          StringType,
          [StringType],
          function (ctx, ref) {
            var s = ref[0];

            return s.evaluate(ctx).toLowerCase();
  }
      ],
      'concat': [
          StringType,
          varargs(ValueType),
          function (ctx, args) { return args.map(function (arg) { return valueToString(arg.evaluate(ctx)); }).join(''); }
      ],
      'resolved-locale': [
          StringType,
          [CollatorType],
          function (ctx, ref) {
            var collator = ref[0];

            return collator.evaluate(ctx).resolvedLocale();
  }
      ]
  });
  function stringifySignature(signature) {
      if (Array.isArray(signature)) {
          return ("(" + (signature.map(typeToString).join(', ')) + ")");
      }
      else {
          return ("(" + (typeToString(signature.type)) + "...)");
      }
  }
  function isExpressionConstant(expression) {
      if (expression instanceof Var) {
          return isExpressionConstant(expression.boundExpression);
      }
      else if (expression instanceof CompoundExpression && expression.name === 'error') {
          return false;
      }
      else if (expression instanceof CollatorExpression) {
          // Although the results of a Collator expression with fixed arguments
          // generally shouldn't change between executions, we can't serialize them
          // as constant expressions because results change based on environment.
          return false;
      }
      else if (expression instanceof Within) {
          return false;
      }
      else if (expression instanceof Distance) {
          return false;
      }
      var isTypeAnnotation = expression instanceof Coercion ||
          expression instanceof Assertion;
      var childrenConstant = true;
      expression.eachChild(function (child) {
          // We can _almost_ assume that if `expressions` children are constant,
          // they would already have been evaluated to Literal values when they
          // were parsed.  Type annotations are the exception, because they might
          // have been inferred and added after a child was parsed.
          // So we recurse into isConstant() for the children of type annotations,
          // but otherwise simply check whether they are Literals.
          if (isTypeAnnotation) {
              childrenConstant = childrenConstant && isExpressionConstant(child);
          }
          else {
              childrenConstant = childrenConstant && child instanceof Literal;
          }
      });
      if (!childrenConstant) {
          return false;
      }
      return isFeatureConstant(expression) &&
          isGlobalPropertyConstant(expression, ['zoom', 'heatmap-density', 'line-progress', 'accumulated', 'is-supported-script']);
  }
  function isFeatureConstant(e) {
      if (e instanceof CompoundExpression) {
          if (e.name === 'get' && e.args.length === 1) {
              return false;
          }
          else if (e.name === 'feature-state') {
              return false;
          }
          else if (e.name === 'has' && e.args.length === 1) {
              return false;
          }
          else if (e.name === 'properties' ||
              e.name === 'geometry-type' ||
              e.name === 'id') {
              return false;
          }
          else if (/^filter-/.test(e.name)) {
              return false;
          }
      }
      if (e instanceof Within) {
          return false;
      }
      if (e instanceof Distance) {
          return false;
      }
      var result = true;
      e.eachChild(function (arg) {
          if (result && !isFeatureConstant(arg)) {
              result = false;
          }
      });
      return result;
  }
  function isStateConstant(e) {
      if (e instanceof CompoundExpression) {
          if (e.name === 'feature-state') {
              return false;
          }
      }
      var result = true;
      e.eachChild(function (arg) {
          if (result && !isStateConstant(arg)) {
              result = false;
          }
      });
      return result;
  }
  function isGlobalPropertyConstant(e, properties) {
      if (e instanceof CompoundExpression && properties.indexOf(e.name) >= 0) {
          return false;
      }
      var result = true;
      e.eachChild(function (arg) {
          if (result && !isGlobalPropertyConstant(arg, properties)) {
              result = false;
          }
      });
      return result;
  }

  function success(value) {
      return { result: 'success', value: value };
  }
  function error(value) {
      return { result: 'error', value: value };
  }

  function supportsPropertyExpression(spec) {
      return spec['property-type'] === 'data-driven' || spec['property-type'] === 'cross-faded-data-driven';
  }
  function supportsZoomExpression(spec) {
      return !!spec.expression && spec.expression.parameters.indexOf('zoom') > -1;
  }
  function supportsInterpolation(spec) {
      return !!spec.expression && spec.expression.interpolated;
  }

  function getType(val) {
      if (val instanceof Number) {
          return 'number';
      }
      else if (val instanceof String) {
          return 'string';
      }
      else if (val instanceof Boolean) {
          return 'boolean';
      }
      else if (Array.isArray(val)) {
          return 'array';
      }
      else if (val === null) {
          return 'null';
      }
      else {
          return typeof val;
      }
  }

  function isFunction$1(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  function identityFunction(x) {
      return x;
  }
  function createFunction(parameters, propertySpec) {
      var isColor = propertySpec.type === 'color';
      var zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
      var featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
      var zoomDependent = zoomAndFeatureDependent || !featureDependent;
      var type = parameters.type || (supportsInterpolation(propertySpec) ? 'exponential' : 'interval');
      if (isColor || propertySpec.type === 'padding') {
          var parseFn = isColor ? Color.parse : Padding.parse;
          parameters = extendBy({}, parameters);
          if (parameters.stops) {
              parameters.stops = parameters.stops.map(function (stop) {
                  return [stop[0], parseFn(stop[1])];
              });
          }
          if (parameters.default) {
              parameters.default = parseFn(parameters.default);
          }
          else {
              parameters.default = parseFn(propertySpec.default);
          }
      }
      if (parameters.colorSpace && !isSupportedInterpolationColorSpace(parameters.colorSpace)) {
          throw new Error(("Unknown color space: \"" + (parameters.colorSpace) + "\""));
      }
      var innerFun;
      var hashedStops;
      var categoricalKeyType;
      if (type === 'exponential') {
          innerFun = evaluateExponentialFunction;
      }
      else if (type === 'interval') {
          innerFun = evaluateIntervalFunction;
      }
      else if (type === 'categorical') {
          innerFun = evaluateCategoricalFunction;
          // For categorical functions, generate an Object as a hashmap of the stops for fast searching
          hashedStops = Object.create(null);
          for (var i = 0, list = parameters.stops; i < list.length; i += 1) {
              var stop = list[i];

            hashedStops[stop[0]] = stop[1];
          }
          // Infer key type based on first stop key-- used to encforce strict type checking later
          categoricalKeyType = typeof parameters.stops[0][0];
      }
      else if (type === 'identity') {
          innerFun = evaluateIdentityFunction;
      }
      else {
          throw new Error(("Unknown function type \"" + type + "\""));
      }
      if (zoomAndFeatureDependent) {
          var featureFunctions = {};
          var zoomStops = [];
          for (var s = 0; s < parameters.stops.length; s++) {
              var stop$1 = parameters.stops[s];
              var zoom = stop$1[0].zoom;
              if (featureFunctions[zoom] === undefined) {
                  featureFunctions[zoom] = {
                      zoom: zoom,
                      type: parameters.type,
                      property: parameters.property,
                      default: parameters.default,
                      stops: []
                  };
                  zoomStops.push(zoom);
              }
              featureFunctions[zoom].stops.push([stop$1[0].value, stop$1[1]]);
          }
          var featureFunctionStops = [];
          for (var i$1 = 0, list$1 = zoomStops; i$1 < list$1.length; i$1 += 1) {
              var z = list$1[i$1];

            featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z], propertySpec)]);
          }
          var interpolationType = { name: 'linear' };
          return {
              kind: 'composite',
              interpolationType: interpolationType,
              interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
              zoomStops: featureFunctionStops.map(function (s) { return s[0]; }),
              evaluate: function evaluate(ref, properties) {
                  var zoom = ref.zoom;

                  return evaluateExponentialFunction({
                      stops: featureFunctionStops,
                      base: parameters.base
                  }, propertySpec, zoom).evaluate(zoom, properties);
              }
          };
      }
      else if (zoomDependent) {
          var interpolationType$1 = type === 'exponential' ?
              { name: 'exponential', base: parameters.base !== undefined ? parameters.base : 1 } : null;
          return {
              kind: 'camera',
              interpolationType: interpolationType$1,
              interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType$1),
              zoomStops: parameters.stops.map(function (s) { return s[0]; }),
              evaluate: function (ref) {
                var zoom = ref.zoom;

                return innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType);
          }
          };
      }
      else {
          return {
              kind: 'source',
              evaluate: function evaluate(_, feature) {
                  var value = feature && feature.properties ? feature.properties[parameters.property] : undefined;
                  if (value === undefined) {
                      return coalesce$1(parameters.default, propertySpec.default);
                  }
                  return innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType);
              }
          };
      }
  }
  function coalesce$1(a, b, c) {
      if (a !== undefined)
          { return a; }
      if (b !== undefined)
          { return b; }
      if (c !== undefined)
          { return c; }
  }
  function evaluateCategoricalFunction(parameters, propertySpec, input, hashedStops, keyType) {
      var evaluated = typeof input === keyType ? hashedStops[input] : undefined; // Enforce strict typing on input
      return coalesce$1(evaluated, parameters.default, propertySpec.default);
  }
  function evaluateIntervalFunction(parameters, propertySpec, input) {
      // Edge cases
      if (getType(input) !== 'number')
          { return coalesce$1(parameters.default, propertySpec.default); }
      var n = parameters.stops.length;
      if (n === 1)
          { return parameters.stops[0][1]; }
      if (input <= parameters.stops[0][0])
          { return parameters.stops[0][1]; }
      if (input >= parameters.stops[n - 1][0])
          { return parameters.stops[n - 1][1]; }
      var index = findStopLessThanOrEqualTo(parameters.stops.map(function (stop) { return stop[0]; }), input);
      return parameters.stops[index][1];
  }
  function evaluateExponentialFunction(parameters, propertySpec, input) {
      var base = parameters.base !== undefined ? parameters.base : 1;
      // Edge cases
      if (getType(input) !== 'number')
          { return coalesce$1(parameters.default, propertySpec.default); }
      var n = parameters.stops.length;
      if (n === 1)
          { return parameters.stops[0][1]; }
      if (input <= parameters.stops[0][0])
          { return parameters.stops[0][1]; }
      if (input >= parameters.stops[n - 1][0])
          { return parameters.stops[n - 1][1]; }
      var index = findStopLessThanOrEqualTo(parameters.stops.map(function (stop) { return stop[0]; }), input);
      var t = interpolationFactor(input, base, parameters.stops[index][0], parameters.stops[index + 1][0]);
      var outputLower = parameters.stops[index][1];
      var outputUpper = parameters.stops[index + 1][1];
      var interp = interpolateFactory[propertySpec.type] || identityFunction;
      if (typeof outputLower.evaluate === 'function') {
          return {
              evaluate: function evaluate() {
                  var args = [], len = arguments.length;
                  while ( len-- ) args[ len ] = arguments[ len ];

                  var evaluatedLower = outputLower.evaluate.apply(undefined, args);
                  var evaluatedUpper = outputUpper.evaluate.apply(undefined, args);
                  // Special case for fill-outline-color, which has no spec default.
                  if (evaluatedLower === undefined || evaluatedUpper === undefined) {
                      return undefined;
                  }
                  return interp(evaluatedLower, evaluatedUpper, t, parameters.colorSpace);
              }
          };
      }
      return interp(outputLower, outputUpper, t, parameters.colorSpace);
  }
  function evaluateIdentityFunction(parameters, propertySpec, input) {
      switch (propertySpec.type) {
          case 'color':
              input = Color.parse(input);
              break;
          case 'formatted':
              input = Formatted.fromString(input.toString());
              break;
          case 'resolvedImage':
              input = ResolvedImage.fromString(input.toString());
              break;
          case 'padding':
              input = Padding.parse(input);
              break;
          default:
              if (getType(input) !== propertySpec.type && (propertySpec.type !== 'enum' || !propertySpec.values[input])) {
                  input = undefined;
              }
      }
      return coalesce$1(input, parameters.default, propertySpec.default);
  }
  /**
   * Returns a ratio that can be used to interpolate between exponential function
   * stops.
   *
   * How it works:
   * Two consecutive stop values define a (scaled and shifted) exponential
   * function `f(x) = a * base^x + b`, where `base` is the user-specified base,
   * and `a` and `b` are constants affording sufficient degrees of freedom to fit
   * the function to the given stops.
   *
   * Here's a bit of algebra that lets us compute `f(x)` directly from the stop
   * values without explicitly solving for `a` and `b`:
   *
   * First stop value: `f(x0) = y0 = a * base^x0 + b`
   * Second stop value: `f(x1) = y1 = a * base^x1 + b`
   * => `y1 - y0 = a(base^x1 - base^x0)`
   * => `a = (y1 - y0)/(base^x1 - base^x0)`
   *
   * Desired value: `f(x) = y = a * base^x + b`
   * => `f(x) = y0 + a * (base^x - base^x0)`
   *
   * From the above, we can replace the `a` in `a * (base^x - base^x0)` and do a
   * little algebra:
   * ```
   * a * (base^x - base^x0) = (y1 - y0)/(base^x1 - base^x0) * (base^x - base^x0)
   *                     = (y1 - y0) * (base^x - base^x0) / (base^x1 - base^x0)
   * ```
   *
   * If we let `(base^x - base^x0) / (base^x1 base^x0)`, then we have
   * `f(x) = y0 + (y1 - y0) * ratio`.  In other words, `ratio` may be treated as
   * an interpolation factor between the two stops' output values.
   *
   * (Note: a slightly different form for `ratio`,
   * `(base^(x-x0) - 1) / (base^(x1-x0) - 1) `, is equivalent, but requires fewer
   * expensive `Math.pow()` operations.)
   *
   * @private
   */
  function interpolationFactor(input, base, lowerValue, upperValue) {
      var difference = upperValue - lowerValue;
      var progress = input - lowerValue;
      if (difference === 0) {
          return 0;
      }
      else if (base === 1) {
          return progress / difference;
      }
      else {
          return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
      }
  }

  var StyleExpression = function StyleExpression(expression, propertySpec) {
        this.expression = expression;
        this._warningHistory = {};
        this._evaluator = new EvaluationContext();
        this._defaultValue = propertySpec ? getDefaultValue(propertySpec) : null;
        this._enumValues = propertySpec && propertySpec.type === 'enum' ? propertySpec.values : null;
    };
    StyleExpression.prototype.evaluateWithoutErrorHandling = function evaluateWithoutErrorHandling (globals, feature, featureState, canonical, availableImages, formattedSection) {
        this._evaluator.globals = globals;
        this._evaluator.feature = feature;
        this._evaluator.featureState = featureState;
        this._evaluator.canonical = canonical;
        this._evaluator.availableImages = availableImages || null;
        this._evaluator.formattedSection = formattedSection;
        return this.expression.evaluate(this._evaluator);
    };
    StyleExpression.prototype.evaluate = function evaluate (globals, feature, featureState, canonical, availableImages, formattedSection) {
        this._evaluator.globals = globals;
        this._evaluator.feature = feature || null;
        this._evaluator.featureState = featureState || null;
        this._evaluator.canonical = canonical;
        this._evaluator.availableImages = availableImages || null;
        this._evaluator.formattedSection = formattedSection || null;
        try {
            var val = this.expression.evaluate(this._evaluator);
            if (val === null || val === undefined || (typeof val === 'number' && val !== val)) {
                return this._defaultValue;
            }
            if (this._enumValues && !(val in this._enumValues)) {
                throw new RuntimeError(("Expected value to be one of " + (Object.keys(this._enumValues).map(function (v) { return JSON.stringify(v); }).join(', ')) + ", but found " + (JSON.stringify(val)) + " instead."));
            }
            return val;
        }
        catch (e) {
            if (!this._warningHistory[e.message]) {
                this._warningHistory[e.message] = true;
                if (typeof console !== 'undefined') {
                    console.warn(e.message);
                }
            }
            return this._defaultValue;
        }
    };
  function isExpression(expression) {
      return Array.isArray(expression) && expression.length > 0 &&
          typeof expression[0] === 'string' && expression[0] in expressions$1;
  }
  /**
   * Parse and typecheck the given style spec JSON expression.  If
   * options.defaultValue is provided, then the resulting StyleExpression's
   * `evaluate()` method will handle errors by logging a warning (once per
   * message) and returning the default value.  Otherwise, it will throw
   * evaluation errors.
   *
   * @private
   */
  function createExpression(expression, propertySpec) {
      var parser = new ParsingContext(expressions$1, isExpressionConstant, [], propertySpec ? getExpectedType(propertySpec) : undefined);
      // For string-valued properties, coerce to string at the top level rather than asserting.
      var parsed = parser.parse(expression, undefined, undefined, undefined, propertySpec && propertySpec.type === 'string' ? { typeAnnotation: 'coerce' } : undefined);
      if (!parsed) {
          return error(parser.errors);
      }
      return success(new StyleExpression(parsed, propertySpec));
  }
  var ZoomConstantExpression = function ZoomConstantExpression(kind, expression) {
        this.kind = kind;
        this._styleExpression = expression;
        this.isStateDependent = kind !== 'constant' && !isStateConstant(expression.expression);
    };
    ZoomConstantExpression.prototype.evaluateWithoutErrorHandling = function evaluateWithoutErrorHandling (globals, feature, featureState, canonical, availableImages, formattedSection) {
        return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection);
    };
    ZoomConstantExpression.prototype.evaluate = function evaluate (globals, feature, featureState, canonical, availableImages, formattedSection) {
        return this._styleExpression.evaluate(globals, feature, featureState, canonical, availableImages, formattedSection);
    };
  var ZoomDependentExpression = function ZoomDependentExpression(kind, expression, zoomStops, interpolationType) {
        this.kind = kind;
        this.zoomStops = zoomStops;
        this._styleExpression = expression;
        this.isStateDependent = kind !== 'camera' && !isStateConstant(expression.expression);
        this.interpolationType = interpolationType;
    };
    ZoomDependentExpression.prototype.evaluateWithoutErrorHandling = function evaluateWithoutErrorHandling (globals, feature, featureState, canonical, availableImages, formattedSection) {
        return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection);
    };
    ZoomDependentExpression.prototype.evaluate = function evaluate (globals, feature, featureState, canonical, availableImages, formattedSection) {
        return this._styleExpression.evaluate(globals, feature, featureState, canonical, availableImages, formattedSection);
    };
    ZoomDependentExpression.prototype.interpolationFactor = function interpolationFactor (input, lower, upper) {
        if (this.interpolationType) {
            return Interpolate.interpolationFactor(this.interpolationType, input, lower, upper);
        }
        else {
            return 0;
        }
    };
  function isZoomExpression(expression) {
      return expression._styleExpression !== undefined;
  }
  function createPropertyExpression(expressionInput, propertySpec) {
      var expression = createExpression(expressionInput, propertySpec);
      if (expression.result === 'error') {
          return expression;
      }
      var parsed = expression.value.expression;
      var isFeatureConstantResult = isFeatureConstant(parsed);
      if (!isFeatureConstantResult && !supportsPropertyExpression(propertySpec)) {
          return error([new ExpressionParsingError('', 'data expressions not supported')]);
      }
      var isZoomConstant = isGlobalPropertyConstant(parsed, ['zoom']);
      if (!isZoomConstant && !supportsZoomExpression(propertySpec)) {
          return error([new ExpressionParsingError('', 'zoom expressions not supported')]);
      }
      var zoomCurve = findZoomCurve(parsed);
      if (!zoomCurve && !isZoomConstant) {
          return error([new ExpressionParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.')]);
      }
      else if (zoomCurve instanceof ExpressionParsingError) {
          return error([zoomCurve]);
      }
      else if (zoomCurve instanceof Interpolate && !supportsInterpolation(propertySpec)) {
          return error([new ExpressionParsingError('', '"interpolate" expressions cannot be used with this property')]);
      }
      if (!zoomCurve) {
          return success(isFeatureConstantResult ?
              new ZoomConstantExpression('constant', expression.value) :
              new ZoomConstantExpression('source', expression.value));
      }
      var interpolationType = zoomCurve instanceof Interpolate ? zoomCurve.interpolation : undefined;
      return success(isFeatureConstantResult ?
          new ZoomDependentExpression('camera', expression.value, zoomCurve.labels, interpolationType) :
          new ZoomDependentExpression('composite', expression.value, zoomCurve.labels, interpolationType));
  }
  // serialization wrapper for old-style stop functions normalized to the
  // expression interface
  var StylePropertyFunction = function StylePropertyFunction(parameters, specification) {
        this._parameters = parameters;
        this._specification = specification;
        extendBy(this, createFunction(this._parameters, this._specification));
    };
    StylePropertyFunction.deserialize = function deserialize (serialized) {
        return new StylePropertyFunction(serialized._parameters, serialized._specification);
    };
    StylePropertyFunction.serialize = function serialize (input) {
        return {
            _parameters: input._parameters,
            _specification: input._specification
        };
    };
  function normalizePropertyExpression(value, specification) {
      if (isFunction$1(value)) {
          return new StylePropertyFunction(value, specification);
      }
      else if (isExpression(value)) {
          var expression = createPropertyExpression(value, specification);
          if (expression.result === 'error') {
              // this should have been caught in validation
              throw new Error(expression.value.map(function (err) { return ((err.key) + ": " + (err.message)); }).join(', '));
          }
          return expression.value;
      }
      else {
          var constant = value;
          if (specification.type === 'color' && typeof value === 'string') {
              constant = Color.parse(value);
          }
          else if (specification.type === 'padding' && (typeof value === 'number' || Array.isArray(value))) {
              constant = Padding.parse(value);
          }
          else if (specification.type === 'variableAnchorOffsetCollection' && Array.isArray(value)) {
              constant = VariableAnchorOffsetCollection.parse(value);
          }
          else if (specification.type === 'projectionDefinition' && typeof value === 'string') {
              constant = ProjectionDefinition.parse(value);
          }
          return {
              kind: 'constant',
              evaluate: function () { return constant; }
          };
      }
  }
  // Zoom-dependent expressions may only use ["zoom"] as the input to a top-level "step" or "interpolate"
  // expression (collectively referred to as a "curve"). The curve may be wrapped in one or more "let" or
  // "coalesce" expressions.
  function findZoomCurve(expression) {
      var result = null;
      if (expression instanceof Let) {
          result = findZoomCurve(expression.result);
      }
      else if (expression instanceof Coalesce) {
          for (var i = 0, list = expression.args; i < list.length; i += 1) {
              var arg = list[i];

            result = findZoomCurve(arg);
              if (result) {
                  break;
              }
          }
      }
      else if ((expression instanceof Step || expression instanceof Interpolate) &&
          expression.input instanceof CompoundExpression &&
          expression.input.name === 'zoom') {
          result = expression;
      }
      if (result instanceof ExpressionParsingError) {
          return result;
      }
      expression.eachChild(function (child) {
          var childResult = findZoomCurve(child);
          if (childResult instanceof ExpressionParsingError) {
              result = childResult;
          }
          else if (!result && childResult) {
              result = new ExpressionParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.');
          }
          else if (result && childResult && result !== childResult) {
              result = new ExpressionParsingError('', 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.');
          }
      });
      return result;
  }
  function getExpectedType(spec) {
      var types = {
          color: ColorType,
          string: StringType,
          number: NumberType,
          enum: StringType,
          boolean: BooleanType,
          formatted: FormattedType,
          padding: PaddingType,
          projectionDefinition: ProjectionDefinitionType,
          resolvedImage: ResolvedImageType,
          variableAnchorOffsetCollection: VariableAnchorOffsetCollectionType
      };
      if (spec.type === 'array') {
          return array(types[spec.value] || ValueType, spec.length);
      }
      return types[spec.type];
  }
  function getDefaultValue(spec) {
      if (spec.type === 'color' && isFunction$1(spec.default)) {
          // Special case for heatmap-color: it uses the 'default:' to define a
          // default color ramp, but createExpression expects a simple value to fall
          // back to in case of runtime errors
          return new Color(0, 0, 0, 0);
      }
      else if (spec.type === 'color') {
          return Color.parse(spec.default) || null;
      }
      else if (spec.type === 'padding') {
          return Padding.parse(spec.default) || null;
      }
      else if (spec.type === 'variableAnchorOffsetCollection') {
          return VariableAnchorOffsetCollection.parse(spec.default) || null;
      }
      else if (spec.type === 'projectionDefinition') {
          return ProjectionDefinition.parse(spec.default) || null;
      }
      else if (spec.default === undefined) {
          return null;
      }
      else {
          return spec.default;
      }
  }

  function isExpressionFilter(filter) {
      if (filter === true || filter === false) {
          return true;
      }
      if (!Array.isArray(filter) || filter.length === 0) {
          return false;
      }
      switch (filter[0]) {
          case 'has':
              return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';
          case 'in':
              return filter.length >= 3 && (typeof filter[1] !== 'string' || Array.isArray(filter[2]));
          case '!in':
          case '!has':
          case 'none':
              return false;
          case '==':
          case '!=':
          case '>':
          case '>=':
          case '<':
          case '<=':
              return filter.length !== 3 || (Array.isArray(filter[1]) || Array.isArray(filter[2]));
          case 'any':
          case 'all':
              for (var i = 0, list = filter.slice(1); i < list.length; i += 1) {
                  var f = list[i];

        if (!isExpressionFilter(f) && typeof f !== 'boolean') {
                      return false;
                  }
              }
              return true;
          default:
              return true;
      }
  }
  var expression = {
      StyleExpression: StyleExpression,
      StylePropertyFunction: StylePropertyFunction,
      ZoomConstantExpression: ZoomConstantExpression,
      ZoomDependentExpression: ZoomDependentExpression,
      createExpression: createExpression,
      createPropertyExpression: createPropertyExpression,
      isExpression: isExpression,
      isExpressionFilter: isExpressionFilter,
      isZoomExpression: isZoomExpression,
      normalizePropertyExpression: normalizePropertyExpression,
  };

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
    var expr = expression.createPropertyExpression(value, spec);
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
      
      if (this.particleTrail > 0) {
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
      var fadeRate = 0.95 + (this.particleTrail * 0.04); // 0.95 to 0.99
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

  Object.defineProperty(exports, '__esModule', { value: true });

}));
