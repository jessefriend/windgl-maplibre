import pkg from "./package.json";
import buble from "@rollup/plugin-buble";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

import { compile as glslify } from "glslify";
import * as GLSLX from "glslx";
import { dirname } from "path";
import { createFilter } from "@rollup/pluginutils";
import json from "@rollup/plugin-json";

const trace = {
  name: "trace",
  transform(code, id) {
    if (!/node_modules/.test(id)) console.log("[rollup] parsing", id);
    return null;
  }
};

function makeGLSL(userOptions = {}) {
  const options = Object.assign(
    { include: ["**/*.vs","**/*.fs","**/*.vert","**/*.frag","**/*.glsl","**/*.glslx"] },
    userOptions
  );
  const filter = createFilter(options.include, options.exclude);

  return {
    transform(code, id) {
      if (!filter(id)) return null;
      options.basedir = options.basedir || dirname(id);

      const codeWithDeps = glslify(code, options).replace("#define GLSLIFY 1\n", "");
      const compiled = GLSLX.compile(codeWithDeps, {
        disableRewriting: false,
        format: "json",
        keepSymbols: false,
        prettyPrint: false,
        renaming: "internal-only"
      });
      if (compiled.log) return this.error(compiled.log.replace("<stdin>", id));

      const program = JSON.parse(compiled.output);
      const { fragmentShaders, vertexShaders, otherShaders } = program.shaders.reduce(
        (obj, shader) => {
          if (shader.name.endsWith("Fragment")) {
            obj.fragmentShaders[shader.name.replace(/Fragment$/, "")] = shader.contents;
          } else if (shader.name.endsWith("Vertex")) {
            obj.vertexShaders[shader.name.replace(/Vertex$/, "")] = shader.contents;
          } else {
            obj.otherShaders[shader.name] = shader.contents;
          }
          return obj;
        },
        { fragmentShaders: {}, vertexShaders: {}, otherShaders: {} }
      );

      const assembled = [];
      Object.keys(vertexShaders).forEach(key => {
        if (fragmentShaders[key]) {
          assembled.push(
            `export const ${key} = gl => createProgram(gl, ${JSON.stringify(vertexShaders[key])}, ${JSON.stringify(fragmentShaders[key])});`
          );
          delete fragmentShaders[key];
          delete vertexShaders[key];
        } else {
          assembled.push(`export const ${key}Vertex = ${JSON.stringify(vertexShaders[key])};`);
        }
      });
      Object.keys(fragmentShaders).forEach(key => {
        assembled.push(`export const ${key}Fragment = ${JSON.stringify(fragmentShaders[key])};`);
      });
      Object.keys(otherShaders).forEach(key => {
        assembled.push(
          key === "main"
            ? `export default ${JSON.stringify(otherShaders[key])};`
            : `export const ${key} = ${JSON.stringify(otherShaders[key])};`
        );
      });

      return {
        code: `import {createProgram} from "../util";\n\n${assembled.join("\n\n")}`,
        map: { mappings: "" }
      };
    }
  };
}

const basePlugins = [
  trace,                                     // first
  json(),                                    // then JSON
  makeGLSL({ include: "./src/shaders/*.glsl" }),
  resolve({ browser: true, mainFields: ['module', 'browser', 'main'], preferBuiltins: false }),
  commonjs()
];

export default [
  { // Demo bundle
    input: "demo.js",
    output: [{ file: "docs/index.js", format: "iife", globals: { 'maplibre-gl': 'maplibregl' } }],
    external: ['maplibre-gl'],
    plugins: [
      ...basePlugins,
      buble({ transforms: { dangerousForOf: true }, objectAssign: "Object.assign" })
    ]
  },
  { // UMD library
    input: "src/index.js",
    output: [{ file: pkg.browser, format: "umd", name: "windGL" }],
    plugins: [
      ...basePlugins,
      buble({ transforms: { dangerousForOf: true }, objectAssign: "Object.assign" })
    ]
  },
  { // CJS + ESM library
    input: "src/index.js",
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" }
    ],
    external: ["@maplibre/maplibre-gl-style-spec"],
    plugins: [
      ...basePlugins,
      buble({ transforms: { dangerousForOf: true }, objectAssign: "Object.assign" })
    ]
  }
];
