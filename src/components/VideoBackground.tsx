import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

const EARTH_VIDEO = require('../../assets/video/shadow wall.mp4');

/**
 * Looping, muted video background. Used as the EARTH atmosphere — a
 * pre-rendered clip is cheaper and visually richer than the SDF-blade
 * shader. Pauses when off-home / app-backgrounded for battery.
 */
type Props = { paused?: boolean };

export function VideoBackground({ paused = false }: Props) {
  const player = useVideoPlayer(EARTH_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  React.useEffect(() => {
    if (!player) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <VideoView
        style={StyleSheet.absoluteFillObject}
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
