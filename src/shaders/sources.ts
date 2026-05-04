/**
 * SkSL shader sources for the home-page atmosphere. One module per
 * theme; each file exports a string passed to `Skia.RuntimeEffect.Make`.
 *
 * All shaders share the same uniforms:
 *   uniform float  uTime;   // seconds since mount, monotonic
 *   uniform float2 uRes;    // canvas size in pixels
 *
 * Colour palettes lean dark + low-saturation so the shader sits
 * underneath the existing UI without yelling. The vignette factor at
 * the bottom of each `main` keeps edges close to the app's navy
 * 'colors.bg' so the transition into surrounding elements is seamless.
 *
 * Add new variants by exporting another string and registering it in
 * `index.ts` — `ShaderBackground` picks the active one from there.
 */

// Shared SkSL helpers — pasted at the top of every shader because
// SkSL doesn't support `#include` in our setup. Keeping the noise +
// fbm primitives in sync across themes makes them visually
// consistent (same grain, same brownian flow).
const COMMON = `
float hash(float2 p) {
  p = fract(p * float2(443.897, 441.423));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + float2(0.0, 0.0)), hash(i + float2(1.0, 0.0)), u.x),
    mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(float2 p) {
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
// EARTH — Part 1, "The Earth", Mind-Body
// Forest tones (deep moss / pine / dappled green light) with a slow
// domain-warped flow. Reads as "canopy seen from below, light
// filtering through leaves" rather than tectonic / sediment.
// =====================================================================
export const SHADER_EARTH = `
uniform float uTime;
uniform float2 uRes;

${COMMON}

half4 main(float2 fc) {
  float2 uv = fc / uRes.xy;
  uv -= 0.5;
  uv.x *= uRes.x / uRes.y;

  // Domain warp — push the lookup point through one layer of fbm
  // before sampling the second. Gives the ridges a soft "wind through
  // canopy" feel instead of straight noise blobs.
  float t = uTime * 0.04;
  float2 q = float2(fbm(uv * 1.6 + t), fbm(uv * 1.6 - t + 5.2));
  float n = fbm(uv * 2.4 + q * 1.3 + t * 0.5);

  // Palette: app navy as the floor, deep teal-pine in the mids, a
  // subdued forest-green crest where the noise peaks. Everything
  // hovers around the navy 'colors.bg' value so the shader reads as
  // "the navy gained a green undertone" rather than "a green
  // background".
  half3 navy   = half3(0.000, 0.063, 0.180); // ≈ colors.bg #00102E
  half3 pine   = half3(0.04,  0.11,  0.14);
  half3 forest = half3(0.06,  0.17,  0.11);

  half3 col = mix(navy, pine, smoothstep(0.30, 0.75, n));
  col = mix(col, forest, smoothstep(0.70, 0.95, n) * 0.45);

  // Vignette to anchor the edges to the surrounding navy app
  // background instead of bleeding green to the rim.
  float vig = 1.0 - smoothstep(0.45, 1.15, length(uv));
  col *= 0.6 + 0.4 * vig;

  return half4(col, 1.0);
}
`;

// =====================================================================
// SKY — Part 2, "The Sky", Stability & Equanimity
// Soft cloud field that drifts slowly. Top of the screen leans
// slate-blue, bottom warms toward a faint dawn pink.
// =====================================================================
export const SHADER_SKY = `
uniform float uTime;
uniform float2 uRes;

${COMMON}

half4 main(float2 fc) {
  float2 uv = fc / uRes.xy;
  float aspect = uRes.x / uRes.y;
  float2 p = uv;
  p.x *= aspect;
  p += float2(uTime * 0.015, uTime * 0.005);

  // Two cloud layers offset in scale + speed so they parallax slightly
  // across each other — gives depth without ray-marching.
  float c1 = fbm(p * 1.7);
  float c2 = fbm(p * 3.2 + 4.7);
  float clouds = smoothstep(0.40, 0.85, c1) * 0.7
               + smoothstep(0.55, 0.95, c2) * 0.3;

  // Night-sky palette: deeper indigo at the top, a slightly warmer
  // navy at the bottom where the horizon would sit. Both anchored
  // close to the app's 'colors.bg' (#00102E) so the shader feels
  // like "the navy now has weather" rather than a different bg.
  half3 top    = half3(0.010, 0.040, 0.130);
  half3 bottom = half3(0.000, 0.063, 0.180); // = colors.bg
  half3 base = mix(bottom, top, uv.y);

  // Clouds in cool moonlit blue, never pure white — keeps the
  // night-sky atmosphere and avoids brightening the page.
  half3 cloudCol = half3(0.45, 0.55, 0.78);
  half3 col = mix(base, cloudCol * 0.6, clouds);

  return half4(col, 1.0);
}
`;

// =====================================================================
// SPACE — Part 3, "The Space", Towards Silence
// Three star layers with parallax + a slow purple/magenta nebula.
// =====================================================================
export const SHADER_SPACE = `
uniform float uTime;
uniform float2 uRes;

${COMMON}

float starLayer(float2 p, float density, float bri) {
  float2 i = floor(p);
  float2 f = fract(p);
  float h = hash(i);
  if (h > 1.0 - density) {
    float2 c = float2(hash(i + 1.7), hash(i + 3.1));
    float d = length(f - c);
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + h * 30.0);
    return bri * twinkle * smoothstep(0.06, 0.0, d);
  }
  return 0.0;
}

half4 main(float2 fc) {
  float2 uv = fc / uRes.xy;
  uv -= 0.5;
  uv.x *= uRes.x / uRes.y;

  // Deep cosmic void — anchored to the app's navy so the page
  // doesn't visually shift when this shader takes over.
  half3 voidCol = half3(0.000, 0.020, 0.075); // close to colors.bg

  // Milky-way band: a diagonal Gaussian stripe across the canvas.
  // bandAxis measures perpendicular distance from the band line, so
  // bandMask is bright along the band and falls off smoothly.
  float angle = 0.55; // ~31° tilt
  float2 bandDir = float2(cos(angle), sin(angle));
  float2 perp    = float2(-bandDir.y, bandDir.x);
  float bandAxis = dot(uv, perp);
  // Slow drift along the band direction so dust + stars within it
  // creep across the screen.
  float drift = dot(uv, bandDir) + uTime * 0.012;
  // Soft Gaussian falloff (width ≈ 0.45). Keeps the band well
  // centred on the screen with the rest of the canvas dark.
  float bandMask = exp(-bandAxis * bandAxis * 5.0);

  // Dust within the band — fbm aligned with the drift so the dust
  // looks like it streams through the band rather than hovering.
  float dust = fbm(float2(drift * 3.0, bandAxis * 4.0));
  half3 dustWarm = half3(0.16, 0.12, 0.18); // milky-way warm dust hint
  half3 dustCool = half3(0.04, 0.08, 0.18); // navy-tinted core
  half3 dustCol = mix(dustCool, dustWarm, smoothstep(0.45, 0.85, dust));

  half3 col = voidCol;
  col = mix(col, dustCol, bandMask * 0.85);

  // Star fields. The band's stars are denser + brighter; the rim has
  // sparse pinpoints so the rest of the page never reads as "blank".
  float s = 0.0;
  s += starLayer(uv * 24.0  + float2(uTime * 0.030, 0.0), 0.018, 0.9);
  s += starLayer(uv * 50.0  + float2(uTime * 0.060, 0.0), 0.010, 0.55);
  s += starLayer(uv * 110.0 + float2(uTime * 0.100, 0.0), 0.005, 0.30);
  // Extra-dense band stars, masked by the same Gaussian.
  float bs = 0.0;
  bs += starLayer(uv * 70.0 + float2(uTime * 0.045, 0.0), 0.040, 1.0);
  bs += starLayer(uv * 140.0 + float2(uTime * 0.075, 0.0), 0.025, 0.6);

  col += half3(1.0, 0.97, 0.92) * (s + bs * bandMask * 1.4);

  return half4(col, 1.0);
}
`;

// =====================================================================
// DEFAULT — Intro / boot / logged-out state
// Subtle radial breath so the home doesn't look static, but no
// content cues yet (the user hasn't started or is between volets).
// =====================================================================
export const SHADER_DEFAULT = `
uniform float uTime;
uniform float2 uRes;

half4 main(float2 fc) {
  float2 uv = (fc - 0.5 * uRes) / uRes.y;
  float r = length(uv);
  float pulse = 0.5 + 0.5 * sin(uTime * 0.25);
  float glow = exp(-r * 2.4) * (0.5 + 0.25 * pulse);

  half3 base   = half3(0.012, 0.028, 0.075);
  half3 accent = half3(0.04,  0.10,  0.18);
  half3 col = mix(base, accent, glow);

  return half4(col, 1.0);
}
`;
