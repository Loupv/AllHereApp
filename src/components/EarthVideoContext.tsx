import * as React from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';

// Path is relative to src/components/ — earth-hero.mp4 lives in
// /assets/video/ at the repo root.
const EARTH_VIDEO = require('../../assets/video/earth-hero.mp4');

const EarthPlayerContext = React.createContext<VideoPlayer | null>(null);

/**
 * Single ExoPlayer instance shared across every Android screen that
 * wants to render the Earth background loop (root layout's
 * journey-theme bg + the SM tree's Part 1 layer). The provider sits at
 * the app root; consumers read it via `useEarthPlayer()` and pass the
 * returned player to <VideoView player={player} />. Sharing the
 * underlying player keeps both consumers on the SAME frame at all
 * times — fixes the stretch + frame-0-reset glitch the user saw when
 * navigating from the SM tab to the SM tree (which was caused by the
 * SM tree instantiating a second player mid-navigation animation).
 *
 * iOS uses its own Swift module via AVSampleBufferDisplayLayer and
 * web uses a raw <video>; neither consumes this player. Calling
 * `useVideoPlayer` on those platforms is still safe — the hook
 * returns a player object that we just don't bind to any view.
 */
export function EarthVideoProvider({ children }: { children: React.ReactNode }) {
  const player = useVideoPlayer(EARTH_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });
  // Belt-and-braces: re-assert loop / mute after the player object is
  // exposed via context. We hit a case on Android where the setup
  // callback's `p.loop = true` didn't survive the source-load →
  // first-play cycle when the player was shared across multiple
  // VideoView consumers — the video played once and stopped. Setting
  // the properties imperatively after the player is live makes loop
  // stick across attach / detach of VideoViews.
  React.useEffect(() => {
    if (!player) return;
    try {
      player.loop = true;
      player.muted = true;
    } catch { /* player may have been released */ }
  }, [player]);
  return (
    <EarthPlayerContext.Provider value={player}>
      {children}
    </EarthPlayerContext.Provider>
  );
}

export function useEarthPlayer(): VideoPlayer | null {
  return React.useContext(EarthPlayerContext);
}
