import * as util from "./util";
import Layer from "./layer";
import { particleUpdate, particleDraw, trailFade } from "./shaders/particles.glsl";

/**
 * Weatherlayers-style trails:
 * - Particle heads are rendered as POINTS each frame
 * - Trails are accumulated in an offscreen FBO (trailTexture)
 * - Fade is time-based: multiply by exp(-dt/tau) and subtract a small bias*dt
 * - Composite back to the map with premultiplied alpha
 */
class Particles extends Layer {
  constructor(options) {
    super(
      {
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
      },
      options
    );

    this.pixelToGridRatio = 20;
    this.tileSize = 1024;

    this.dropRate = 0.003;
    this.dropRateBump = 0.01;
    this._numParticles = 1500;

    this._particleTiles = {};

    // time-base for fade
    this._fadePrevTime = null;
  }

  visibleParticleTiles() {
    return this.computeVisibleTiles(2, this.tileSize, {
      minzoom: 0,
      maxzoom: this.windData.maxzoom + 3,
    });
  }

  setParticleColor(expr) {
    this.buildColorRamp(expr);
  }

  initializeParticleTile() {
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

    // dispose offscreen textures for tiles that left view
    const keys = Object.keys(this._particleTiles);
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
        const p = this._particleTiles[key];
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
  }

  initializeParticles(gl, count) {
    const particleRes = (this.particleStateResolution = Math.ceil(Math.sqrt(count)));
    this._numParticles = particleRes * particleRes;

    this._randomParticleState = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < this._randomParticleState.length; i++) {
      this._randomParticleState[i] = Math.floor(Math.random() * 256);
    }

    const particleIndices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++) particleIndices[i] = i;
    this.particleIndexBuffer = util.createBuffer(gl, particleIndices);
  }

  initialize(map, gl) {
    this.updateProgram = particleUpdate(gl);
    this.drawProgram = particleDraw(gl);
    this.fadeProgram = trailFade(gl);

    this.framebuffer = gl.createFramebuffer();

    // Quad for particle update pass
    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    // Fullscreen quad for fade/composite
    this.fadeQuadBuffer = util.createBuffer(
      gl,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    );

    this.initializeParticles(gl, this._numParticles);

    this.nullTexture = util.createTexture(gl, gl.NEAREST, new Uint8Array([0, 0, 0, 0]), 1, 1);
    this.nullTile = { getTexture: () => this.nullTexture };

    // Trail FBOs
    this.setupTrailRendering(gl);

    // Clear trails when camera/view changes
    const self = this;
    this._clearTrails = function () {
      if (!self.trailFramebuffer || !self.tempTrailFramebuffer) return;
      const vp = gl.getParameter(gl.VIEWPORT);
      const fbos = [self.trailFramebuffer, self.tempTrailFramebuffer];
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
      (evt) => map.on(evt, this._clearTrails)
    );

    // Transparent clears
    gl.clearColor(0, 0, 0, 0);

    // Color ramp bootstrap (fallback to white ramp)
    if (!this.colorRampTexture) {
      try {
        this.setParticleColor(this.properties["particle-color"].default);
      } catch (e) {
        const ramp = new Uint8Array(256 * 4);
        for (let i = 0; i < 256; i++) {
          ramp[i * 4 + 0] = 255;
          ramp[i * 4 + 1] = 255;
          ramp[i * 4 + 2] = 255;
          ramp[i * 4 + 3] = 255;
        }
        this.colorRampTexture = util.createTexture(gl, gl.LINEAR, ramp, 256, 1);
      }
    }

    this._onResize = () => this.setupTrailRendering(gl);
    map.on("resize", this._onResize);

    // Keep references
    this.gl = gl;
    this._fadePrevTime =
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  setupTrailRendering(gl) {
    const canvas = gl.canvas;
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);

    // cleanup old
    if (this.trailTexture) {
      gl.deleteTexture(this.trailTexture);
      gl.deleteTexture(this.tempTrailTexture);
      gl.deleteFramebuffer(this.trailFramebuffer);
      gl.deleteFramebuffer(this.tempTrailFramebuffer);
    }

    function mkTex() {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
    this._trailReadyFrames = 0;
  }

  // -------- simulation prerender --------
  prerender(gl) {
    if (!this.windData) return;

    gl.disable(gl.BLEND);

    const tiles = this.visibleParticleTiles();
    for (var i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const found = this.findAssociatedDataTiles(tile);
      if (found) {
        this.update(gl, this._particleTiles[tile], found);
        this._particleTiles[tile].updated = true;
      }
    }

    gl.enable(gl.BLEND);
    this.map.triggerRepaint();
  }

  // -------- draw --------
  render(gl, matrix) {
    if (!this.windData) return;

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);

    this.renderWithTrails(gl, matrix);
  }

  renderWithTrails(gl, matrix) {
    if (!this.trailFramebuffer) return;

    // --- compute dt for time-based fade ---
    var now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    var dt = 16.7;
    if (this._fadePrevTime != null) dt = now - this._fadePrevTime;
    this._fadePrevTime = now;
    dt = Math.max(0.0, Math.min(200.0, dt)) / 1000.0; // clamp to [0..0.2] s

    // More aggressive fade parameters to prevent permanent marks
    const trailSetting = this.particleTrail || 0.3; // 0..1
    const tau = 0.4 + 0.6 * trailSetting;          // 0.4..1.0 s (shorter decay)
    const biasPerSec = 0.08 + 0.05 * (1.0 - trailSetting); // 0.13..0.08 (more aggressive)
    const fadeFactor = Math.exp(-dt / Math.max(1e-4, tau));
    const biasDt = biasPerSec * dt;
    const cutoff = 0.035; // Higher cutoff to eliminate lingering traces

    // A) Clear temp buffer first to ensure no accumulation
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.viewport(0, 0, this._trailWidth, this._trailHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // B) Fade old trails into temp FBO (no blending)
    gl.useProgram(this.fadeProgram.program);
    util.bindTexture(gl, this.trailTexture, 0);
    util.bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    gl.uniform1f(this.fadeProgram.u_fade, fadeFactor);
    gl.uniform1f(this.fadeProgram.u_bias, biasDt);
    gl.uniform1f(this.fadeProgram.u_cutoff, cutoff);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // C) Stamp current heads additively into temp FBO
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    gl.useProgram(this.drawProgram.program);

    // Reduce stamp intensity to prevent over-accumulation
    const stampAlpha = 0.03 + 0.05 * trailSetting; // 0.03..0.08 per frame (reduced)
    gl.uniform1f(this.drawProgram.u_alpha, stampAlpha);

    const tiles = this.visibleParticleTiles();
    for (var i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const found = this.findAssociatedDataTiles(tile);
      if (!found) continue;
      this._drawPoints(gl, matrix, this._particleTiles[tile], tile.viewMatrix(2), found, 1.0);
    }

    // D) Swap trail buffers
    var ttex = this.trailTexture;
    this.trailTexture = this.tempTrailTexture;
    this.tempTrailTexture = ttex;

    var tfbo = this.trailFramebuffer;
    this.trailFramebuffer = this.tempTrailFramebuffer;
    this.tempTrailFramebuffer = tfbo;

    // E) Composite to screen with premultiplied alpha
    const vp = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.fadeProgram.program);
    util.bindTexture(gl, this.trailTexture, 0);
    util.bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    gl.uniform1f(this.fadeProgram.u_fade, 1.0);
    gl.uniform1f(this.fadeProgram.u_bias, 0.0);
    gl.uniform1f(this.fadeProgram.u_cutoff, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // F) Draw bright heads on top with reduced alpha
    gl.useProgram(this.drawProgram.program);
    gl.uniform1f(this.drawProgram.u_alpha, 0.7); // Reduced from 0.85

    for (var j = 0; j < tiles.length; j++) {
      const tile2 = tiles[j];
      const found2 = this.findAssociatedDataTiles(tile2);
      if (!found2) continue;
      this._drawPoints(gl, matrix, this._particleTiles[tile2], tile2.viewMatrix(2), found2, 1.2); // Reduced size boost
    }

    // Periodic trail clearing to prevent any accumulation
    this._frameCount = (this._frameCount || 0) + 1;
    if (this._frameCount % 300 === 0) { // Every 5 seconds at 60fps
      this._clearTrails();
    }
  }

  _drawPoints(gl, matrix, tile, offset, data, sizeBoost) {
    // bind state + ramp
    util.bindTexture(gl, tile.particleStateTexture0, 0);
    util.bindTexture(gl, this.colorRampTexture, 1);

    // wind textures for color ramp sampling
    util.bindTexture(gl, data.tileTopLeft.getTexture(gl), 2);
    util.bindTexture(gl, data.tileTopCenter.getTexture(gl), 3);
    util.bindTexture(gl, data.tileTopRight.getTexture(gl), 4);
    util.bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 5);
    util.bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 6);
    util.bindTexture(gl, data.tileMiddleRight.getTexture(gl), 7);
    util.bindTexture(gl, data.tileBottomLeft.getTexture(gl), 8);
    util.bindTexture(gl, data.tileBottomCenter.getTexture(gl), 9);
    util.bindTexture(gl, data.tileBottomRight.getTexture(gl), 10);

    // attributes
    util.bindAttribute(gl, this.particleIndexBuffer, this.drawProgram.a_index, 1);

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

    // Particle head size scales with zoom
    const currentZoom = this.map && this.map.getZoom ? this.map.getZoom() : 0;
    const zoomScale = Math.max(1.0, Math.min(3.0, Math.pow(2, currentZoom - 2)));
    const sizePx = Math.max(1.0, this.particleSize * zoomScale * sizeBoost);
    gl.uniform1f(this.drawProgram.u_particle_size, sizePx);

    gl.uniform2f(this.drawProgram.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(this.drawProgram.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(this.drawProgram.u_data_matrix, false, data.matrix);

    const vp = gl.getParameter(gl.VIEWPORT);
    gl.uniform2f(this.drawProgram.u_viewport, vp[2], vp[3]);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }

  update(gl, tile, data) {
    util.bindFramebuffer(gl, this.framebuffer, tile.particleStateTexture1);
    gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);

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

    // ping-pong swap
    const temp = tile.particleStateTexture0;
    tile.particleStateTexture0 = tile.particleStateTexture1;
    tile.particleStateTexture1 = temp;
  }

  // ------- Tile helpers (used by prerender/render) -------
  computeLoadableTiles() {
    const result = {};
    const add = function (tile) {
      result[tile] = tile;
    };
    const vis = this.visibleParticleTiles();
    for (var i = 0; i < vis.length; i++) {
      let t = vis[i];
      let matrix = new DOMMatrix();
      while (!t.isRoot()) {
        if (t.z <= this.windData.maxzoom) break;
        const q = t.quadrant();
        matrix.translateSelf(0.5 * q[0], 0.5 * q[1]);
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
    }
    return Object.values(result);
  }

  findAssociatedDataTiles(tileID) {
    let t = tileID;
    let found;
    let matrix = new DOMMatrix();
    while (!t.isRoot()) {
      if ((found = this._tiles[t])) break;
      const q = t.quadrant();
      matrix.translateSelf(0.5 * q[0], 0.5 * q[1]);
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
      tileBottomRight: tileBottomRight || this.nullTile,
    };
  }
}

export default (options) => new Particles(options);
