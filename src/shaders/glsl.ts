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
precision highp float;

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

// Triangular-PDF dither, ~1 LSB of an 8-bit channel. Added to the
// final colour to break up gradient banding. On Android GPUs that
// don't honour \`highp\` in the fragment stage (it's optional in
// GLES2) the smooth vertical sky gradient quantises into visible
// horizontal bars; a sub-perceptual dither dissolves them without
// touching devices that render the gradient correctly. Two hash
// samples give a triangular distribution (less structured than a
// single uniform sample).
vec3 dither(vec2 fragCoord) {
  float r = hash(fragCoord);
  float g = hash(fragCoord + 17.13);
  return vec3((r + g - 1.0) / 255.0);
}
`;

export const FRAG_EARTH_MINIMAL = `
${COMMON}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float n = fbm(vec2(uv.x * 30.0, uv.y * 4.0));
  float blades = pow(1.0 - abs(2.0 * n - 1.0), 4.0);
  // FULL bright green to verify the shader covers the whole screen
  vec3 col = mix(vec3(0.0, 0.5, 0.0), vec3(1.0, 1.0, 0.0), blades);
  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

// =====================================================================
// EARTH — grass field viewed from above. Multi-scale voronoi cells
// stand in for tufts of grass; domain-warped fbm overlay gives the
// terrain organic mottling. Slow horizontal drift simulates a
// breeze passing through the field. Stays anchored to navy with a
// low-saturation forest palette so the page reads as a quiet
// patch of ground rather than a green wall.
// =====================================================================
// =====================================================================
// EARTH — small lake viewed from above. Concentric ripples
// expanding from a few moving "drop points", a fine surface
// shimmer, and a depth gradient so the centre reads as deeper
// than the rim. Stays anchored to navy with teal/seaweed accents
// so the page feels like a still pond at dusk, not a bright sea.
// =====================================================================
export const FRAG_EARTH_TOPDOWN = `
${COMMON}

// One ripple from a centre point. \`waveSpeed\` and \`spreadSpeed\`
// let each drop have its own pace, so the lake doesn't read as a
// single regular metronome. \`age\` is the time since this drop
// "landed", looping over \`cycle\`; \`life\` fades the amplitude as
// the drop ages out.
float ripple(vec2 p, vec2 centre, float age, float cycle,
             float waveSpeed, float spreadSpeed, float k) {
  float d = length(p - centre);
  float wave = sin(d * k - age * waveSpeed);
  float wavefront = age * spreadSpeed;
  float front = smoothstep(wavefront, wavefront - 0.08, d);
  float life = 1.0 - smoothstep(0.0, cycle, age);
  return wave * front * life * 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = uv;
  p.x *= uRes.x / uRes.y;

  vec2 centre = vec2(0.5 * uRes.x / uRes.y, 0.5);

  // Slowed 4× again — surface now barely moves; rings expand
  // over ~6-9 minutes. Reads as a contemplative still pond.
  float a1 = mod(uTime + 0.0,  380.0);
  float a2 = mod(uTime + 4.7,  248.0);
  float a3 = mod(uTime + 8.3,  520.0);
  vec2 c1 = centre + vec2(cos(uTime * 0.0045),        sin(uTime * 0.0063))        * 0.22;
  vec2 c2 = centre + vec2(cos(uTime * 0.0033 + 1.2),  sin(uTime * 0.0040 + 0.5))  * 0.32;
  vec2 c3 = centre + vec2(cos(uTime * 0.0058 + 2.7),  sin(uTime * 0.0048 + 1.9))  * 0.16;
  float macroRipples = ripple(p, c1, a1, 380.0, 0.140, 0.0035, 28.0)
                     + ripple(p, c2, a2, 248.0, 0.200, 0.0050, 36.0)
                     + ripple(p, c3, a3, 520.0, 0.115, 0.0025, 22.0);

  float b1 = mod(uTime + 1.7,  312.0);
  float b2 = mod(uTime + 6.3,  416.0);
  vec2 m1 = centre + vec2(cos(uTime * 0.0050 + 3.2),  sin(uTime * 0.0060 + 0.9))  * 0.28;
  vec2 m2 = centre + vec2(cos(uTime * 0.0040 + 4.8),  sin(uTime * 0.0048 + 2.4))  * 0.20;
  // High-k wave numbers softened (65/80 → 38/48) so the micro-ripples
  // read as gentle wavelets instead of a busy crackle on the surface.
  float microRipples = ripple(p, m1, b1, 312.0, 0.165, 0.0033, 38.0)
                     + ripple(p, m2, b2, 416.0, 0.125, 0.0020, 48.0);

  // Reduce the micro contribution into the macro carrier so the
  // overall ripple field has less HF energy.
  float ripples = macroRipples * (1.0 + microRipples * 0.4) + microRipples * 0.18;

  // Coarser shimmer (14 → 7) — same energy, lower spatial frequency,
  // less "noisy" surface. Threshold tightened so only the clearest
  // peaks register, leaving the rest of the surface smoother.
  float shimmer = fbm(p * 7.0 + ripples * 0.6 + uTime * 0.0025);
  shimmer = smoothstep(0.55, 0.85, shimmer);

  float caustics = fbm(p * 2.6 + uTime * 0.00075);

  // Depth: distance from lake centre. Centre = darkest (deep
  // water), rim = slightly lighter (shallows). We then add a
  // soft outer vignette so the very edges fall back to navy.
  float fromCentre = length(p - centre);
  float depth = 1.0 - smoothstep(0.10, 0.65, fromCentre);

  // Palette pivot — pull towards blue and lift the highlights so
  // the lake reads as moonlit-water rather than dark teal pond.
  vec3 navy   = vec3(0.000, 0.063, 0.180);
  vec3 deep   = vec3(0.010, 0.050, 0.190); // deep blue water
  vec3 mid    = vec3(0.040, 0.130, 0.260); // mid blue
  vec3 light  = vec3(0.220, 0.380, 0.520); // brighter blue highlight

  vec3 col = navy;
  col = mix(col, deep, depth * 0.85);
  col = mix(col, mid,  smoothstep(0.30, 0.75, caustics) * (0.55 + 0.40 * depth));
  // Ripple body — crests lift more in blue than green/red so the
  // wave tops glow with a watery sheen.
  col += vec3(0.05, 0.10, 0.18) * ripples;
  // Specular peaks where shimmer + ripple crests align. Factor
  // dialled back (1.0 → 0.55) so the sparkle reads as occasional
  // glints rather than a high-frequency haze across the whole pond.
  col = mix(col, light, shimmer * smoothstep(0.05, 0.20, ripples) * 0.55);

  // Outer vignette to anchor the page edges back to navy.
  float vig = 1.0 - smoothstep(0.55, 1.20, fromCentre * 1.6);
  col *= 0.7 + 0.3 * vig;

  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
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

// Distance from point p to the line segment a→b. Returns the
// shortest distance, used to render thin straight blades.
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Render blades inside a single cell. 3 blades per cell —
// combined with a denser 40-per-unit grid below this is enough
// to fill the field with overlapping blades while staying
// affordable on the GPU.
float bladesInCell(vec2 p, vec2 cell, float windAmp, float windPhase) {
  float result = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 seed = cell + vec2(fi * 13.1, fi * 17.7);
    float h1 = hash(seed);
    float h2 = hash(seed + 1.7);
    float h3 = hash(seed + 5.3);
    float h4 = hash(seed + 9.1);
    float h5 = hash(seed + 11.3);

    // Root anywhere in the cell so blades cluster naturally
    // rather than queueing up at the bottom.
    vec2 root = cell + vec2(h1, h2);

    // Lengths span 1.0..2.2 cells so blades overlap their
    // neighbours significantly — fills the gaps the previous
    // 0.5-cell-long blades left visible.
    float bladeLen = mix(1.0, 2.0, h3);
    if (h4 > 0.85) bladeLen *= 1.4;
    float baseW = mix(0.060, 0.110, h5);

    // Angle — mostly upward, leaning ±30°.
    float lean = (h4 - 0.5) * 1.05;
    float bladeWind = sin(windPhase + h1 * 6.28) * windAmp;
    float angle = 1.5708 + lean + bladeWind;

    vec2 tip = root + vec2(cos(angle), sin(angle)) * bladeLen;

    // Distance to tapered centreline.
    vec2 pa = p - root;
    vec2 ba = tip - root;
    float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 closest = root + ba * t;
    float d = length(p - closest);
    float w = baseW * (1.0 - 0.7 * t);

    float a = 1.0 - smoothstep(0.0, w, d);
    float bri = 0.55 + 0.45 * h5;
    result = max(result, a * bri);
  }
  return result;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = uv;
  p.x *= uRes.x / uRes.y;

  // Hill / group mask — low-frequency fbm picks where the grass
  // is denser (peaks → tufts) and where it thins out.
  float hillN1 = fbm(p * 1.5 + vec2(uTime * 0.008, 0.0));
  float hillN2 = fbm(p * 3.5 + vec2(0.0, uTime * 0.012) + 5.7);
  float hill = hillN1 * 0.7 + hillN2 * 0.4;
  // Floor at 0.55 so even sparse zones still carry visible
  // blades — no "patchy bald" look between clusters.
  float groupMask = 0.55 + 0.45 * smoothstep(0.30, 0.85, hill);

  // Wind parameters — boosted amplitude so the sway is clearly
  // visible motion. \`windPhase\` runs faster too so the field
  // breathes at a noticeable cadence (gusts every ~3 seconds).
  float windAmp   = 0.14 + 0.08 * sin(uTime * 0.32);
  float windPhase = uTime * 0.85;

  // Vertical perspective — cell grid frequency rises near the
  // top of the screen so distant blades pack tighter.
  float depthScale = 1.0 + smoothstep(0.20, 1.0, uv.y) * 1.6;

  // Denser cell grid — 40 cells per unit, so the SDF blades pack
  // tightly enough to overlap into a continuous field.
  float gridX = 40.0 * depthScale;
  float gridY = 40.0 * depthScale;
  vec2 cellP = vec2(p.x * gridX, p.y * gridY);
  vec2 cellId = floor(cellP);

  // Skip the (expensive) 3×3 blade loop entirely on pixels well
  // above the horizon — they'd be masked to zero anyway. Halves
  // the per-frame work since the upper half of the screen is now
  // a pure background pass.
  float blades = 0.0;
  if (uv.y < 0.58) {
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 cell = cellId + vec2(float(dx), float(dy));
        blades = max(blades, bladesInCell(cellP, cell, windAmp, windPhase));
      }
    }
    blades *= groupMask;
  }

  // Horizon mask — grass fades out across a wide soft band so the
  // green-to-sky transition reads as atmospheric haze, not a line.
  float horizonMask = 1.0 - smoothstep(0.30, 0.62, uv.y);
  blades *= horizonMask;

  // Background gradient: deep ground at the bottom → mid-green
  // mossy band → atmospheric haze (greenish-blue) → navy sky.
  // Three stops so the colour change is progressive instead of a
  // single mossy↔navy mix that produces a visible seam.
  float floorN = fbm(p * 1.6 + vec2(0.0, uTime * 0.02));
  vec3 ground = mix(vec3(0.010, 0.070, 0.050), vec3(0.030, 0.130, 0.080), smoothstep(0.30, 0.70, floorN));
  vec3 haze   = vec3(0.020, 0.090, 0.140);   // misty teal — bridges green→navy
  vec3 skyCol = vec3(0.005, 0.040, 0.140);
  vec3 base = ground;
  base = mix(base, haze,   smoothstep(0.28, 0.55, uv.y));
  base = mix(base, skyCol, smoothstep(0.50, 0.90, uv.y));

  // Distant hills above the horizon — two silhouette layers with
  // atmospheric perspective: their colour fades toward the sky as
  // uv.y rises, and their top edges are softened over a wider band
  // so the silhouettes melt into the haze rather than cutting it.
  float horizon = 0.50;
  // Far hills.
  float hFar = fbm(vec2(p.x * 1.3 + uTime * 0.005, 0.0));
  float farTop = horizon + 0.05 + hFar * 0.06;
  float farMask = (1.0 - smoothstep(farTop - 0.04, farTop + 0.01, uv.y))
                * smoothstep(horizon - 0.02, horizon + 0.04, uv.y);
  // Near hills (rolling closer to the camera, taller).
  float hNear = fbm(vec2(p.x * 0.9 + uTime * 0.003 + 7.3, 0.0));
  float nearTop = horizon + 0.02 + hNear * 0.10;
  float nearMask = (1.0 - smoothstep(nearTop - 0.05, nearTop + 0.005, uv.y))
                 * smoothstep(horizon - 0.03, horizon + 0.03, uv.y);
  vec3 farCol  = vec3(0.020, 0.080, 0.110);   // distant cool-green
  vec3 nearCol = vec3(0.030, 0.110, 0.080);   // closer green
  // Atmospheric fade — hills lose saturation as they rise, mixing
  // toward the surrounding haze/sky so their tops dissolve.
  float farAtm  = smoothstep(horizon, horizon + 0.12, uv.y);
  float nearAtm = smoothstep(horizon, horizon + 0.16, uv.y);
  farCol  = mix(farCol,  haze,   farAtm * 0.85);
  nearCol = mix(nearCol, haze,   nearAtm * 0.55);
  base = mix(base, farCol, farMask);
  base = mix(base, nearCol, nearMask);

  // Floating specks above the horizon — pollen / distant
  // fireflies. Hashed per cell, drift slowly upward, each one
  // twinkles independently. Sparse so the upper sky stays calm.
  vec2 sCellP = vec2(p.x * 18.0, (uv.y - horizon) * 24.0 - uTime * 0.20);
  vec2 sCell = floor(sCellP);
  vec2 sFrac = fract(sCellP);
  float sH = hash(sCell);
  float speckExists = step(0.985, sH);
  vec2 sCentre = vec2(hash(sCell + 1.7), hash(sCell + 3.1));
  float sD = length(sFrac - sCentre);
  float sTwinkle = 0.5 + 0.5 * sin(uTime * 1.6 + sH * 30.0);
  float speck = (1.0 - smoothstep(0.0, 0.08, sD)) * speckExists * sTwinkle;
  // Specks only above horizon, not on hills.
  float speckMask = smoothstep(horizon + 0.02, horizon + 0.10, uv.y)
                  * (1.0 - max(farMask, nearMask));
  base += vec3(0.40, 0.55, 0.30) * speck * speckMask * 0.35;

  // Blade palette — dark green base, mid green main, brighter tips.
  vec3 dark = vec3(0.040, 0.140, 0.090);
  vec3 midG = vec3(0.140, 0.300, 0.130);
  vec3 lite = vec3(0.320, 0.520, 0.220);

  vec3 col = base;
  col = mix(col, dark, smoothstep(0.10, 0.45, blades));
  col = mix(col, midG, smoothstep(0.40, 0.80, blades));
  col = mix(col, lite, smoothstep(0.75, 1.00, blades) * 0.8);

  // Vignette to fall back into navy at the rim.
  float vig = 1.0 - smoothstep(0.55, 1.25, length(uv - 0.5) * 1.6);
  col *= 0.80 + 0.20 * vig;

  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

// =====================================================================
// SKY — layered cumulus with volumetric-feel lighting.
// Three cloud layers (back/mid/front) at increasing scale and
// brightness; each layer's silhouette is a thresholded 2-D fbm.
// Shading per pixel comes from comparing the cloud density at p
// against p - lightDir * eps: if density is higher at p (i.e. the
// cloud surface is facing the light), the pixel is bright; if
// it's lower, the pixel is on the unlit underside, painted
// darker. A subtle warm rim adds a soft golden edge where the
// silhouette crosses from cloud → sky, evoking late-afternoon
// light.
// =====================================================================
export const FRAG_SKY = `
${COMMON}

// Cloud density field — 2D fbm sampled at the given scale,
// then thresholded for puffy cumulus silhouettes. \`thresh\`
// shifts how much sky vs cloud you get (lower = more cloud).
// Wider smoothstep range gives softer, cottony edges. We also
// run a smoothstep on the noise BEFORE thresholding so the
// internal density curve is smoother, killing the granular
// "noise" feel and pushing cloud bodies toward filled puffs.
float cloudField(vec2 p, float scale, float seed, float thresh) {
  vec2 q = p * scale + vec2(seed, seed * 1.7);
  float n = fbm(q);
  // Smoothify the noise so the body density transitions in soft
  // curves rather than the raw fbm jitter — reads as cotton.
  n = smoothstep(0.10, 0.90, n);
  return smoothstep(thresh, thresh + 0.45, n);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / uRes.y;
  vec2 p = uv;
  p.x *= aspect;

  // Per-layer drift — back layer barely moves (distant), mid is
  // the reference rate, front drifts faster (parallax). Drift
  // is added when sampling each cloudField below, not on p
  // globally, so the three layers slide past each other.
  vec2 driftBack  = vec2(uTime * 0.005, 0.0);
  vec2 driftMid   = vec2(uTime * 0.012, 0.0);
  vec2 driftFront = vec2(uTime * 0.024, 0.0);

  // Day / night cycle over 60 s. 0 = deep night, max ≈ 0.40 =
  // pre-dawn / late-evening (we cap well below "full daylight" so
  // foreground text — circle labels, descriptions, dots — stays
  // legible against the brightest frame of the loop).
  float rawPhase = 0.5 + 0.5 * sin(uTime * 6.28318 / 60.0);
  float dayPhase = smoothstep(0.05, 0.95, rawPhase) * 0.40;
  // Twilight peaks at the rising / falling middle of the cycle.
  // Used below to drive the warm rim — sun rakes the edges of
  // cumulus most strongly at dawn / dusk, fades at full day and
  // disappears at night.
  float twilight = 1.0 - abs(rawPhase * 2.0 - 1.0); // 0..1..0 over phase
  twilight = pow(twilight, 1.5);

  // Density envelope — slow, asymmetric. Most of the time the
  // sky has a partial cumulus deck, occasionally fills.
  float densityNoise = fbm(vec2(uTime * 0.012, 0.0));
  float density = smoothstep(0.40, 0.75, densityNoise);

  // Light direction: implicit sun. We rotate it slightly with
  // the day phase so the lit side of the clouds tracks the
  // implicit sun position over the cycle.
  float sunAngle = mix(2.6, 0.6, dayPhase); // sweeps across the sky
  vec2 lightDir = vec2(cos(sunAngle), sin(sunAngle));
  float eps = 0.018;

  // Three cloud layers: BACK (small distant clouds, high in the
  // sky, dimmest), MID (the main cumulus band across the middle
  // of the screen), FRONT (large dark blobs along the bottom
  // edge). Each layer carries its own silhouette + lighting.
  // Shared threshold scaled by density so the whole sky gets
  // fuller in dense passages — lowered overall so the sky
  // always carries a substantial amount of cloud presence.
  float thresh = mix(0.42, 0.26, density);

  // Internal mottling — softer / lower frequency than before so
  // cloud bodies read as cotton with broad lit/shadow patches
  // rather than a fine noisy texture.
  float mottle = fbm(p * 4.0 + 1.7);

  // ---- BACK layer ---------------------------------------------
  // Distant cumulus. Slowest drift, larger blobs (smaller noise
  // scale = bigger features), upper-third vertical envelope.
  float backV  = smoothstep(0.40, 0.95, uv.y) * (1.0 - smoothstep(0.95, 1.05, uv.y));
  float backD0 = cloudField(p + driftBack, 1.4, 0.0, thresh + 0.03);
  float backDL = cloudField(p + driftBack - lightDir * eps, 1.4, 0.0, thresh + 0.03);
  float backLit = clamp((backD0 - backDL) * 8.0 + 0.35 + (mottle - 0.5) * 0.50, 0.0, 1.0);
  float backMask = backD0 * backV;

  // ---- MID layer (the centrepiece) -----------------------------
  // Reference drift rate. Bigger cumulus deck, larger blobs.
  float midV   = smoothstep(0.10, 0.55, uv.y) * (1.0 - smoothstep(0.85, 1.05, uv.y));
  float midD0  = cloudField(p + driftMid, 0.85, 4.7, thresh);
  float midDL  = cloudField(p + driftMid - lightDir * eps, 0.85, 4.7, thresh);
  float midLit = clamp((midD0 - midDL) * 7.5 + 0.35 + (mottle - 0.5) * 0.55, 0.0, 1.0);
  float midMask = midD0 * midV;

  // ---- FRONT layer (foreground cumulus belly) ------------------
  // Fastest drift (parallax). Larger blobs than before but
  // threshold biased higher so the layer doesn't fill the
  // lower half — just a few big puffy bodies hugging the bottom.
  float frontV  = (1.0 - smoothstep(0.02, 0.40, uv.y));
  float frontD0 = cloudField(p + driftFront, 1.0, 9.3, thresh + 0.01);
  float frontDL = cloudField(p + driftFront - lightDir * eps, 1.0, 9.3, thresh + 0.01);
  float frontLit = clamp((frontD0 - frontDL) * 6.5 + 0.22 + (mottle - 0.5) * 0.60, 0.0, 1.0);
  float frontMask = frontD0 * frontV;

  // Composite the three layers back-to-front. \`clouds\` is the
  // maximum of the three masks, so the visible silhouette comes
  // from whichever layer is densest at each pixel.
  float clouds = max(max(backMask, midMask), frontMask);

  // Mask-weighted blend of the per-layer lit values. The
  // previous version picked the dominant layer with hard ternary
  // selects, which produced visible boundary lines wherever two
  // layers had similar mask values. Weighted average eliminates
  // that.
  float wSum = backMask + midMask + frontMask + 0.0001;
  float lit = (backLit * backMask + midLit * midMask + frontLit * frontMask) / wSum;

  // Warm rim: gradient magnitudes from each layer combined.
  // Smoothed via clamp so peak values at the silhouette edge
  // don't read as hard outlines.
  float rim = clamp((midD0 - midDL) * 14.0, 0.0, 1.0) * 0.85
            + clamp((frontD0 - frontDL) * 11.0, 0.0, 1.0) * 0.55
            + clamp((backD0 - backDL) * 9.0, 0.0, 1.0) * 0.30;
  rim = clamp(rim, 0.0, 1.0) * clouds;

  // Sky background: vertical gradient. Day is now a richer,
  // slightly darker blue so the white cumulus clouds pop with
  // more contrast against it. Night stays close to the app navy.
  vec3 nightTop    = vec3(0.005, 0.025, 0.090);
  vec3 nightBottom = vec3(0.000, 0.063, 0.180);
  vec3 dayTop      = vec3(0.090, 0.260, 0.550);
  vec3 dayBottom   = vec3(0.220, 0.400, 0.640);
  vec3 topCol      = mix(nightTop,    dayTop,    dayPhase);
  vec3 bottomCol   = mix(nightBottom, dayBottom, dayPhase);
  vec3 base = mix(bottomCol, topCol, uv.y);

  // Star field behind the clouds — fixed relative to the
  // viewport (not the drifting p), with each star getting an
  // independent twinkle rate, phase, and peak intensity. Sparse
  // density so the field reads as a quiet sky, not glitter.
  vec2 starUV = uv * vec2(aspect, 1.0);
  vec2 starCell = floor(starUV * 90.0);
  float hExist = hash(starCell);
  float starHere = step(0.987, hExist);
  // Per-star jitter inside its grid cell so the spacing isn't a
  // visible lattice.
  vec2 starJitter = vec2(hash(starCell + 7.1), hash(starCell + 13.3));
  vec2 starCentre = (starCell + 0.5 + (starJitter - 0.5) * 0.6) / 90.0;
  float starD = length(starUV - starCentre);
  // Per-star size variation — brighter stars are slightly bigger.
  float hSize = hash(starCell + 19.7);
  float starSize = mix(0.0020, 0.0040, hSize);
  // Per-star peak intensity — most are dim, a few stand out.
  float hBri = hash(starCell + 23.1);
  float maxBri = pow(hBri, 2.5) * 1.0 + 0.20;     // 0.20..1.20, skewed dim
  // Per-star twinkle: independent rate AND phase.
  float hRate  = hash(starCell + 29.3);
  float hPhase = hash(starCell + 31.9);
  float twinkleRate = mix(0.4, 1.8, hRate);       // 0.4..1.8 cycles/s
  float twinkle = 0.55 + 0.45 * sin(uTime * twinkleRate + hPhase * 6.28);
  float starDot = smoothstep(starSize, 0.0, starD) * starHere * twinkle * maxBri;
  // Stars only at night (fade out as dayPhase rises), above the
  // horizon-fade band, and only where clouds aren't blocking.
  float nightMask = 1.0 - smoothstep(0.10, 0.55, dayPhase);
  float starMask = smoothstep(0.05, 0.30, uv.y) * (1.0 - clouds) * nightMask;
  float stars = starDot * starMask;

  vec3 starCol = vec3(0.95, 0.93, 0.88);
  vec3 col = base;
  col += starCol * stars * 0.85;

  // Clouds drawn over the star field — pale moonlit blue, never
  // pure white.
  // Cloud body — punchier whites at day, dimmed at night.
  // Shadow stop lifted slightly so cumulus undersides don't
  // muddy out, and the high stop is pure white so lit tops can
  // overdrive against the darker daytime sky.
  vec3 shadow = vec3(0.62, 0.66, 0.72);
  vec3 midC   = vec3(0.86, 0.89, 0.93);
  vec3 high   = vec3(1.00, 1.00, 1.00);
  vec3 cloudCol = mix(shadow, midC, smoothstep(0.0, 0.55, lit));
  cloudCol = mix(cloudCol, high, smoothstep(0.55, 1.0, lit));
  // Night dimmed to ~65 %. Day pushed to 1.10 (slight overdrive)
  // so the lit tops register as full white against the rich
  // daytime blue.
  float cloudBrightness = mix(0.65, 1.10, dayPhase);
  col = mix(col, clamp(cloudCol * cloudBrightness, 0.0, 1.0), clouds);

  // Warm rim accent — strongest at twilight (dawn / dusk),
  // disappears at noon and night.
  vec3 rimCol = vec3(0.95, 0.65, 0.40);
  col += rimCol * rim * 0.55 * twilight;

  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

// =====================================================================
// SPACE — deep cosmic field with milky-way band, purple/magenta
// nebulae, and a tiny solar-system-like cluster of bright points
// orbiting the screen centre (where the play button visually
// sits). Aspect-corrected so the orbits stay circular on phone
// portrait viewports.
// =====================================================================
export const FRAG_SPACE = `
${COMMON}

// One layer of fixed stars — each star gets an independent
// twinkle rate, phase and intensity, so the field doesn't blink
// in unison. \`bri\` is the layer-wide brightness multiplier;
// individual stars then sample their own peak from another hash.
float starLayer(vec2 p, float density, float bri) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float h = hash(i);
  // Step instead of if() — keeps GLES happy on all drivers.
  float exists = step(1.0 - density, h);
  vec2 c = vec2(hash(i + 1.7), hash(i + 3.1));
  float d = length(f - c);
  // Per-star: independent rate, phase, peak intensity, size.
  float hRate  = hash(i + 5.3);
  float hPhase = hash(i + 9.1);
  float hPeak  = hash(i + 11.7);
  float hSize  = hash(i + 17.9);
  float rate   = mix(0.4, 1.6, hRate);     // ~0.4..1.6 cycles/s
  float phase  = hPhase * 6.28;
  float peak   = mix(0.35, 1.0, hPeak);    // 0.35..1.0 max brightness
  float size   = mix(0.04, 0.07, hSize);
  float twinkle = 0.55 + 0.45 * sin(uTime * rate + phase);
  // Edges in proper order to avoid GLES undefined behaviour.
  float disc = 1.0 - smoothstep(0.0, size, d);
  return bri * peak * twinkle * disc * exists;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  // Aspect-corrected: keep raw uv around (with origin at bottom-
  // left in [0,1]²) for the play-button-area orbit centre, plus
  // an aspect-corrected q for the cosmic field.
  vec2 q = uv - 0.5;
  q.x *= uRes.x / uRes.y;

  // Near-black void with very subtle background gradients —
  // breaks up pure RGB-zero so the field reads as deep space
  // with faint colour variations rather than a black surface.
  // The gradients are a wide low-frequency fbm in two channels;
  // amplitude kept tiny so the field still feels overwhelmingly
  // dark.
  // Single cheap vnoise gradient — the previous two fbm() calls
  // were 10 octaves total just for a subtle background tint that
  // the eye barely registers. One vnoise sample is plenty.
  float bgN = vnoise(q * 0.7 + 7.3);
  vec3 col = vec3(0.010, 0.008, 0.026) * bgN;

  // Milky-way band — clearly visible diagonal river of dust +
  // light. Falloff back to 5 so the band has substance, but
  // dust threshold tightened so the surrounding void stays
  // pure black except in the band itself.
  float angle = 0.55;
  vec2 bandDir = vec2(cos(angle), sin(angle));
  vec2 perp    = vec2(-bandDir.y, bandDir.x);
  float bandAxis = dot(q, perp);
  float drift = dot(q, bandDir);
  float bandMask = exp(-bandAxis * bandAxis * 5.0);
  // Large-scale low-frequency noise mask — gates the milky way
  // shape so its envelope is irregular (some sections fade out,
  // others stay bright) instead of a smooth uniform band. The
  // noise is sampled at a low spatial frequency and drifts very
  // slowly, so the silhouette appears organic without the dust
  // shapes themselves moving. \`shapeMask\` is reused below for
  // the dust mix, the spine boost AND the band stars so every
  // milky-way feature shares the same envelope.
  // Cheap single-octave vnoise — the shape envelope is so low-
  // frequency that fbm's extra octaves added cost without visible
  // benefit.
  float shapeN = vnoise(vec2(drift * 0.6 + uTime * 0.010, bandAxis * 0.5));
  // Lifted floor (0.55) + narrower swing so the mask only gently
  // breaks the band instead of carving big black voids in it.
  float shapeMask = 0.55 + 0.45 * smoothstep(0.25, 0.70, shapeN);

  // Ridge-fbm dust — replaces the smooth fbm haze with sharp
  // fibrous strands aligned with the band. \`1 - abs(2n - 1)\`
  // turns noise peaks into ridges; raising to a power tightens
  // them into thin lines. Two scales summed for richer detail.
  float n1 = fbm(vec2(drift * 3.5, bandAxis * 4.5));
  float n2 = fbm(vec2(drift * 7.0 + 1.7, bandAxis * 7.0));
  float r1 = pow(1.0 - abs(2.0 * n1 - 1.0), 3.0);
  float r2 = pow(1.0 - abs(2.0 * n2 - 1.0), 4.0);
  float dust = clamp(r1 * 0.80 + r2 * 0.55, 0.0, 1.0);
  // Position-driven dust palette with slow temporal motion: the
  // hue cycles along the band axis AND drifts over time, so the
  // colour at any given pixel slowly shifts through the
  // red-violet → indigo → teal palette over a ~50 s cycle. The
  // dust shapes themselves stay static (only the colour mapping
  // moves), so the milky way silhouette doesn't appear to flow.
  float hueT = 0.5 + 0.5 * sin(drift * 2.0 + uTime * 0.12);   // 0..1 along band
  vec3 hueA = vec3(0.24, 0.04, 0.14);   // red-violet
  vec3 hueB = vec3(0.06, 0.02, 0.26);   // deep indigo
  vec3 hueC = vec3(0.04, 0.16, 0.22);   // dim teal
  vec3 dustWarm = mix(hueA, hueB, smoothstep(0.0, 0.55, hueT));
  dustWarm = mix(dustWarm, hueC, smoothstep(0.55, 1.0, hueT));
  vec3 dustCool = vec3(0.02, 0.00, 0.05);
  vec3 dustCol = mix(dustCool, dustWarm, smoothstep(0.20, 0.70, dust));
  col = mix(col, dustCol, bandMask * shapeMask * 0.70);

  // Spine picks up a slightly hotter version of the local band
  // hue, giving the centreline a warm core that varies along
  // the milky way.
  float spine = exp(-bandAxis * bandAxis * 22.0) * smoothstep(0.40, 0.90, dust);
  vec3 spineCol = mix(vec3(0.36, 0.08, 0.24), vec3(0.10, 0.06, 0.34), smoothstep(0.0, 0.55, hueT));
  spineCol = mix(spineCol, vec3(0.06, 0.22, 0.30), smoothstep(0.55, 1.0, hueT));
  col += spineCol * spine * shapeMask * 0.45;

  // Distant galaxies — bright cores + structured halos. Each
  // galaxy has its own shape, scale and texture: a compact
  // luminous core (very tight Gaussian) layered under a softer
  // disc whose interior is modulated by static fbm so the body
  // reads as a real deep-sky object with internal structure
  // (dust lanes, varying density), not a smooth blob.
  vec2 galPos1 = vec2(-0.30, 0.20);
  vec2 galPos2 = vec2( 0.35,-0.25);
  vec2 galPos3 = vec2(-0.05,-0.40);

  // Cores — small bright pinpoints.
  float core1 = exp(-dot(q - galPos1, q - galPos1) * 500.0);
  float core2 = exp(-dot(q - galPos2, q - galPos2) * 650.0);
  float core3 = exp(-dot(q - galPos3, q - galPos3) * 750.0);

  // Discs — falloff radius defines galaxy size. Variable names
  // prefixed gr to avoid collision with the milky-way r1/r2.
  float gr1 = length(q - galPos1);
  float gr2 = length(q - galPos2);
  float gr3 = length(q - galPos3);
  float disc1 = (1.0 - smoothstep(0.04, 0.13, gr1));
  float disc2 = (1.0 - smoothstep(0.03, 0.10, gr2));
  float disc3 = (1.0 - smoothstep(0.04, 0.12, gr3));

  // Disc interior texture — static fbm sampled per-galaxy. Acts
  // as dust lanes / arm-density variation across the body.
  // Single-octave vnoise instead of full fbm — the texture is
  // already heavily attenuated by the disc falloff, the extra
  // octaves were invisible. Saves 12 noise samples per pixel.
  float tex1 = vnoise((q - galPos1) * 16.0);
  float tex2 = vnoise((q - galPos2) * 22.0 + 1.7);
  float tex3 = vnoise((q - galPos3) * 18.0 + 3.3);
  // Modulate disc by texture so the body has a structured
  // internal pattern rather than a uniform fade.
  disc1 *= 0.35 + 0.85 * tex1;
  disc2 *= 0.35 + 0.85 * tex2;
  disc3 *= 0.35 + 0.85 * tex3;

  // Galaxies as soft cosmic gradients — palette mixes deep
  // violet, dim red-purple, and indigo so the field carries the
  // requested warm tones without burning white.
  col += vec3(0.22, 0.06, 0.32) * (core1 * 0.45 + disc1 * 0.55);  // deep violet
  col += vec3(0.30, 0.06, 0.20) * (core2 * 0.45 + disc2 * 0.45);  // deep red-violet
  col += vec3(0.08, 0.08, 0.30) * (core3 * 0.45 + disc3 * 0.55);  // indigo

  // Star layers — densities ~doubled across the board so the
  // sky looks properly populated, not a sparse field.
  // Cut from 5 → 3 star layers — the densest layer was double-
  // counting bright pinpoints inside the band; the eye doesn't
  // miss it once the field is populated.
  float s = 0.0;
  s += starLayer(q * 24.0,  0.040, 0.9);
  s += starLayer(q * 50.0,  0.025, 0.55);
  float bs = starLayer(q * 70.0 + 5.1, 0.080, 1.0);
  col += vec3(1.0, 0.97, 0.92) * (s + bs * bandMask * shapeMask * 1.4);

  col += dither(gl_FragCoord.xy);
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

  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

import type { ShaderTheme } from './index';

export const FRAG_FOR_THEME: Record<ShaderTheme, string> = {
  default: FRAG_DEFAULT,
  earth: FRAG_EARTH,                  // grass shader fallback (earth normally renders as video)
  grass: FRAG_EARTH,                  // explicit grass shader (cycler can pick it)
  sky: FRAG_SKY,
  space: FRAG_SPACE,
  lake: FRAG_EARTH_TOPDOWN,           // ripples on still water — used on Media / About
};
