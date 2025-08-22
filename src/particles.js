import * as util from "./util";
import Layer from "./layer";

import { particleUpdate, particleDraw } from "./shaders/particles.glsl";

class Particles extends Layer {
  constructor(options) {
    super(
      {
        "particle-color": {
          type: "color",
          default: "white",
          expression: { interpolated: true, parameters: ["zoom", "feature"] },
          "property-type": "data-driven"
        },
        "particle-speed": {
          type: "number",
          minimum: 0,
          default: 0.75,
          transition: true,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant"
        },
        "particle-size": {
          type: "number",
          minimum: 0.1,
          default: 2.0,
          transition: true,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant"
        },
        "particle-trail": {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.05,
          transition: true,
          expression: { interpolated: true, parameters: ["zoom"] },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.pixelToGridRatio = 20;
    this.tileSize = 1024;

    this.dropRate = 0.003;
    this.dropRateBump = 0.01;
    this._numParticles = 5000;

    this._particleTiles = {};

    // Trail effect
    this.trailEnabled = false;
    this.trailFadeRate = 0.98;
  }

  visibleParticleTiles() {
    return this.computeVisibleTiles(2, this.tileSize, {
      minzoom: 0,
      maxzoom: this.windData.maxzoom + 3
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
    Object.keys(this._particleTiles).forEach((tile) => {
      if (tiles.filter((t) => t.toString() == tile).length === 0) {
        // cleanup
        this.gl.deleteTexture(tile.particleStateTexture0);
        this.gl.deleteTexture(tile.particleStateTexture1);
        delete this._particleTiles[tile];
      }
    });
    tiles.forEach((tile) => {
      if (!this._particleTiles[tile]) {
        this._particleTiles[tile] = this.initializeParticleTile();
      }
    });
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

    this.framebuffer = gl.createFramebuffer();

    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.initializeParticles(gl, this._numParticles);

    this.nullTexture = util.createTexture(gl, gl.NEAREST, new Uint8Array([0, 0, 0, 0]), 1, 1);

    this.nullTile = {
      getTexture: () => this.nullTexture
    };

    // Setup trail rendering components
    this.setupTrailRendering(gl);

    this._onResize = () => this.setupTrailRendering(gl);
    map.on("resize", this._onResize);
  }

  // mapbox prerender callback
  prerender(gl) {
    if (this.windData) {
      const blendingEnabled = gl.isEnabled(gl.BLEND);
      gl.disable(gl.BLEND);
      const tiles = this.visibleParticleTiles();
      tiles.forEach((tile) => {
        const found = this.findAssociatedDataTiles(tile);
        if (found) {
          this.update(gl, this._particleTiles[tile], found);
          this._particleTiles[tile].updated = true;
        }
      });
      if (blendingEnabled) gl.enable(gl.BLEND);
      this.map.triggerRepaint();
    }
  }

  computeLoadableTiles() {
    const result = {};
    const add = (tile) => (result[tile] = tile);
    this.visibleParticleTiles().forEach((tileID) => {
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
    while (!t.isRoot()) {
      if ((found = this._tiles[t])) break;
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

  setupTrailRendering(gl) {
    const canvas = gl.canvas;
    const width = Math.max(1, Math.floor(canvas.width));
    const height = Math.max(1, Math.floor(canvas.height));

    // Clean up old
    if (this.trailTexture) {
      gl.deleteTexture(this.trailTexture);
      gl.deleteTexture(this.tempTrailTexture);
      gl.deleteFramebuffer(this.trailFramebuffer);
      gl.deleteFramebuffer(this.tempTrailFramebuffer);
    }

    // Allocate 1:1 with the framebuffer size (device pixels)
    const empty = new Uint8Array(width * height * 4);
    const makeTex = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, empty);
      return tex;
    };

    this.trailTexture = makeTex();
    this.tempTrailTexture = makeTex();

    this.trailFramebuffer = gl.createFramebuffer();
    this.tempTrailFramebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.trailTexture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tempTrailTexture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (!this.fadeProgram) this.createFadeShader(gl);

    this.trailEnabled = true;
    this.lastZoom = this.map.getZoom();
    this._trailWidth = width;
    this._trailHeight = height;
    this._trailReadyFrames = 0; // warm-up
  }

  render(gl, matrix) {
    if (!this.windData) return;

    // Recreate trail textures if zoom changed significantly
    const currentZoom = this.map.getZoom();
    if (Math.abs(currentZoom - (this.lastZoom || 0)) > 0.5) {
      this.setupTrailRendering(gl);
    }

    if (this.trailEnabled) {
      this.renderWithTrails(gl, matrix);
      if (this._trailReadyFrames < 2) this._trailReadyFrames++;
    } else {
      this.renderNormal(gl, matrix);
    }
  }

  renderNormal(gl, matrix) {
    const tiles = this.visibleParticleTiles();
    tiles.forEach((tile) => {
      const found = this.findAssociatedDataTiles(tile);
      if (!found) return;
      // No trails: single stamp at t=1, alpha=1
      this.draw(gl, matrix, this._particleTiles[tile], tile.viewMatrix(2), found, 1.0, 1.0);
    });
  }

  createFadeShader(gl) {
    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_fade;
      varying vec2 v_texCoord;
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        gl_FragColor = vec4(color.rgb, color.a * u_fade);
      }
    `;

    this.fadeProgram = util.createProgram(gl, vertexSource, fragmentSource);
    this.fadeQuadBuffer = util.createBuffer(
      gl,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    );
  }

  // Trail rendering with accumulation + multi-stamp interpolation
  renderWithTrails(gl, matrix) {
    if (!this.fadeProgram || !this.trailTexture) return this.renderNormal(gl, matrix);

    // ----- 1) Fade existing trail into temp FBO -----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempTrailFramebuffer);
    gl.viewport(0, 0, this._trailWidth, this._trailHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.fadeProgram.program);
    util.bindTexture(gl, this.trailTexture, 0);
    util.bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);

    // Shorter trails as requested
    const fadeRate = Math.min(0.98, 0.9 + (this.particleTrail || 0.05) * 0.06);
    gl.uniform1f(this.fadeProgram.u_fade, fadeRate);
    gl.uniform1i(this.fadeProgram.u_texture, 0);

    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // ----- 2) Render new particles (multi-stamp) into the same temp FBO -----
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const tiles = this.visibleParticleTiles();
    const SUBSTEPS = 3;
    const baseAlpha = 1.0 / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
      const t = (s + 1) / SUBSTEPS; // (0,1]
      tiles.forEach((tile) => {
        const found = this.findAssociatedDataTiles(tile);
        if (!found) return;
        this.draw(gl, matrix, this._particleTiles[tile], tile.viewMatrix(2), found, t, baseAlpha);
      });
    }

    // ----- 3) Swap ping-pong trail textures -----
    [this.trailTexture, this.tempTrailTexture] = [this.tempTrailTexture, this.trailTexture];
    [this.trailFramebuffer, this.tempTrailFramebuffer] = [this.tempTrailFramebuffer, this.trailFramebuffer];

    // ----- 4) Composite to default framebuffer at native resolution -----
    const vp = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);

    gl.useProgram(this.fadeProgram.program);
    util.bindTexture(gl, this.trailTexture, 0);
    util.bindAttribute(gl, this.fadeQuadBuffer, this.fadeProgram.a_position, 2);
    gl.uniform1i(this.fadeProgram.u_texture, 0);
    gl.uniform1f(this.fadeProgram.u_fade, 1.0);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  }

  // Draw a single pass; now accepts substep 't' and 'alpha' so uniforms are set on the correct program
  draw(gl, matrix, tile, offset, data, interpT = 1.0, trailAlpha = 1.0) {
    const program = this.drawProgram;
    gl.useProgram(program.program);

    // Particle state (current & previous)
    util.bindTexture(gl, tile.particleStateTexture0, 0);
    util.bindTexture(gl, tile.particleStateTexture1, 11);
    util.bindTexture(gl, this.colorRampTexture, 1);

    // Wind textures
    util.bindTexture(gl, data.tileTopLeft.getTexture(gl), 2);
    util.bindTexture(gl, data.tileTopCenter.getTexture(gl), 3);
    util.bindTexture(gl, data.tileTopRight.getTexture(gl), 4);
    util.bindTexture(gl, data.tileMiddleLeft.getTexture(gl), 5);
    util.bindTexture(gl, data.tileMiddleCenter.getTexture(gl), 6);
    util.bindTexture(gl, data.tileMiddleRight.getTexture(gl), 7);
    util.bindTexture(gl, data.tileBottomLeft.getTexture(gl), 8);
    util.bindTexture(gl, data.tileBottomCenter.getTexture(gl), 9);
    util.bindTexture(gl, data.tileBottomRight.getTexture(gl), 10);

    util.bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);

    // Sampler bindings
    gl.uniform1i(program.u_particles, 0);
    gl.uniform1i(program.u_particles_prev, 11);
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

    // Other uniforms
    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);
    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniform1f(program.u_particle_size, this.particleSize);

    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_data_matrix, false, data.matrix);

    // Substep interpolation + per-substep alpha (set on the correct program)
    if (program.u_interp_t) gl.uniform1f(program.u_interp_t, interpT);
    if (program.u_trail_alpha) gl.uniform1f(program.u_trail_alpha, trailAlpha);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }
}

export default (options) => new Particles(options);
