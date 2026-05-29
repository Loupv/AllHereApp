import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEarthPlayer } from './EarthVideoContext';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// iOS uses a local AVSampleBufferDisplayLayer-backed module so the
// background video can't claim the MediaPlayback AVAudioSession (see
// modules/earth-video/ios/EarthVideoView.swift). Android and web get
// the same loop via expo-video — ExoPlayer on Android, HTML5 <video>
// on web — which don't have iOS's session-election problem.
const EarthVideoView: React.ComponentType<{
  source: string;
  style?: any;
}> | null = Platform.OS === 'ios'
  ? require('../../modules/earth-video').default
  : null;

// Original earth-hero MP4 (5.4 MB H.264). Played at full quality via
// the local `earth-video` Expo module, which uses
// AVSampleBufferDisplayLayer instead of AVPlayer — that's the whole
// reason this module exists. AVPlayer (used by expo-video) claims an
// iOS MediaPlayback session even when muted with showNowPlayingNotification
// = false; that session pollution blocked the expo-audio meditation
// player from being elected as the lock-screen Now Playing source.
// See modules/earth-video/ios/EarthVideoView.swift for details.
const EARTH_VIDEO = require('../../assets/video/earth-hero.mp4');
// Static still as a fallback when the iOS asset hasn't finished
// resolving yet (the require() metro-resolved URI needs an async hop
// on first mount). Android and web now have their own live video via
// expo-video, so this still only paints for the first ~1 frame of an
// iOS cold start.
const EARTH_STILL = require('../../assets/video/earth-hero.jpg');

/**
 * Background animation behind the rest of the UI. The `paused` prop is
 * kept for API compatibility with the previous expo-video version but
 * is currently a no-op — AVSampleBufferDisplayLayer keeps rendering
 * cheaply (it's a CALayer with a small CADisplayLink callback). If
 * battery is ever a concern we can short-circuit the CADisplayLink in
 * native when paused goes true.
 */
type Props = { paused?: boolean };

export function VideoBackground(_: Props) {
  // Resolve the MP4's metro-served file URI. expo-asset gives us a
  // local file:// URL after the first downloadAsync() call (it's a
  // no-op for bundled assets but populates `localUri`).
  const [videoUri, setVideoUri] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return; // native module only ships on iOS for now
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(EARTH_VIDEO);
        if (!asset.localUri) await asset.downloadAsync();
        if (!cancelled) setVideoUri(asset.localUri ?? asset.uri);
      } catch {
        // Asset resolution failed (corrupt cache?). The JPG fallback
        // below keeps rendering — we just never swap to video.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Ken Burns: a slow zoom (1.0 → 1.08) + tiny pan that the user only
  // notices subconsciously. Cycle is ~90 s so it doesn't feel
  // mechanical when looped. Cosmetic; pure UI thread via reanimated.
  //
  // Skipped on Android: expo-video's VideoView is backed by a
  // SurfaceView (out-of-band drawing), and reanimated transforms on a
  // wrapper View don't propagate cleanly to the underlying surface —
  // the rendering ends up quantised against the transform on every
  // frame, which the user perceives as the video "trembling" / its
  // size shifting. iOS (Swift module + AVSampleBufferDisplayLayer) and
  // web (plain <video>) both composite normally, so they keep the
  // subtle motion.
  const kbEnabled = Platform.OS !== 'android';
  const kbProgress = useSharedValue(0);
  React.useEffect(() => {
    if (!kbEnabled) return;
    kbProgress.value = withRepeat(
      withTiming(1, { duration: 90_000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true, // reverse on each cycle — avoids the snap at loop boundary
    );
    return () => { cancelAnimation(kbProgress); };
  }, [kbEnabled, kbProgress]);
  const kbStyle = useAnimatedStyle(() => {
    if (!kbEnabled) return {};
    return {
      transform: [
        { scale: 1 + kbProgress.value * 0.08 },
        // Tiny lateral drift (in dp). ±8 px is invisible by itself but
        // breaks the static feel that pure zoom has.
        { translateX: (kbProgress.value - 0.5) * 16 },
        { translateY: (kbProgress.value - 0.5) * 8 },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Animated.View style={[StyleSheet.absoluteFillObject, kbStyle]}>
        {Platform.OS === 'ios' ? (
          videoUri && EarthVideoView ? (
            <EarthVideoView source={videoUri} style={StyleSheet.absoluteFillObject} />
          ) : (
            // Asset URI not yet resolved — show the JPG so the screen
            // isn't blank during the very first mount frame.
            <Image
              source={EARTH_STILL}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
          )
        ) : Platform.OS === 'web' ? (
          <WebVideoBackground />
        ) : (
          <ExpoVideoBackground />
        )}
      </Animated.View>
      {/* see ExpoVideoBackground below for the non-iOS implementation */}
      {/* Darken + boost contrast: a black overlay drops the midtones,
          and a radial-ish vignette via a second darker layer at the
          edges. Two flat overlays are cheap and stack well. */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.40)' }]} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,12,0.20)' }]} />
    </View>
  );
}

/**
 * expo-video-backed background loop for Android. The player is owned
 * by EarthVideoProvider at the app root so a single ExoPlayer instance
 * is shared across every consumer (root layout's journey-theme bg + the
 * SM tree's Part 1 layer) — eliminates the mount-glitch / frame-0
 * reset that happened when two players ran in parallel.
 *
 * Fallback: if for some reason the provider isn't mounted above us
 * (tests, dev hot-reload edge cases), we spin up a local player so the
 * component still renders.
 *
 * Sound discipline (configured at the provider): the player is muted
 * with `audioMixingMode: 'mixWithOthers'` so expo-video shares audio
 * output with our expo-audio meditation player and doesn't elbow it
 * out of the Android MediaSession / lock-screen Now Playing card.
 */
function ExpoVideoBackground() {
  const sharedPlayer = useEarthPlayer();
  if (sharedPlayer) {
    return (
      <VideoView
        player={sharedPlayer}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    );
  }
  return <ExpoVideoBackgroundLocal />;
}

function ExpoVideoBackgroundLocal() {
  const player = useVideoPlayer(EARTH_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

/**
 * Web background loop. We render a raw <video> instead of going through
 * expo-video on web because expo-video's web VideoView doesn't set the
 * `autoplay` or `playsinline` attributes on the underlying <video>,
 * and its `.play()` call is a no-op when fired from the useVideoPlayer
 * setup callback (the <video> hasn't been mounted yet, so the player's
 * `_mountedVideos` Set is still empty). Browsers also require both
 * `muted` AND `playsinline` for autoplay to start without user
 * interaction. Easier to skip the wrapper here.
 */
function WebVideoBackground() {
  // Metro's `require('.mp4')` returns an asset id (number) or an
  // object with a uri/localUri field, depending on dev vs production
  // build. Asset.fromModule normalises both to a usable URL.
  const uri = React.useMemo(() => {
    if (typeof EARTH_VIDEO === 'string') return EARTH_VIDEO;
    const asset = Asset.fromModule(EARTH_VIDEO);
    return asset.uri ?? asset.localUri ?? '';
  }, []);
  return React.createElement('video', {
    src: uri,
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
    // RN-Web doesn't translate StyleSheet.absoluteFillObject for raw
    // DOM elements, so spell out the absolute-fill rules in plain CSS.
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      pointerEvents: 'none',
    },
  });
}
