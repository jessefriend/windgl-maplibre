precision highp float;

#pragma glslify: wgs84ToMercator = require(./wgs84ToMercator)
#pragma glslify: transform       = require(./transform)

/* ========= Shared samplers & params used across passes ========= */

uniform sampler2D u_particles;        // particle state (curr)
uniform sampler2D u_color_ramp;

uniform sampler2D u_wind_top_left;
uniform sampler2D u_wind_top_center;
uniform sampler2D u_wind_top_right;
uniform sampler2D u_wind_middle_left;
uniform sampler2D u_wind_middle_center;
uniform sampler2D u_wind_middle_right;
uniform sampler2D u_wind_bottom_left;
uniform sampler2D u_wind_bottom_center;
uniform sampler2D u_wind_bottom_right;

uniform vec2  u_wind_res;
uniform vec2  u_wind_min;
uniform vec2  u_wind_max;
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;
uniform mat4  u_data_matrix;
uniform bool  u_initialize;

uniform float u_particles_res;
uniform mat4  u_matrix;
uniform mat4  u_offset;

uniform float u_particle_size;     // px size for heads (draw pass)
uniform vec2  u_viewport;          // only used by some draw variants; harmless here

/* ========= Common helpers ========= */

const vec3 RAND_C = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
  float t = dot(RAND_C.xy, co);
  return fract(sin(t) * (RAND_C.z + t));
}

// 3x3 tile lookup (input in -1..2)
vec2 windTexture(const vec2 uv) {
  if (uv.x > 1. && uv.y > 1.)      return texture2D(u_wind_bottom_right,  uv - vec2(1.0, 1.0)).rg;
  else if (uv.x > 0. && uv.y > 1.) return texture2D(u_wind_bottom_center, uv - vec2(0.0, 1.0)).rg;
  else if (uv.y > 1.)              return texture2D(u_wind_bottom_left,   uv - vec2(-1.0, 1.0)).rg;
  else if (uv.x > 1. && uv.y > 0.) return texture2D(u_wind_middle_right,  uv - vec2(1.0, 0.0)).rg;
  else if (uv.x > 0. && uv.y > 0.) return texture2D(u_wind_middle_center, uv - vec2(0.0, 0.0)).rg;
  else if (uv.y > 0.)              return texture2D(u_wind_middle_left,   uv - vec2(-1.0, 0.0)).rg;
  else if (uv.x > 1.)              return texture2D(u_wind_top_right,     uv - vec2(1.0, -1.0)).rg;
  else if (uv.x > 0.)              return texture2D(u_wind_top_center,    uv - vec2(0.0, -1.0)).rg;
  else                              return texture2D(u_wind_top_left,      uv - vec2(-1.0, -1.0)).rg;
}

#pragma glslify: lookup_wind = require(./bilinearWind, windTexture=windTexture, windRes=u_wind_res)

vec2 decodePos(vec4 rgba) {
  // pack: r/g fractional, b/a floor/255
  return vec2(rgba.r / 255.0 + rgba.b,
              rgba.g / 255.0 + rgba.a);
}

/* ================================================================
   UPDATE PROGRAM
   ================================================================ */

attribute vec2 a_pos;  // fullscreen quad for update pass
varying vec2 v_tex_pos;

export void particleUpdateVertex() {
  v_tex_pos   = a_pos;
  gl_Position = vec4(1.0 - 2.0 * a_pos, 0.0, 1.0);
}

// Integrate particle in normalized [0,1]^2 space
vec2 integrate(vec2 pos) {
  vec2 wind_uv  = transform(pos, u_data_matrix);
  vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(wind_uv));
  float speed_t = length(velocity) / max(1e-6, length(u_wind_max));

  // screen-space step; note inverted y to match map coords
  vec2 offset = vec2(velocity.x, -velocity.y) * 0.0001 * u_speed_factor;

  pos = fract(1.0 + pos + offset);

  // stochastic drop to keep distribution healthy
  vec2 seed = (pos + v_tex_pos) * u_rand_seed;
  float drop_rate = u_drop_rate
                  + speed_t * u_drop_rate_bump
                  + smoothstep(0.24, 0.5, length(pos - vec2(0.5)) * 0.7);
  float drop = step(1.0 - drop_rate, rand(seed));

  vec2 random_pos = vec2(0.5 * rand(seed + 1.3) + 0.25,
                         0.5 * rand(seed + 2.1) + 0.25);
  return mix(pos, random_pos, drop);
}

export void particleUpdateFragment() {
  vec4 st  = texture2D(u_particles, v_tex_pos);
  vec2 pos = decodePos(st);

  pos = integrate(pos);
  if (u_initialize) {
    // pre-roll to avoid all particles starting together
    for (int i = 0; i < 100; i++) {
      pos = integrate(pos);
    }
  }

  // encode pos back into RGBA
  gl_FragColor = vec4(fract(pos * 255.0),
                      floor(pos * 255.0) / 255.0);
}

/* ================================================================
   DRAW PROGRAM (POINT SPRITES WITH ROUND HEADS)
   ================================================================ */

attribute float a_index;      // particle id
varying vec2  v_particle_pos; // for wind color sampling

// Alpha for both stamping and head overlay (set from JS)
uniform float u_alpha;

export void particleDrawVertex() {
  // index -> UV in state texture
  float res = u_particles_res;
  vec2  uv  = vec2(fract(a_index / res), floor(a_index / res) / res);

  vec4 rgba = texture2D(u_particles, uv);
  vec2 posRel = decodePos(rgba);

  // world → mercator → clip
  vec2 posWGS = transform(posRel, u_offset);
  vec2 posM   = wgs84ToMercator(posWGS);
  vec4 clip   = u_matrix * vec4(posM, 0.0, 1.0);

  gl_Position = clip;
  gl_PointSize = max(1.0, u_particle_size);

  // keep for wind color in fragment
  v_particle_pos = posRel;
}

export void particleDrawFragment() {
  // Create smooth circular particle heads
  vec2 pc = gl_PointCoord * 2.0 - 1.0;   // [-1,1]
  float r = length(pc);
  
  // Smooth circular falloff with softer edges
  float m = smoothstep(1.0, 0.85, r);    // Softer edge transition
  if (m <= 0.0) discard;

  // color ramp by local wind speed
  vec2 wind_uv = transform(v_particle_pos, u_data_matrix);
  vec2 vel     = mix(u_wind_min, u_wind_max, lookup_wind(wind_uv));
  float speed_t = clamp(length(vel) / max(1e-6, length(u_wind_max)), 0.0, 1.0);

  // ramp lookup (matches your existing ramp layout)
  vec2 ramp_pos = vec2(fract(16.0 * speed_t), floor(16.0 * speed_t) / 16.0);
  vec4 color    = texture2D(u_color_ramp, ramp_pos);

  // Add subtle glow effect for better visibility
  float glow = smoothstep(1.0, 0.6, r) * 0.3;
  float totalAlpha = (m + glow) * u_alpha;
  
  if (totalAlpha < 0.01) discard;

  // premultiplied alpha output
  gl_FragColor = vec4(color.rgb * totalAlpha, totalAlpha);
}

/* ================================================================
   FADE PROGRAM (FULLSCREEN QUAD)
   ================================================================ */

// NOTE: These uniforms are declared ONCE globally above if shared;
// here we add fade-specific ones. DO NOT re-declare u_cutoff twice.
uniform sampler2D u_texture;  // previous trail texture
uniform float     u_fade;     // multiplicative fade = exp(-dt/tau)
uniform float     u_bias;     // subtractive bias per frame = bias_per_sec * dt
uniform float     u_cutoff;   // drop tiny alpha (e.g., 0.02)

attribute vec2 a_position;
varying vec2 v_uv;

export void trailFadeVertex() {
  v_uv        = a_position * 0.5 + 0.5;   // [-1,1] -> [0,1]
  gl_Position = vec4(a_position, 0.0, 1.0);
}

export void trailFadeFragment() {
  vec4 c = texture2D(u_texture, v_uv);

  // More aggressive fade with better precision
  float newAlpha = c.a * u_fade - u_bias;
  
  // Ensure we don't have floating point precision issues
  newAlpha = floor(newAlpha * 1000.0) / 1000.0;
  
  c.a = max(0.0, newAlpha);
  c.rgb *= u_fade;

  // More aggressive cutoff with smoother transition
  if (c.a < u_cutoff) {
    discard;
  }
  
  // Additional safety: if alpha is very small, make it zero
  if (c.a < 0.01) {
    c.a = 0.0;
    c.rgb = vec3(0.0);
  }

  gl_FragColor = c;
}
