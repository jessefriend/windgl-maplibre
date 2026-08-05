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

  //#region src/reference/v8.json
  //#endregion
  //#region src/expression/parsing_error.ts
  var ExpressionParsingError = class extends Error {
  	constructor(key, message) {
  		super(message);
  		this.message = message;
  		this.key = key;
  	}
  };
  //#endregion
  //#region src/expression/scope.ts
  /**
  * Tracks `let` bindings during expression parsing.
  * @private
  */
  var Scope = class Scope {
  	constructor(parent, bindings = []) {
  		this.parent = parent;
  		this.bindings = {};
  		for (const [name, expression] of bindings) this.bindings[name] = expression;
  	}
  	concat(bindings) {
  		return new Scope(this, bindings);
  	}
  	get(name) {
  		if (this.bindings[name]) return this.bindings[name];
  		if (this.parent) return this.parent.get(name);
  		throw new Error(`${name} not found in scope.`);
  	}
  	has(name) {
  		if (this.bindings[name]) return true;
  		return this.parent ? this.parent.has(name) : false;
  	}
  };
  //#endregion
  //#region src/expression/types.ts
  const NullType = { kind: "null" };
  const NumberType = { kind: "number" };
  const StringType = { kind: "string" };
  const BooleanType = { kind: "boolean" };
  const ColorType = { kind: "color" };
  const ProjectionDefinitionType = { kind: "projectionDefinition" };
  const ObjectType = { kind: "object" };
  const ValueType = { kind: "value" };
  const ErrorType = { kind: "error" };
  const CollatorType = { kind: "collator" };
  const FormattedType = { kind: "formatted" };
  const PaddingType = { kind: "padding" };
  const ColorArrayType = { kind: "colorArray" };
  const NumberArrayType = { kind: "numberArray" };
  const ResolvedImageType = { kind: "resolvedImage" };
  const VariableAnchorOffsetCollectionType = { kind: "variableAnchorOffsetCollection" };
  function array(itemType, N) {
  	return {
  		kind: "array",
  		itemType,
  		N
  	};
  }
  function typeToString(type) {
  	if (type.kind === "array") {
  		const itemType = typeToString(type.itemType);
  		return typeof type.N === "number" ? `array<${itemType}, ${type.N}>` : type.itemType.kind === "value" ? "array" : `array<${itemType}>`;
  	} else return type.kind;
  }
  const valueMemberTypes = [
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
  	NumberArrayType,
  	ColorArrayType,
  	ResolvedImageType,
  	VariableAnchorOffsetCollectionType
  ];
  /**
  * Returns null if `t` is a subtype of `expected`; otherwise returns an
  * error message.
  * @private
  */
  function checkSubtype(expected, t) {
  	if (t.kind === "error") return null;
  	else if (expected.kind === "array") {
  		if (t.kind === "array" && (t.N === 0 && t.itemType.kind === "value" || !checkSubtype(expected.itemType, t.itemType)) && (typeof expected.N !== "number" || expected.N === t.N)) return null;
  	} else if (expected.kind === t.kind) return null;
  	else if (expected.kind === "value") {
  		for (const memberType of valueMemberTypes) if (!checkSubtype(memberType, t)) return null;
  	}
  	return `Expected ${typeToString(expected)} but found ${typeToString(t)} instead.`;
  }
  function isValidType(provided, allowedTypes) {
  	return allowedTypes.some((t) => t.kind === provided.kind);
  }
  function isValidNativeType(provided, allowedTypes) {
  	return allowedTypes.some((t) => {
  		if (t === "null") return provided === null;
  		else if (t === "array") return Array.isArray(provided);
  		else if (t === "object") return provided && !Array.isArray(provided) && typeof provided === "object";
  		else return t === typeof provided;
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
  	if (provided.kind === "array" && sample.kind === "array") return provided.itemType.kind === sample.itemType.kind && typeof provided.N === "number";
  	return provided.kind === sample.kind;
  }
  //#endregion
  //#region src/expression/types/color_spaces.ts
  const Xn = .96422;
  const Yn = 1;
  const Zn = .82521;
  const t0 = 4 / 29;
  const t1 = 6 / 29;
  const t2 = 3 * t1 * t1;
  const t3 = t1 * t1 * t1;
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  function constrainAngle(angle) {
  	angle = angle % 360;
  	if (angle < 0) angle += 360;
  	return angle;
  }
  function rgbToLab([r, g, b, alpha]) {
  	r = rgb2xyz(r);
  	g = rgb2xyz(g);
  	b = rgb2xyz(b);
  	let x, z;
  	const y = xyz2lab((.2225045 * r + .7168786 * g + .0606169 * b) / Yn);
  	if (r === g && g === b) x = z = y;
  	else {
  		x = xyz2lab((.4360747 * r + .3850649 * g + .1430804 * b) / Xn);
  		z = xyz2lab((.0139322 * r + .0971045 * g + .7141733 * b) / Zn);
  	}
  	const l = 116 * y - 16;
  	return [
  		l < 0 ? 0 : l,
  		500 * (x - y),
  		200 * (y - z),
  		alpha
  	];
  }
  function rgb2xyz(x) {
  	return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
  }
  function xyz2lab(t) {
  	return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }
  function labToRgb([l, a, b, alpha]) {
  	let y = (l + 16) / 116, x = isNaN(a) ? y : y + a / 500, z = isNaN(b) ? y : y - b / 200;
  	y = Yn * lab2xyz(y);
  	x = Xn * lab2xyz(x);
  	z = Zn * lab2xyz(z);
  	return [
  		xyz2rgb(3.1338561 * x - 1.6168667 * y - .4906146 * z),
  		xyz2rgb(-.9787684 * x + 1.9161415 * y + .033454 * z),
  		xyz2rgb(.0719453 * x - .2289914 * y + 1.4052427 * z),
  		alpha
  	];
  }
  function xyz2rgb(x) {
  	x = x <= .00304 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055;
  	return x < 0 ? 0 : x > 1 ? 1 : x;
  }
  function lab2xyz(t) {
  	return t > t1 ? t * t * t : t2 * (t - t0);
  }
  function rgbToHcl(rgbColor) {
  	const [l, a, b, alpha] = rgbToLab(rgbColor);
  	const c = Math.sqrt(a * a + b * b);
  	return [
  		Math.round(c * 1e4) ? constrainAngle(Math.atan2(b, a) * rad2deg) : NaN,
  		c,
  		l,
  		alpha
  	];
  }
  function hclToRgb([h, c, l, alpha]) {
  	h = isNaN(h) ? 0 : h * deg2rad;
  	return labToRgb([
  		l,
  		Math.cos(h) * c,
  		Math.sin(h) * c,
  		alpha
  	]);
  }
  function hslToRgb([h, s, l, alpha]) {
  	h = constrainAngle(h);
  	s /= 100;
  	l /= 100;
  	function f(n) {
  		const k = (n + h / 30) % 12;
  		const a = s * Math.min(l, 1 - l);
  		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  	}
  	return [
  		f(0),
  		f(8),
  		f(4),
  		alpha
  	];
  }
  //#endregion
  //#region src/util/get_own.ts
  const hasOwnProperty = Object.hasOwn || function hasOwnProperty(object, key) {
  	return Object.prototype.hasOwnProperty.call(object, key);
  };
  function getOwn(object, key) {
  	return hasOwnProperty(object, key) ? object[key] : void 0;
  }
  //#endregion
  //#region src/expression/types/parse_css_color.ts
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
  	if (input === "transparent") return [
  		0,
  		0,
  		0,
  		0
  	];
  	const namedColorsMatch = getOwn(namedColors, input);
  	if (namedColorsMatch) {
  		const [r, g, b] = namedColorsMatch;
  		return [
  			r / 255,
  			g / 255,
  			b / 255,
  			1
  		];
  	}
  	if (input.startsWith("#")) {
  		if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(input)) {
  			const step = input.length < 6 ? 1 : 2;
  			let i = 1;
  			return [
  				parseHex(input.slice(i, i += step)),
  				parseHex(input.slice(i, i += step)),
  				parseHex(input.slice(i, i += step)),
  				parseHex(input.slice(i, i + step) || "ff")
  			];
  		}
  	}
  	if (input.startsWith("rgb")) {
  		const rgbMatch = input.match(/^rgba?\(\s*([\de.+-]+)(%)?(?:\s+|\s*(,)\s*)([\de.+-]+)(%)?(?:\s+|\s*(,)\s*)([\de.+-]+)(%)?(?:\s*([,\/])\s*([\de.+-]+)(%)?)?\s*\)$/);
  		if (rgbMatch) {
  			const [_, r, rp, f1, g, gp, f2, b, bp, f3, a, ap] = rgbMatch;
  			const argFormat = [
  				f1 || " ",
  				f2 || " ",
  				f3
  			].join("");
  			if (argFormat === "  " || argFormat === "  /" || argFormat === ",," || argFormat === ",,,") {
  				const valFormat = [
  					rp,
  					gp,
  					bp
  				].join("");
  				const maxValue = valFormat === "%%%" ? 100 : valFormat === "" ? 255 : 0;
  				if (maxValue) {
  					const rgba = [
  						clamp(+r / maxValue, 0, 1),
  						clamp(+g / maxValue, 0, 1),
  						clamp(+b / maxValue, 0, 1),
  						a ? parseAlpha(+a, ap) : 1
  					];
  					if (validateNumbers(rgba)) return rgba;
  				}
  			}
  			return;
  		}
  	}
  	const hslMatch = input.match(/^hsla?\(\s*([\de.+-]+)(?:deg)?(?:\s+|\s*(,)\s*)([\de.+-]+)%(?:\s+|\s*(,)\s*)([\de.+-]+)%(?:\s*([,\/])\s*([\de.+-]+)(%)?)?\s*\)$/);
  	if (hslMatch) {
  		const [_, h, f1, s, f2, l, f3, a, ap] = hslMatch;
  		const argFormat = [
  			f1 || " ",
  			f2 || " ",
  			f3
  		].join("");
  		if (argFormat === "  " || argFormat === "  /" || argFormat === ",," || argFormat === ",,,") {
  			const hsla = [
  				+h,
  				clamp(+s, 0, 100),
  				clamp(+l, 0, 100),
  				a ? parseAlpha(+a, ap) : 1
  			];
  			if (validateNumbers(hsla)) return hslToRgb(hsla);
  		}
  	}
  }
  function parseHex(hex) {
  	return parseInt(hex.padEnd(2, hex), 16) / 255;
  }
  function parseAlpha(a, asPercentage) {
  	return clamp(asPercentage ? a / 100 : a, 0, 1);
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
  const namedColors = {
  	aliceblue: [
  		240,
  		248,
  		255
  	],
  	antiquewhite: [
  		250,
  		235,
  		215
  	],
  	aqua: [
  		0,
  		255,
  		255
  	],
  	aquamarine: [
  		127,
  		255,
  		212
  	],
  	azure: [
  		240,
  		255,
  		255
  	],
  	beige: [
  		245,
  		245,
  		220
  	],
  	bisque: [
  		255,
  		228,
  		196
  	],
  	black: [
  		0,
  		0,
  		0
  	],
  	blanchedalmond: [
  		255,
  		235,
  		205
  	],
  	blue: [
  		0,
  		0,
  		255
  	],
  	blueviolet: [
  		138,
  		43,
  		226
  	],
  	brown: [
  		165,
  		42,
  		42
  	],
  	burlywood: [
  		222,
  		184,
  		135
  	],
  	cadetblue: [
  		95,
  		158,
  		160
  	],
  	chartreuse: [
  		127,
  		255,
  		0
  	],
  	chocolate: [
  		210,
  		105,
  		30
  	],
  	coral: [
  		255,
  		127,
  		80
  	],
  	cornflowerblue: [
  		100,
  		149,
  		237
  	],
  	cornsilk: [
  		255,
  		248,
  		220
  	],
  	crimson: [
  		220,
  		20,
  		60
  	],
  	cyan: [
  		0,
  		255,
  		255
  	],
  	darkblue: [
  		0,
  		0,
  		139
  	],
  	darkcyan: [
  		0,
  		139,
  		139
  	],
  	darkgoldenrod: [
  		184,
  		134,
  		11
  	],
  	darkgray: [
  		169,
  		169,
  		169
  	],
  	darkgreen: [
  		0,
  		100,
  		0
  	],
  	darkgrey: [
  		169,
  		169,
  		169
  	],
  	darkkhaki: [
  		189,
  		183,
  		107
  	],
  	darkmagenta: [
  		139,
  		0,
  		139
  	],
  	darkolivegreen: [
  		85,
  		107,
  		47
  	],
  	darkorange: [
  		255,
  		140,
  		0
  	],
  	darkorchid: [
  		153,
  		50,
  		204
  	],
  	darkred: [
  		139,
  		0,
  		0
  	],
  	darksalmon: [
  		233,
  		150,
  		122
  	],
  	darkseagreen: [
  		143,
  		188,
  		143
  	],
  	darkslateblue: [
  		72,
  		61,
  		139
  	],
  	darkslategray: [
  		47,
  		79,
  		79
  	],
  	darkslategrey: [
  		47,
  		79,
  		79
  	],
  	darkturquoise: [
  		0,
  		206,
  		209
  	],
  	darkviolet: [
  		148,
  		0,
  		211
  	],
  	deeppink: [
  		255,
  		20,
  		147
  	],
  	deepskyblue: [
  		0,
  		191,
  		255
  	],
  	dimgray: [
  		105,
  		105,
  		105
  	],
  	dimgrey: [
  		105,
  		105,
  		105
  	],
  	dodgerblue: [
  		30,
  		144,
  		255
  	],
  	firebrick: [
  		178,
  		34,
  		34
  	],
  	floralwhite: [
  		255,
  		250,
  		240
  	],
  	forestgreen: [
  		34,
  		139,
  		34
  	],
  	fuchsia: [
  		255,
  		0,
  		255
  	],
  	gainsboro: [
  		220,
  		220,
  		220
  	],
  	ghostwhite: [
  		248,
  		248,
  		255
  	],
  	gold: [
  		255,
  		215,
  		0
  	],
  	goldenrod: [
  		218,
  		165,
  		32
  	],
  	gray: [
  		128,
  		128,
  		128
  	],
  	green: [
  		0,
  		128,
  		0
  	],
  	greenyellow: [
  		173,
  		255,
  		47
  	],
  	grey: [
  		128,
  		128,
  		128
  	],
  	honeydew: [
  		240,
  		255,
  		240
  	],
  	hotpink: [
  		255,
  		105,
  		180
  	],
  	indianred: [
  		205,
  		92,
  		92
  	],
  	indigo: [
  		75,
  		0,
  		130
  	],
  	ivory: [
  		255,
  		255,
  		240
  	],
  	khaki: [
  		240,
  		230,
  		140
  	],
  	lavender: [
  		230,
  		230,
  		250
  	],
  	lavenderblush: [
  		255,
  		240,
  		245
  	],
  	lawngreen: [
  		124,
  		252,
  		0
  	],
  	lemonchiffon: [
  		255,
  		250,
  		205
  	],
  	lightblue: [
  		173,
  		216,
  		230
  	],
  	lightcoral: [
  		240,
  		128,
  		128
  	],
  	lightcyan: [
  		224,
  		255,
  		255
  	],
  	lightgoldenrodyellow: [
  		250,
  		250,
  		210
  	],
  	lightgray: [
  		211,
  		211,
  		211
  	],
  	lightgreen: [
  		144,
  		238,
  		144
  	],
  	lightgrey: [
  		211,
  		211,
  		211
  	],
  	lightpink: [
  		255,
  		182,
  		193
  	],
  	lightsalmon: [
  		255,
  		160,
  		122
  	],
  	lightseagreen: [
  		32,
  		178,
  		170
  	],
  	lightskyblue: [
  		135,
  		206,
  		250
  	],
  	lightslategray: [
  		119,
  		136,
  		153
  	],
  	lightslategrey: [
  		119,
  		136,
  		153
  	],
  	lightsteelblue: [
  		176,
  		196,
  		222
  	],
  	lightyellow: [
  		255,
  		255,
  		224
  	],
  	lime: [
  		0,
  		255,
  		0
  	],
  	limegreen: [
  		50,
  		205,
  		50
  	],
  	linen: [
  		250,
  		240,
  		230
  	],
  	magenta: [
  		255,
  		0,
  		255
  	],
  	maroon: [
  		128,
  		0,
  		0
  	],
  	mediumaquamarine: [
  		102,
  		205,
  		170
  	],
  	mediumblue: [
  		0,
  		0,
  		205
  	],
  	mediumorchid: [
  		186,
  		85,
  		211
  	],
  	mediumpurple: [
  		147,
  		112,
  		219
  	],
  	mediumseagreen: [
  		60,
  		179,
  		113
  	],
  	mediumslateblue: [
  		123,
  		104,
  		238
  	],
  	mediumspringgreen: [
  		0,
  		250,
  		154
  	],
  	mediumturquoise: [
  		72,
  		209,
  		204
  	],
  	mediumvioletred: [
  		199,
  		21,
  		133
  	],
  	midnightblue: [
  		25,
  		25,
  		112
  	],
  	mintcream: [
  		245,
  		255,
  		250
  	],
  	mistyrose: [
  		255,
  		228,
  		225
  	],
  	moccasin: [
  		255,
  		228,
  		181
  	],
  	navajowhite: [
  		255,
  		222,
  		173
  	],
  	navy: [
  		0,
  		0,
  		128
  	],
  	oldlace: [
  		253,
  		245,
  		230
  	],
  	olive: [
  		128,
  		128,
  		0
  	],
  	olivedrab: [
  		107,
  		142,
  		35
  	],
  	orange: [
  		255,
  		165,
  		0
  	],
  	orangered: [
  		255,
  		69,
  		0
  	],
  	orchid: [
  		218,
  		112,
  		214
  	],
  	palegoldenrod: [
  		238,
  		232,
  		170
  	],
  	palegreen: [
  		152,
  		251,
  		152
  	],
  	paleturquoise: [
  		175,
  		238,
  		238
  	],
  	palevioletred: [
  		219,
  		112,
  		147
  	],
  	papayawhip: [
  		255,
  		239,
  		213
  	],
  	peachpuff: [
  		255,
  		218,
  		185
  	],
  	peru: [
  		205,
  		133,
  		63
  	],
  	pink: [
  		255,
  		192,
  		203
  	],
  	plum: [
  		221,
  		160,
  		221
  	],
  	powderblue: [
  		176,
  		224,
  		230
  	],
  	purple: [
  		128,
  		0,
  		128
  	],
  	rebeccapurple: [
  		102,
  		51,
  		153
  	],
  	red: [
  		255,
  		0,
  		0
  	],
  	rosybrown: [
  		188,
  		143,
  		143
  	],
  	royalblue: [
  		65,
  		105,
  		225
  	],
  	saddlebrown: [
  		139,
  		69,
  		19
  	],
  	salmon: [
  		250,
  		128,
  		114
  	],
  	sandybrown: [
  		244,
  		164,
  		96
  	],
  	seagreen: [
  		46,
  		139,
  		87
  	],
  	seashell: [
  		255,
  		245,
  		238
  	],
  	sienna: [
  		160,
  		82,
  		45
  	],
  	silver: [
  		192,
  		192,
  		192
  	],
  	skyblue: [
  		135,
  		206,
  		235
  	],
  	slateblue: [
  		106,
  		90,
  		205
  	],
  	slategray: [
  		112,
  		128,
  		144
  	],
  	slategrey: [
  		112,
  		128,
  		144
  	],
  	snow: [
  		255,
  		250,
  		250
  	],
  	springgreen: [
  		0,
  		255,
  		127
  	],
  	steelblue: [
  		70,
  		130,
  		180
  	],
  	tan: [
  		210,
  		180,
  		140
  	],
  	teal: [
  		0,
  		128,
  		128
  	],
  	thistle: [
  		216,
  		191,
  		216
  	],
  	tomato: [
  		255,
  		99,
  		71
  	],
  	turquoise: [
  		64,
  		224,
  		208
  	],
  	violet: [
  		238,
  		130,
  		238
  	],
  	wheat: [
  		245,
  		222,
  		179
  	],
  	white: [
  		255,
  		255,
  		255
  	],
  	whitesmoke: [
  		245,
  		245,
  		245
  	],
  	yellow: [
  		255,
  		255,
  		0
  	],
  	yellowgreen: [
  		154,
  		205,
  		50
  	]
  };
  //#endregion
  //#region src/util/interpolate-primitives.ts
  function interpolateNumber(from, to, t) {
  	return from + t * (to - from);
  }
  function interpolateArray(from, to, t) {
  	return from.map((d, i) => {
  		return interpolateNumber(d, to[i], t);
  	});
  }
  //#endregion
  //#region src/expression/types/color.ts
  /**
  * Checks whether the specified color space is one of the supported interpolation color spaces.
  *
  * @param colorSpace Color space key to verify.
  * @returns `true` if the specified color space is one of the supported
  * interpolation color spaces, `false` otherwise
  */
  function isSupportedInterpolationColorSpace(colorSpace) {
  	return colorSpace === "rgb" || colorSpace === "hcl" || colorSpace === "lab";
  }
  /**
  * Color representation used by WebGL.
  * Defined in sRGB color space and pre-blended with alpha.
  * @private
  */
  var Color = class Color {
  	/**
  	* @param r Red component premultiplied by `alpha` 0..1
  	* @param g Green component premultiplied by `alpha` 0..1
  	* @param b Blue component premultiplied by `alpha` 0..1
  	* @param [alpha=1] Alpha component 0..1
  	* @param [premultiplied=true] Whether the `r`, `g` and `b` values have already
  	* been multiplied by alpha. If `true` nothing happens if `false` then they will
  	* be multiplied automatically.
  	*/
  	constructor(r, g, b, alpha = 1, premultiplied = true) {
  		this.r = r;
  		this.g = g;
  		this.b = b;
  		this.a = alpha;
  		if (!premultiplied) {
  			this.r *= alpha;
  			this.g *= alpha;
  			this.b *= alpha;
  			if (!alpha) this.overwriteGetter("rgb", [
  				r,
  				g,
  				b,
  				alpha
  			]);
  		}
  	}
  	static {
  		this.black = new Color(0, 0, 0, 1);
  	}
  	static {
  		this.white = new Color(1, 1, 1, 1);
  	}
  	static {
  		this.transparent = new Color(0, 0, 0, 0);
  	}
  	static {
  		this.red = new Color(1, 0, 0, 1);
  	}
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
  	static parse(input) {
  		if (input instanceof Color) return input;
  		if (typeof input !== "string") return;
  		const rgba = parseCssColor(input);
  		if (rgba) return new Color(...rgba, false);
  	}
  	/**
  	* Used in color interpolation and by 'to-rgba' expression.
  	*
  	* @returns Gien color, with reversed alpha blending, in sRGB color space.
  	*/
  	get rgb() {
  		const { r, g, b, a } = this;
  		const f = a || Infinity;
  		return this.overwriteGetter("rgb", [
  			r / f,
  			g / f,
  			b / f,
  			a
  		]);
  	}
  	/**
  	* Used in color interpolation.
  	*
  	* @returns Gien color, with reversed alpha blending, in HCL color space.
  	*/
  	get hcl() {
  		return this.overwriteGetter("hcl", rgbToHcl(this.rgb));
  	}
  	/**
  	* Used in color interpolation.
  	*
  	* @returns Gien color, with reversed alpha blending, in LAB color space.
  	*/
  	get lab() {
  		return this.overwriteGetter("lab", rgbToLab(this.rgb));
  	}
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
  	overwriteGetter(getterKey, lazyValue) {
  		Object.defineProperty(this, getterKey, { value: lazyValue });
  		return lazyValue;
  	}
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
  	toString() {
  		const [r, g, b, a] = this.rgb;
  		return `rgba(${[
			r,
			g,
			b
		].map((n) => Math.round(n * 255)).join(",")},${a})`;
  	}
  	static interpolate(from, to, t, spaceKey = "rgb") {
  		switch (spaceKey) {
  			case "rgb": {
  				const [r, g, b, alpha] = interpolateArray(from.rgb, to.rgb, t);
  				return new Color(r, g, b, alpha, false);
  			}
  			case "hcl": {
  				const [hue0, chroma0, light0, alphaF] = from.hcl;
  				const [hue1, chroma1, light1, alphaT] = to.hcl;
  				let hue, chroma;
  				if (!isNaN(hue0) && !isNaN(hue1)) {
  					let dh = hue1 - hue0;
  					if (hue1 > hue0 && dh > 180) dh -= 360;
  					else if (hue1 < hue0 && hue0 - hue1 > 180) dh += 360;
  					hue = hue0 + t * dh;
  				} else if (!isNaN(hue0)) {
  					hue = hue0;
  					if (light1 === 1 || light1 === 0) chroma = chroma0;
  				} else if (!isNaN(hue1)) {
  					hue = hue1;
  					if (light0 === 1 || light0 === 0) chroma = chroma1;
  				} else hue = NaN;
  				const [r, g, b, alpha] = hclToRgb([
  					hue,
  					chroma ?? interpolateNumber(chroma0, chroma1, t),
  					interpolateNumber(light0, light1, t),
  					interpolateNumber(alphaF, alphaT, t)
  				]);
  				return new Color(r, g, b, alpha, false);
  			}
  			case "lab": {
  				const [r, g, b, alpha] = labToRgb(interpolateArray(from.lab, to.lab, t));
  				return new Color(r, g, b, alpha, false);
  			}
  		}
  	}
  };
  //#endregion
  //#region src/expression/types/collator.ts
  var Collator = class {
  	constructor(caseSensitive, diacriticSensitive, locale) {
  		if (caseSensitive) this.sensitivity = diacriticSensitive ? "variant" : "case";
  		else this.sensitivity = diacriticSensitive ? "accent" : "base";
  		this.locale = locale;
  		this.collator = new Intl.Collator(this.locale ? this.locale : [], {
  			sensitivity: this.sensitivity,
  			usage: "search"
  		});
  	}
  	compare(lhs, rhs) {
  		return this.collator.compare(lhs, rhs);
  	}
  	resolvedLocale() {
  		return new Intl.Collator(this.locale ? this.locale : []).resolvedOptions().locale;
  	}
  };
  //#endregion
  //#region src/expression/types/formatted.ts
  const VERTICAL_ALIGN_OPTIONS = [
  	"bottom",
  	"center",
  	"top"
  ];
  var FormattedSection = class {
  	constructor(text, image, scale, fontStack, textColor, verticalAlign) {
  		this.text = text;
  		this.image = image;
  		this.scale = scale;
  		this.fontStack = fontStack;
  		this.textColor = textColor;
  		this.verticalAlign = verticalAlign;
  	}
  };
  var Formatted = class Formatted {
  	constructor(sections) {
  		this.sections = sections;
  	}
  	static fromString(unformatted) {
  		return new Formatted([new FormattedSection(unformatted, null, null, null, null, null)]);
  	}
  	isEmpty() {
  		if (this.sections.length === 0) return true;
  		return !this.sections.some((section) => section.text.length !== 0 || section.image && section.image.name.length !== 0);
  	}
  	static factory(text) {
  		if (text instanceof Formatted) return text;
  		else return Formatted.fromString(text);
  	}
  	toString() {
  		if (this.sections.length === 0) return "";
  		return this.sections.map((section) => section.text).join("");
  	}
  };
  //#endregion
  //#region src/expression/types/padding.ts
  /**
  * A set of four numbers representing padding around a box. Create instances from
  * bare arrays or numeric values using the static method `Padding.parse`.
  * @private
  */
  var Padding = class Padding {
  	constructor(values) {
  		this.values = values.slice();
  	}
  	/**
  	* Numeric padding values
  	* @param input A padding value
  	* @returns A `Padding` instance, or `undefined` if the input is not a valid padding value.
  	*/
  	static parse(input) {
  		if (input instanceof Padding) return input;
  		if (typeof input === "number") return new Padding([
  			input,
  			input,
  			input,
  			input
  		]);
  		if (!Array.isArray(input)) return;
  		if (input.length < 1 || input.length > 4) return;
  		for (const val of input) if (typeof val !== "number") return;
  		switch (input.length) {
  			case 1:
  				input = [
  					input[0],
  					input[0],
  					input[0],
  					input[0]
  				];
  				break;
  			case 2:
  				input = [
  					input[0],
  					input[1],
  					input[0],
  					input[1]
  				];
  				break;
  			case 3:
  				input = [
  					input[0],
  					input[1],
  					input[2],
  					input[1]
  				];
  				break;
  		}
  		return new Padding(input);
  	}
  	toString() {
  		return JSON.stringify(this.values);
  	}
  	static interpolate(from, to, t) {
  		return new Padding(interpolateArray(from.values, to.values, t));
  	}
  };
  //#endregion
  //#region src/expression/types/number_array.ts
  /**
  * An array of numbers. Create instances from
  * bare arrays or numeric values using the static method `NumberArray.parse`.
  * @private
  */
  var NumberArray = class NumberArray {
  	constructor(values) {
  		this.values = values.slice();
  	}
  	/**
  	* Numeric NumberArray values
  	* @param input A NumberArray value
  	* @returns A `NumberArray` instance, or `undefined` if the input is not a valid NumberArray value.
  	*/
  	static parse(input) {
  		if (input instanceof NumberArray) return input;
  		if (typeof input === "number") return new NumberArray([input]);
  		if (!Array.isArray(input)) return;
  		for (const val of input) if (typeof val !== "number") return;
  		return new NumberArray(input);
  	}
  	toString() {
  		return JSON.stringify(this.values);
  	}
  	static interpolate(from, to, t) {
  		return new NumberArray(interpolateArray(from.values, to.values, t));
  	}
  };
  //#endregion
  //#region src/expression/types/color_array.ts
  /**
  * An array of colors. Create instances from
  * bare arrays or strings using the static method `ColorArray.parse`.
  * @private
  */
  var ColorArray = class ColorArray {
  	constructor(values) {
  		this.values = values.slice();
  	}
  	/**
  	* ColorArray values
  	* @param input A ColorArray value
  	* @returns A `ColorArray` instance, or `undefined` if the input is not a valid ColorArray value.
  	*/
  	static parse(input) {
  		if (input instanceof ColorArray) return input;
  		if (typeof input === "string") {
  			const parsed_val = Color.parse(input);
  			if (!parsed_val) return;
  			return new ColorArray([parsed_val]);
  		}
  		if (!Array.isArray(input)) return;
  		const colors = [];
  		for (const val of input) {
  			if (typeof val !== "string") return;
  			const parsed_val = Color.parse(val);
  			if (!parsed_val) return;
  			colors.push(parsed_val);
  		}
  		return new ColorArray(colors);
  	}
  	toString() {
  		return JSON.stringify(this.values);
  	}
  	static interpolate(from, to, t, spaceKey = "rgb") {
  		const colors = [];
  		if (from.values.length != to.values.length) throw new Error(`colorArray: Arrays have mismatched length (${from.values.length} vs. ${to.values.length}), cannot interpolate.`);
  		for (let i = 0; i < from.values.length; i++) colors.push(Color.interpolate(from.values[i], to.values[i], t, spaceKey));
  		return new ColorArray(colors);
  	}
  };
  //#endregion
  //#region src/expression/runtime_error.ts
  var RuntimeError = class extends Error {
  	constructor(message, path) {
  		super(message);
  		this.name = "RuntimeError";
  		this.path = path;
  	}
  	toJSON() {
  		return this.message;
  	}
  };
  //#endregion
  //#region src/expression/types/variable_anchor_offset_collection.ts
  /** Set of valid anchor positions, as a set for validation */
  const anchors = /* @__PURE__ */ new Set([
  	"center",
  	"left",
  	"right",
  	"top",
  	"bottom",
  	"top-left",
  	"top-right",
  	"bottom-left",
  	"bottom-right"
  ]);
  /**
  * Utility class to assist managing values for text-variable-anchor-offset property. Create instances from
  * bare arrays using the static method `VariableAnchorOffsetCollection.parse`.
  * @private
  */
  var VariableAnchorOffsetCollection = class VariableAnchorOffsetCollection {
  	constructor(values) {
  		this.values = values.slice();
  	}
  	static parse(input) {
  		if (input instanceof VariableAnchorOffsetCollection) return input;
  		if (!Array.isArray(input) || input.length < 1 || input.length % 2 !== 0) return;
  		for (let i = 0; i < input.length; i += 2) {
  			const anchorValue = input[i];
  			const offsetValue = input[i + 1];
  			if (typeof anchorValue !== "string" || !anchors.has(anchorValue)) return;
  			if (!Array.isArray(offsetValue) || offsetValue.length !== 2 || typeof offsetValue[0] !== "number" || typeof offsetValue[1] !== "number") return;
  		}
  		return new VariableAnchorOffsetCollection(input);
  	}
  	toString() {
  		return JSON.stringify(this.values);
  	}
  	static interpolate(from, to, t, key) {
  		const fromValues = from.values;
  		const toValues = to.values;
  		if (fromValues.length !== toValues.length) throw new RuntimeError(`Cannot interpolate values of different length. from: ${from.toString()}, to: ${to.toString()}`, key);
  		const output = [];
  		for (let i = 0; i < fromValues.length; i += 2) {
  			if (fromValues[i] !== toValues[i]) throw new RuntimeError(`Cannot interpolate values containing mismatched anchors. from[${i}]: ${fromValues[i]}, to[${i}]: ${toValues[i]}`, key);
  			output.push(fromValues[i]);
  			const [fx, fy] = fromValues[i + 1];
  			const [tx, ty] = toValues[i + 1];
  			output.push([interpolateNumber(fx, tx, t), interpolateNumber(fy, ty, t)]);
  		}
  		return new VariableAnchorOffsetCollection(output);
  	}
  };
  //#endregion
  //#region src/expression/types/resolved_image.ts
  var ResolvedImage = class ResolvedImage {
  	constructor(options) {
  		this.name = options.name;
  		this.available = options.available;
  	}
  	toString() {
  		return this.name;
  	}
  	static fromString(name) {
  		if (!name) return null;
  		return new ResolvedImage({
  			name,
  			available: false
  		});
  	}
  };
  //#endregion
  //#region src/expression/types/projection_definition.ts
  var ProjectionDefinition = class ProjectionDefinition {
  	constructor(from, to, transition) {
  		this.from = from;
  		this.to = to;
  		this.transition = transition;
  	}
  	toString() {
  		if (this.from === this.to && this.transition === 1) return this.from;
  		return JSON.stringify([
  			this.from,
  			this.to,
  			this.transition
  		]);
  	}
  	static interpolate(from, to, t) {
  		return new ProjectionDefinition(from, to, t);
  	}
  	static parse(input) {
  		if (input instanceof ProjectionDefinition) return input;
  		if (Array.isArray(input) && input.length === 3 && typeof input[0] === "string" && typeof input[1] === "string" && typeof input[2] === "number") return new ProjectionDefinition(input[0], input[1], input[2]);
  		if (typeof input === "object" && typeof input.from === "string" && typeof input.to === "string" && typeof input.transition === "number") return new ProjectionDefinition(input.from, input.to, input.transition);
  		if (typeof input === "string") return new ProjectionDefinition(input, input, 1);
  	}
  };
  //#endregion
  //#region src/expression/values.ts
  function validateRGBA(r, g, b, a) {
  	if (!(typeof r === "number" && r >= 0 && r <= 255 && typeof g === "number" && g >= 0 && g <= 255 && typeof b === "number" && b >= 0 && b <= 255)) return `Invalid rgba value [${(typeof a === "number" ? [
		r,
		g,
		b,
		a
	] : [
		r,
		g,
		b
	]).join(", ")}]: 'r', 'g', and 'b' must be between 0 and 255.`;
  	if (!(typeof a === "undefined" || typeof a === "number" && a >= 0 && a <= 1)) return `Invalid rgba value [${[
		r,
		g,
		b,
		a
	].join(", ")}]: 'a' must be between 0 and 1.`;
  	return null;
  }
  function isValue(mixed) {
  	if (mixed === null || typeof mixed === "string" || typeof mixed === "boolean" || typeof mixed === "number" || mixed instanceof ProjectionDefinition || mixed instanceof Color || mixed instanceof Collator || mixed instanceof Formatted || mixed instanceof Padding || mixed instanceof NumberArray || mixed instanceof ColorArray || mixed instanceof VariableAnchorOffsetCollection || mixed instanceof ResolvedImage) return true;
  	else if (Array.isArray(mixed)) {
  		for (const item of mixed) if (!isValue(item)) return false;
  		return true;
  	} else if (typeof mixed === "object") {
  		for (const key in mixed) if (!isValue(mixed[key])) return false;
  		return true;
  	} else return false;
  }
  function typeOf(value) {
  	if (value === null) return NullType;
  	else if (typeof value === "string") return StringType;
  	else if (typeof value === "boolean") return BooleanType;
  	else if (typeof value === "number") return NumberType;
  	else if (value instanceof Color) return ColorType;
  	else if (value instanceof ProjectionDefinition) return ProjectionDefinitionType;
  	else if (value instanceof Collator) return CollatorType;
  	else if (value instanceof Formatted) return FormattedType;
  	else if (value instanceof Padding) return PaddingType;
  	else if (value instanceof NumberArray) return NumberArrayType;
  	else if (value instanceof ColorArray) return ColorArrayType;
  	else if (value instanceof VariableAnchorOffsetCollection) return VariableAnchorOffsetCollectionType;
  	else if (value instanceof ResolvedImage) return ResolvedImageType;
  	else if (Array.isArray(value)) {
  		const length = value.length;
  		let itemType;
  		for (const item of value) {
  			const t = typeOf(item);
  			if (!itemType) itemType = t;
  			else if (itemType === t) continue;
  			else {
  				itemType = ValueType;
  				break;
  			}
  		}
  		return array(itemType || ValueType, length);
  	} else return ObjectType;
  }
  function valueToString(value) {
  	const type = typeof value;
  	if (value === null) return "";
  	else if (type === "string" || type === "number" || type === "boolean") return String(value);
  	else if (value instanceof Color || value instanceof ProjectionDefinition || value instanceof Formatted || value instanceof Padding || value instanceof NumberArray || value instanceof ColorArray || value instanceof VariableAnchorOffsetCollection || value instanceof ResolvedImage) return value.toString();
  	else return JSON.stringify(value);
  }
  //#endregion
  //#region src/expression/definitions/literal.ts
  var Literal = class Literal {
  	constructor(type, value) {
  		this.type = type;
  		this.value = value;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error(`'literal' expression requires exactly one argument, but found ${args.length - 1} instead.`);
  		if (!isValue(args[1])) return context.error("invalid value");
  		const value = args[1];
  		let type = typeOf(value);
  		const expected = context.expectedType;
  		if (type.kind === "array" && type.N === 0 && expected && expected.kind === "array" && (typeof expected.N !== "number" || expected.N === 0)) type = expected;
  		return new Literal(type, value);
  	}
  	evaluate() {
  		return this.value;
  	}
  	eachChild() {}
  	outputDefined() {
  		return true;
  	}
  };
  //#endregion
  //#region src/expression/definitions/assertion.ts
  const types$1 = {
  	string: StringType,
  	number: NumberType,
  	boolean: BooleanType,
  	object: ObjectType
  };
  var Assertion = class Assertion {
  	constructor(type, args, key) {
  		this.type = type;
  		this.args = args;
  		this.key = key;
  	}
  	static parse(args, context) {
  		if (args.length < 2) return context.error("Expected at least one argument.");
  		let i = 1;
  		let type;
  		const name = args[0];
  		if (name === "array") {
  			let itemType;
  			if (args.length > 2) {
  				const type = args[1];
  				if (typeof type !== "string" || !(type in types$1) || type === "object") return context.error("The item type argument of \"array\" must be one of string, number, boolean", 1);
  				itemType = types$1[type];
  				i++;
  			} else itemType = ValueType;
  			let N;
  			if (args.length > 3) {
  				if (args[2] !== null && (typeof args[2] !== "number" || args[2] < 0 || args[2] !== Math.floor(args[2]))) return context.error("The length argument to \"array\" must be a positive integer literal", 2);
  				N = args[2];
  				i++;
  			}
  			type = array(itemType, N);
  		} else {
  			if (!types$1[name]) throw new Error(`Types doesn't contain name = ${name}`);
  			type = types$1[name];
  		}
  		const parsed = [];
  		for (; i < args.length; i++) {
  			const input = context.parse(args[i], i, ValueType);
  			if (!input) return null;
  			parsed.push(input);
  		}
  		return new Assertion(type, parsed, context.key);
  	}
  	evaluate(ctx) {
  		for (let i = 0; i < this.args.length; i++) {
  			const value = this.args[i].evaluate(ctx);
  			if (!checkSubtype(this.type, typeOf(value))) return value;
  			else if (i === this.args.length - 1) throw new RuntimeError(`Expected value to be of type ${typeToString(this.type)}, but found ${typeToString(typeOf(value))} instead.`, this.key);
  		}
  		throw new Error();
  	}
  	eachChild(fn) {
  		this.args.forEach(fn);
  	}
  	outputDefined() {
  		return this.args.every((arg) => arg.outputDefined());
  	}
  };
  //#endregion
  //#region src/expression/definitions/coercion.ts
  const types = {
  	"to-boolean": BooleanType,
  	"to-color": ColorType,
  	"to-number": NumberType,
  	"to-string": StringType
  };
  /**
  * Special form for error-coalescing coercion expressions "to-number",
  * "to-color".  Since these coercions can fail at runtime, they accept multiple
  * arguments, only evaluating one at a time until one succeeds.
  *
  * @private
  */
  var Coercion = class Coercion {
  	constructor(type, args, key) {
  		this.type = type;
  		this.args = args;
  		this.key = key;
  	}
  	static parse(args, context) {
  		if (args.length < 2) return context.error("Expected at least one argument.");
  		const name = args[0];
  		if (!types[name]) throw new Error(`Can't parse ${name} as it is not part of the known types`);
  		if ((name === "to-boolean" || name === "to-string") && args.length !== 2) return context.error("Expected one argument.");
  		const type = types[name];
  		const parsed = [];
  		for (let i = 1; i < args.length; i++) {
  			const input = context.parse(args[i], i, ValueType);
  			if (!input) return null;
  			parsed.push(input);
  		}
  		return new Coercion(type, parsed, context.key);
  	}
  	evaluate(ctx) {
  		switch (this.type.kind) {
  			case "boolean": return Boolean(this.args[0].evaluate(ctx));
  			case "color": {
  				let input;
  				let error;
  				for (const arg of this.args) {
  					input = arg.evaluate(ctx);
  					error = null;
  					if (input instanceof Color) return input;
  					else if (typeof input === "string") {
  						const c = ctx.parseColor(input);
  						if (c) return c;
  					} else if (Array.isArray(input)) {
  						if (input.length < 3 || input.length > 4) error = `Invalid rgba value ${JSON.stringify(input)}: expected an array containing either three or four numeric values.`;
  						else error = validateRGBA(input[0], input[1], input[2], input[3]);
  						if (!error) return new Color(input[0] / 255, input[1] / 255, input[2] / 255, input[3]);
  					}
  				}
  				throw new RuntimeError(error || `Could not parse color from value '${typeof input === "string" ? input : JSON.stringify(input)}'`, this.key);
  			}
  			case "padding": {
  				let input;
  				for (const arg of this.args) {
  					input = arg.evaluate(ctx);
  					const pad = Padding.parse(input);
  					if (pad) return pad;
  				}
  				throw new RuntimeError(`Could not parse padding from value '${typeof input === "string" ? input : JSON.stringify(input)}'`, this.key);
  			}
  			case "numberArray": {
  				let input;
  				for (const arg of this.args) {
  					input = arg.evaluate(ctx);
  					const val = NumberArray.parse(input);
  					if (val) return val;
  				}
  				throw new RuntimeError(`Could not parse numberArray from value '${typeof input === "string" ? input : JSON.stringify(input)}'`, this.key);
  			}
  			case "colorArray": {
  				let input;
  				for (const arg of this.args) {
  					input = arg.evaluate(ctx);
  					const val = ColorArray.parse(input);
  					if (val) return val;
  				}
  				throw new RuntimeError(`Could not parse colorArray from value '${typeof input === "string" ? input : JSON.stringify(input)}'`, this.key);
  			}
  			case "variableAnchorOffsetCollection": {
  				let input;
  				for (const arg of this.args) {
  					input = arg.evaluate(ctx);
  					const coll = VariableAnchorOffsetCollection.parse(input);
  					if (coll) return coll;
  				}
  				throw new RuntimeError(`Could not parse variableAnchorOffsetCollection from value '${typeof input === "string" ? input : JSON.stringify(input)}'`, this.key);
  			}
  			case "number": {
  				let value = null;
  				for (const arg of this.args) {
  					value = arg.evaluate(ctx);
  					if (value === null) return 0;
  					const num = Number(value);
  					if (isNaN(num)) continue;
  					return num;
  				}
  				throw new RuntimeError(`Could not convert ${JSON.stringify(value)} to number.`, this.key);
  			}
  			case "formatted": return Formatted.fromString(valueToString(this.args[0].evaluate(ctx)));
  			case "resolvedImage": return ResolvedImage.fromString(valueToString(this.args[0].evaluate(ctx)));
  			case "projectionDefinition": {
  				const input = this.args[0].evaluate(ctx);
  				if (ProjectionDefinition.parse(input)) return input;
  				throw new RuntimeError(`Could not parse projectionDefinition from value '${typeof input === "string" ? input : JSON.stringify(input)}'`, this.key);
  			}
  			default: return valueToString(this.args[0].evaluate(ctx));
  		}
  	}
  	eachChild(fn) {
  		this.args.forEach(fn);
  	}
  	outputDefined() {
  		return this.args.every((arg) => arg.outputDefined());
  	}
  };
  //#endregion
  //#region src/expression/evaluation_context.ts
  const geometryTypes = [
  	"Unknown",
  	"Point",
  	"LineString",
  	"Polygon"
  ];
  var EvaluationContext = class {
  	constructor() {
  		this.globals = null;
  		this.feature = null;
  		this.featureState = null;
  		this.formattedSection = null;
  		this._parseColorCache = /* @__PURE__ */ new Map();
  		this.availableImages = null;
  		this.canonical = null;
  	}
  	id() {
  		return this.feature && "id" in this.feature ? this.feature.id : null;
  	}
  	geometryType() {
  		return this.feature ? typeof this.feature.type === "number" ? geometryTypes[this.feature.type] : this.feature.type : null;
  	}
  	geometry() {
  		return this.feature && "geometry" in this.feature ? this.feature.geometry : null;
  	}
  	canonicalID() {
  		return this.canonical;
  	}
  	properties() {
  		return this.feature && this.feature.properties || {};
  	}
  	parseColor(input) {
  		let cached = this._parseColorCache.get(input);
  		if (!cached) {
  			cached = Color.parse(input);
  			this._parseColorCache.set(input, cached);
  		}
  		return cached;
  	}
  };
  //#endregion
  //#region src/expression/parsing_context.ts
  /**
  * State associated parsing at a given point in an expression tree.
  * @private
  */
  var ParsingContext = class ParsingContext {
  	constructor(registry, isConstantFunc, path = [], expectedType, scope = new Scope(), errors = []) {
  		this.registry = registry;
  		this.path = path;
  		this.key = path.map((part) => `[${part}]`).join("");
  		this.scope = scope;
  		this.errors = errors;
  		this.expectedType = expectedType;
  		this._isConstant = isConstantFunc;
  	}
  	/**
  	* @param expr the JSON expression to parse
  	* @param index the optional argument index if this expression is an argument of a parent expression that's being parsed
  	* @param options
  	* @param options.omitTypeAnnotations set true to omit inferred type annotations.  Caller beware: with this option set, the parsed expression's type will NOT satisfy `expectedType` if it would normally be wrapped in an inferred annotation.
  	* @private
  	*/
  	parse(expr, index, expectedType, bindings, options = {}) {
  		if (index) return this.concat(index, expectedType, bindings)._parse(expr, options);
  		return this._parse(expr, options);
  	}
  	_parse(expr, options) {
  		if (expr === null || typeof expr === "string" || typeof expr === "boolean" || typeof expr === "number") expr = ["literal", expr];
  		const key = this.key;
  		function annotate(parsed, type, typeAnnotation) {
  			if (typeAnnotation === "assert") return new Assertion(type, [parsed], key);
  			else if (typeAnnotation === "coerce") return new Coercion(type, [parsed], key);
  			else return parsed;
  		}
  		if (Array.isArray(expr)) {
  			if (expr.length === 0) return this.error("Expected an array with at least one element. If you wanted a literal array, use [\"literal\", []].");
  			const op = expr[0];
  			if (typeof op !== "string") {
  				this.error(`Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`, 0);
  				return null;
  			}
  			const Expr = this.registry[op];
  			if (Expr) {
  				let parsed = Expr.parse(expr, this);
  				if (!parsed) return null;
  				if (this.expectedType) {
  					const expected = this.expectedType;
  					const actual = parsed.type;
  					if ((expected.kind === "string" || expected.kind === "number" || expected.kind === "boolean" || expected.kind === "object" || expected.kind === "array") && actual.kind === "value") parsed = annotate(parsed, expected, options.typeAnnotation || "assert");
  					else if ("projectionDefinition" === expected.kind && [
  						"string",
  						"array",
  						"value"
  					].includes(actual.kind) || [
  						"color",
  						"formatted",
  						"resolvedImage"
  					].includes(expected.kind) && ["value", "string"].includes(actual.kind) || ["padding", "numberArray"].includes(expected.kind) && [
  						"value",
  						"number",
  						"array"
  					].includes(actual.kind) || "colorArray" === expected.kind && [
  						"value",
  						"string",
  						"array"
  					].includes(actual.kind) || "variableAnchorOffsetCollection" === expected.kind && ["value", "array"].includes(actual.kind)) parsed = annotate(parsed, expected, options.typeAnnotation || "coerce");
  					else if (this.checkSubtype(expected, actual)) return null;
  				}
  				if (!(parsed instanceof Literal) && parsed.type.kind !== "resolvedImage" && this._isConstant(parsed)) {
  					const ec = new EvaluationContext();
  					try {
  						parsed = new Literal(parsed.type, parsed.evaluate(ec));
  					} catch (e) {
  						this.error(e.message);
  						return null;
  					}
  				}
  				return parsed;
  			}
  			return this.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
  		} else if (typeof expr === "undefined") return this.error("'undefined' value invalid. Use null instead.");
  		else if (typeof expr === "object") return this.error("Bare objects invalid. Use [\"literal\", {...}] instead.");
  		else return this.error(`Expected an array, but found ${typeof expr} instead.`);
  	}
  	/**
  	* Returns a copy of this context suitable for parsing the subexpression at
  	* index `index`, optionally appending to 'let' binding map.
  	*
  	* Note that `errors` property, intended for collecting errors while
  	* parsing, is copied by reference rather than cloned.
  	* @private
  	*/
  	concat(index, expectedType, bindings) {
  		const path = typeof index === "number" ? this.path.concat(index) : this.path;
  		const scope = bindings ? this.scope.concat(bindings) : this.scope;
  		return new ParsingContext(this.registry, this._isConstant, path, expectedType || null, scope, this.errors);
  	}
  	/**
  	* Push a parsing (or type checking) error into the `this.errors`
  	* @param error The message
  	* @param keys Optionally specify the source of the error at a child
  	* of the current expression at `this.key`.
  	* @private
  	*/
  	error(error, ...keys) {
  		const key = `${this.key}${keys.map((k) => `[${k}]`).join("")}`;
  		this.errors.push(new ExpressionParsingError(key, error));
  	}
  	/**
  	* Returns null if `t` is a subtype of `expected`; otherwise returns an
  	* error message and also pushes it to `this.errors`.
  	* @param expected The expected type
  	* @param t The actual type
  	* @returns null if `t` is a subtype of `expected`; otherwise returns an error message
  	*/
  	checkSubtype(expected, t) {
  		const error = checkSubtype(expected, t);
  		if (error) this.error(error);
  		return error;
  	}
  };
  //#endregion
  //#region src/expression/definitions/let.ts
  var Let = class Let {
  	constructor(bindings, result) {
  		this.type = result.type;
  		this.bindings = [].concat(bindings);
  		this.result = result;
  	}
  	evaluate(ctx) {
  		return this.result.evaluate(ctx);
  	}
  	eachChild(fn) {
  		for (const binding of this.bindings) fn(binding[1]);
  		fn(this.result);
  	}
  	static parse(args, context) {
  		if (args.length < 4) return context.error(`Expected at least 3 arguments, but found ${args.length - 1} instead.`);
  		const bindings = [];
  		for (let i = 1; i < args.length - 1; i += 2) {
  			const name = args[i];
  			if (typeof name !== "string") return context.error(`Expected string, but found ${typeof name} instead.`, i);
  			if (/[^a-zA-Z0-9_]/.test(name)) return context.error("Variable names must contain only alphanumeric characters or '_'.", i);
  			const value = context.parse(args[i + 1], i + 1);
  			if (!value) return null;
  			bindings.push([name, value]);
  		}
  		const result = context.parse(args[args.length - 1], args.length - 1, context.expectedType, bindings);
  		if (!result) return null;
  		return new Let(bindings, result);
  	}
  	outputDefined() {
  		return this.result.outputDefined();
  	}
  };
  //#endregion
  //#region src/expression/definitions/var.ts
  var Var = class Var {
  	constructor(name, boundExpression) {
  		this.type = boundExpression.type;
  		this.name = name;
  		this.boundExpression = boundExpression;
  	}
  	static parse(args, context) {
  		if (args.length !== 2 || typeof args[1] !== "string") return context.error("'var' expression requires exactly one string literal argument.");
  		const name = args[1];
  		if (!context.scope.has(name)) return context.error(`Unknown variable "${name}". Make sure "${name}" has been bound in an enclosing "let" expression before using it.`, 1);
  		return new Var(name, context.scope.get(name));
  	}
  	evaluate(ctx) {
  		return this.boundExpression.evaluate(ctx);
  	}
  	eachChild() {}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/at.ts
  var At = class At {
  	constructor(type, index, input, key) {
  		this.type = type;
  		this.index = index;
  		this.input = input;
  		this.key = key;
  	}
  	static parse(args, context) {
  		if (args.length !== 3) return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);
  		const index = context.parse(args[1], 1, NumberType);
  		const input = context.parse(args[2], 2, array(context.expectedType || ValueType));
  		if (!index || !input) return null;
  		const t = input.type;
  		return new At(t.itemType, index, input, context.key);
  	}
  	evaluate(ctx) {
  		const index = this.index.evaluate(ctx);
  		const array = this.input.evaluate(ctx);
  		if (index < 0) throw new RuntimeError(`Array index out of bounds: ${index} < 0.`, this.key);
  		if (index >= array.length) throw new RuntimeError(`Array index out of bounds: ${index} > ${array.length - 1}.`, this.key);
  		if (index !== Math.floor(index)) throw new RuntimeError(`Array index must be an integer, but found ${index} instead.`, this.key);
  		return array[index];
  	}
  	eachChild(fn) {
  		fn(this.index);
  		fn(this.input);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/in.ts
  var In = class In {
  	constructor(needle, haystack, key) {
  		this.needle = needle;
  		this.haystack = haystack;
  		this.key = key;
  		this.type = BooleanType;
  	}
  	static parse(args, context) {
  		if (args.length !== 3) return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);
  		const needle = context.parse(args[1], 1, ValueType);
  		const haystack = context.parse(args[2], 2, ValueType);
  		if (!needle || !haystack) return null;
  		if (!isValidType(needle.type, [
  			BooleanType,
  			StringType,
  			NumberType,
  			NullType,
  			ValueType
  		])) return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${typeToString(needle.type)} instead`);
  		return new In(needle, haystack, context.key);
  	}
  	evaluate(ctx) {
  		const needle = this.needle.evaluate(ctx);
  		const haystack = this.haystack.evaluate(ctx);
  		if (!haystack) return false;
  		if (!isValidNativeType(needle, [
  			"boolean",
  			"string",
  			"number",
  			"null"
  		])) throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${typeToString(typeOf(needle))} instead.`, this.key);
  		if (!isValidNativeType(haystack, ["string", "array"])) throw new RuntimeError(`Expected second argument to be of type array or string, but found ${typeToString(typeOf(haystack))} instead.`, this.key);
  		return haystack.indexOf(needle) >= 0;
  	}
  	eachChild(fn) {
  		fn(this.needle);
  		fn(this.haystack);
  	}
  	outputDefined() {
  		return true;
  	}
  };
  //#endregion
  //#region src/expression/definitions/index_of.ts
  var IndexOf = class IndexOf {
  	constructor(needle, haystack, key, fromIndex) {
  		this.needle = needle;
  		this.haystack = haystack;
  		this.key = key;
  		this.fromIndex = fromIndex;
  		this.type = NumberType;
  	}
  	static parse(args, context) {
  		if (args.length <= 2 || args.length >= 5) return context.error(`Expected 2 or 3 arguments, but found ${args.length - 1} instead.`);
  		const needle = context.parse(args[1], 1, ValueType);
  		const haystack = context.parse(args[2], 2, ValueType);
  		if (!needle || !haystack) return null;
  		if (!isValidType(needle.type, [
  			BooleanType,
  			StringType,
  			NumberType,
  			NullType,
  			ValueType
  		])) return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${typeToString(needle.type)} instead`);
  		if (args.length === 4) {
  			const fromIndex = context.parse(args[3], 3, NumberType);
  			if (!fromIndex) return null;
  			return new IndexOf(needle, haystack, context.key, fromIndex);
  		} else return new IndexOf(needle, haystack, context.key);
  	}
  	evaluate(ctx) {
  		const needle = this.needle.evaluate(ctx);
  		const haystack = this.haystack.evaluate(ctx);
  		if (!isValidNativeType(needle, [
  			"boolean",
  			"string",
  			"number",
  			"null"
  		])) throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${typeToString(typeOf(needle))} instead.`, this.key);
  		let fromIndex;
  		if (this.fromIndex) fromIndex = this.fromIndex.evaluate(ctx);
  		if (isValidNativeType(haystack, ["string"])) {
  			const rawIndex = haystack.indexOf(needle, fromIndex);
  			if (rawIndex === -1) return -1;
  			else return [...haystack.slice(0, rawIndex)].length;
  		} else if (isValidNativeType(haystack, ["array"])) return haystack.indexOf(needle, fromIndex);
  		else throw new RuntimeError(`Expected second argument to be of type array or string, but found ${typeToString(typeOf(haystack))} instead.`, this.key);
  	}
  	eachChild(fn) {
  		fn(this.needle);
  		fn(this.haystack);
  		if (this.fromIndex) fn(this.fromIndex);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/match.ts
  var Match = class Match {
  	constructor(inputType, outputType, input, cases, outputs, otherwise) {
  		this.inputType = inputType;
  		this.type = outputType;
  		this.input = input;
  		this.cases = cases;
  		this.outputs = outputs;
  		this.otherwise = otherwise;
  	}
  	static parse(args, context) {
  		if (args.length < 5) return context.error(`Expected at least 4 arguments, but found only ${args.length - 1}.`);
  		if (args.length % 2 !== 1) return context.error("Expected an even number of arguments.");
  		let inputType;
  		let outputType;
  		if (context.expectedType && context.expectedType.kind !== "value") outputType = context.expectedType;
  		const cases = {};
  		const outputs = [];
  		for (let i = 2; i < args.length - 1; i += 2) {
  			let labels = args[i];
  			const value = args[i + 1];
  			if (!Array.isArray(labels)) labels = [labels];
  			const labelContext = context.concat(i);
  			if (labels.length === 0) return labelContext.error("Expected at least one branch label.");
  			for (const label of labels) {
  				if (typeof label !== "number" && typeof label !== "string") return labelContext.error("Branch labels must be numbers or strings.");
  				else if (typeof label === "number" && Math.abs(label) > Number.MAX_SAFE_INTEGER) return labelContext.error(`Branch labels must be integers no larger than ${Number.MAX_SAFE_INTEGER}.`);
  				else if (typeof label === "number" && Math.floor(label) !== label) return labelContext.error("Numeric branch labels must be integer values.");
  				else if (!inputType) inputType = typeOf(label);
  				else if (labelContext.checkSubtype(inputType, typeOf(label))) return null;
  				if (typeof cases[String(label)] !== "undefined") return labelContext.error("Branch labels must be unique.");
  				cases[String(label)] = outputs.length;
  			}
  			const result = context.parse(value, i, outputType);
  			if (!result) return null;
  			outputType = outputType || result.type;
  			outputs.push(result);
  		}
  		const input = context.parse(args[1], 1, ValueType);
  		if (!input) return null;
  		const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
  		if (!otherwise) return null;
  		if (input.type.kind !== "value" && context.concat(1).checkSubtype(inputType, input.type)) return null;
  		return new Match(inputType, outputType, input, cases, outputs, otherwise);
  	}
  	evaluate(ctx) {
  		const input = this.input.evaluate(ctx);
  		return (typeOf(input) === this.inputType && this.outputs[this.cases[input]] || this.otherwise).evaluate(ctx);
  	}
  	eachChild(fn) {
  		fn(this.input);
  		this.outputs.forEach(fn);
  		fn(this.otherwise);
  	}
  	outputDefined() {
  		return this.outputs.every((out) => out.outputDefined()) && this.otherwise.outputDefined();
  	}
  };
  //#endregion
  //#region src/expression/definitions/case.ts
  var Case = class Case {
  	constructor(type, branches, otherwise) {
  		this.type = type;
  		this.branches = branches;
  		this.otherwise = otherwise;
  	}
  	static parse(args, context) {
  		if (args.length < 4) return context.error(`Expected at least 3 arguments, but found only ${args.length - 1}.`);
  		if (args.length % 2 !== 0) return context.error("Expected an odd number of arguments.");
  		let outputType;
  		if (context.expectedType && context.expectedType.kind !== "value") outputType = context.expectedType;
  		const branches = [];
  		for (let i = 1; i < args.length - 1; i += 2) {
  			const test = context.parse(args[i], i, BooleanType);
  			if (!test) return null;
  			const result = context.parse(args[i + 1], i + 1, outputType);
  			if (!result) return null;
  			branches.push([test, result]);
  			outputType = outputType || result.type;
  		}
  		const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
  		if (!otherwise) return null;
  		if (!outputType) throw new Error("Can't infer output type");
  		return new Case(outputType, branches, otherwise);
  	}
  	evaluate(ctx) {
  		for (const [test, expression] of this.branches) if (test.evaluate(ctx)) return expression.evaluate(ctx);
  		return this.otherwise.evaluate(ctx);
  	}
  	eachChild(fn) {
  		for (const [test, expression] of this.branches) {
  			fn(test);
  			fn(expression);
  		}
  		fn(this.otherwise);
  	}
  	outputDefined() {
  		return this.branches.every(([_, out]) => out.outputDefined()) && this.otherwise.outputDefined();
  	}
  };
  //#endregion
  //#region src/expression/definitions/slice.ts
  var Slice = class Slice {
  	constructor(type, input, beginIndex, key, endIndex) {
  		this.type = type;
  		this.input = input;
  		this.beginIndex = beginIndex;
  		this.key = key;
  		this.endIndex = endIndex;
  	}
  	static parse(args, context) {
  		if (args.length <= 2 || args.length >= 5) return context.error(`Expected 2 or 3 arguments, but found ${args.length - 1} instead.`);
  		const input = context.parse(args[1], 1, ValueType);
  		const beginIndex = context.parse(args[2], 2, NumberType);
  		if (!input || !beginIndex) return null;
  		if (!isValidType(input.type, [
  			array(ValueType),
  			StringType,
  			ValueType
  		])) return context.error(`Expected first argument to be of type array or string, but found ${typeToString(input.type)} instead`);
  		if (args.length === 4) {
  			const endIndex = context.parse(args[3], 3, NumberType);
  			if (!endIndex) return null;
  			return new Slice(input.type, input, beginIndex, context.key, endIndex);
  		} else return new Slice(input.type, input, beginIndex, context.key);
  	}
  	evaluate(ctx) {
  		const input = this.input.evaluate(ctx);
  		const beginIndex = this.beginIndex.evaluate(ctx);
  		let endIndex;
  		if (this.endIndex) endIndex = this.endIndex.evaluate(ctx);
  		if (isValidNativeType(input, ["string"])) return [...input].slice(beginIndex, endIndex).join("");
  		else if (isValidNativeType(input, ["array"])) return input.slice(beginIndex, endIndex);
  		else throw new RuntimeError(`Expected first argument to be of type array or string, but found ${typeToString(typeOf(input))} instead.`, this.key);
  	}
  	eachChild(fn) {
  		fn(this.input);
  		fn(this.beginIndex);
  		if (this.endIndex) fn(this.endIndex);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/stops.ts
  /**
  * Returns the index of the last stop <= input, or 0 if it doesn't exist.
  * @private
  */
  function findStopLessThanOrEqualTo(stops, input, key) {
  	const lastIndex = stops.length - 1;
  	let lowerIndex = 0;
  	let upperIndex = lastIndex;
  	let currentIndex = 0;
  	let currentValue, nextValue;
  	while (lowerIndex <= upperIndex) {
  		currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
  		currentValue = stops[currentIndex];
  		nextValue = stops[currentIndex + 1];
  		if (currentValue <= input) {
  			if (currentIndex === lastIndex || input < nextValue) return currentIndex;
  			lowerIndex = currentIndex + 1;
  		} else if (currentValue > input) upperIndex = currentIndex - 1;
  		else throw new RuntimeError("Input is not a number.", key);
  	}
  	return 0;
  }
  //#endregion
  //#region src/expression/definitions/step.ts
  var Step = class Step {
  	constructor(type, input, stops, key) {
  		this.type = type;
  		this.input = input;
  		this.key = key;
  		this.labels = [];
  		this.outputs = [];
  		for (const [label, expression] of stops) {
  			this.labels.push(label);
  			this.outputs.push(expression);
  		}
  	}
  	static parse(args, context) {
  		if (args.length - 1 < 4) return context.error(`Expected at least 4 arguments, but found only ${args.length - 1}.`);
  		if ((args.length - 1) % 2 !== 0) return context.error("Expected an even number of arguments.");
  		const input = context.parse(args[1], 1, NumberType);
  		if (!input) return null;
  		const stops = [];
  		let outputType = null;
  		if (context.expectedType && context.expectedType.kind !== "value") outputType = context.expectedType;
  		for (let i = 1; i < args.length; i += 2) {
  			const label = i === 1 ? -Infinity : args[i];
  			const value = args[i + 1];
  			const labelKey = i;
  			const valueKey = i + 1;
  			if (typeof label !== "number") return context.error("Input/output pairs for \"step\" expressions must be defined using literal numeric values (not computed expressions) for the input values.", labelKey);
  			if (stops.length && stops[stops.length - 1][0] >= label) return context.error("Input/output pairs for \"step\" expressions must be arranged with input values in strictly ascending order.", labelKey);
  			const parsed = context.parse(value, valueKey, outputType);
  			if (!parsed) return null;
  			outputType = outputType || parsed.type;
  			stops.push([label, parsed]);
  		}
  		return new Step(outputType, input, stops, context.key);
  	}
  	evaluate(ctx) {
  		const labels = this.labels;
  		const outputs = this.outputs;
  		if (labels.length === 1) return outputs[0].evaluate(ctx);
  		const value = this.input.evaluate(ctx);
  		if (value <= labels[0]) return outputs[0].evaluate(ctx);
  		const stopCount = labels.length;
  		if (value >= labels[stopCount - 1]) return outputs[stopCount - 1].evaluate(ctx);
  		return outputs[findStopLessThanOrEqualTo(labels, value, this.key)].evaluate(ctx);
  	}
  	eachChild(fn) {
  		fn(this.input);
  		for (const expression of this.outputs) fn(expression);
  	}
  	outputDefined() {
  		return this.outputs.every((out) => out.outputDefined());
  	}
  };
  //#endregion
  //#region node_modules/@mapbox/unitbezier/index.js
  function unitBezier(p1x, p1y, p2x, p2y) {
  	const cx = 3 * p1x;
  	const bx = 3 * (p2x - p1x) - cx;
  	const ax = 1 - cx - bx;
  	const cy = 3 * p1y;
  	const by = 3 * (p2y - p1y) - cy;
  	const ay = 1 - cy - by;
  	return function solve(x, epsilon = 1e-6) {
  		if (x <= 0) return 0;
  		if (x >= 1) return 1;
  		let t = x;
  		for (let i = 0; i < 8; i++) {
  			const x2 = ((ax * t + bx) * t + cx) * t - x;
  			if (Math.abs(x2) < epsilon) return ((ay * t + by) * t + cy) * t;
  			const d2 = (3 * ax * t + 2 * bx) * t + cx;
  			if (Math.abs(d2) < 1e-6) break;
  			t -= x2 / d2;
  		}
  		let t0 = 0;
  		let t1 = 1;
  		t = x;
  		for (let i = 0; i < 20; i++) {
  			const x2 = ((ax * t + bx) * t + cx) * t;
  			if (Math.abs(x2 - x) < epsilon) break;
  			if (x > x2) t0 = t;
  			else t1 = t;
  			t = (t0 + t1) * .5;
  		}
  		return ((ay * t + by) * t + cy) * t;
  	};
  }
  //#endregion
  //#region src/expression/definitions/interpolate.ts
  var Interpolate = class Interpolate {
  	constructor(type, operator, interpolation, input, stops, key) {
  		this.type = type;
  		this.operator = operator;
  		this.interpolation = interpolation;
  		this.input = input;
  		this.key = key;
  		this.labels = [];
  		this.outputs = [];
  		for (const [label, expression] of stops) {
  			this.labels.push(label);
  			this.outputs.push(expression);
  		}
  	}
  	static interpolationFactor(interpolation, input, lower, upper) {
  		let t = 0;
  		if (interpolation.name === "exponential") t = exponentialInterpolation(input, interpolation.base, lower, upper);
  		else if (interpolation.name === "linear") t = exponentialInterpolation(input, 1, lower, upper);
  		else if (interpolation.name === "cubic-bezier") {
  			const c = interpolation.controlPoints;
  			t = unitBezier(c[0], c[1], c[2], c[3])(exponentialInterpolation(input, 1, lower, upper));
  		}
  		return t;
  	}
  	static parse(args, context) {
  		let [operator, interpolation, input, ...rest] = args;
  		if (!Array.isArray(interpolation) || interpolation.length === 0) return context.error("Expected an interpolation type expression.", 1);
  		if (interpolation[0] === "linear") interpolation = { name: "linear" };
  		else if (interpolation[0] === "exponential") {
  			const base = interpolation[1];
  			if (typeof base !== "number") return context.error("Exponential interpolation requires a numeric base.", 1, 1);
  			interpolation = {
  				name: "exponential",
  				base
  			};
  		} else if (interpolation[0] === "cubic-bezier") {
  			const controlPoints = interpolation.slice(1);
  			if (controlPoints.length !== 4 || controlPoints.some((t) => typeof t !== "number" || t < 0 || t > 1)) return context.error("Cubic bezier interpolation requires four numeric arguments with values between 0 and 1.", 1);
  			interpolation = {
  				name: "cubic-bezier",
  				controlPoints
  			};
  		} else return context.error(`Unknown interpolation type ${String(interpolation[0])}`, 1, 0);
  		if (args.length - 1 < 4) return context.error(`Expected at least 4 arguments, but found only ${args.length - 1}.`);
  		if ((args.length - 1) % 2 !== 0) return context.error("Expected an even number of arguments.");
  		input = context.parse(input, 2, NumberType);
  		if (!input) return null;
  		const stops = [];
  		let outputType = null;
  		if ((operator === "interpolate-hcl" || operator === "interpolate-lab") && context.expectedType != ColorArrayType) outputType = ColorType;
  		else if (context.expectedType && context.expectedType.kind !== "value") outputType = context.expectedType;
  		for (let i = 0; i < rest.length; i += 2) {
  			const label = rest[i];
  			const value = rest[i + 1];
  			const labelKey = i + 3;
  			const valueKey = i + 4;
  			if (typeof label !== "number") return context.error("Input/output pairs for \"interpolate\" expressions must be defined using literal numeric values (not computed expressions) for the input values.", labelKey);
  			if (stops.length && stops[stops.length - 1][0] >= label) return context.error("Input/output pairs for \"interpolate\" expressions must be arranged with input values in strictly ascending order.", labelKey);
  			const parsed = context.parse(value, valueKey, outputType);
  			if (!parsed) return null;
  			outputType = outputType || parsed.type;
  			stops.push([label, parsed]);
  		}
  		if (!verifyType(outputType, NumberType) && !verifyType(outputType, ProjectionDefinitionType) && !verifyType(outputType, ColorType) && !verifyType(outputType, PaddingType) && !verifyType(outputType, NumberArrayType) && !verifyType(outputType, ColorArrayType) && !verifyType(outputType, VariableAnchorOffsetCollectionType) && !verifyType(outputType, array(NumberType))) return context.error(`Type ${typeToString(outputType)} is not interpolatable.`);
  		return new Interpolate(outputType, operator, interpolation, input, stops, context.key);
  	}
  	evaluate(ctx) {
  		const labels = this.labels;
  		const outputs = this.outputs;
  		if (labels.length === 1) return outputs[0].evaluate(ctx);
  		const value = this.input.evaluate(ctx);
  		if (value <= labels[0]) return outputs[0].evaluate(ctx);
  		const stopCount = labels.length;
  		if (value >= labels[stopCount - 1]) return outputs[stopCount - 1].evaluate(ctx);
  		const index = findStopLessThanOrEqualTo(labels, value, this.key);
  		const lower = labels[index];
  		const upper = labels[index + 1];
  		const t = Interpolate.interpolationFactor(this.interpolation, value, lower, upper);
  		const outputLower = outputs[index].evaluate(ctx);
  		const outputUpper = outputs[index + 1].evaluate(ctx);
  		switch (this.operator) {
  			case "interpolate": switch (this.type.kind) {
  				case "number": return interpolateNumber(outputLower, outputUpper, t);
  				case "color": return Color.interpolate(outputLower, outputUpper, t);
  				case "padding": return Padding.interpolate(outputLower, outputUpper, t);
  				case "colorArray": return ColorArray.interpolate(outputLower, outputUpper, t);
  				case "numberArray": return NumberArray.interpolate(outputLower, outputUpper, t);
  				case "variableAnchorOffsetCollection": return VariableAnchorOffsetCollection.interpolate(outputLower, outputUpper, t, this.key);
  				case "array": return interpolateArray(outputLower, outputUpper, t);
  				case "projectionDefinition": return ProjectionDefinition.interpolate(outputLower, outputUpper, t);
  			}
  			case "interpolate-hcl": switch (this.type.kind) {
  				case "color": return Color.interpolate(outputLower, outputUpper, t, "hcl");
  				case "colorArray": return ColorArray.interpolate(outputLower, outputUpper, t, "hcl");
  			}
  			case "interpolate-lab": switch (this.type.kind) {
  				case "color": return Color.interpolate(outputLower, outputUpper, t, "lab");
  				case "colorArray": return ColorArray.interpolate(outputLower, outputUpper, t, "lab");
  			}
  		}
  	}
  	eachChild(fn) {
  		fn(this.input);
  		for (const expression of this.outputs) fn(expression);
  	}
  	outputDefined() {
  		return this.outputs.every((out) => out.outputDefined());
  	}
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
  	const difference = upperValue - lowerValue;
  	const progress = input - lowerValue;
  	if (difference === 0) return 0;
  	else if (base === 1) return progress / difference;
  	else return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
  }
  const interpolateFactory = {
  	color: Color.interpolate,
  	number: interpolateNumber,
  	padding: Padding.interpolate,
  	numberArray: NumberArray.interpolate,
  	colorArray: ColorArray.interpolate,
  	variableAnchorOffsetCollection: VariableAnchorOffsetCollection.interpolate,
  	array: interpolateArray
  };
  //#endregion
  //#region src/expression/definitions/coalesce.ts
  var Coalesce = class Coalesce {
  	constructor(type, args) {
  		this.type = type;
  		this.args = args;
  	}
  	static parse(args, context) {
  		if (args.length < 2) return context.error("Expected at least one argument.");
  		let outputType = null;
  		const expectedType = context.expectedType;
  		if (expectedType && expectedType.kind !== "value") outputType = expectedType;
  		const parsedArgs = [];
  		for (const arg of args.slice(1)) {
  			const parsed = context.parse(arg, 1 + parsedArgs.length, outputType, void 0, { typeAnnotation: "omit" });
  			if (!parsed) return null;
  			outputType = outputType || parsed.type;
  			parsedArgs.push(parsed);
  		}
  		if (!outputType) throw new Error("No output type");
  		return expectedType && parsedArgs.some((arg) => checkSubtype(expectedType, arg.type)) ? new Coalesce(ValueType, parsedArgs) : new Coalesce(outputType, parsedArgs);
  	}
  	evaluate(ctx) {
  		let result = null;
  		let argCount = 0;
  		let requestedImageName;
  		for (const arg of this.args) {
  			argCount++;
  			result = arg.evaluate(ctx);
  			if (result && result instanceof ResolvedImage && !result.available) {
  				if (!requestedImageName) requestedImageName = result.name;
  				result = null;
  				if (argCount === this.args.length) result = requestedImageName;
  			}
  			if (result !== null) break;
  		}
  		return result;
  	}
  	eachChild(fn) {
  		this.args.forEach(fn);
  	}
  	outputDefined() {
  		return this.args.every((arg) => arg.outputDefined());
  	}
  };
  //#endregion
  //#region src/expression/definitions/comparison.ts
  function isComparableType(op, type) {
  	if (op === "==" || op === "!=") return type.kind === "boolean" || type.kind === "string" || type.kind === "number" || type.kind === "null" || type.kind === "value";
  	else return type.kind === "string" || type.kind === "number" || type.kind === "value";
  }
  function eq(ctx, a, b) {
  	return a === b;
  }
  function neq(ctx, a, b) {
  	return a !== b;
  }
  function lt(ctx, a, b) {
  	return a < b;
  }
  function gt(ctx, a, b) {
  	return a > b;
  }
  function lteq(ctx, a, b) {
  	return a <= b;
  }
  function gteq(ctx, a, b) {
  	return a >= b;
  }
  function eqCollate(ctx, a, b, c) {
  	return c.compare(a, b) === 0;
  }
  function neqCollate(ctx, a, b, c) {
  	return !eqCollate(ctx, a, b, c);
  }
  function ltCollate(ctx, a, b, c) {
  	return c.compare(a, b) < 0;
  }
  function gtCollate(ctx, a, b, c) {
  	return c.compare(a, b) > 0;
  }
  function lteqCollate(ctx, a, b, c) {
  	return c.compare(a, b) <= 0;
  }
  function gteqCollate(ctx, a, b, c) {
  	return c.compare(a, b) >= 0;
  }
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
  	const isOrderComparison = op !== "==" && op !== "!=";
  	return class Comparison {
  		constructor(lhs, rhs, key, collator) {
  			this.lhs = lhs;
  			this.rhs = rhs;
  			this.key = key;
  			this.collator = collator;
  			this.type = BooleanType;
  			this.hasUntypedArgument = lhs.type.kind === "value" || rhs.type.kind === "value";
  		}
  		static parse(args, context) {
  			if (args.length !== 3 && args.length !== 4) return context.error("Expected two or three arguments.");
  			const op = args[0];
  			let lhs = context.parse(args[1], 1, ValueType);
  			if (!lhs) return null;
  			if (!isComparableType(op, lhs.type)) return context.concat(1).error(`"${op}" comparisons are not supported for type '${typeToString(lhs.type)}'.`);
  			let rhs = context.parse(args[2], 2, ValueType);
  			if (!rhs) return null;
  			if (!isComparableType(op, rhs.type)) return context.concat(2).error(`"${op}" comparisons are not supported for type '${typeToString(rhs.type)}'.`);
  			if (lhs.type.kind !== rhs.type.kind && lhs.type.kind !== "value" && rhs.type.kind !== "value") return context.error(`Cannot compare types '${typeToString(lhs.type)}' and '${typeToString(rhs.type)}'.`);
  			if (isOrderComparison) {
  				if (lhs.type.kind === "value" && rhs.type.kind !== "value") lhs = new Assertion(rhs.type, [lhs], context.key);
  				else if (lhs.type.kind !== "value" && rhs.type.kind === "value") rhs = new Assertion(lhs.type, [rhs], context.key);
  			}
  			let collator = null;
  			if (args.length === 4) {
  				if (lhs.type.kind !== "string" && rhs.type.kind !== "string" && lhs.type.kind !== "value" && rhs.type.kind !== "value") return context.error("Cannot use collator to compare non-string types.");
  				collator = context.parse(args[3], 3, CollatorType);
  				if (!collator) return null;
  			}
  			return new Comparison(lhs, rhs, context.key, collator);
  		}
  		evaluate(ctx) {
  			const lhs = this.lhs.evaluate(ctx);
  			const rhs = this.rhs.evaluate(ctx);
  			if (isOrderComparison && this.hasUntypedArgument) {
  				const lt = typeOf(lhs);
  				const rt = typeOf(rhs);
  				if (lt.kind !== rt.kind || !(lt.kind === "string" || lt.kind === "number")) throw new RuntimeError(`Expected arguments for "${op}" to be (string, string) or (number, number), but found (${lt.kind}, ${rt.kind}) instead.`, this.key);
  			}
  			if (this.collator && !isOrderComparison && this.hasUntypedArgument) {
  				const lt = typeOf(lhs);
  				const rt = typeOf(rhs);
  				if (lt.kind !== "string" || rt.kind !== "string") return compareBasic(ctx, lhs, rhs);
  			}
  			return this.collator ? compareWithCollator(ctx, lhs, rhs, this.collator.evaluate(ctx)) : compareBasic(ctx, lhs, rhs);
  		}
  		eachChild(fn) {
  			fn(this.lhs);
  			fn(this.rhs);
  			if (this.collator) fn(this.collator);
  		}
  		outputDefined() {
  			return true;
  		}
  	};
  }
  const Equals = makeComparison("==", eq, eqCollate);
  const NotEquals = makeComparison("!=", neq, neqCollate);
  const LessThan = makeComparison("<", lt, ltCollate);
  const GreaterThan = makeComparison(">", gt, gtCollate);
  const LessThanOrEqual = makeComparison("<=", lteq, lteqCollate);
  const GreaterThanOrEqual = makeComparison(">=", gteq, gteqCollate);
  //#endregion
  //#region src/expression/definitions/collator.ts
  var CollatorExpression = class CollatorExpression {
  	constructor(caseSensitive, diacriticSensitive, locale) {
  		this.type = CollatorType;
  		this.locale = locale;
  		this.caseSensitive = caseSensitive;
  		this.diacriticSensitive = diacriticSensitive;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error("Expected one argument.");
  		const options = args[1];
  		if (typeof options !== "object" || Array.isArray(options)) return context.error("Collator options argument must be an object.");
  		const caseSensitive = context.parse(options["case-sensitive"] === void 0 ? false : options["case-sensitive"], 1, BooleanType);
  		if (!caseSensitive) return null;
  		const diacriticSensitive = context.parse(options["diacritic-sensitive"] === void 0 ? false : options["diacritic-sensitive"], 1, BooleanType);
  		if (!diacriticSensitive) return null;
  		let locale = null;
  		if (options["locale"]) {
  			locale = context.parse(options["locale"], 1, StringType);
  			if (!locale) return null;
  		}
  		return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
  	}
  	evaluate(ctx) {
  		return new Collator(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
  	}
  	eachChild(fn) {
  		fn(this.caseSensitive);
  		fn(this.diacriticSensitive);
  		if (this.locale) fn(this.locale);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/number_format.ts
  var NumberFormat = class NumberFormat {
  	constructor(number, locale, currency, unit, minFractionDigits, maxFractionDigits) {
  		this.type = StringType;
  		this.number = number;
  		this.locale = locale;
  		this.currency = currency;
  		this.unit = unit;
  		this.minFractionDigits = minFractionDigits;
  		this.maxFractionDigits = maxFractionDigits;
  	}
  	static parse(args, context) {
  		if (args.length !== 3) return context.error("Expected two arguments.");
  		const number = context.parse(args[1], 1, NumberType);
  		if (!number) return null;
  		const options = args[2];
  		if (typeof options !== "object" || Array.isArray(options)) return context.error("NumberFormat options argument must be an object.");
  		let locale = null;
  		if (options["locale"]) {
  			locale = context.parse(options["locale"], 1, StringType);
  			if (!locale) return null;
  		}
  		let currency = null;
  		if (options["currency"]) {
  			currency = context.parse(options["currency"], 1, StringType);
  			if (!currency) return null;
  		}
  		let unit = null;
  		if (options["unit"]) {
  			unit = context.parse(options["unit"], 1, StringType);
  			if (!unit) return null;
  		}
  		if (currency && unit) return context.error("NumberFormat options `currency` and `unit` are mutually exclusive");
  		let minFractionDigits = null;
  		if (options["min-fraction-digits"]) {
  			minFractionDigits = context.parse(options["min-fraction-digits"], 1, NumberType);
  			if (!minFractionDigits) return null;
  		}
  		let maxFractionDigits = null;
  		if (options["max-fraction-digits"]) {
  			maxFractionDigits = context.parse(options["max-fraction-digits"], 1, NumberType);
  			if (!maxFractionDigits) return null;
  		}
  		return new NumberFormat(number, locale, currency, unit, minFractionDigits, maxFractionDigits);
  	}
  	evaluate(ctx) {
  		return new Intl.NumberFormat(this.locale ? this.locale.evaluate(ctx) : [], {
  			style: this.currency ? "currency" : this.unit ? "unit" : "decimal",
  			currency: this.currency ? this.currency.evaluate(ctx) : void 0,
  			unit: this.unit ? this.unit.evaluate(ctx) : void 0,
  			minimumFractionDigits: this.minFractionDigits ? this.minFractionDigits.evaluate(ctx) : void 0,
  			maximumFractionDigits: this.maxFractionDigits ? this.maxFractionDigits.evaluate(ctx) : void 0
  		}).format(this.number.evaluate(ctx));
  	}
  	eachChild(fn) {
  		fn(this.number);
  		if (this.locale) fn(this.locale);
  		if (this.currency) fn(this.currency);
  		if (this.unit) fn(this.unit);
  		if (this.minFractionDigits) fn(this.minFractionDigits);
  		if (this.maxFractionDigits) fn(this.maxFractionDigits);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/format.ts
  var FormatExpression = class FormatExpression {
  	constructor(sections) {
  		this.type = FormattedType;
  		this.sections = sections;
  	}
  	static parse(args, context) {
  		if (args.length < 2) return context.error("Expected at least one argument.");
  		const firstArg = args[1];
  		if (!Array.isArray(firstArg) && typeof firstArg === "object") return context.error("First argument must be an image or text section.");
  		const sections = [];
  		let nextTokenMayBeObject = false;
  		for (let i = 1; i <= args.length - 1; ++i) {
  			const arg = args[i];
  			if (nextTokenMayBeObject && typeof arg === "object" && !Array.isArray(arg)) {
  				nextTokenMayBeObject = false;
  				let scale = null;
  				if (arg["font-scale"]) {
  					scale = context.parse(arg["font-scale"], 1, NumberType);
  					if (!scale) return null;
  				}
  				let font = null;
  				if (arg["text-font"]) {
  					font = context.parse(arg["text-font"], 1, array(StringType));
  					if (!font) return null;
  				}
  				let textColor = null;
  				if (arg["text-color"]) {
  					textColor = context.parse(arg["text-color"], 1, ColorType);
  					if (!textColor) return null;
  				}
  				let verticalAlign = null;
  				if (arg["vertical-align"]) {
  					if (typeof arg["vertical-align"] === "string" && !VERTICAL_ALIGN_OPTIONS.includes(arg["vertical-align"])) return context.error(`'vertical-align' must be one of: 'bottom', 'center', 'top' but found '${arg["vertical-align"]}' instead.`);
  					verticalAlign = context.parse(arg["vertical-align"], 1, StringType);
  					if (!verticalAlign) return null;
  				}
  				const lastExpression = sections[sections.length - 1];
  				lastExpression.scale = scale;
  				lastExpression.font = font;
  				lastExpression.textColor = textColor;
  				lastExpression.verticalAlign = verticalAlign;
  			} else {
  				const content = context.parse(args[i], 1, ValueType);
  				if (!content) return null;
  				const kind = content.type.kind;
  				if (kind !== "string" && kind !== "value" && kind !== "null" && kind !== "resolvedImage") return context.error("Formatted text type must be 'string', 'value', 'image' or 'null'.");
  				nextTokenMayBeObject = true;
  				sections.push({
  					content,
  					scale: null,
  					font: null,
  					textColor: null,
  					verticalAlign: null
  				});
  			}
  		}
  		return new FormatExpression(sections);
  	}
  	evaluate(ctx) {
  		const evaluateSection = (section) => {
  			const evaluatedContent = section.content.evaluate(ctx);
  			if (typeOf(evaluatedContent) === ResolvedImageType) return new FormattedSection("", evaluatedContent, null, null, null, section.verticalAlign ? section.verticalAlign.evaluate(ctx) : null);
  			return new FormattedSection(valueToString(evaluatedContent), null, section.scale ? section.scale.evaluate(ctx) : null, section.font ? section.font.evaluate(ctx).join(",") : null, section.textColor ? section.textColor.evaluate(ctx) : null, section.verticalAlign ? section.verticalAlign.evaluate(ctx) : null);
  		};
  		return new Formatted(this.sections.map(evaluateSection));
  	}
  	eachChild(fn) {
  		for (const section of this.sections) {
  			fn(section.content);
  			if (section.scale) fn(section.scale);
  			if (section.font) fn(section.font);
  			if (section.textColor) fn(section.textColor);
  			if (section.verticalAlign) fn(section.verticalAlign);
  		}
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/image.ts
  var ImageExpression = class ImageExpression {
  	constructor(input) {
  		this.type = ResolvedImageType;
  		this.input = input;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error("Expected two arguments.");
  		const name = context.parse(args[1], 1, StringType);
  		if (!name) return context.error("No image name provided.");
  		return new ImageExpression(name);
  	}
  	evaluate(ctx) {
  		const evaluatedImageName = this.input.evaluate(ctx);
  		const value = ResolvedImage.fromString(evaluatedImageName);
  		if (value && ctx.availableImages) value.available = ctx.availableImages.indexOf(evaluatedImageName) > -1;
  		return value;
  	}
  	eachChild(fn) {
  		fn(this.input);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/length.ts
  var Length = class Length {
  	constructor(input, key) {
  		this.input = input;
  		this.key = key;
  		this.type = NumberType;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error(`Expected 1 argument, but found ${args.length - 1} instead.`);
  		const input = context.parse(args[1], 1);
  		if (!input) return null;
  		if (input.type.kind !== "array" && input.type.kind !== "string" && input.type.kind !== "value") return context.error(`Expected argument of type string or array, but found ${typeToString(input.type)} instead.`);
  		return new Length(input, context.key);
  	}
  	evaluate(ctx) {
  		const input = this.input.evaluate(ctx);
  		if (typeof input === "string") return [...input].length;
  		else if (Array.isArray(input)) return input.length;
  		else throw new RuntimeError(`Expected value to be of type string or array, but found ${typeToString(typeOf(input))} instead.`, this.key);
  	}
  	eachChild(fn) {
  		fn(this.input);
  	}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/util/geometry_util.ts
  const EXTENT = 8192;
  function getTileCoordinates(p, canonical) {
  	const x = mercatorXfromLng(p[0]);
  	const y = mercatorYfromLat(p[1]);
  	const tilesAtZoom = Math.pow(2, canonical.z);
  	return [Math.round(x * tilesAtZoom * EXTENT), Math.round(y * tilesAtZoom * EXTENT)];
  }
  function getLngLatFromTileCoord(coord, canonical) {
  	const tilesAtZoom = Math.pow(2, canonical.z);
  	const x = (coord[0] / EXTENT + canonical.x) / tilesAtZoom;
  	const y = (coord[1] / EXTENT + canonical.y) / tilesAtZoom;
  	return [lngFromMercatorXfromLng(x), latFromMercatorY(y)];
  }
  function mercatorXfromLng(lng) {
  	return (180 + lng) / 360;
  }
  function lngFromMercatorXfromLng(mercatorX) {
  	return mercatorX * 360 - 180;
  }
  function mercatorYfromLat(lat) {
  	return (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;
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
  	if (bbox1[0] <= bbox2[0]) return false;
  	if (bbox1[2] >= bbox2[2]) return false;
  	if (bbox1[1] <= bbox2[1]) return false;
  	if (bbox1[3] >= bbox2[3]) return false;
  	return true;
  }
  function rayIntersect(p, p1, p2) {
  	return p1[1] > p[1] !== p2[1] > p[1] && p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0];
  }
  function pointOnBoundary(p, p1, p2) {
  	const x1 = p[0] - p1[0];
  	const y1 = p[1] - p1[1];
  	const x2 = p[0] - p2[0];
  	const y2 = p[1] - p2[1];
  	return x1 * y2 - x2 * y1 === 0 && x1 * x2 <= 0 && y1 * y2 <= 0;
  }
  function segmentIntersectSegment(a, b, c, d) {
  	const vectorP = [b[0] - a[0], b[1] - a[1]];
  	if (perp([d[0] - c[0], d[1] - c[1]], vectorP) === 0) return false;
  	if (twoSided(a, b, c, d) && twoSided(c, d, a, b)) return true;
  	return false;
  }
  function lineIntersectPolygon(p1, p2, polygon) {
  	for (const ring of polygon) for (let j = 0; j < ring.length - 1; ++j) if (segmentIntersectSegment(p1, p2, ring[j], ring[j + 1])) return true;
  	return false;
  }
  function pointWithinPolygon(point, rings, trueIfOnBoundary = false) {
  	let inside = false;
  	for (const ring of rings) for (let j = 0; j < ring.length - 1; j++) {
  		if (pointOnBoundary(point, ring[j], ring[j + 1])) return trueIfOnBoundary;
  		if (rayIntersect(point, ring[j], ring[j + 1])) inside = !inside;
  	}
  	return inside;
  }
  function pointWithinPolygons(point, polygons) {
  	for (const polygon of polygons) if (pointWithinPolygon(point, polygon)) return true;
  	return false;
  }
  function lineStringWithinPolygon(line, polygon) {
  	for (const point of line) if (!pointWithinPolygon(point, polygon)) return false;
  	for (let i = 0; i < line.length - 1; ++i) if (lineIntersectPolygon(line[i], line[i + 1], polygon)) return false;
  	return true;
  }
  function lineStringWithinPolygons(line, polygons) {
  	for (const polygon of polygons) if (lineStringWithinPolygon(line, polygon)) return true;
  	return false;
  }
  function perp(v1, v2) {
  	return v1[0] * v2[1] - v1[1] * v2[0];
  }
  function twoSided(p1, p2, q1, q2) {
  	const x1 = p1[0] - q1[0];
  	const y1 = p1[1] - q1[1];
  	const x2 = p2[0] - q1[0];
  	const y2 = p2[1] - q1[1];
  	const x3 = q2[0] - q1[0];
  	const y3 = q2[1] - q1[1];
  	const det1 = x1 * y3 - x3 * y1;
  	const det2 = x2 * y3 - x3 * y2;
  	if (det1 > 0 && det2 < 0 || det1 < 0 && det2 > 0) return true;
  	return false;
  }
  //#endregion
  //#region src/expression/definitions/within.ts
  function getTilePolygon(coordinates, bbox, canonical) {
  	const polygon = [];
  	for (let i = 0; i < coordinates.length; i++) {
  		const ring = [];
  		for (let j = 0; j < coordinates[i].length; j++) {
  			const coord = getTileCoordinates(coordinates[i][j], canonical);
  			updateBBox(bbox, coord);
  			ring.push(coord);
  		}
  		polygon.push(ring);
  	}
  	return polygon;
  }
  function getTilePolygons(coordinates, bbox, canonical) {
  	const polygons = [];
  	for (let i = 0; i < coordinates.length; i++) {
  		const polygon = getTilePolygon(coordinates[i], bbox, canonical);
  		polygons.push(polygon);
  	}
  	return polygons;
  }
  function updatePoint(p, bbox, polyBBox, worldSize) {
  	if (p[0] < polyBBox[0] || p[0] > polyBBox[2]) {
  		const halfWorldSize = worldSize * .5;
  		let shift = p[0] - polyBBox[0] > halfWorldSize ? -worldSize : polyBBox[0] - p[0] > halfWorldSize ? worldSize : 0;
  		if (shift === 0) shift = p[0] - polyBBox[2] > halfWorldSize ? -worldSize : polyBBox[2] - p[0] > halfWorldSize ? worldSize : 0;
  		p[0] += shift;
  	}
  	updateBBox(bbox, p);
  }
  function resetBBox(bbox) {
  	bbox[0] = bbox[1] = Infinity;
  	bbox[2] = bbox[3] = -Infinity;
  }
  function getTilePoints(geometry, pointBBox, polyBBox, canonical) {
  	const worldSize = Math.pow(2, canonical.z) * EXTENT;
  	const shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
  	const tilePoints = [];
  	for (const points of geometry) for (const point of points) {
  		const p = [point.x + shifts[0], point.y + shifts[1]];
  		updatePoint(p, pointBBox, polyBBox, worldSize);
  		tilePoints.push(p);
  	}
  	return tilePoints;
  }
  function getTileLines(geometry, lineBBox, polyBBox, canonical) {
  	const worldSize = Math.pow(2, canonical.z) * EXTENT;
  	const shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
  	const tileLines = [];
  	for (const line of geometry) {
  		const tileLine = [];
  		for (const point of line) {
  			const p = [point.x + shifts[0], point.y + shifts[1]];
  			updateBBox(lineBBox, p);
  			tileLine.push(p);
  		}
  		tileLines.push(tileLine);
  	}
  	if (lineBBox[2] - lineBBox[0] <= worldSize / 2) {
  		resetBBox(lineBBox);
  		for (const line of tileLines) for (const p of line) updatePoint(p, lineBBox, polyBBox, worldSize);
  	}
  	return tileLines;
  }
  function pointsWithinPolygons(ctx, polygonGeometry) {
  	const pointBBox = [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	const polyBBox = [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	const canonical = ctx.canonicalID();
  	if (polygonGeometry.type === "Polygon") {
  		const tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
  		const tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
  		if (!boxWithinBox(pointBBox, polyBBox)) return false;
  		for (const point of tilePoints) if (!pointWithinPolygon(point, tilePolygon)) return false;
  	}
  	if (polygonGeometry.type === "MultiPolygon") {
  		const tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
  		const tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
  		if (!boxWithinBox(pointBBox, polyBBox)) return false;
  		for (const point of tilePoints) if (!pointWithinPolygons(point, tilePolygons)) return false;
  	}
  	return true;
  }
  function linesWithinPolygons(ctx, polygonGeometry) {
  	const lineBBox = [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	const polyBBox = [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	const canonical = ctx.canonicalID();
  	if (polygonGeometry.type === "Polygon") {
  		const tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
  		const tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
  		if (!boxWithinBox(lineBBox, polyBBox)) return false;
  		for (const line of tileLines) if (!lineStringWithinPolygon(line, tilePolygon)) return false;
  	}
  	if (polygonGeometry.type === "MultiPolygon") {
  		const tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
  		const tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
  		if (!boxWithinBox(lineBBox, polyBBox)) return false;
  		for (const line of tileLines) if (!lineStringWithinPolygons(line, tilePolygons)) return false;
  	}
  	return true;
  }
  var Within = class Within {
  	constructor(geojson, geometries) {
  		this.type = BooleanType;
  		this.geojson = geojson;
  		this.geometries = geometries;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error(`'within' expression requires exactly one argument, but found ${args.length - 1} instead.`);
  		if (isValue(args[1])) {
  			const geojson = args[1];
  			if (geojson.type === "FeatureCollection") {
  				const polygonsCoords = [];
  				for (const polygon of geojson.features) {
  					const { type, coordinates } = polygon.geometry;
  					if (type === "Polygon") polygonsCoords.push(coordinates);
  					if (type === "MultiPolygon") polygonsCoords.push(...coordinates);
  				}
  				if (polygonsCoords.length) return new Within(geojson, {
  					type: "MultiPolygon",
  					coordinates: polygonsCoords
  				});
  			} else if (geojson.type === "Feature") {
  				const type = geojson.geometry.type;
  				if (type === "Polygon" || type === "MultiPolygon") return new Within(geojson, geojson.geometry);
  			} else if (geojson.type === "Polygon" || geojson.type === "MultiPolygon") return new Within(geojson, geojson);
  		}
  		return context.error("'within' expression requires valid geojson object that contains polygon geometry type.");
  	}
  	evaluate(ctx) {
  		if (ctx.geometry() != null && ctx.canonicalID() != null) {
  			if (ctx.geometryType() === "Point") return pointsWithinPolygons(ctx, this.geometries);
  			else if (ctx.geometryType() === "LineString") return linesWithinPolygons(ctx, this.geometries);
  		}
  		return false;
  	}
  	eachChild() {}
  	outputDefined() {
  		return true;
  	}
  };
  //#endregion
  //#region node_modules/tinyqueue/index.js
  var TinyQueue = class {
  	constructor(data = [], compare = (a, b) => a < b ? -1 : a > b ? 1 : 0) {
  		this.data = data;
  		this.length = this.data.length;
  		this.compare = compare;
  		if (this.length > 0) for (let i = (this.length >> 1) - 1; i >= 0; i--) this._down(i);
  	}
  	push(item) {
  		this.data.push(item);
  		this._up(this.length++);
  	}
  	pop() {
  		if (this.length === 0) return void 0;
  		const top = this.data[0];
  		const bottom = this.data.pop();
  		if (--this.length > 0) {
  			this.data[0] = bottom;
  			this._down(0);
  		}
  		return top;
  	}
  	peek() {
  		return this.data[0];
  	}
  	_up(pos) {
  		const { data, compare } = this;
  		const item = data[pos];
  		while (pos > 0) {
  			const parent = pos - 1 >> 1;
  			const current = data[parent];
  			if (compare(item, current) >= 0) break;
  			data[pos] = current;
  			pos = parent;
  		}
  		data[pos] = item;
  	}
  	_down(pos) {
  		const { data, compare } = this;
  		const halfLength = this.length >> 1;
  		const item = data[pos];
  		while (pos < halfLength) {
  			let bestChild = (pos << 1) + 1;
  			const right = bestChild + 1;
  			if (right < this.length && compare(data[right], data[bestChild]) < 0) bestChild = right;
  			if (compare(data[bestChild], item) >= 0) break;
  			data[pos] = data[bestChild];
  			pos = bestChild;
  		}
  		data[pos] = item;
  	}
  };
  //#endregion
  //#region node_modules/quickselect/index.js
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
  function quickselect(arr, k, left = 0, right = arr.length - 1, compare = defaultCompare) {
  	while (right > left) {
  		if (right - left > 600) {
  			const n = right - left + 1;
  			const m = k - left + 1;
  			const z = Math.log(n);
  			const s = .5 * Math.exp(2 * z / 3);
  			const sd = .5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
  			quickselect(arr, k, Math.max(left, Math.floor(k - m * s / n + sd)), Math.min(right, Math.floor(k + (n - m) * s / n + sd)), compare);
  		}
  		const t = arr[k];
  		let i = left;
  		/** @type {number} */
  		let j = right;
  		swap(arr, left, k);
  		if (compare(arr[right], t) > 0) swap(arr, left, right);
  		while (i < j) {
  			swap(arr, i, j);
  			i++;
  			j--;
  			while (compare(arr[i], t) < 0) i++;
  			while (compare(arr[j], t) > 0) j--;
  		}
  		if (compare(arr[left], t) === 0) swap(arr, left, j);
  		else {
  			j++;
  			swap(arr, j, right);
  		}
  		if (j <= k) left = j + 1;
  		if (k <= j) right = j - 1;
  	}
  }
  /**
  * @template T
  * @param {T[]} arr
  * @param {number} i
  * @param {number} j
  */
  function swap(arr, i, j) {
  	const tmp = arr[i];
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
  //#endregion
  //#region src/util/classify_rings.ts
  /**
  * Classifies an array of rings into polygons with outer rings and holes
  * @param rings - the rings to classify
  * @param maxRings - the maximum number of rings to include in a polygon, use 0 to include all rings
  * @returns an array of polygons with internal rings as holes
  */
  function classifyRings(rings, maxRings) {
  	if (rings.length <= 1) return [rings];
  	const polygons = [];
  	let polygon;
  	let ccw;
  	for (const ring of rings) {
  		const area = calculateSignedArea(ring);
  		if (area === 0) continue;
  		ring.area = Math.abs(area);
  		if (ccw === void 0) ccw = area < 0;
  		if (ccw === area < 0) {
  			if (polygon) polygons.push(polygon);
  			polygon = [ring];
  		} else polygon.push(ring);
  	}
  	if (polygon) polygons.push(polygon);
  	if (maxRings > 1) for (let j = 0; j < polygons.length; j++) {
  		if (polygons[j].length <= maxRings) continue;
  		quickselect(polygons[j], maxRings, 1, polygons[j].length - 1, compareAreas);
  		polygons[j] = polygons[j].slice(0, maxRings);
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
  	let sum = 0;
  	for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
  		p1 = ring[i];
  		p2 = ring[j];
  		sum += (p2.x - p1.x) * (p1.y + p2.y);
  	}
  	return sum;
  }
  //#endregion
  //#region src/util/cheap_ruler.ts
  const RE = 6378.137;
  const FE = 1 / 298.257223563;
  const E2 = FE * (2 - FE);
  const RAD = Math.PI / 180;
  var CheapRuler = class {
  	constructor(lat) {
  		const m = RAD * RE * 1e3;
  		const coslat = Math.cos(lat * RAD);
  		const w2 = 1 / (1 - E2 * (1 - coslat * coslat));
  		const w = Math.sqrt(w2);
  		this.kx = m * w * coslat;
  		this.ky = m * w * w2 * (1 - E2);
  	}
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
  	distance(a, b) {
  		const dx = this.wrap(a[0] - b[0]) * this.kx;
  		const dy = (a[1] - b[1]) * this.ky;
  		return Math.sqrt(dx * dx + dy * dy);
  	}
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
  	pointOnLine(line, p) {
  		let minDist = Infinity;
  		let minX, minY, minI, minT;
  		for (let i = 0; i < line.length - 1; i++) {
  			let x = line[i][0];
  			let y = line[i][1];
  			let dx = this.wrap(line[i + 1][0] - x) * this.kx;
  			let dy = (line[i + 1][1] - y) * this.ky;
  			let t = 0;
  			if (dx !== 0 || dy !== 0) {
  				t = (this.wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);
  				if (t > 1) {
  					x = line[i + 1][0];
  					y = line[i + 1][1];
  				} else if (t > 0) {
  					x += dx / this.kx * t;
  					y += dy / this.ky * t;
  				}
  			}
  			dx = this.wrap(p[0] - x) * this.kx;
  			dy = (p[1] - y) * this.ky;
  			const sqDist = dx * dx + dy * dy;
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
  	}
  	wrap(deg) {
  		while (deg < -180) deg += 360;
  		while (deg > 180) deg -= 360;
  		return deg;
  	}
  };
  //#endregion
  //#region src/expression/definitions/distance.ts
  const MinPointsSize = 100;
  const MinLinePointsSize = 50;
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
  	if (range[0] > range[1]) return [null, null];
  	const size = getRangeSize(range);
  	if (isLine) {
  		if (size === 2) return [range, null];
  		const size1 = Math.floor(size / 2);
  		return [[range[0], range[0] + size1], [range[0] + size1, range[1]]];
  	}
  	if (size === 1) return [range, null];
  	const size1 = Math.floor(size / 2) - 1;
  	return [[range[0], range[0] + size1], [range[0] + size1 + 1, range[1]]];
  }
  function getBBox(coords, range) {
  	if (!isRangeSafe(range, coords.length)) return [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	const bbox = [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	for (let i = range[0]; i <= range[1]; ++i) updateBBox(bbox, coords[i]);
  	return bbox;
  }
  function getPolygonBBox(polygon) {
  	const bbox = [
  		Infinity,
  		Infinity,
  		-Infinity,
  		-Infinity
  	];
  	for (const ring of polygon) for (const coord of ring) updateBBox(bbox, coord);
  	return bbox;
  }
  function isValidBBox(bbox) {
  	return bbox[0] !== -Infinity && bbox[1] !== -Infinity && bbox[2] !== Infinity && bbox[3] !== Infinity;
  }
  function bboxToBBoxDistance(bbox1, bbox2, ruler) {
  	if (!isValidBBox(bbox1) || !isValidBBox(bbox2)) return NaN;
  	let dx = 0;
  	let dy = 0;
  	if (bbox1[2] < bbox2[0]) dx = bbox2[0] - bbox1[2];
  	if (bbox1[0] > bbox2[2]) dx = bbox1[0] - bbox2[2];
  	if (bbox1[1] > bbox2[3]) dy = bbox1[1] - bbox2[3];
  	if (bbox1[3] < bbox2[1]) dy = bbox2[1] - bbox1[3];
  	return ruler.distance([0, 0], [dx, dy]);
  }
  function pointToLineDistance(point, line, ruler) {
  	const nearestPoint = ruler.pointOnLine(line, point);
  	return ruler.distance(point, nearestPoint.point);
  }
  function segmentToSegmentDistance(p1, p2, q1, q2, ruler) {
  	const dist1 = Math.min(pointToLineDistance(p1, [q1, q2], ruler), pointToLineDistance(p2, [q1, q2], ruler));
  	const dist2 = Math.min(pointToLineDistance(q1, [p1, p2], ruler), pointToLineDistance(q2, [p1, p2], ruler));
  	return Math.min(dist1, dist2);
  }
  function lineToLineDistance(line1, range1, line2, range2, ruler) {
  	if (!(isRangeSafe(range1, line1.length) && isRangeSafe(range2, line2.length))) return Infinity;
  	let dist = Infinity;
  	for (let i = range1[0]; i < range1[1]; ++i) {
  		const p1 = line1[i];
  		const p2 = line1[i + 1];
  		for (let j = range2[0]; j < range2[1]; ++j) {
  			const q1 = line2[j];
  			const q2 = line2[j + 1];
  			if (segmentIntersectSegment(p1, p2, q1, q2)) return 0;
  			dist = Math.min(dist, segmentToSegmentDistance(p1, p2, q1, q2, ruler));
  		}
  	}
  	return dist;
  }
  function pointsToPointsDistance(points1, range1, points2, range2, ruler) {
  	if (!(isRangeSafe(range1, points1.length) && isRangeSafe(range2, points2.length))) return NaN;
  	let dist = Infinity;
  	for (let i = range1[0]; i <= range1[1]; ++i) for (let j = range2[0]; j <= range2[1]; ++j) {
  		dist = Math.min(dist, ruler.distance(points1[i], points2[j]));
  		if (dist === 0) return dist;
  	}
  	return dist;
  }
  function pointToPolygonDistance(point, polygon, ruler) {
  	if (pointWithinPolygon(point, polygon, true)) return 0;
  	let dist = Infinity;
  	for (const ring of polygon) {
  		const front = ring[0];
  		const back = ring[ring.length - 1];
  		if (front !== back) {
  			dist = Math.min(dist, pointToLineDistance(point, [back, front], ruler));
  			if (dist === 0) return dist;
  		}
  		const nearestPoint = ruler.pointOnLine(ring, point);
  		dist = Math.min(dist, ruler.distance(point, nearestPoint.point));
  		if (dist === 0) return dist;
  	}
  	return dist;
  }
  function lineToPolygonDistance(line, range, polygon, ruler) {
  	if (!isRangeSafe(range, line.length)) return NaN;
  	for (let i = range[0]; i <= range[1]; ++i) if (pointWithinPolygon(line[i], polygon, true)) return 0;
  	let dist = Infinity;
  	for (let i = range[0]; i < range[1]; ++i) {
  		const p1 = line[i];
  		const p2 = line[i + 1];
  		for (const ring of polygon) for (let j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
  			const q1 = ring[k];
  			const q2 = ring[j];
  			if (segmentIntersectSegment(p1, p2, q1, q2)) return 0;
  			dist = Math.min(dist, segmentToSegmentDistance(p1, p2, q1, q2, ruler));
  		}
  	}
  	return dist;
  }
  function polygonIntersect(poly1, poly2) {
  	for (const ring of poly1) for (const point of ring) if (pointWithinPolygon(point, poly2, true)) return true;
  	return false;
  }
  function polygonToPolygonDistance(polygon1, polygon2, ruler, currentMiniDist = Infinity) {
  	const bbox1 = getPolygonBBox(polygon1);
  	const bbox2 = getPolygonBBox(polygon2);
  	if (currentMiniDist !== Infinity && bboxToBBoxDistance(bbox1, bbox2, ruler) >= currentMiniDist) return currentMiniDist;
  	if (boxWithinBox(bbox1, bbox2)) {
  		if (polygonIntersect(polygon1, polygon2)) return 0;
  	} else if (polygonIntersect(polygon2, polygon1)) return 0;
  	let dist = Infinity;
  	for (const ring1 of polygon1) for (let i = 0, len1 = ring1.length, l = len1 - 1; i < len1; l = i++) {
  		const p1 = ring1[l];
  		const p2 = ring1[i];
  		for (const ring2 of polygon2) for (let j = 0, len2 = ring2.length, k = len2 - 1; j < len2; k = j++) {
  			const q1 = ring2[k];
  			const q2 = ring2[j];
  			if (segmentIntersectSegment(p1, p2, q1, q2)) return 0;
  			dist = Math.min(dist, segmentToSegmentDistance(p1, p2, q1, q2, ruler));
  		}
  	}
  	return dist;
  }
  function updateQueue(distQueue, miniDist, ruler, points, polyBBox, rangeA) {
  	if (!rangeA) return;
  	const tempDist = bboxToBBoxDistance(getBBox(points, rangeA), polyBBox, ruler);
  	if (tempDist < miniDist) distQueue.push([
  		tempDist,
  		rangeA,
  		[0, 0]
  	]);
  }
  function updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, range1, range2) {
  	if (!range1 || !range2) return;
  	const tempDist = bboxToBBoxDistance(getBBox(pointSet1, range1), getBBox(pointSet2, range2), ruler);
  	if (tempDist < miniDist) distQueue.push([
  		tempDist,
  		range1,
  		range2
  	]);
  }
  function pointsToPolygonDistance(points, isLine, polygon, ruler, currentMiniDist = Infinity) {
  	let miniDist = Math.min(ruler.distance(points[0], polygon[0][0]), currentMiniDist);
  	if (miniDist === 0) return miniDist;
  	const distQueue = new TinyQueue([[
  		0,
  		[0, points.length - 1],
  		[0, 0]
  	]], compareDistPair);
  	const polyBBox = getPolygonBBox(polygon);
  	while (distQueue.length > 0) {
  		const distPair = distQueue.pop();
  		if (distPair[0] >= miniDist) continue;
  		const range = distPair[1];
  		const threshold = isLine ? MinLinePointsSize : MinPointsSize;
  		if (getRangeSize(range) <= threshold) {
  			if (!isRangeSafe(range, points.length)) return NaN;
  			if (isLine) {
  				const tempDist = lineToPolygonDistance(points, range, polygon, ruler);
  				if (isNaN(tempDist) || tempDist === 0) return tempDist;
  				miniDist = Math.min(miniDist, tempDist);
  			} else for (let i = range[0]; i <= range[1]; ++i) {
  				const tempDist = pointToPolygonDistance(points[i], polygon, ruler);
  				miniDist = Math.min(miniDist, tempDist);
  				if (miniDist === 0) return 0;
  			}
  		} else {
  			const newRangesA = splitRange(range, isLine);
  			updateQueue(distQueue, miniDist, ruler, points, polyBBox, newRangesA[0]);
  			updateQueue(distQueue, miniDist, ruler, points, polyBBox, newRangesA[1]);
  		}
  	}
  	return miniDist;
  }
  function pointSetToPointSetDistance(pointSet1, isLine1, pointSet2, isLine2, ruler, currentMiniDist = Infinity) {
  	let miniDist = Math.min(currentMiniDist, ruler.distance(pointSet1[0], pointSet2[0]));
  	if (miniDist === 0) return miniDist;
  	const distQueue = new TinyQueue([[
  		0,
  		[0, pointSet1.length - 1],
  		[0, pointSet2.length - 1]
  	]], compareDistPair);
  	while (distQueue.length > 0) {
  		const distPair = distQueue.pop();
  		if (distPair[0] >= miniDist) continue;
  		const rangeA = distPair[1];
  		const rangeB = distPair[2];
  		const threshold1 = isLine1 ? MinLinePointsSize : MinPointsSize;
  		const threshold2 = isLine2 ? MinLinePointsSize : MinPointsSize;
  		if (getRangeSize(rangeA) <= threshold1 && getRangeSize(rangeB) <= threshold2) {
  			if (!isRangeSafe(rangeA, pointSet1.length) && isRangeSafe(rangeB, pointSet2.length)) return NaN;
  			let tempDist;
  			if (isLine1 && isLine2) {
  				tempDist = lineToLineDistance(pointSet1, rangeA, pointSet2, rangeB, ruler);
  				miniDist = Math.min(miniDist, tempDist);
  			} else if (isLine1 && !isLine2) {
  				const sublibe = pointSet1.slice(rangeA[0], rangeA[1] + 1);
  				for (let i = rangeB[0]; i <= rangeB[1]; ++i) {
  					tempDist = pointToLineDistance(pointSet2[i], sublibe, ruler);
  					miniDist = Math.min(miniDist, tempDist);
  					if (miniDist === 0) return miniDist;
  				}
  			} else if (!isLine1 && isLine2) {
  				const sublibe = pointSet2.slice(rangeB[0], rangeB[1] + 1);
  				for (let i = rangeA[0]; i <= rangeA[1]; ++i) {
  					tempDist = pointToLineDistance(pointSet1[i], sublibe, ruler);
  					miniDist = Math.min(miniDist, tempDist);
  					if (miniDist === 0) return miniDist;
  				}
  			} else {
  				tempDist = pointsToPointsDistance(pointSet1, rangeA, pointSet2, rangeB, ruler);
  				miniDist = Math.min(miniDist, tempDist);
  			}
  		} else {
  			const newRangesA = splitRange(rangeA, isLine1);
  			const newRangesB = splitRange(rangeB, isLine2);
  			updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[0], newRangesB[0]);
  			updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[0], newRangesB[1]);
  			updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[1], newRangesB[0]);
  			updateQueueTwoSets(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[1], newRangesB[1]);
  		}
  	}
  	return miniDist;
  }
  function pointToGeometryDistance(ctx, geometries) {
  	const tilePoints = ctx.geometry();
  	const pointPosition = tilePoints.flat().map((p) => getLngLatFromTileCoord([p.x, p.y], ctx.canonical));
  	if (tilePoints.length === 0) return NaN;
  	const ruler = new CheapRuler(pointPosition[0][1]);
  	let dist = Infinity;
  	for (const geometry of geometries) {
  		switch (geometry.type) {
  			case "Point":
  				dist = Math.min(dist, pointSetToPointSetDistance(pointPosition, false, [geometry.coordinates], false, ruler, dist));
  				break;
  			case "LineString":
  				dist = Math.min(dist, pointSetToPointSetDistance(pointPosition, false, geometry.coordinates, true, ruler, dist));
  				break;
  			case "Polygon":
  				dist = Math.min(dist, pointsToPolygonDistance(pointPosition, false, geometry.coordinates, ruler, dist));
  				break;
  		}
  		if (dist === 0) return dist;
  	}
  	return dist;
  }
  function lineStringToGeometryDistance(ctx, geometries) {
  	const tileLine = ctx.geometry();
  	const linePositions = tileLine.flat().map((p) => getLngLatFromTileCoord([p.x, p.y], ctx.canonical));
  	if (tileLine.length === 0) return NaN;
  	const ruler = new CheapRuler(linePositions[0][1]);
  	let dist = Infinity;
  	for (const geometry of geometries) {
  		switch (geometry.type) {
  			case "Point":
  				dist = Math.min(dist, pointSetToPointSetDistance(linePositions, true, [geometry.coordinates], false, ruler, dist));
  				break;
  			case "LineString":
  				dist = Math.min(dist, pointSetToPointSetDistance(linePositions, true, geometry.coordinates, true, ruler, dist));
  				break;
  			case "Polygon":
  				dist = Math.min(dist, pointsToPolygonDistance(linePositions, true, geometry.coordinates, ruler, dist));
  				break;
  		}
  		if (dist === 0) return dist;
  	}
  	return dist;
  }
  function polygonToGeometryDistance(ctx, geometries) {
  	const tilePolygon = ctx.geometry();
  	if (tilePolygon.length === 0 || tilePolygon[0].length === 0) return NaN;
  	const polygons = classifyRings(tilePolygon, 0).map((polygon) => {
  		return polygon.map((ring) => {
  			return ring.map((p) => getLngLatFromTileCoord([p.x, p.y], ctx.canonical));
  		});
  	});
  	const ruler = new CheapRuler(polygons[0][0][0][1]);
  	let dist = Infinity;
  	for (const geometry of geometries) for (const polygon of polygons) {
  		switch (geometry.type) {
  			case "Point":
  				dist = Math.min(dist, pointsToPolygonDistance([geometry.coordinates], false, polygon, ruler, dist));
  				break;
  			case "LineString":
  				dist = Math.min(dist, pointsToPolygonDistance(geometry.coordinates, true, polygon, ruler, dist));
  				break;
  			case "Polygon":
  				dist = Math.min(dist, polygonToPolygonDistance(polygon, geometry.coordinates, ruler, dist));
  				break;
  		}
  		if (dist === 0) return dist;
  	}
  	return dist;
  }
  function toSimpleGeometry(geometry) {
  	if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => {
  		return {
  			type: "Polygon",
  			coordinates: polygon
  		};
  	});
  	if (geometry.type === "MultiLineString") return geometry.coordinates.map((lineString) => {
  		return {
  			type: "LineString",
  			coordinates: lineString
  		};
  	});
  	if (geometry.type === "MultiPoint") return geometry.coordinates.map((point) => {
  		return {
  			type: "Point",
  			coordinates: point
  		};
  	});
  	return [geometry];
  }
  var Distance = class Distance {
  	constructor(geojson, geometries) {
  		this.type = NumberType;
  		this.geojson = geojson;
  		this.geometries = geometries;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error(`'distance' expression requires exactly one argument, but found ${args.length - 1} instead.`);
  		if (isValue(args[1])) {
  			const geojson = args[1];
  			if (geojson.type === "FeatureCollection") return new Distance(geojson, geojson.features.map((feature) => toSimpleGeometry(feature.geometry)).flat());
  			else if (geojson.type === "Feature") return new Distance(geojson, toSimpleGeometry(geojson.geometry));
  			else if ("type" in geojson && "coordinates" in geojson) return new Distance(geojson, toSimpleGeometry(geojson));
  		}
  		return context.error("'distance' expression requires valid geojson object that contains polygon geometry type.");
  	}
  	evaluate(ctx) {
  		if (ctx.geometry() != null && ctx.canonicalID() != null) {
  			if (ctx.geometryType() === "Point") return pointToGeometryDistance(ctx, this.geometries);
  			else if (ctx.geometryType() === "LineString") return lineStringToGeometryDistance(ctx, this.geometries);
  			else if (ctx.geometryType() === "Polygon") return polygonToGeometryDistance(ctx, this.geometries);
  		}
  		return NaN;
  	}
  	eachChild() {}
  	outputDefined() {
  		return true;
  	}
  };
  //#endregion
  //#region src/expression/definitions/global_state.ts
  var GlobalState = class GlobalState {
  	constructor(key) {
  		this.key = key;
  		this.type = ValueType;
  	}
  	static parse(args, context) {
  		if (args.length !== 2) return context.error(`Expected 1 argument, but found ${args.length - 1} instead.`);
  		const key = args[1];
  		if (key === void 0 || key === null) return context.error("Global state property must be defined.");
  		if (typeof key !== "string") return context.error(`Global state property must be string, but found ${typeof args[1]} instead.`);
  		return new GlobalState(key);
  	}
  	evaluate(ctx) {
  		const globalState = ctx.globals?.globalState;
  		if (!globalState || Object.keys(globalState).length === 0) return null;
  		return getOwn(globalState, this.key) ?? null;
  	}
  	eachChild() {}
  	outputDefined() {
  		return false;
  	}
  };
  //#endregion
  //#region src/expression/definitions/index.ts
  const expressions = {
  	"==": Equals,
  	"!=": NotEquals,
  	">": GreaterThan,
  	"<": LessThan,
  	">=": GreaterThanOrEqual,
  	"<=": LessThanOrEqual,
  	array: Assertion,
  	at: At,
  	boolean: Assertion,
  	case: Case,
  	coalesce: Coalesce,
  	collator: CollatorExpression,
  	format: FormatExpression,
  	image: ImageExpression,
  	in: In,
  	"index-of": IndexOf,
  	interpolate: Interpolate,
  	"interpolate-hcl": Interpolate,
  	"interpolate-lab": Interpolate,
  	length: Length,
  	let: Let,
  	literal: Literal,
  	match: Match,
  	number: Assertion,
  	"number-format": NumberFormat,
  	object: Assertion,
  	slice: Slice,
  	step: Step,
  	string: Assertion,
  	"to-boolean": Coercion,
  	"to-color": Coercion,
  	"to-number": Coercion,
  	"to-string": Coercion,
  	var: Var,
  	within: Within,
  	distance: Distance,
  	"global-state": GlobalState
  };
  //#endregion
  //#region src/expression/compound_expression.ts
  var CompoundExpression = class CompoundExpression {
  	constructor(name, type, evaluate, args, key) {
  		this.name = name;
  		this.type = type;
  		this._evaluate = evaluate;
  		this.args = args;
  		this.key = key;
  	}
  	evaluate(ctx) {
  		return this._evaluate(ctx, this.args, this.key);
  	}
  	eachChild(fn) {
  		this.args.forEach(fn);
  	}
  	outputDefined() {
  		return false;
  	}
  	static parse(args, context) {
  		const op = args[0];
  		const definition = CompoundExpression.definitions[op];
  		if (!definition) return context.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
  		const type = Array.isArray(definition) ? definition[0] : definition.type;
  		const availableOverloads = Array.isArray(definition) ? [[definition[1], definition[2]]] : definition.overloads;
  		const overloads = availableOverloads.filter(([signature]) => !Array.isArray(signature) || signature.length === args.length - 1);
  		let signatureContext = null;
  		for (const [params, evaluate] of overloads) {
  			signatureContext = new ParsingContext(context.registry, isExpressionConstant, context.path, null, context.scope);
  			const parsedArgs = [];
  			let argParseFailed = false;
  			for (let i = 1; i < args.length; i++) {
  				const arg = args[i];
  				const expectedType = Array.isArray(params) ? params[i - 1] : params.type;
  				const parsed = signatureContext.parse(arg, 1 + parsedArgs.length, expectedType);
  				if (!parsed) {
  					argParseFailed = true;
  					break;
  				}
  				parsedArgs.push(parsed);
  			}
  			if (argParseFailed) continue;
  			if (Array.isArray(params)) {
  				if (params.length !== parsedArgs.length) {
  					signatureContext.error(`Expected ${params.length} arguments, but found ${parsedArgs.length} instead.`);
  					continue;
  				}
  			}
  			for (let i = 0; i < parsedArgs.length; i++) {
  				const expected = Array.isArray(params) ? params[i] : params.type;
  				const arg = parsedArgs[i];
  				signatureContext.concat(i + 1).checkSubtype(expected, arg.type);
  			}
  			if (signatureContext.errors.length === 0) return new CompoundExpression(op, type, evaluate, parsedArgs, context.key);
  		}
  		if (overloads.length === 1) context.errors.push(...signatureContext.errors);
  		else {
  			const signatures = (overloads.length ? overloads : availableOverloads).map(([params]) => stringifySignature(params)).join(" | ");
  			const actualTypes = [];
  			for (let i = 1; i < args.length; i++) {
  				const parsed = context.parse(args[i], 1 + actualTypes.length);
  				if (!parsed) return null;
  				actualTypes.push(typeToString(parsed.type));
  			}
  			context.error(`Expected arguments of type ${signatures}, but found (${actualTypes.join(", ")}) instead.`);
  		}
  		return null;
  	}
  	static register(registry, definitions) {
  		CompoundExpression.definitions = definitions;
  		for (const name in definitions) registry[name] = CompoundExpression;
  	}
  };
  function rgba(ctx, [r, g, b, a], key) {
  	r = r.evaluate(ctx);
  	g = g.evaluate(ctx);
  	b = b.evaluate(ctx);
  	const alpha = a ? a.evaluate(ctx) : 1;
  	const error = validateRGBA(r, g, b, alpha);
  	if (error) throw new RuntimeError(error, key);
  	return new Color(r / 255, g / 255, b / 255, alpha, false);
  }
  function has(key, obj) {
  	return key in obj && obj[key] !== void 0;
  }
  function get(key, obj) {
  	const v = obj[key];
  	return typeof v === "undefined" ? null : v;
  }
  function binarySearch(v, a, i, j) {
  	while (i <= j) {
  		const m = i + j >> 1;
  		if (a[m] === v) return true;
  		if (a[m] > v) j = m - 1;
  		else i = m + 1;
  	}
  	return false;
  }
  function varargs(type) {
  	return { type };
  }
  CompoundExpression.register(expressions, {
  	error: [
  		ErrorType,
  		[StringType],
  		(ctx, [v], key) => {
  			throw new RuntimeError(v.evaluate(ctx), key);
  		}
  	],
  	typeof: [
  		StringType,
  		[ValueType],
  		(ctx, [v]) => typeToString(typeOf(v.evaluate(ctx)))
  	],
  	"to-rgba": [
  		array(NumberType, 4),
  		[ColorType],
  		(ctx, [v]) => {
  			const [r, g, b, a] = v.evaluate(ctx).rgb;
  			return [
  				r * 255,
  				g * 255,
  				b * 255,
  				a
  			];
  		}
  	],
  	rgb: [
  		ColorType,
  		[
  			NumberType,
  			NumberType,
  			NumberType
  		],
  		rgba
  	],
  	rgba: [
  		ColorType,
  		[
  			NumberType,
  			NumberType,
  			NumberType,
  			NumberType
  		],
  		rgba
  	],
  	has: {
  		type: BooleanType,
  		overloads: [[[StringType], (ctx, [key]) => has(key.evaluate(ctx), ctx.properties())], [[StringType, ObjectType], (ctx, [key, obj]) => has(key.evaluate(ctx), obj.evaluate(ctx))]]
  	},
  	get: {
  		type: ValueType,
  		overloads: [[[StringType], (ctx, [key]) => get(key.evaluate(ctx), ctx.properties())], [[StringType, ObjectType], (ctx, [key, obj]) => get(key.evaluate(ctx), obj.evaluate(ctx))]]
  	},
  	"feature-state": [
  		ValueType,
  		[StringType],
  		(ctx, [key]) => get(key.evaluate(ctx), ctx.featureState || {})
  	],
  	properties: [
  		ObjectType,
  		[],
  		(ctx) => ctx.properties()
  	],
  	"geometry-type": [
  		StringType,
  		[],
  		(ctx) => ctx.geometryType()
  	],
  	id: [
  		ValueType,
  		[],
  		(ctx) => ctx.id()
  	],
  	zoom: [
  		NumberType,
  		[],
  		(ctx) => ctx.globals.zoom
  	],
  	"heatmap-density": [
  		NumberType,
  		[],
  		(ctx) => ctx.globals.heatmapDensity || 0
  	],
  	elevation: [
  		NumberType,
  		[],
  		(ctx) => ctx.globals.elevation || 0
  	],
  	"line-progress": [
  		NumberType,
  		[],
  		(ctx) => ctx.globals.lineProgress || 0
  	],
  	accumulated: [
  		ValueType,
  		[],
  		(ctx) => ctx.globals.accumulated === void 0 ? null : ctx.globals.accumulated
  	],
  	"+": [
  		NumberType,
  		varargs(NumberType),
  		(ctx, args) => {
  			let result = 0;
  			for (const arg of args) result += arg.evaluate(ctx);
  			return result;
  		}
  	],
  	"*": [
  		NumberType,
  		varargs(NumberType),
  		(ctx, args) => {
  			let result = 1;
  			for (const arg of args) result *= arg.evaluate(ctx);
  			return result;
  		}
  	],
  	"-": {
  		type: NumberType,
  		overloads: [[[NumberType, NumberType], (ctx, [a, b]) => a.evaluate(ctx) - b.evaluate(ctx)], [[NumberType], (ctx, [a]) => -a.evaluate(ctx)]]
  	},
  	"/": [
  		NumberType,
  		[NumberType, NumberType],
  		(ctx, [a, b]) => a.evaluate(ctx) / b.evaluate(ctx)
  	],
  	"%": [
  		NumberType,
  		[NumberType, NumberType],
  		(ctx, [a, b]) => a.evaluate(ctx) % b.evaluate(ctx)
  	],
  	ln2: [
  		NumberType,
  		[],
  		() => Math.LN2
  	],
  	pi: [
  		NumberType,
  		[],
  		() => Math.PI
  	],
  	e: [
  		NumberType,
  		[],
  		() => Math.E
  	],
  	"^": [
  		NumberType,
  		[NumberType, NumberType],
  		(ctx, [b, e]) => Math.pow(b.evaluate(ctx), e.evaluate(ctx))
  	],
  	sqrt: [
  		NumberType,
  		[NumberType],
  		(ctx, [x]) => Math.sqrt(x.evaluate(ctx))
  	],
  	log10: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN10
  	],
  	ln: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.log(n.evaluate(ctx))
  	],
  	log2: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN2
  	],
  	sin: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.sin(n.evaluate(ctx))
  	],
  	cos: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.cos(n.evaluate(ctx))
  	],
  	tan: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.tan(n.evaluate(ctx))
  	],
  	asin: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.asin(n.evaluate(ctx))
  	],
  	acos: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.acos(n.evaluate(ctx))
  	],
  	atan: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.atan(n.evaluate(ctx))
  	],
  	min: [
  		NumberType,
  		varargs(NumberType),
  		(ctx, args) => Math.min(...args.map((arg) => arg.evaluate(ctx)))
  	],
  	max: [
  		NumberType,
  		varargs(NumberType),
  		(ctx, args) => Math.max(...args.map((arg) => arg.evaluate(ctx)))
  	],
  	abs: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.abs(n.evaluate(ctx))
  	],
  	round: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => {
  			const v = n.evaluate(ctx);
  			return v < 0 ? -Math.round(-v) : Math.round(v);
  		}
  	],
  	floor: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.floor(n.evaluate(ctx))
  	],
  	ceil: [
  		NumberType,
  		[NumberType],
  		(ctx, [n]) => Math.ceil(n.evaluate(ctx))
  	],
  	"filter-==": [
  		BooleanType,
  		[StringType, ValueType],
  		(ctx, [k, v]) => ctx.properties()[k.value] === v.value
  	],
  	"filter-id-==": [
  		BooleanType,
  		[ValueType],
  		(ctx, [v]) => ctx.id() === v.value
  	],
  	"filter-type-==": [
  		BooleanType,
  		[StringType],
  		(ctx, [v]) => ctx.geometryType() === v.value
  	],
  	"filter-<": [
  		BooleanType,
  		[StringType, ValueType],
  		(ctx, [k, v]) => {
  			const a = ctx.properties()[k.value];
  			const b = v.value;
  			return typeof a === typeof b && a < b;
  		}
  	],
  	"filter-id-<": [
  		BooleanType,
  		[ValueType],
  		(ctx, [v]) => {
  			const a = ctx.id();
  			const b = v.value;
  			return typeof a === typeof b && a < b;
  		}
  	],
  	"filter->": [
  		BooleanType,
  		[StringType, ValueType],
  		(ctx, [k, v]) => {
  			const a = ctx.properties()[k.value];
  			const b = v.value;
  			return typeof a === typeof b && a > b;
  		}
  	],
  	"filter-id->": [
  		BooleanType,
  		[ValueType],
  		(ctx, [v]) => {
  			const a = ctx.id();
  			const b = v.value;
  			return typeof a === typeof b && a > b;
  		}
  	],
  	"filter-<=": [
  		BooleanType,
  		[StringType, ValueType],
  		(ctx, [k, v]) => {
  			const a = ctx.properties()[k.value];
  			const b = v.value;
  			return typeof a === typeof b && a <= b;
  		}
  	],
  	"filter-id-<=": [
  		BooleanType,
  		[ValueType],
  		(ctx, [v]) => {
  			const a = ctx.id();
  			const b = v.value;
  			return typeof a === typeof b && a <= b;
  		}
  	],
  	"filter->=": [
  		BooleanType,
  		[StringType, ValueType],
  		(ctx, [k, v]) => {
  			const a = ctx.properties()[k.value];
  			const b = v.value;
  			return typeof a === typeof b && a >= b;
  		}
  	],
  	"filter-id->=": [
  		BooleanType,
  		[ValueType],
  		(ctx, [v]) => {
  			const a = ctx.id();
  			const b = v.value;
  			return typeof a === typeof b && a >= b;
  		}
  	],
  	"filter-has": [
  		BooleanType,
  		[ValueType],
  		(ctx, [k]) => {
  			const key = k.value;
  			const props = ctx.properties();
  			return key in props && props[key] !== void 0;
  		}
  	],
  	"filter-has-id": [
  		BooleanType,
  		[],
  		(ctx) => ctx.id() !== null && ctx.id() !== void 0
  	],
  	"filter-type-in": [
  		BooleanType,
  		[array(StringType)],
  		(ctx, [v]) => v.value.indexOf(ctx.geometryType()) >= 0
  	],
  	"filter-id-in": [
  		BooleanType,
  		[array(ValueType)],
  		(ctx, [v]) => v.value.indexOf(ctx.id()) >= 0
  	],
  	"filter-in-small": [
  		BooleanType,
  		[StringType, array(ValueType)],
  		(ctx, [k, v]) => v.value.indexOf(ctx.properties()[k.value]) >= 0
  	],
  	"filter-in-large": [
  		BooleanType,
  		[StringType, array(ValueType)],
  		(ctx, [k, v]) => binarySearch(ctx.properties()[k.value], v.value, 0, v.value.length - 1)
  	],
  	all: {
  		type: BooleanType,
  		overloads: [[[BooleanType, BooleanType], (ctx, [a, b]) => a.evaluate(ctx) && b.evaluate(ctx)], [varargs(BooleanType), (ctx, args) => {
  			for (const arg of args) if (!arg.evaluate(ctx)) return false;
  			return true;
  		}]]
  	},
  	any: {
  		type: BooleanType,
  		overloads: [[[BooleanType, BooleanType], (ctx, [a, b]) => a.evaluate(ctx) || b.evaluate(ctx)], [varargs(BooleanType), (ctx, args) => {
  			for (const arg of args) if (arg.evaluate(ctx)) return true;
  			return false;
  		}]]
  	},
  	"!": [
  		BooleanType,
  		[BooleanType],
  		(ctx, [b]) => !b.evaluate(ctx)
  	],
  	"is-supported-script": [
  		BooleanType,
  		[StringType],
  		(ctx, [s]) => {
  			const isSupportedScript = ctx.globals && ctx.globals.isSupportedScript;
  			if (isSupportedScript) return isSupportedScript(s.evaluate(ctx));
  			return true;
  		}
  	],
  	upcase: [
  		StringType,
  		[StringType],
  		(ctx, [s]) => s.evaluate(ctx).toUpperCase()
  	],
  	downcase: [
  		StringType,
  		[StringType],
  		(ctx, [s]) => s.evaluate(ctx).toLowerCase()
  	],
  	concat: [
  		StringType,
  		varargs(ValueType),
  		(ctx, args) => args.map((arg) => valueToString(arg.evaluate(ctx))).join("")
  	],
  	split: [
  		array(StringType),
  		[StringType, StringType],
  		(ctx, [s, delim]) => s.evaluate(ctx).split(delim.evaluate(ctx))
  	],
  	join: [
  		StringType,
  		[array(StringType), StringType],
  		(ctx, [arr, delim]) => arr.evaluate(ctx).join(delim.evaluate(ctx))
  	],
  	"resolved-locale": [
  		StringType,
  		[CollatorType],
  		(ctx, [collator]) => collator.evaluate(ctx).resolvedLocale()
  	]
  });
  function stringifySignature(signature) {
  	if (Array.isArray(signature)) return `(${signature.map(typeToString).join(", ")})`;
  	else return `(${typeToString(signature.type)}...)`;
  }
  function isExpressionConstant(expression) {
  	if (expression instanceof Var) return isExpressionConstant(expression.boundExpression);
  	else if (expression instanceof CompoundExpression && expression.name === "error") return false;
  	else if (expression instanceof CollatorExpression) return false;
  	else if (expression instanceof Within) return false;
  	else if (expression instanceof Distance) return false;
  	else if (expression instanceof GlobalState) return false;
  	const isTypeAnnotation = expression instanceof Coercion || expression instanceof Assertion;
  	let childrenConstant = true;
  	expression.eachChild((child) => {
  		if (isTypeAnnotation) childrenConstant = childrenConstant && isExpressionConstant(child);
  		else childrenConstant = childrenConstant && child instanceof Literal;
  	});
  	if (!childrenConstant) return false;
  	return isFeatureConstant(expression) && isGlobalPropertyConstant(expression, [
  		"zoom",
  		"heatmap-density",
  		"elevation",
  		"line-progress",
  		"accumulated",
  		"is-supported-script"
  	]);
  }
  function isFeatureConstant(e) {
  	if (e instanceof CompoundExpression) {
  		if (e.name === "get" && e.args.length === 1) return false;
  		else if (e.name === "feature-state") return false;
  		else if (e.name === "has" && e.args.length === 1) return false;
  		else if (e.name === "properties" || e.name === "geometry-type" || e.name === "id") return false;
  		else if (/^filter-/.test(e.name)) return false;
  	}
  	if (e instanceof Within) return false;
  	if (e instanceof Distance) return false;
  	let result = true;
  	e.eachChild((arg) => {
  		if (result && !isFeatureConstant(arg)) result = false;
  	});
  	return result;
  }
  function isStateConstant(e) {
  	if (e instanceof CompoundExpression) {
  		if (e.name === "feature-state") return false;
  	}
  	let result = true;
  	e.eachChild((arg) => {
  		if (result && !isStateConstant(arg)) result = false;
  	});
  	return result;
  }
  function isGlobalPropertyConstant(e, properties) {
  	if (e instanceof CompoundExpression && properties.indexOf(e.name) >= 0) return false;
  	let result = true;
  	e.eachChild((arg) => {
  		if (result && !isGlobalPropertyConstant(arg, properties)) result = false;
  	});
  	return result;
  }
  //#endregion
  //#region src/util/result.ts
  function success(value) {
  	return {
  		result: "success",
  		value
  	};
  }
  function error(value) {
  	return {
  		result: "error",
  		value
  	};
  }
  //#endregion
  //#region src/util/properties.ts
  function supportsPropertyExpression(spec) {
  	return spec["property-type"] === "data-driven" || spec["property-type"] === "cross-faded-data-driven";
  }
  function supportsZoomExpression(spec) {
  	return !!spec.expression && spec.expression.parameters.indexOf("zoom") > -1;
  }
  function supportsInterpolation(spec) {
  	return !!spec.expression && spec.expression.interpolated;
  }
  //#endregion
  //#region src/util/extend.ts
  function extendBy(output, ...inputs) {
  	for (const input of inputs) for (const k in input) output[k] = input[k];
  	return output;
  }
  //#endregion
  //#region src/util/get_type.ts
  function getType(val) {
  	if (val instanceof Number) return "number";
  	else if (val instanceof String) return "string";
  	else if (val instanceof Boolean) return "boolean";
  	else if (Array.isArray(val)) return "array";
  	else if (val === null) return "null";
  	else return typeof val;
  }
  //#endregion
  //#region src/function/index.ts
  function isFunction(value) {
  	return typeof value === "object" && value !== null && !Array.isArray(value) && typeOf(value) === ObjectType;
  }
  function identityFunction(x) {
  	return x;
  }
  function getParseFunction(propertySpec) {
  	switch (propertySpec.type) {
  		case "color": return Color.parse;
  		case "padding": return Padding.parse;
  		case "numberArray": return NumberArray.parse;
  		case "colorArray": return ColorArray.parse;
  		default: return null;
  	}
  }
  function getInnerFunction(type) {
  	switch (type) {
  		case "exponential": return evaluateExponentialFunction;
  		case "interval": return evaluateIntervalFunction;
  		case "categorical": return evaluateCategoricalFunction;
  		case "identity": return evaluateIdentityFunction;
  		default: throw new Error(`Unknown function type "${type}"`);
  	}
  }
  function createFunction(parameters, propertySpec) {
  	const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === "object";
  	const featureDependent = zoomAndFeatureDependent || parameters.property !== void 0;
  	const zoomDependent = zoomAndFeatureDependent || !featureDependent;
  	const type = parameters.type || (supportsInterpolation(propertySpec) ? "exponential" : "interval");
  	const parseFn = getParseFunction(propertySpec);
  	if (parseFn) {
  		parameters = extendBy({}, parameters);
  		if (parameters.stops) parameters.stops = parameters.stops.map((stop) => {
  			return [stop[0], parseFn(stop[1])];
  		});
  		if (parameters.default) parameters.default = parseFn(parameters.default);
  		else parameters.default = parseFn(propertySpec.default);
  	}
  	if (parameters.colorSpace && !isSupportedInterpolationColorSpace(parameters.colorSpace)) throw new Error(`Unknown color space: "${parameters.colorSpace}"`);
  	const innerFun = getInnerFunction(type);
  	let hashedStops;
  	let categoricalKeyType;
  	if (type === "categorical") {
  		hashedStops = Object.create(null);
  		for (const stop of parameters.stops) hashedStops[stop[0]] = stop[1];
  		categoricalKeyType = typeof parameters.stops[0][0];
  	}
  	if (zoomAndFeatureDependent) {
  		const featureFunctions = {};
  		const zoomStops = [];
  		for (let s = 0; s < parameters.stops.length; s++) {
  			const stop = parameters.stops[s];
  			const zoom = stop[0].zoom;
  			if (featureFunctions[zoom] === void 0) {
  				featureFunctions[zoom] = {
  					zoom,
  					type: parameters.type,
  					property: parameters.property,
  					default: parameters.default,
  					stops: []
  				};
  				zoomStops.push(zoom);
  			}
  			featureFunctions[zoom].stops.push([stop[0].value, stop[1]]);
  		}
  		const featureFunctionStops = [];
  		for (const z of zoomStops) featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z], propertySpec)]);
  		const interpolationType = { name: "linear" };
  		return {
  			kind: "composite",
  			interpolationType,
  			interpolationFactor: Interpolate.interpolationFactor.bind(void 0, interpolationType),
  			zoomStops: featureFunctionStops.map((s) => s[0]),
  			evaluate({ zoom }, properties) {
  				return evaluateExponentialFunction({
  					stops: featureFunctionStops,
  					base: parameters.base
  				}, propertySpec, zoom).evaluate(zoom, properties);
  			}
  		};
  	} else if (zoomDependent) {
  		const interpolationType = type === "exponential" ? {
  			name: "exponential",
  			base: parameters.base !== void 0 ? parameters.base : 1
  		} : null;
  		return {
  			kind: "camera",
  			interpolationType,
  			interpolationFactor: Interpolate.interpolationFactor.bind(void 0, interpolationType),
  			zoomStops: parameters.stops.map((s) => s[0]),
  			evaluate: ({ zoom }) => innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType)
  		};
  	} else return {
  		kind: "source",
  		evaluate(_, feature) {
  			const value = feature && feature.properties ? feature.properties[parameters.property] : void 0;
  			if (value === void 0) return coalesce$1(parameters.default, propertySpec.default);
  			return innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType);
  		}
  	};
  }
  function coalesce$1(a, b, c) {
  	if (a !== void 0) return a;
  	if (b !== void 0) return b;
  	if (c !== void 0) return c;
  }
  function evaluateCategoricalFunction(parameters, propertySpec, input, hashedStops, keyType) {
  	return coalesce$1(typeof input === keyType ? hashedStops[input] : void 0, parameters.default, propertySpec.default);
  }
  function evaluateIntervalFunction(parameters, propertySpec, input) {
  	if (getType(input) !== "number") return coalesce$1(parameters.default, propertySpec.default);
  	const n = parameters.stops.length;
  	if (n === 1) return parameters.stops[0][1];
  	if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
  	if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];
  	const index = findStopLessThanOrEqualTo(parameters.stops.map((stop) => stop[0]), input, "");
  	return parameters.stops[index][1];
  }
  function evaluateExponentialFunction(parameters, propertySpec, input) {
  	const base = parameters.base !== void 0 ? parameters.base : 1;
  	if (getType(input) !== "number") return coalesce$1(parameters.default, propertySpec.default);
  	const n = parameters.stops.length;
  	if (n === 1) return parameters.stops[0][1];
  	if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
  	if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];
  	const index = findStopLessThanOrEqualTo(parameters.stops.map((stop) => stop[0]), input, "");
  	const t = interpolationFactor(input, base, parameters.stops[index][0], parameters.stops[index + 1][0]);
  	const outputLower = parameters.stops[index][1];
  	const outputUpper = parameters.stops[index + 1][1];
  	const interp = interpolateFactory[propertySpec.type] || identityFunction;
  	if (typeof outputLower.evaluate === "function") return { evaluate(...args) {
  		const evaluatedLower = outputLower.evaluate.apply(void 0, args);
  		const evaluatedUpper = outputUpper.evaluate.apply(void 0, args);
  		if (evaluatedLower === void 0 || evaluatedUpper === void 0) return;
  		return interp(evaluatedLower, evaluatedUpper, t, parameters.colorSpace);
  	} };
  	return interp(outputLower, outputUpper, t, parameters.colorSpace);
  }
  function evaluateIdentityFunction(parameters, propertySpec, input) {
  	switch (propertySpec.type) {
  		case "color":
  			input = Color.parse(input);
  			break;
  		case "formatted":
  			input = Formatted.fromString(input.toString());
  			break;
  		case "resolvedImage":
  			input = ResolvedImage.fromString(input.toString());
  			break;
  		case "padding":
  			input = Padding.parse(input);
  			break;
  		case "colorArray":
  			input = ColorArray.parse(input);
  			break;
  		case "numberArray":
  			input = NumberArray.parse(input);
  			break;
  		default: if (getType(input) !== propertySpec.type && (propertySpec.type !== "enum" || !propertySpec.values[input])) input = void 0;
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
  	const difference = upperValue - lowerValue;
  	const progress = input - lowerValue;
  	if (difference === 0) return 0;
  	else if (base === 1) return progress / difference;
  	else return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
  }
  //#endregion
  //#region src/expression/index.ts
  var StyleExpression = class {
  	constructor(expression, rootKey, propertySpec, globalState) {
  		this.expression = expression;
  		this._warningHistory = {};
  		this._evaluator = new EvaluationContext();
  		this._defaultValue = propertySpec ? getDefaultValue(propertySpec) : null;
  		this._enumValues = propertySpec && propertySpec.type === "enum" ? propertySpec.values : null;
  		this._globalState = globalState;
  		this._rootKey = rootKey;
  	}
  	evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection) {
  		if (this._globalState) globals = addGlobalState(globals, this._globalState);
  		this._evaluator.globals = globals;
  		this._evaluator.feature = feature;
  		this._evaluator.featureState = featureState;
  		this._evaluator.canonical = canonical;
  		this._evaluator.availableImages = availableImages || null;
  		this._evaluator.formattedSection = formattedSection;
  		return this.expression.evaluate(this._evaluator);
  	}
  	evaluate(globals, feature, featureState, canonical, availableImages, formattedSection) {
  		if (this._globalState) globals = addGlobalState(globals, this._globalState);
  		this._evaluator.globals = globals;
  		this._evaluator.feature = feature || null;
  		this._evaluator.featureState = featureState || null;
  		this._evaluator.canonical = canonical;
  		this._evaluator.availableImages = availableImages || null;
  		this._evaluator.formattedSection = formattedSection || null;
  		try {
  			const val = this.expression.evaluate(this._evaluator);
  			if (val === null || val === void 0 || typeof val === "number" && val !== val) return this._defaultValue;
  			if (this._enumValues && !(val in this._enumValues)) throw new RuntimeError(`Expected value to be one of ${Object.keys(this._enumValues).map((v) => JSON.stringify(v)).join(", ")}, but found ${JSON.stringify(val)} instead.`, "");
  			return val;
  		} catch (e) {
  			const path = e instanceof RuntimeError ? e.path : "";
  			const dedupKey = `${path}|${e.message}`;
  			if (!this._warningHistory[dedupKey]) {
  				this._warningHistory[dedupKey] = true;
  				if (typeof console !== "undefined") console.warn(formatRuntimeWarning(this._rootKey, path, e.message, this._defaultValue));
  			}
  			return this._defaultValue;
  		}
  	}
  };
  /**
  * Builds the warning logged when an expression or legacy function fails at
  * evaluation: a `rootKey + index path` location prefix, plus the fallback
  * value being used.
  * @param rootKey Caller-supplied location of the expression in the style JSON
  * @param path Index path of the throwing sub-expression ('' for the root)
  * @param message The error message from the failed evaluation
  * @param defaultValue The value being fallen back to
  * @returns The formatted warning string
  */
  function formatRuntimeWarning(rootKey, path, message, defaultValue) {
  	return `${rootKey}${path}: ${message}${defaultValue == null ? "" : ` Falling back to ${String(defaultValue)}.`}`;
  }
  /**
  * Rejects a missing or empty root key. The location prefix is what makes
  * runtime warnings actionable, so callers must always supply one; failing
  * here surfaces the programmer error at style load instead of producing
  * unattributable warnings at render time.
  * @param rootKey The root key to check
  */
  function assertRootKey(rootKey) {
  	if (!rootKey) throw new Error("rootKey must identify the location of the expression in the style JSON, e.g. \"layers[3].paint.line-width\".");
  }
  function isExpression(expression) {
  	return Array.isArray(expression) && expression.length > 0 && typeof expression[0] === "string" && expression[0] in expressions;
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
  function createExpression(expression, rootKey, propertySpec, globalState) {
  	assertRootKey(rootKey);
  	const parser = new ParsingContext(expressions, isExpressionConstant, [], propertySpec ? getExpectedType(propertySpec) : void 0);
  	const parsed = parser.parse(expression, void 0, void 0, void 0, propertySpec && propertySpec.type === "string" ? { typeAnnotation: "coerce" } : void 0);
  	if (!parsed) return error(parser.errors);
  	return success(new StyleExpression(parsed, rootKey, propertySpec, globalState));
  }
  var ZoomConstantExpression = class {
  	constructor(kind, expression, globalState) {
  		this.kind = kind;
  		this._styleExpression = expression;
  		this.isStateDependent = kind !== "constant" && !isStateConstant(expression.expression);
  		this.globalStateRefs = findGlobalStateRefs(expression.expression);
  		this._globalState = globalState;
  	}
  	evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection) {
  		if (this._globalState) globals = addGlobalState(globals, this._globalState);
  		return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection);
  	}
  	evaluate(globals, feature, featureState, canonical, availableImages, formattedSection) {
  		if (this._globalState) globals = addGlobalState(globals, this._globalState);
  		return this._styleExpression.evaluate(globals, feature, featureState, canonical, availableImages, formattedSection);
  	}
  };
  var ZoomDependentExpression = class {
  	constructor(kind, expression, zoomStops, interpolationType, globalState) {
  		this.kind = kind;
  		this.zoomStops = zoomStops;
  		this._styleExpression = expression;
  		this.isStateDependent = kind !== "camera" && !isStateConstant(expression.expression);
  		this.globalStateRefs = findGlobalStateRefs(expression.expression);
  		this.interpolationType = interpolationType;
  		this._globalState = globalState;
  	}
  	evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection) {
  		if (this._globalState) globals = addGlobalState(globals, this._globalState);
  		return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection);
  	}
  	evaluate(globals, feature, featureState, canonical, availableImages, formattedSection) {
  		if (this._globalState) globals = addGlobalState(globals, this._globalState);
  		return this._styleExpression.evaluate(globals, feature, featureState, canonical, availableImages, formattedSection);
  	}
  	interpolationFactor(input, lower, upper) {
  		if (this.interpolationType) return Interpolate.interpolationFactor(this.interpolationType, input, lower, upper);
  		else return 0;
  	}
  };
  function isZoomExpression(expression) {
  	return expression._styleExpression !== void 0;
  }
  function createPropertyExpression$1(expressionInput, rootKey, propertySpec, globalState) {
  	const expression = createExpression(expressionInput, rootKey, propertySpec, globalState);
  	if (expression.result === "error") return expression;
  	const parsed = expression.value.expression;
  	const isFeatureConstantResult = isFeatureConstant(parsed);
  	if (!isFeatureConstantResult && !supportsPropertyExpression(propertySpec)) return error([new ExpressionParsingError("", "data expressions not supported")]);
  	const isZoomConstant = isGlobalPropertyConstant(parsed, ["zoom"]);
  	if (!isZoomConstant && !supportsZoomExpression(propertySpec)) return error([new ExpressionParsingError("", "zoom expressions not supported")]);
  	const zoomCurve = findZoomCurve(parsed);
  	if (!zoomCurve && !isZoomConstant) return error([new ExpressionParsingError("", "\"zoom\" expression may only be used as input to a top-level \"step\" or \"interpolate\" expression.")]);
  	else if (zoomCurve instanceof ExpressionParsingError) return error([zoomCurve]);
  	else if (zoomCurve instanceof Interpolate && !supportsInterpolation(propertySpec)) return error([new ExpressionParsingError("", "\"interpolate\" expressions cannot be used with this property")]);
  	if (!zoomCurve) return success(isFeatureConstantResult ? new ZoomConstantExpression("constant", expression.value, globalState) : new ZoomConstantExpression("source", expression.value, globalState));
  	const interpolationType = zoomCurve instanceof Interpolate ? zoomCurve.interpolation : void 0;
  	return success(isFeatureConstantResult ? new ZoomDependentExpression("camera", expression.value, zoomCurve.labels, interpolationType, globalState) : new ZoomDependentExpression("composite", expression.value, zoomCurve.labels, interpolationType, globalState));
  }
  var StylePropertyFunction = class StylePropertyFunction {
  	constructor(parameters, rootKey, specification) {
  		this.isStateDependent = false;
  		this.globalStateRefs = /* @__PURE__ */ new Set();
  		this._globalState = null;
  		assertRootKey(rootKey);
  		this._parameters = parameters;
  		this._specification = specification;
  		this._rootKey = rootKey;
  		this._defaultValue = getDefaultValue(specification);
  		this._warningHistory = {};
  		const fn = createFunction(this._parameters, this._specification);
  		this.kind = fn.kind;
  		this.interpolationFactor = fn.interpolationFactor;
  		this.zoomStops = fn.zoomStops;
  		this.interpolationType = fn.interpolationType;
  		this._innerEvaluate = fn.evaluate;
  	}
  	/**
  	* Evaluates the legacy function, handling a runtime throw (e.g. interpolating
  	* mismatched value types) by warning with the property location and falling
  	* back to the spec default, mirroring {@link StyleExpression.evaluate}.
  	* @param globals Global evaluation properties (e.g. zoom)
  	* @param feature The feature being evaluated, if any
  	* @returns The function result, or the spec default if evaluation throws
  	*/
  	evaluate(globals, feature) {
  		try {
  			return this._innerEvaluate(globals, feature);
  		} catch (e) {
  			const message = e instanceof Error ? e.message : String(e);
  			const dedupKey = `|${message}`;
  			if (!this._warningHistory[dedupKey]) {
  				this._warningHistory[dedupKey] = true;
  				if (typeof console !== "undefined") console.warn(formatRuntimeWarning(this._rootKey, "", message, this._defaultValue));
  			}
  			return this._defaultValue;
  		}
  	}
  	static deserialize(serialized) {
  		return new StylePropertyFunction(serialized._parameters, serialized._rootKey, serialized._specification);
  	}
  	static serialize(input) {
  		return {
  			_parameters: input._parameters,
  			_specification: input._specification,
  			_rootKey: input._rootKey
  		};
  	}
  };
  function normalizePropertyExpression(value, rootKey, specification, globalState) {
  	if (isFunction(value)) return new StylePropertyFunction(value, rootKey, specification);
  	else if (isExpression(value)) {
  		const expression = createPropertyExpression$1(value, rootKey, specification, globalState);
  		if (expression.result === "error") throw new Error(expression.value.map((err) => `${err.key}: ${err.message}`).join(", "));
  		return expression.value;
  	} else {
  		let constant = value;
  		if (specification.type === "color" && typeof value === "string") constant = Color.parse(value);
  		else if (specification.type === "padding" && (typeof value === "number" || Array.isArray(value))) constant = Padding.parse(value);
  		else if (specification.type === "numberArray" && (typeof value === "number" || Array.isArray(value))) constant = NumberArray.parse(value);
  		else if (specification.type === "colorArray" && (typeof value === "string" || Array.isArray(value))) constant = ColorArray.parse(value);
  		else if (specification.type === "variableAnchorOffsetCollection" && Array.isArray(value)) constant = VariableAnchorOffsetCollection.parse(value);
  		else if (specification.type === "projectionDefinition" && typeof value === "string") constant = ProjectionDefinition.parse(value);
  		return {
  			globalStateRefs: /* @__PURE__ */ new Set(),
  			_globalState: null,
  			kind: "constant",
  			evaluate: () => constant
  		};
  	}
  }
  function findZoomCurve(expression) {
  	let result = null;
  	if (expression instanceof Let) result = findZoomCurve(expression.result);
  	else if (expression instanceof Coalesce) for (const arg of expression.args) {
  		result = findZoomCurve(arg);
  		if (result) break;
  	}
  	else if ((expression instanceof Step || expression instanceof Interpolate) && expression.input instanceof CompoundExpression && expression.input.name === "zoom") result = expression;
  	if (result instanceof ExpressionParsingError) return result;
  	expression.eachChild((child) => {
  		const childResult = findZoomCurve(child);
  		if (childResult instanceof ExpressionParsingError) result = childResult;
  		else if (!result && childResult) result = new ExpressionParsingError("", "\"zoom\" expression may only be used as input to a top-level \"step\" or \"interpolate\" expression.");
  		else if (result && childResult && result !== childResult) result = new ExpressionParsingError("", "Only one zoom-based \"step\" or \"interpolate\" subexpression may be used in an expression.");
  	});
  	return result;
  }
  function findGlobalStateRefs(expression, results = /* @__PURE__ */ new Set()) {
  	if (expression instanceof GlobalState) results.add(expression.key);
  	expression.eachChild((childExpression) => {
  		findGlobalStateRefs(childExpression, results);
  	});
  	return results;
  }
  function getExpectedType(spec) {
  	const types = {
  		color: ColorType,
  		string: StringType,
  		number: NumberType,
  		enum: StringType,
  		boolean: BooleanType,
  		formatted: FormattedType,
  		padding: PaddingType,
  		numberArray: NumberArrayType,
  		colorArray: ColorArrayType,
  		projectionDefinition: ProjectionDefinitionType,
  		resolvedImage: ResolvedImageType,
  		variableAnchorOffsetCollection: VariableAnchorOffsetCollectionType
  	};
  	if (spec.type === "array") return array(types[spec.value] || ValueType, spec.length);
  	return types[spec.type];
  }
  function getDefaultValue(spec) {
  	if (spec.type === "color" && isFunction(spec.default)) return new Color(0, 0, 0, 0);
  	switch (spec.type) {
  		case "color": return Color.parse(spec.default) || null;
  		case "padding": return Padding.parse(spec.default) || null;
  		case "numberArray": return NumberArray.parse(spec.default) || null;
  		case "colorArray": return ColorArray.parse(spec.default) || null;
  		case "variableAnchorOffsetCollection": return VariableAnchorOffsetCollection.parse(spec.default) || null;
  		case "projectionDefinition": return ProjectionDefinition.parse(spec.default) || null;
  		default: return spec.default === void 0 ? null : spec.default;
  	}
  }
  function addGlobalState(globals, globalState) {
  	const { zoom, heatmapDensity, elevation, lineProgress, isSupportedScript, accumulated } = globals ?? {};
  	return {
  		zoom,
  		heatmapDensity,
  		elevation,
  		lineProgress,
  		isSupportedScript,
  		accumulated,
  		globalState
  	};
  }
  //#endregion
  //#region src/feature_filter/index.ts
  function classifyChildren(children) {
  	let sawLegacy = false;
  	for (const child of children) {
  		const classification = classifyFilter(child);
  		if (classification === "expression") return "expression";
  		if (classification === "legacy") sawLegacy = true;
  	}
  	return sawLegacy ? "legacy" : "neutral";
  }
  function classifyFilter(filter) {
  	if (typeof filter === "boolean") return "neutral";
  	if (!Array.isArray(filter) || filter.length === 0) return "legacy";
  	switch (filter[0]) {
  		case "has":
  			if (filter.length < 2 || filter[1] === "$id" || filter[1] === "$type") return "legacy";
  			return filter.length === 2 ? "neutral" : "expression";
  		case "in": return filter.length >= 3 && (typeof filter[1] !== "string" || Array.isArray(filter[2])) ? "expression" : "legacy";
  		case "!in":
  		case "!has": return "legacy";
  		case "==":
  		case "!=":
  		case ">":
  		case ">=":
  		case "<":
  		case "<=": return filter.length !== 3 || Array.isArray(filter[1]) || Array.isArray(filter[2]) ? "expression" : "legacy";
  		case "none": return "legacy";
  		case "any":
  		case "all": return classifyChildren(filter.slice(1));
  		default: return "expression";
  	}
  }
  function isExpressionFilter(filter) {
  	return classifyFilter(filter) !== "legacy";
  }
  //#endregion
  //#region src/index.ts
  const expression = {
  	StyleExpression,
  	StylePropertyFunction,
  	ZoomConstantExpression,
  	ZoomDependentExpression,
  	createExpression,
  	createPropertyExpression: createPropertyExpression$1,
  	isExpression,
  	isExpressionFilter,
  	isZoomExpression,
  	normalizePropertyExpression
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
   * MapLibre >= 5 calls `render`/`prerender` with an options object where older
   * versions passed the mercator matrix directly. Accept either.
   *
   * `defaultProjectionData.mainMatrix` is the successor of the old matrix: it maps
   * mercator 0..1 to clip space. (`modelViewProjectionMatrix` is *not* — it expects
   * world pixel coordinates.) Under mercator it is a Float64Array, which WebGL
   * refuses, hence the copy.
   */
  function customLayerMatrix(args) {
    if (args && args.defaultProjectionData) {
      return new Float32Array(args.defaultProjectionData.mainMatrix);
    }
    return args;
  }

  /**
   * Our shaders project mercator coordinates themselves, so they only line up with
   * MapLibre's mercator projection. Under globe we would smear a flat sheet across
   * the sphere, so the layers skip rendering instead. Supporting globe means
   * switching to MapLibre's `shaderData.vertexShaderPrelude` + `projectTile()`,
   * which requires GLSL ES 3.00 shaders.
   */
  function isUnsupportedProjection(args) {
    return !!(
      args &&
      args.shaderData &&
      args.shaderData.variantName &&
      args.shaderData.variantName !== "mercator"
    );
  }

  /**
   * `@maplibre/maplibre-gl-style-spec` 26 inserted a `rootKey` argument between the
   * value and the property spec. Probe once with an expression that only parses
   * when the spec is honoured, so we work against both shapes (a consuming app may
   * dedupe us onto whichever copy its MapLibre version ships).
   */
  var styleSpecNeedsRootKey = (function () {
    var spec = {
      type: "color",
      default: "#000000",
      expression: { interpolated: true, parameters: ["zoom"] },
      "property-type": "data-constant"
    };
    var probe = ["interpolate", ["linear"], ["zoom"], 0, "#000000", 1, "#ffffff"];
    try {
      return expression.createPropertyExpression(probe, spec).result !== "success";
    } catch (e) {
      return true;
    }
  })();

  function createPropertyExpression(prop, value, spec) {
    return styleSpecNeedsRootKey
      ? expression.createPropertyExpression(value, prop, spec)
      : expression.createPropertyExpression(value, spec);
  }

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
    var expr = createPropertyExpression(prop, value, spec);
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
          : { zoom: this.map.getZoom() },
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

    // Tiles are requested from `move`, so without this the layer renders nothing
    // until the user first pans or zooms.
    this.move();
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

  // Returns true (and complains once) if the map is using a projection we can't draw in.
  Layer.prototype.warnOnUnsupportedProjection = function warnOnUnsupportedProjection (args) {
    if (!isUnsupportedProjection(args)) { return false; }
    if (!this._warnedProjection) {
      this._warnedProjection = true;
      console.warn(
        "windgl: layer \"" + (this.id) + "\" only supports the mercator projection, " +
          "not \"" + (args.shaderData.variantName) + "\". The layer will not be drawn."
      );
    }
    return true;
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
  Layer.prototype.render = function render (gl, args) {
      var this$1$1 = this;

    if (!this.windData) { return; }
    if (this.warnOnUnsupportedProjection(args)) { return; }
    var matrix = customLayerMatrix(args);
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

  var particleUpdate = function (gl) { return createProgram(gl, "precision highp float;attribute vec2 a_pos;varying vec2 h;void main(){h=a_pos,gl_Position=vec4(1.-2.*a_pos,0,1);}const vec3 f=vec3(12.9898,78.233,4375.85453);", "precision highp float;vec2 g(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_particles,u_wind_top_left,u_wind_top_center,u_wind_top_right,u_wind_middle_left,u_wind_middle_center,u_wind_middle_right,u_wind_bottom_left,u_wind_bottom_center,u_wind_bottom_right;uniform vec2 u_wind_res,u_wind_min,u_wind_max;uniform bool u_initialize;uniform mat4 u_data_matrix;uniform float u_rand_seed,u_speed_factor,u_drop_rate,u_drop_rate_bump;varying vec2 h;const vec3 f=vec3(12.9898,78.233,4375.85453);float i(const vec2 b){float a=dot(f.xy,b);return fract(sin(a)*(f.z+a));}vec2 d(const vec2 a){return a.x>1.&&a.y>1.?texture2D(u_wind_bottom_right,a-vec2(1,1)).rg:a.x>0.&&a.y>1.?texture2D(u_wind_bottom_center,a-vec2(0,1)).rg:a.y>1.?texture2D(u_wind_bottom_left,a-vec2(-1,1)).rg:a.x>1.&&a.y>0.?texture2D(u_wind_middle_right,a-vec2(1,0)).rg:a.x>0.&&a.y>0.?texture2D(u_wind_middle_center,a-vec2(0,0)).rg:a.y>0.?texture2D(u_wind_middle_left,a-vec2(-1,0)).rg:a.x>1.?texture2D(u_wind_top_right,a-vec2(1,-1)).rg:a.x>0.?texture2D(u_wind_top_center,a-vec2(0,-1)).rg:texture2D(u_wind_top_left,a-vec2(-1,-1)).rg;}vec2 p(const vec2 e){vec2 a=1./u_wind_res,b=floor(e*u_wind_res)*a,c=fract(e*u_wind_res),j=d(b),k=d(b+vec2(a.x,0)),l=d(b+vec2(0,a.y)),m=d(b+a);return mix(mix(j,k,c.x),mix(l,m,c.x),c.y);}vec2 o(vec2 a){vec2 e=g(a,u_data_matrix),b=mix(u_wind_min,u_wind_max,p(e));float j=length(b)/length(u_wind_max);vec2 k=vec2(b.x,-b.y)*1e-4*u_speed_factor;a=fract(1.+a+k);vec2 c=(a+h)*u_rand_seed;float l=u_drop_rate+j*u_drop_rate_bump+smoothstep(.24,.5,length(a-vec2(.5,.5))*.7),m=step(1.-l,i(c));vec2 q=vec2(.5*i(c+1.3)+.25,.5*i(c+2.1)+.25);return mix(a,q,m);}void main(){vec4 b=texture2D(u_particles,h);vec2 a=vec2(b.r/255.+b.b,b.g/255.+b.a);a=o(a);if(u_initialize)for(int c=0;c<100;c++)a=o(a);gl_FragColor=vec4(fract(a*255.),floor(a*255.)/255.);}"); };

  var particleDraw = function (gl) { return createProgram(gl, "precision highp float;vec2 r(vec2 b){float a=-180.*b.y+90.;a=(180.-57.29578*log(tan(.785398+a*3.141593/360.)))/360.;return vec2(b.x,a);}vec2 g(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_particles;uniform mat4 u_matrix,u_offset;uniform float u_particles_res,u_particle_size;const vec3 f=vec3(12.9898,78.233,4375.85453);attribute float a_index;varying vec2 n;void main(){vec4 a=texture2D(u_particles,vec2(fract(a_index/u_particles_res),floor(a_index/u_particles_res)/u_particles_res));vec2 b=vec2(a.r/255.+a.b,a.g/255.+a.a),c=g(b,u_offset),e=r(c);n=b,gl_PointSize=u_particle_size,gl_Position=u_matrix*vec4(e,0,1);}", "precision highp float;vec2 g(vec2 b,mat4 c){vec4 a=c*vec4(b,1,1);return a.xy/a.w;}uniform sampler2D u_wind_top_left,u_wind_top_center,u_wind_top_right,u_wind_middle_left,u_wind_middle_center,u_wind_middle_right,u_wind_bottom_left,u_wind_bottom_center,u_wind_bottom_right,u_color_ramp;uniform vec2 u_wind_min,u_wind_max;uniform mat4 u_data_matrix;const vec3 f=vec3(12.9898,78.233,4375.85453);vec2 d(const vec2 a){return a.x>1.&&a.y>1.?texture2D(u_wind_bottom_right,a-vec2(1,1)).rg:a.x>0.&&a.y>1.?texture2D(u_wind_bottom_center,a-vec2(0,1)).rg:a.y>1.?texture2D(u_wind_bottom_left,a-vec2(-1,1)).rg:a.x>1.&&a.y>0.?texture2D(u_wind_middle_right,a-vec2(1,0)).rg:a.x>0.&&a.y>0.?texture2D(u_wind_middle_center,a-vec2(0,0)).rg:a.y>0.?texture2D(u_wind_middle_left,a-vec2(-1,0)).rg:a.x>1.?texture2D(u_wind_top_right,a-vec2(1,-1)).rg:a.x>0.?texture2D(u_wind_top_center,a-vec2(0,-1)).rg:texture2D(u_wind_top_left,a-vec2(-1,-1)).rg;}varying vec2 n;void main(){vec2 b=mix(u_wind_min,u_wind_max,d(g(n,u_data_matrix)));float a=length(b)/length(u_wind_max);vec2 c=vec2(fract(16.*a),floor(16.*a)/16.);gl_FragColor=texture2D(u_color_ramp,c);}"); };

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
      this.tileSize = 1024;

      this.dropRate = 0.003; // how often the particles move to a random place
      this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
      this._numParticles = 65536;
      // The requested count, before it is rounded up to a square texture.
      this._requestedParticles = 65536;
      // This layer manages 2 kinds of tiles: data tiles (the same as other layers) and particle state tiles
      this._particleTiles = {};
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

    // Changing the count invalidates the index buffer and every particle state
    // texture, since those are sized from the resolution.
    Particles.prototype.setNumberParticles = function setNumberParticles (expr) {
      var count = Math.max(1, Math.round(expr.evaluate({})));
      if (count === this._requestedParticles) { return; }
      this._requestedParticles = count;
      if (!this.gl) { return; } // initialize() will pick it up
      this.initializeParticles(this.gl, count);
      this.dropParticleTiles();
      this.move();
      this.map.triggerRepaint();
    };

    Particles.prototype.dropParticleTiles = function dropParticleTiles () {
      var this$1$1 = this;

      Object.keys(this._particleTiles).forEach(function (key) {
        var state = this$1$1._particleTiles[key];
        this$1$1.gl.deleteTexture(state.particleStateTexture0);
        this$1$1.gl.deleteTexture(state.particleStateTexture1);
        delete this$1$1._particleTiles[key];
      });
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
          // cleanup - note `tile` is the string key, the state lives in the value
          var state = this$1$1._particleTiles[tile];
          this$1$1.gl.deleteTexture(state.particleStateTexture0);
          this$1$1.gl.deleteTexture(state.particleStateTexture1);
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
      if (this.particleIndexBuffer) { gl.deleteBuffer(this.particleIndexBuffer); }
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

      this.initializeParticles(gl, this._requestedParticles);

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
    };

    // This is a callback from mapbox for rendering into a texture
    Particles.prototype.prerender = function prerender (gl, args) {
      var this$1$1 = this;

      if (this.windData) {
        if (isUnsupportedProjection(args)) { return; }
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
      // Walk up towards the root looking for a loaded data tile. The root itself
      // has to be tested too, otherwise nothing ever renders at low zooms.
      for (;;) {
        if ((found = this._tiles[t])) { break; }
        if (t.isRoot()) { break; }
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

    Particles.prototype.render = function render (gl, args) {
      var this$1$1 = this;

      if (this.windData) {
        if (this.warnOnUnsupportedProjection(args)) { return; }
        var matrix = customLayerMatrix(args);
        this.visibleParticleTiles().forEach(function (tile) {
          var found = this$1$1.findAssociatedDataTiles(tile);
          if (!found) { return; }

          this$1$1.draw(
            gl,
            matrix,
            this$1$1._particleTiles[tile],
            tile.viewMatrix(2),
            found
          );
        });
      }
    };

    Particles.prototype.draw = function draw (gl, matrix, tile, offset, data) {
      var program = this.drawProgram;
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
      bindTexture(gl, this.colorRampTexture, 10);

      bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);

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

      gl.uniform1f(program.u_particles_res, this.particleStateResolution);

      gl.uniformMatrix4fv(program.u_offset, false, offset);
      gl.uniformMatrix4fv(
        program.u_offset_inverse,
        false,
        matrixInverse(offset)
      );

      gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
      gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

      gl.uniformMatrix4fv(program.u_matrix, false, matrix);
      gl.uniformMatrix4fv(program.u_data_matrix, false, data.matrix);

      gl.uniform1f(program.u_particle_size, this.particleSize);

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
