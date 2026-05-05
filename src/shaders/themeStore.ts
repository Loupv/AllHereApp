import { create } from 'zustand';
import type { ShaderTheme } from './index';

/**
 * Tiny shared store for the shader theme override. Lives outside
 * any one screen because the ShaderBackground is rendered at the
 * root layout (so it stays visible behind the audio Player), but
 * the dev cycler pill that drives the override is rendered on
 * the home tab. Both subscribe here.
 */
type ThemeStore = {
  override: ShaderTheme | null;
  setOverride: (v: ShaderTheme | null) => void;
};

export const useShaderThemeStore = create<ThemeStore>((set) => ({
  override: null,
  setOverride: (v) => set({ override: v }),
}));
