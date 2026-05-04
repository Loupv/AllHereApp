/**
 * GLSL ES fragment shaders for the home-page atmosphere — driven via
 * expo-gl on every platform (WebGL on web, OpenGL ES on iOS/Android).
 * Same uniforms across all themes:
 *
 *   uniform float uTime;   // seconds since mount
 *   uniform vec2  uRes;    // canvas size in pixels
 *
 * Vertex shader is a single fullscreen-triangle covering NDC [-1,1]²;
 * `gl_FragCoord` gives pixel-space coordinates the fragment shader
 * normalises to UV.
 *
 * Conversion notes from the previous SkSL versions:
 *   - `half4` → `vec4`
 *   - `half3` → `vec3`
 *   - `float2/3/4` → `vec2/3/4`
 *   - `main(float2 fc)` → `void main()` reading from `gl_FragCoord`
 *   - mat2 init order matches column-major in GLSL.
 */

export const VERTEX_SHADER = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const COMMON = `
precision mediump float;

uniform float uTime;
uniform vec2  uRes;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.02;
    a *= 0.5;
  }
  return v;
}
`;

// =====================================================================
// EARTH — discrete grass blades growing from the bottom.
//
// The previous "stretched FBM" approach read as flame because the
// noise field flowed upward continuously. Real plants don't flow:
// each blade has its own start point, its own height, its own
// life cycle. We simulate that here directly.
//
// Per-fragment algorithm:
//   1. Discretize the X axis into N columns. Each column gets a
//      single blade rooted at its centre (with a per-blade x-jitter
//      so the spacing isn't perfectly uniform).
//   2. Each blade has unique parameters seeded from its column id:
//      max height, max width, sway phase, growth phase offset.
//   3. The blade's CURRENT height is driven by a per-blade clock —
//      a slow rising ramp from 0 → maxHeight, hold, slow fall, with
//      a long quiet phase before the next cycle. So at any time
//      different blades are at different stages: some sprouting,
//      most fully grown, some just settling back.
//   4. Render: a thin filled curve from (bladeBaseX, 0) up to
//      (bladeBaseX + sway, currentHeight). Width tapers towards the
//      tip so blades read pointed.
// We run this for two passes (foreground + background scale) to
// give a soft sense of depth without a loop.
// =====================================================================
export const FRAG_EARTH = `
${COMMON}

// Single blade per column, no neighbours and no early continue —
// keeps the shader compatible with GLSL ES 1.0 (WebGL1) which is
// strict about flow control inside loops. The branch leans within
// its own column (sway < column width / 2) so we don't need to
// peek at neighbours.
float blade(vec2 uvLocal, float seed, float densityX, float groundY, float t) {
  float col = floor(uvLocal.x * densityX);
  float h1 = hash(vec2(col, seed));
  float h2 = hash(vec2(col, seed + 7.3));
  float h3 = hash(vec2(col, seed + 13.7));

  // Root x at column centre + jitter (max 30 % of column width)
  // so the row of blades doesn't read as a regular fence.
  float baseX = (col + 0.5 + (h1 - 0.5) * 0.6) / densityX;

  // Per-blade max height. Most blades short (0.10..0.30), a few
  // (h3 > 0.9) reach taller (up to 0.45).
  float maxH = mix(0.10, 0.30, h2);
  maxH += step(0.9, h3) * mix(0.10, 0.20, hash(vec2(col, seed + 19.1)));

  // Growth cycle (24 s, phased per blade so the field is always
  // partially mid-grow / partially holding / partially settling):
  //   0.00 .. 0.20  — grow 0 → 1
  //   0.20 .. 0.85  — hold full
  //   0.85 .. 1.00  — settle 1 → 0
  float cycle = 24.0;
  float phase = mod(t / cycle + h1, 1.0);
  float ramp = smoothstep(0.0, 0.20, phase);
  float fall = 1.0 - smoothstep(0.85, 1.0, phase);
  float growT = ramp * fall;                          // 0 → 1 → 1 → 0
  float curH = maxH * growT;

  // Sway, phase-shifted per blade.
  float sway = sin(t * 0.6 + h1 * 6.28) * 0.010;

  // Distance to blade centreline. Inside the blade body, this
  // function returns a (1 - distance/width) ramp clamped to [0,1].
  float relY = uvLocal.y - groundY;
  float inBody = step(0.0, relY) * step(relY, curH);
  float yT = relY / max(curH, 0.001);
  float centreX = baseX + sway * yT * yT;
  float dx = abs(uvLocal.x - centreX);
  float baseW = mix(0.0028, 0.0050, hash(vec2(col, seed + 23.7)));
  float w = baseW * (1.0 - 0.7 * yT);
  float a = smoothstep(w, 0.0, dx);

  return inBody * a;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  // Aspect-corrected coordinates for the vignette only — the
  // blade renderer wants raw uv so columns are evenly spread
  // across the canvas regardless of aspect.
  vec2 p = uv - 0.5;
  p.x *= uRes.x / uRes.y;
  float t = uTime;

  // Foreground grass: dense, sharp, rooted at the bottom of the
  // screen so the bulk of the foliage hugs the lower third.
  float grass = blade(uv, 11.0, 70.0, 0.0, t);

  // Mid-ground blades: fewer per column, taller, rooted slightly
  // lower for layered parallax depth.
  float midGrass = blade(uv, 31.0, 35.0, -0.05, t) * 0.7;

  // Background sprouts — sparser still, slightly desaturated.
  // Rooted higher so they peek out behind the foreground.
  float sprouts = blade(uv, 53.0, 18.0, 0.10, t * 0.6) * 0.45;

  float blades = max(max(grass, midGrass), sprouts);

  // Palette: navy floor → forest pine for the blades themselves
  // → a slightly brighter dapple for the tips of currently-
  // growing blades (we approximate "currently growing" as: blade
  // alpha > 0 AND fragment is near the top of its blade).
  vec3 navy   = vec3(0.000, 0.063, 0.180);
  vec3 pine   = vec3(0.06,  0.18,  0.11);
  vec3 tipCol = vec3(0.18,  0.34,  0.18);

  vec3 col = navy;
  col = mix(col, pine, blades);
  // Tip highlight — only the topmost portion of any blade gets
  // the lighter green. Quick proxy: weighted by uv.y above some
  // threshold scaled by the local blade alpha.
  col = mix(col, tipCol, blades * smoothstep(0.0, 0.35, uv.y) * 0.3);

  // Soft vignette to fall back to navy at the rim.
  float vig = 1.0 - smoothstep(0.55, 1.25, length(p));
  col *= 0.75 + 0.25 * vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

// =====================================================================
// SKY — night with drifting clouds
// =====================================================================
export const FRAG_SKY = `
${COMMON}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / uRes.y;
  vec2 p = uv;
  p.x *= aspect;
  p += vec2(uTime * 0.015, uTime * 0.005);

  float c1 = fbm(p * 1.7);
  float c2 = fbm(p * 3.2 + 4.7);
  float clouds = smoothstep(0.40, 0.85, c1) * 0.7
               + smoothstep(0.55, 0.95, c2) * 0.3;

  vec3 top    = vec3(0.010, 0.040, 0.130);
  vec3 bottom = vec3(0.000, 0.063, 0.180);
  vec3 base = mix(bottom, top, uv.y);

  vec3 cloudCol = vec3(0.45, 0.55, 0.78);
  vec3 col = mix(base, cloudCol * 0.6, clouds);

  gl_FragColor = vec4(col, 1.0);
}
`;

// =====================================================================
// SPACE — milky way + parallaxed stars
// =====================================================================
export const FRAG_SPACE = `
${COMMON}

float starLayer(vec2 p, float density, float bri) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float h = hash(i);
  if (h > 1.0 - density) {
    vec2 c = vec2(hash(i + 1.7), hash(i + 3.1));
    float d = length(f - c);
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + h * 30.0);
    return bri * twinkle * smoothstep(0.06, 0.0, d);
  }
  return 0.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  uv -= 0.5;
  uv.x *= uRes.x / uRes.y;

  vec3 voidCol = vec3(0.000, 0.020, 0.075);

  float angle = 0.55;
  vec2 bandDir = vec2(cos(angle), sin(angle));
  vec2 perp    = vec2(-bandDir.y, bandDir.x);
  float bandAxis = dot(uv, perp);
  float drift = dot(uv, bandDir) + uTime * 0.012;
  float bandMask = exp(-bandAxis * bandAxis * 5.0);

  float dust = fbm(vec2(drift * 3.0, bandAxis * 4.0));
  vec3 dustWarm = vec3(0.16, 0.12, 0.18);
  vec3 dustCool = vec3(0.04, 0.08, 0.18);
  vec3 dustCol = mix(dustCool, dustWarm, smoothstep(0.45, 0.85, dust));

  vec3 col = voidCol;
  col = mix(col, dustCol, bandMask * 0.85);

  float s = 0.0;
  s += starLayer(uv * 24.0  + vec2(uTime * 0.030, 0.0), 0.018, 0.9);
  s += starLayer(uv * 50.0  + vec2(uTime * 0.060, 0.0), 0.010, 0.55);
  s += starLayer(uv * 110.0 + vec2(uTime * 0.100, 0.0), 0.005, 0.30);
  float bs = 0.0;
  bs += starLayer(uv * 70.0  + vec2(uTime * 0.045, 0.0), 0.040, 1.0);
  bs += starLayer(uv * 140.0 + vec2(uTime * 0.075, 0.0), 0.025, 0.6);

  col += vec3(1.0, 0.97, 0.92) * (s + bs * bandMask * 1.4);

  gl_FragColor = vec4(col, 1.0);
}
`;

// =====================================================================
// DEFAULT — subtle pulse
// =====================================================================
export const FRAG_DEFAULT = `
${COMMON}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(uv);
  float pulse = 0.5 + 0.5 * sin(uTime * 0.25);
  float glow = exp(-r * 2.4) * (0.5 + 0.25 * pulse);

  vec3 base   = vec3(0.012, 0.028, 0.075);
  vec3 accent = vec3(0.04,  0.10,  0.18);
  vec3 col = mix(base, accent, glow);

  gl_FragColor = vec4(col, 1.0);
}
`;

import type { ShaderTheme } from './index';

export const FRAG_FOR_THEME: Record<ShaderTheme, string> = {
  default: FRAG_DEFAULT,
  earth: FRAG_EARTH,
  sky: FRAG_SKY,
  space: FRAG_SPACE,
};
