import type { StyleProp, ViewStyle } from 'react-native';

export type EarthVideoViewProps = {
  /**
   * Local file URL (`file:///…/earth-hero.mp4`) for the video to loop.
   * Resolve via `expo-asset` before passing in.
   */
  source: string;
  style?: StyleProp<ViewStyle>;
};
