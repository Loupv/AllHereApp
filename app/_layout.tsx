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
import { LoginScreen } from '../src/components/LoginScreen';
import { setAudioModeAsync } from 'expo-audio';
import { Player } from '../src/components/Player';
import { VideoPlayerModal } from '../src/components/VideoPlayerModal';
import { AnimatedGradient } from '../src/components/AnimatedGradient';
import { EnergyColumn } from '../src/components/EnergyColumn';
import { WebSwipeBack } from '../src/components/WebSwipeBack';
import { usePlayerStore } from '../src/player/store';
import { useAuth } from '../src/auth/authStore';
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

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  const user = useAuth(s => s.user);

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
          // simple_push: only the new screen slides in from the right,
          // the old one stays put (no parallax). slide_from_right used
          // to layer two transparent screens during the parallax move
          // and the user could see both contents at once — what they
          // called "superposition". simple_push avoids that because
          // there's nothing for the old screen to do; the new screen
          // just covers it as it slides in.
          animation: 'simple_push',
          animationDuration: 260,
          // Native swipe-back: activate from anywhere on the screen, not
          // only from the left edge. iOS's default edge-only swipe was
          // confusing on detail pages with horizontal content (the
          // user started a swipe mid-screen and nothing happened). The
          // SubPageSwipeNav wrapper consumes only LEFTWARD pans, so a
          // rightward pan falls through to this back gesture cleanly.
          // Web gets an equivalent handler via <WebSwipeBack /> below.
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
          fullScreenGestureShadowEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="silent-mind/[id]" options={{ title: '' }} />
        <Stack.Screen name="qm/[id]" options={{ title: '' }} />
        <Stack.Screen name="qm-training" options={{ title: '' }} />
        <Stack.Screen name="news/[id]" options={{ title: '' }} />
        <Stack.Screen name="video/[id]" options={{ title: '' }} />
      </Stack>
      <WebSwipeBack />
      </ThemeProvider>
      </Animated.View>
      <Player />
      <VideoPlayerModal />
      {!user ? <LoginScreen /> : null}
      {!introDone && <IntroSplash onDone={() => setIntroDone(true)} />}
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerLogo: { width: 100, height: 32 },
});
