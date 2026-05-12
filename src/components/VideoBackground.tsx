import * as React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

// Hero clip from allhere.org/the-technology/ — slow earthy texture
// (iStock-1173910629), reused as the Earth atmosphere in-app so the
// site and the app share one visual identity. ~25 MB so the bundle
// grows accordingly; consider transcoding (H.265 / lower bitrate) if
// the install size starts to matter.
const EARTH_VIDEO = require('../../assets/video/earth-hero.mp4');

/**
 * Looping, muted video background. Used as the EARTH atmosphere — a
 * pre-rendered clip is cheaper and visually richer than the SDF-blade
 * shader. Pauses when off-home / app-backgrounded for battery.
 */
type Props = { paused?: boolean };

// Slower-than-real-time playback so the texture drifts gently rather
// than rolling at scenic speed. 0.5 ≈ half speed; 0.6 keeps a hint of
// motion in the eddies. Tweak here if it feels too sleepy.
const PLAYBACK_RATE = 0.6;

export function VideoBackground({ paused = false }: Props) {
  const player = useVideoPlayer(EARTH_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = PLAYBACK_RATE;
    p.play();
  });

  React.useEffect(() => {
    if (!player) return;
    // Re-assert the rate on resume — some platforms reset it after a
    // pause/play cycle. Cheap to set unconditionally.
    try { player.playbackRate = PLAYBACK_RATE; } catch {}
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  // Explicit window dimensions for the VideoView — this is portrait
  // phone territory and we want the clip to cover the FULL screen
  // height (priority), even when the parent's resolved height isn't
  // the same as the window (e.g. when the bg layer is nested inside
  // a screen container whose bottom is occluded by a footer). With
  // explicit width/height pulled from useWindowDimensions, the
  // VideoView always knows it owns the entire viewport.
  const { width: winW, height: winH } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <VideoView
        // `cover` scales the clip to fill BOTH dimensions of the
        // container, cropping whichever overflows. On a portrait
        // phone with a landscape source that means the video reaches
        // top-to-bottom; the sides get cropped instead of letterboxed.
        style={{ width: winW, height: winH }}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {/* Darken + boost contrast: a black overlay drops the midtones,
          and a radial-ish vignette via a second darker layer at the
          edges. Two flat overlays are cheap and stack well. */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.40)' }]} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,12,0.20)' }]} />
    </View>
  );
}
