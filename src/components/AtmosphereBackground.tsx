import * as React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
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
export function AtmosphereBackground({ theme }: { theme: ShaderTheme }) {
  const { width, height } = useWindowDimensions();
  const fragSrc = React.useMemo(() => FRAG_FOR_THEME[theme], [theme]);

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

    const start = Date.now();
    let stopped = false;
    const draw = () => {
      if (stopped) return;
      gl.uniform1f(uTime, (Date.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // expo-gl native needs `endFrameEXP`; web has it as a no-op.
      if (typeof gl.endFrameEXP === 'function') gl.endFrameEXP();
      requestAnimationFrame(draw);
    };
    draw();
    (gl as any).__shaderStop = () => { stopped = true; };
  }, [fragSrc]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <GLView
        key={theme}
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
