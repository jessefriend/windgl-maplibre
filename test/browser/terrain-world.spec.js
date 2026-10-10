const { test, expect } = require("@playwright/test");

const WIND_SOURCE = "/docs/wind/gfs/2026100700/tile.json";

async function openWindMap(page, terrain = false) {
  await page.goto("/test/browser/map.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(({ source, terrain }) => {
    window.layer = windGL.particles({
      id: "wind", source: windGL.source(source),
      "number-particles": 4096, "particle-size": 4, "particle-color": "red",
      "particle-terrain": terrain, "particle-altitude": terrain ? 30 : 0
    });
    window.glErrors = [];
    for (const name of ["draw", "update", "updateTerrain"]) {
      const original = layer[name];
      layer[name] = function(gl, ...args) {
        original.call(this, gl, ...args);
        const error = gl.getError();
        if (error) glErrors.push(error);
      };
    }
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
  }, { source: WIND_SOURCE, terrain });
}

test("global wind renders beyond the US and across the dateline", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await openWindMap(page);
  for (const center of [[-100, 40], [11, 47], [20, -5], [135, -25], [179, 10], [-179, 10]]) {
    await page.evaluate(center => new Promise(resolve => {
      map.once("render", resolve);
      map.jumpTo({ center, zoom: 3 });
    }), center);
    await expect.poll(() => page.evaluate(() => redPixels())).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => glErrors)).toEqual([]);
  expect(await page.evaluate(() => mapErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test("global particles follow pitched terrain and survive terrain toggles", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await openWindMap(page, true);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    const image = context.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const elevation = 2000 + Math.round(500 * Math.sin(x * Math.PI / 128) * Math.sin(y * Math.PI / 128));
        const value = elevation + 32768;
        const i = (y * 256 + x) * 4;
        image.data[i] = value >> 8;
        image.data[i + 1] = value & 255;
        image.data[i + 2] = 0;
        image.data[i + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL().split(",")[1];
  });
  await page.route("**/dem/**", route => route.fulfill({
    contentType: "image/png", body: Buffer.from(png, "base64")
  }));
  await page.evaluate(() => {
    map.addSource("terrain", {
      type: "raster-dem", tiles: [`${location.origin}/dem/{z}/{x}/{y}.png`],
      tileSize: 256, maxzoom: 0, encoding: "terrarium"
    });
    map.setTerrain({ source: "terrain", exaggeration: 1.5 });
    map.jumpTo({ center: [11.39085, 47.27574], zoom: 10, pitch: 65, bearing: -25 });
  });
  await expect.poll(() => page.evaluate(() => map.queryTerrainElevation(map.getCenter()) || 0)).toBeGreaterThan(1000);
  await expect.poll(() => page.evaluate(() => layer.terrainActive && layer.terrainReady)).toBe(true);
  expect(await page.evaluate(() => layer.renderingMode)).toBe("3d");
  await expect.poll(() => page.evaluate(() => redPixels())).toBeGreaterThan(0);
  await page.evaluate(() => map.setMaxPitch(85));
  for (const bearing of [-25, 120]) {
    await page.evaluate(bearing => map.jumpTo({ pitch: 80, bearing }), bearing);
    await expect.poll(() => page.evaluate(() => redPixels())).toBeGreaterThan(0);
  }
  for (const terrain of [null, { source: "terrain", exaggeration: 1.5 }]) {
    await page.evaluate(terrain => new Promise(resolve => {
      map.once("render", resolve);
      map.setTerrain(terrain);
    }), terrain);
    await expect.poll(() => page.evaluate(() => redPixels())).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => glErrors)).toEqual([]);
  expect(await page.evaluate(() => mapErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test("particles project above exaggerated terrain, not at sea level", async ({ page }) => {
  await openWindMap(page, true);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    // Terrarium RGB encodes exactly 2000 metres.
    context.fillStyle = "rgb(135, 208, 0)";
    context.fillRect(0, 0, 256, 256);
    return canvas.toDataURL().split(",")[1];
  });
  await page.route("**/dem/**", route => route.fulfill({
    contentType: "image/png", body: Buffer.from(png, "base64")
  }));
  await page.evaluate(() => {
    map.addSource("terrain", {
      type: "raster-dem", tiles: [`${location.origin}/dem/{z}/{x}/{y}.png`],
      tileSize: 256, maxzoom: 0, encoding: "terrarium"
    });
    map.setMaxPitch(85);
    map.setTerrain({ source: "terrain", exaggeration: 1.5 });
    map.jumpTo({ center: [11.39085, 47.27574], zoom: 11, pitch: 80 });
  });
  await expect.poll(() => page.evaluate(() => map.queryTerrainElevation(map.getCenter()) || 0)).toBeCloseTo(3000, 0);
  await page.evaluate(() => {
    // Freeze one particle at the camera target. Keep the production draw shader
    // and height-map path, so a hard-coded z=0 cannot pass this assertion.
    layer._numParticles = 1;
    layer.update = () => {};
    const draw = layer.draw;
    layer.draw = function(gl, matrix, tile, offset, data) {
      const center = map.getCenter();
      const point = new DOMPoint((center.lng + 180) / 360, (90 - center.lat) / 180);
      const local = new DOMMatrix(offset).inverse().transformPoint(point);
      if (local.x < 0 || local.x > 1 || local.y < 0 || local.y > 1) return;
      const encode = value => [Math.round((value * 255 % 1) * 255), Math.floor(value * 255)];
      const [rx, bx] = encode(local.x), [ry, by] = encode(local.y);
      gl.bindTexture(gl.TEXTURE_2D, tile.particleStateTexture0);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([rx, ry, bx, by]));
      const decoded = new DOMMatrix(offset).transformPoint(new DOMPoint(rx / 65025 + bx / 255, ry / 65025 + by / 255));
      window.fixedParticle = { lng: decoded.x * 360 - 180, lat: 90 - decoded.y * 180, matrix: Array.from(matrix) };
      draw.call(this, gl, matrix, tile, offset, data);
    };
    window.redNearAltitude = altitude => {
      if (!window.fixedParticle) return 0;
      const { lng, lat, matrix } = fixedParticle;
      const position = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altitude);
      const clip = new DOMMatrix(matrix).transformPoint(new DOMPoint(position.x, position.y, position.z));
      const x = Math.round((clip.x / clip.w + 1) * 256);
      const y = Math.round((clip.y / clip.w + 1) * 256);
      if (x < 4 || y < 4 || x > 507 || y > 507) return 0;
      const gl = layer.gl, pixels = new Uint8Array(9 * 9 * 4);
      gl.readPixels(x - 4, y - 4, 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let red = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 100 && pixels[i + 1] < 50 && pixels[i + 2] < 50) red++;
      }
      return red;
    };
  });
  await expect.poll(() => page.evaluate(() => redNearAltitude(3030))).toBeGreaterThan(0);
  expect(await page.evaluate(() => redNearAltitude(0))).toBe(0);
  await page.evaluate(() => map.setTerrain({ source: "terrain", exaggeration: 2 }));
  await expect.poll(() => page.evaluate(() => redNearAltitude(4030))).toBeGreaterThan(0);
  // Bypass the public property's nonnegative constraint only for this test:
  // a point inside the mountain must be hidden by the shared depth buffer.
  await page.evaluate(() => { layer.particleAltitude = -100; });
  await expect.poll(() => page.evaluate(() => redPixels())).toBe(0);
  await page.evaluate(() => { layer.particleAltitude = 30; });
  await expect.poll(() => page.evaluate(() => redNearAltitude(4030))).toBeGreaterThan(0);
  const warnings = [];
  page.on("console", message => {
    if (message.type() === "warning" && message.text().startsWith("windgl: terrain")) warnings.push(message.text());
  });
  await page.evaluate(() => { layer.terrainSupported = false; });
  await expect.poll(() => page.evaluate(() => redPixels())).toBe(0);
  await expect.poll(() => warnings.length).toBe(1);
  await page.evaluate(() => map.setTerrain(null));
  await expect.poll(() => page.evaluate(() => redNearAltitude(30))).toBeGreaterThan(0);
  expect(warnings).toHaveLength(1);
  expect(await page.evaluate(() => glErrors)).toEqual([]);
  expect(await page.evaluate(() => mapErrors)).toEqual([]);
});
