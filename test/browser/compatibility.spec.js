const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/test/browser/map.html");
  await page.waitForFunction(() => window.ready);
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(192, 128, 0)";
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL();
  });
  await page.route("**/wind.json", route => route.fulfill({
    json: { width: 16, height: 16, minzoom: 0, maxzoom: 0,
      uMin: -10, uMax: 10, vMin: -10, vMax: 10, tiles: [image] }
  }));
});

for (const kind of ["sampleFill", "arrow", "particles"]) {
  test(`${kind} renders with current MapLibre and survives pan and zoom`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.evaluate(kind => {
      window.layer = windGL[kind]({
        id: "wind", source: windGL.source("/wind.json"),
        "number-particles": 4096,
        "particle-size": 4,
        "particle-color": "red",
        "arrow-color": "red",
        "sample-fill-color": "red"
      });
      window.draws = 0;
      window.glErrors = [];
      const draw = layer.draw;
      layer.draw = function(gl, ...args) {
        draw.call(this, gl, ...args);
        draws++;
        const error = gl.getError();
        if (error) glErrors.push(error);
      };
      map.addLayer(layer);
      window.redPixels = () => {
        const gl = layer.gl;
        const pixels = new Uint8Array(512 * 512 * 4);
        gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 100 && pixels[i + 1] < 50 && pixels[i + 2] < 50) count++;
        }
        return count;
      };
    }, kind);
    await expect.poll(() => page.evaluate(() => draws)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => redPixels())).toBeGreaterThan(0);
    // Arrows are limited to the source grid; a z0 fixture has no arrow in a
    // street-level viewport. Particles can overzoom the same data.
    await page.evaluate(kind => new Promise(resolve => {
      map.once("render", resolve);
      map.jumpTo({
        center: [12, 22], zoom: kind === "arrow" ? 3 : 10, bearing: 30, pitch: 20
      });
    }), kind);
    await expect.poll(() => page.evaluate(() => redPixels())).toBeGreaterThan(0);
    expect(await page.evaluate(() => glErrors)).toEqual([]);
    expect(await page.evaluate(() => mapErrors)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("the wind fill stays visible underneath particles", async ({ page }) => {
  await page.evaluate(() => {
    const source = windGL.source("/wind.json");
    window.fill = windGL.sampleFill({
      id: "fill", source, "sample-fill-color": "#ff00ff"
    });
    window.particles = windGL.particles({
      id: "particles", source, "number-particles": 4096,
      "particle-size": 4, "particle-color": "white"
    });
    map.addLayer(fill);
    map.addLayer(particles);
    window.compositedPixels = () => {
      const gl = fill.gl;
      const pixels = new Uint8Array(512 * 512 * 4);
      gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let background = 0, dots = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 200 && pixels[i + 1] < 50 && pixels[i + 2] > 200) background++;
        if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) dots++;
      }
      return { background, dots };
    };
  });
  await expect.poll(() => page.evaluate(() => {
    const { background, dots } = compositedPixels();
    return background > 512 * 512 / 2 && dots > 0;
  })).toBe(true);
  expect(await page.evaluate(() => mapErrors)).toEqual([]);
});

test("mixed wind layers leave subsequent MapLibre layers intact", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    const source = windGL.source("/wind.json");
    window.layers = [
      windGL.arrow({ id: "arrows", source, "arrow-color": "red" }),
      windGL.particles({ id: "particles", source, "number-particles": 4096, "particle-color": "red" }),
      windGL.sampleFill({ id: "fill", source, "sample-fill-color": "red" })
    ];
    window.glErrors = [];
    window.calls = {};
    for (const layer of layers) {
      for (const name of ["draw", "update"]) {
        if (!layer[name]) continue;
        const original = layer[name];
        layer[name] = function(gl, ...args) {
          original.call(this, gl, ...args);
          const key = `${this.id}.${name}`;
          calls[key] = (calls[key] || 0) + 1;
          const error = gl.getError();
          if (error) glErrors.push({ layer: this.id, name, error });
        };
      }
      map.addLayer(layer);
    }
    map.addSource("overlay", { type: "geojson", data: {
      type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [
        [[0, 0], [20, 0], [20, 40], [0, 40], [0, 0]]
      ] }
    } });
    map.addLayer({ id: "overlay", type: "fill", source: "overlay", paint: { "fill-color": "#00ff00" } });
    window.centerPixel = () => {
      const gl = layers[0].gl;
      const pixel = new Uint8Array(4);
      gl.readPixels(256, 256, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
  });
  for (const key of ["arrows.draw", "particles.draw", "particles.update", "fill.draw"]) {
    await expect.poll(() => page.evaluate(key => calls[key] || 0, key)).toBeGreaterThan(0);
  }
  await expect.poll(() => page.evaluate(() => centerPixel())).toEqual([0, 255, 0, 255]);
  expect(await page.evaluate(() => glErrors)).toEqual([]);
  expect(await page.evaluate(() => mapErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a globe style warns once and resumes wind rendering in Mercator", async ({ page }) => {
  const warnings = [];
  page.on("console", message => {
    if (message.type() === "warning" && message.text().startsWith("windgl:")) {
      warnings.push(message.text());
    }
  });
  await page.evaluate(() => {
    map.setProjection({ type: "globe" });
    window.layer = windGL.sampleFill({
      id: "wind", source: windGL.source("/wind.json"), "sample-fill-color": "red"
    });
    window.draws = 0;
    const draw = layer.draw;
    layer.draw = function(...args) { draws++; draw.apply(this, args); };
    map.addLayer(layer);
  });
  await expect.poll(() => warnings.length).toBe(1);
  expect(await page.evaluate(() => draws)).toBe(0);
  await page.evaluate(() => map.setProjection({ type: "mercator" }));
  await expect.poll(() => page.evaluate(() => draws)).toBeGreaterThan(0);
  expect(warnings).toHaveLength(1);
  expect(await page.evaluate(() => mapErrors)).toEqual([]);
});
