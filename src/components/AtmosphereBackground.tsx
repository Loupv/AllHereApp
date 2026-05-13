import * as React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

// Module-level shared start time so the shader clock survives a
// theme switch (which remounts the GLView via key={theme}). Set
// the first time onContextCreate fires; reused for every later
// mount. Initialised to 0 as a sentinel; the first context to fire
// stamps it to (now - WARMUP_SECONDS * 1000) so the very first
// frame already runs past the build-up phase.
let sharedStart = 0;
import { GLView } from 'expo-gl';
import { VERTEX_SHADER, FRAG_FOR_THEME } from '../shaders/glsl';
import type { ShaderTheme } from '../shaders';

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

  const onContextCreate = React.useCallback((gl: any) => {
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
    const draw = () => {
      if (stopped) return;
      frameIdx++;
      // Two GPU-saving knobs at once:
      //   1. paused → skip the GL submit entirely (still keep
      //      the rAF loop alive so we can resume when the home
      //      screen comes back into focus, but no draw work).
      //   2. 20 fps → render only every 3rd rAF tick (60→20).
      //      The visible motion in these shaders is slow enough
      //      that even 20 fps is indistinguishable from 60 fps to
      //      the eye — meditation shaders move at ~0.005 cycles/s.
      //      Was 30 fps; dropped a notch to cool the phone.
      if (!pausedRef.current && frameIdx % 3 === 0) {
        gl.uniform1f(uTime, (Date.now() - start) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // expo-gl native needs `endFrameEXP`; web has it as a no-op.
        if (typeof gl.endFrameEXP === 'function') gl.endFrameEXP();
      }
      requestAnimationFrame(draw);
    };
    draw();
    (gl as any).__shaderStop = () => { stopped = true; };
  }, [fragSrc]);

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
