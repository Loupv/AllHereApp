import { useEffect, useState } from 'react';
import { kv } from '../src/content/kv';
import { useNotifications } from '../src/player/notificationStore';
import { Platform, View, Image, StyleSheet } from 'react-native';

// BG visual config:
//   - Web: full animated treatment — gradient breathes, energy column
//     drifts. Browser GPUs handle it for free.
//   - Native (iOS/Android): same gradient + energy column rendered, but
//     with all live worklets disabled (`staticMode`). The visual
//     identity is preserved, only the perpetual per-frame work is gone
//     — that's what was making screen transitions feel sticky on iPhone.
const BG_FX_ENABLED = true;
const BG_STATIC_MODE = Platform.OS !== 'web';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const LOGO = require('../assets/images/allhere-logo.png');
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import { IntroSplash } from '../src/components/IntroSplash';
import { setAudioModeAsync } from 'expo-audio';
import { Player } from '../src/components/Player';
import { VideoPlayerModal } from '../src/components/VideoPlayerModal';
import { AnimatedGradient } from '../src/components/AnimatedGradient';
import { EnergyColumn } from '../src/components/EnergyColumn';
import { AtmosphereBackground as ShaderBackground } from '../src/components/AtmosphereBackground';
import { VideoBackground } from '../src/components/VideoBackground';
import { useShaderThemeStore } from '../src/shaders/themeStore';
import { WebSwipeBack } from '../src/components/WebSwipeBack';
import { usePlayerStore } from '../src/player/store';
import { AppState } from 'react-native';
import { colors } from '../src/theme';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';

// React Navigation paints a default light-grey (`rgb(242,242,242)`)
// behind every screen container when no theme is passed — that opaque
// layer covered our shared root gradient. The fix is a custom theme
// that keeps everything dark (we already use a dark UI) and crucially
// uses a transparent screen background so the gradient shows through.
const TransparentNavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent' },
};

// Pick one of the three headline shaders at module load — that's
// once per app process, so it survives navigation and only changes
// when the app is fully relaunched.
const LAUNCH_POOL: ('lake' | 'sky' | 'space')[] = ['lake', 'sky', 'space'];
const LAUNCH_THEME = LAUNCH_POOL[Math.floor(Math.random() * LAUNCH_POOL.length)];

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  // Shader theme: auto-derived from progress, optionally overridden
  // by the dev pill on the home tab (via the shared store), and
  // forced to the slow-lake variant on Media + About where the
  // calmer water motion is a quieter companion to dense text.
  const shaderOverride = useShaderThemeStore(s => s.override);
  // Random launch theme — picked once per app process from the three
  // headline shaders (lake, sky, space). Module-level constant means
  // every screen sees the same backdrop until the next launch, while
  // re-opening the app gives the user a different atmosphere. Any
  // dev pill override still wins.
  const shaderTheme = shaderOverride ?? LAUNCH_THEME;
  // Pause only when the app is backgrounded. The shader keeps
  // running on every screen now (lake on Media/About, the
  // progress-based theme everywhere else).
  const [appActive, setAppActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const shaderPaused = !appActive;

  // Configure expo-audio's session once at startup so the Player keeps
  // playing when the user locks the screen, and the session takes a
  // sensible interruption stance against other apps (Spotify, calls,
  // Siri). Pairs with the iOS `UIBackgroundModes: ["audio"]` declaration
  // and the Android `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission in
  // app.json — those grant the *capability*; this call activates it.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      shouldRouteThroughEarpiece: false,
    }).catch(() => { /* no-op on web — expo-audio's web build is a stub */ });
  }, []);

  // Global ambient ripple-field — lines visible everywhere, drift
  // animation only runs while audio is actually playing.
  const audioPlaying = usePlayerStore(s => s.playing);
  // Player open flag — drives a global fade on the entire navigator
  // tree so every screen (Start tab, SM/QM tabs, detail pages…)
  // dissolves together when the audio Player overlay opens, no
  // matter where the user tapped Play. Keeps the morph illusion
  // consistent across entry points.
  const playerOpen = usePlayerStore(s => s.isOpen);
  const stackOpacity = useSharedValue(playerOpen ? 0 : 1);
  useEffect(() => {
    stackOpacity.value = withTiming(playerOpen ? 0 : 1, {
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [playerOpen]);
  const stackFadeStyle = useAnimatedStyle(() => ({ opacity: stackOpacity.value }));

  // DEV: wipe per-item seen state on every app reload so tab badges and
  // "Mark all as read" behaviours are testable. Remove this block when
  // going to production.
  useEffect(() => {
    kv.remove('ah_seen_news_v1');
    kv.remove('ah_seen_media_v1');
    useNotifications.setState({ seenNews: {}, seenMedia: {} });
  }, []);
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  });

  if (!fontsLoaded) return <View style={styles.root} />;

  return (
    // GestureHandlerRootView wraps everything so any descendant
    // <GestureDetector> (e.g. SwipeTabs' Pan gesture) has the
    // gesture-handler runtime available. expo-router used to add this
    // automatically but stopped doing so in some recent native builds —
    // without the explicit wrap, screens that mount a GestureDetector
    // throw "GestureDetector must be used as a descendant of
    // GestureHandlerRootView" at render time.
    <GestureHandlerRootView style={styles.root}>
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* DEV TOGGLE — flip BG_FX_ENABLED to bring the animated
          background back. Disabled on native right now while we
          investigate whether the EnergyColumn + AnimatedGradient pair
          is what's making screen / overlay transitions feel sticky on
          iPhone. Both layers run reanimated worklets at 60 Hz across
          the whole viewport, which adds up alongside the new
          PagerView. With them off you'll get a flat `colors.bg` fill
          behind everything — same colour, no motion — so any change
          in transition fluidity points right back at these. */}
      {BG_FX_ENABLED ? (
        <>
          {/* Shared atmospheric gradient — sits at the root so every
              screen renders against the same backdrop. `staticMode`
              skips the breath + centre-Y chase on native so the SVG
              renders once and stays. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <AnimatedGradient
              centerY={0.55}
              animateCenter={false}
              staticMode={BG_STATIC_MODE}
            />
          </View>
          {/* Global energy column. `staticMode` pins the time clock so
              every WaveLine renders a single fixed path, no per-frame
              UI-thread work. Web keeps the live drift. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <EnergyColumn
              opacity={0.75}
              active={audioPlaying}
              staticMode={BG_STATIC_MODE}
            />
          </View>
        </>
      ) : null}
      {/* Atmospheric shader behind everything — rendered at root
          level so it stays visible behind the audio Player overlay
          (which fades the navigator below). Paused when off-home
          or app-backgrounded for battery. */}
      {shaderTheme === 'earth'
        ? <VideoBackground paused={shaderPaused} />
        : <ShaderBackground theme={shaderTheme} paused={shaderPaused} />}
      <Animated.View style={[{ flex: 1 }, stackFadeStyle]} pointerEvents={playerOpen ? 'none' : 'auto'}>
      <ThemeProvider value={TransparentNavTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: 'transparent' },
          // Render the All Here wordmark in the header for every stack
          // screen (detail pages like /about, /news/[id], /silent-mind/[id]
          // …) — the (tabs) group overrides headerShown:false so its own
          // tab-layout logo stays in charge there.
          headerTitle: () => <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />,
          headerTitleAlign: 'center',
          // Hide the iOS back-button label that defaults to the
          // previous screen's name — for tab → detail pushes that
          // would print "(tabs)" verbatim, since the (tabs) layout
          // has no title. Just the chevron is enough.
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          // slide_from_right: native iOS push with parallax + the
          // interactive back-gesture. We tried simple_push to avoid
          // the parallax overlap when both screens were transparent,
          // but simple_push by design has no interactive back gesture.
          // Compromise: keep slide_from_right and give the detail
          // screens an opaque background (per-screen below) so the
          // new screen masks the old one as it slides in — no
          // visible overlap, but the back-swipe is preserved.
          animation: 'slide_from_right',
          // Native swipe-back: activate from anywhere on the screen, not
          // only from the left edge. iOS's default edge-only swipe was
          // confusing on detail pages with horizontal content (the
          // user started a swipe mid-screen and nothing happened).
          // Web gets an equivalent handler via <WebSwipeBack /> below.
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
          fullScreenGestureShadowEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
        {/* Detail screens hide the navigation header — the page
            renders its own colored eyebrow ("SILENT MIND PROGRAM ·
            PART 1") at the same vertical position as the tabs (which
            also have no header). Back is the swipe-right gesture
            (fullScreenGestureEnabled). Opaque background masks the
            previous screen during the parallax slide. */}
        <Stack.Screen name="silent-mind/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="qm/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="qm-training" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="silent-mind-tree" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bgTab } }} />
        <Stack.Screen name="news/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="video/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </Stack>
      <WebSwipeBack />
      </ThemeProvider>
      </Animated.View>
      <Player />
      <VideoPlayerModal />
      {!introDone && <IntroSplash onDone={() => setIntroDone(true)} />}
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerLogo: { width: 100, height: 32 },
});
