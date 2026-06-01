import * as React from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';

// Module-level shared start time so the shader clock survives a
// theme switch (which remounts the GLView via key={theme}). Set
// the first time onContextCreate fires; reused for every later
// mount. Initialised to 0 as a sentinel; the first context to fire
// stamps it to (now - WARMUP_SECONDS * 1000) so the very first
// frame already runs past the build-up phase.
let sharedStart = 0;
import { GLView } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import { VERTEX_SHADER, FRAG_FOR_THEME } from '../shaders/glsl';
import type { ShaderTheme } from '../shaders';

// The iOS Simulator's OpenGL→Metal layer crashes compiling these shaders
// (SIGBUS in libCoreVMClient). Run a simulator build with
// `EXPO_PUBLIC_DISABLE_GL=1 npx expo run:ios` to render a cheap static
// gradient instead of the GLView. Real devices have a native GL stack —
// leave the flag UNSET there (device builds keep the live shader).
const GL_DISABLED = process.env.EXPO_PUBLIC_DISABLE_GL === '1';

// Approximate per-theme colours for the no-GL fallback (top → bottom).
const FALLBACK_COLORS: Record<ShaderTheme, readonly [string, string]> = {
  default: ['#00102E', '#02060F'],
  earth: ['#0B2A1A', '#02100A'],
  grass: ['#0B2A1A', '#02100A'],
  sky: ['#1A3A6B', '#06122E'],
  space: ['#1A0F3A', '#05030F'],
  lake: ['#0A2A33', '#02121A'],
};

/**
 * Cross-platform shader background using expo-gl. Renders a single
 * fragment shader (selected by theme) full-screen behind the home
 * content. Works on web (WebGL), iOS / Android (OpenGL ES).
 *
 * One GLView per theme: re-keying the GLView on theme change spins up
 * a fresh GL context with the right program — simpler than swapping
 * shaders on a live context. The cost (one program compile per
 * change) is negligible vs. the readability win.
 *
 * Animation loop: `requestAnimationFrame` updates `uTime` and re-draws
 * the fullscreen triangle. The vertex shader is trivial (single
 * `attribute vec2 aPos` covering NDC [-1,1]²); all the work happens
 * in the fragment shader.
 */
type Props = { theme: ShaderTheme; paused?: boolean };

export function AtmosphereBackground({ theme, paused = false }: Props) {
  const { width, height } = useWindowDimensions();
  // Mirror the latest paused value into a ref so the render loop
  // (whose closure was created on context-init) sees the up-to-
  // date state on every frame instead of the value at mount.
  const pausedRef = React.useRef(paused);
  React.useEffect(() => { pausedRef.current = paused; }, [paused]);
  const fragSrc = React.useMemo(() => FRAG_FOR_THEME[theme], [theme]);
  // Cheap content hash of the fragment source so the GLView re-
  // mounts whenever the shader is edited (hot reload). String
  // length alone wasn't enough — comment-only or same-length
  // tweaks left the key unchanged and the old program ran.
  const srcHash = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < fragSrc.length; i++) {
      h = ((h << 5) - h + fragSrc.charCodeAt(i)) | 0;
    }
    return h;
  }, [fragSrc]);

  // Holds the live GL context so we can stop its render loop. Without
  // this, every shader/theme re-key (which remounts the GLView) and
  // every unmount left the previous context's `draw()` rescheduling
  // itself via requestAnimationFrame forever — on web a lost WebGL
  // context doesn't throw, so the orphaned 60 fps loop kept the gl,
  // program and buffers alive for the rest of the session.
  const glRef = React.useRef<any>(null);

  const onContextCreate = React.useCallback((gl: any) => {
    // Stop the render loop of the *previous* context before starting a
    // new one (theme / hot-reload re-key spins up a fresh GLView +
    // context while the old one's rAF is still chained).
    try { glRef.current?.__shaderStop?.(); } catch {}
    glRef.current = gl;

    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    gl.viewport(0, 0, w, h);

    const vsh = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fsh = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vsh || !fsh) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uRes = gl.getUniformLocation(prog, 'uRes');
    gl.uniform2f(uRes, w, h);

    // Pre-warm the clock by `WARMUP_SECONDS` so we skip the
    // initial "ripples just spawned / density envelope at zero /
    // ..." setup phases. Shaders are designed to be looking right
    // at any random t > warmup, so this jumps the field straight
    // into a settled, mid-life state on theme activation.
    //
    // The shared module-level `sharedStart` keeps uTime continuous
    // ACROSS theme switches as well, so cycling the pill doesn't
    // restart the clock at the warmup boundary every time.
    const WARMUP_SECONDS = 60;
    if (sharedStart === 0) {
      sharedStart = Date.now() - WARMUP_SECONDS * 1000;
    }
    const start = sharedStart;
    let stopped = false;
    let frameIdx = 0;
    let rafId = 0;
    // Pausable clock. The shader's uTime is wall-clock based
    // (Date.now() - start). While the layer is paused (offscreen page)
    // we stop submitting frames, but Date.now() keeps advancing — so
    // the first frame after un-pausing would jump uTime forward by the
    // entire pause duration, which read as a visible shader "jump"
    // right after the crossfade brought the layer back in. We instead
    // accumulate the paused (and backgrounded) time and subtract it, so
    // uTime resumes CONTINUOUSLY from where it froze — the fade-in shows
    // live motion that picks up exactly where it left off.
    let pausedAccum = 0;
    let frozenSince: number | null = null;
    // Background guard: when iOS locks the screen or the app goes to
    // background, we MUST stop calling rAF entirely (not just skip GL
    // submit) — even a do-nothing rAF callback still wakes the JS
    // thread 60×/s, which contributed to the 48-s-CPU-per-60-s iOS
    // background watchdog killing the app while audio was streaming.
    let appStateActive = AppState.currentState === 'active';
    const draw = () => {
      if (stopped) return;
      frameIdx++;
      // Track the paused→running edge to keep the clock continuous.
      // (Runs every frame while the app is active, regardless of the
      // paused prop, so it catches both the enter- and exit-pause
      // transitions for the offscreen-page case.)
      if (pausedRef.current) {
        if (frozenSince === null) frozenSince = Date.now();
      } else if (frozenSince !== null) {
        pausedAccum += Date.now() - frozenSince;
        frozenSince = null;
      }
      if (!pausedRef.current && appStateActive && frameIdx % 3 === 0) {
        gl.uniform1f(uTime, (Date.now() - start - pausedAccum) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // expo-gl native needs `endFrameEXP`; web has it as a no-op.
        if (typeof gl.endFrameEXP === 'function') gl.endFrameEXP();
      }
      if (appStateActive) {
        rafId = requestAnimationFrame(draw);
      }
    };
    const sub = AppState.addEventListener('change', (s) => {
      const wasActive = appStateActive;
      appStateActive = s === 'active';
      if (!appStateActive && wasActive) {
        // Going to background: the draw loop stops scheduling, so it
        // can't observe the freeze itself — start the freeze window
        // here (unless the paused prop already opened one). draw()
        // closes it on resume and folds the gap into pausedAccum, so
        // uTime doesn't jump forward by the backgrounded duration.
        if (frozenSince === null) frozenSince = Date.now();
      }
      if (appStateActive && !wasActive && !stopped) {
        // Resume: kick the loop again. Skip ahead one tick boundary
        // so the very first resumed frame submits GL again.
        frameIdx = 2;
        rafId = requestAnimationFrame(draw);
      }
    });
    rafId = requestAnimationFrame(draw);
    (gl as any).__shaderStop = () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      sub.remove();
    };
  }, [fragSrc]);

  // Stop the render loop when the whole component unmounts (navigating
  // away from a screen that mounts an AtmosphereBackground). The
  // re-key case is handled at the top of onContextCreate; this covers
  // the final teardown.
  React.useEffect(() => {
    return () => {
      try { glRef.current?.__shaderStop?.(); } catch {}
      glRef.current = null;
    };
  }, []);

  // Simulator / GL-disabled builds: skip the GLView entirely (it would
  // crash the simulator's GL compiler) and paint a static theme gradient.
  if (GL_DISABLED) {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={FALLBACK_COLORS[theme] ?? FALLBACK_COLORS.default}
        style={StyleSheet.absoluteFillObject}
      />
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <GLView
        // Key includes a content fingerprint of the shader source
        // so that hot-reloaded edits to glsl.ts force the GLView
        // to remount and recompile, instead of keeping the stale
        // program from the original onContextCreate closure.
        key={`${theme}-${srcHash}`}
        style={{ width, height }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}

function compile(gl: any, type: number, src: string) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('[Shader compile failed]', gl.getShaderInfoLog(sh), '\n---\n', src.slice(0, 500));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
