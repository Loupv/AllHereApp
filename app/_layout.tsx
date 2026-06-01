import { useEffect, useState } from 'react';
import { kv } from '../src/content/kv';
import { useNotifications } from '../src/player/notificationStore';
import { View, Image, StyleSheet } from 'react-native';

import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, Easing,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import { Stack, usePathname } from 'expo-router';
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
import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import { Player } from '../src/components/Player';
import { VideoPlayerModal } from '../src/components/VideoPlayerModal';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { useUpdateCheck } from '../src/hooks/useUpdateCheck';
import { AtmosphereBackground as ShaderBackground } from '../src/components/AtmosphereBackground';
import { VideoBackground } from '../src/components/VideoBackground';
import { useShaderThemeStore } from '../src/shaders/themeStore';
import { themeForJourneyPosition } from '../src/shaders';
import { useProgress } from '../src/player/progressStore';
import { initAnalytics, track as trackEvent } from '../src/analytics';
import pkg from '../package.json';
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

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  // Shader theme — tied to the user's progression through the
  // Silent Mind journey, mirroring the silent-mind-tree's per-part
  // palette:
  //   • next track is intro-* → lake (every tab stays calm during
  //     the first connection)
  //   • next track is p1-* / qm1-* → earth (video atmosphere)
  //   • next track is p2-* / qm2-* → sky
  //   • next track is p3-* / qm3-* → space
  //   • journey complete → space
  // The dev pill override on the home tab still wins (manual cycle
  // through themes for design work).
  const shaderOverride = useShaderThemeStore(s => s.override);
  // Pick the theme from the user's CURRENT SM JOURNEY POSITION (= the
  // next-up SM, skipping QM side trips). Was reading from
  // `nextTrackId()` which includes QMs — that pulled the bg back to
  // 'earth' whenever the user had a QM pending in part 1, even when
  // they'd already unlocked Space via SM progress.
  const listened = useProgress(s => s.listened);
  const shaderTheme = shaderOverride ?? themeForJourneyPosition(listened);
  // Pause only when the app is backgrounded. The shader keeps
  // running on every screen now (lake on Media/About, the
  // progress-based theme everywhere else).
  const [appActive, setAppActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  // Activity tracking: register the anonymous device, sync progress, emit
  // session events + drive the flush cadence. Fire-and-forget; never blocks
  // or throws. Points at EXPO_PUBLIC_API_URL (local wrangler dev by default).
  useEffect(() => {
    void initAnalytics(pkg.version);
  }, []);
  // Feature usage: log every screen the user lands on (tabs + detail
  // pages). One central point via the router path; fire-and-forget.
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackEvent('feature_open', { payload: { path: pathname } });
  }, [pathname]);
  // `playerOpen` is also used below to fade the navigator tree —
  // hoisting the read here so we can pass it into `shaderPaused`.
  const playerOpen = usePlayerStore(s => s.isOpen);
  // Soft "update available" check (fetches version.json off R2 once on
  // launch; null until a newer release is found and not yet dismissed).
  const { update, dismiss: dismissUpdate } = useUpdateCheck();
  // Pause the root shader when:
  //  - app is backgrounded (battery)
  //  - the Player overlay is open (it has its OWN backdrop, so the
  //    root shader runs invisible behind it for nothing)
  // The Player open case is the big saver — a 20-min meditation
  // session is 20 min of free GPU cycles otherwise.
  const shaderPaused = !appActive || playerOpen;

  // Configure expo-audio's session once at startup so the Player keeps
  // playing when the user locks the screen, and the session takes a
  // sensible interruption stance against other apps (Spotify, calls,
  // Siri). Pairs with the iOS `UIBackgroundModes: ["audio"]` declaration
  // and the Android `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission in
  // app.json — those grant the *capability*; this call activates it.
  useEffect(() => {
    // `interruptionMode: 'doNotMix'` — the AVAudioSession on iOS
    // gets a Playback category with NO mixable options, which is the
    // only configuration iOS recognises as a "primary audio app"
    // eligible for the Lock-screen Now Playing card. Anything else
    // (mixWithOthers / duckOthers) flags the session as Mixable and
    // iOS silently refuses to publish MPNowPlayingInfo — confirmed
    // in os_log:
    //   [MediaPlayback/Default] [Mixable] ... NowPlayingApp:NO
    //   Session ... is not applicable for nowPlaying consideration
    // For Android, doNotMix translates to a regular AUDIOFOCUS_GAIN
    // request, which the foreground-service intent honours the same
    // way as duckOthers — JS stays alive through the screen lock.
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          allowsRecording: false,
          interruptionMode: 'doNotMix',
          shouldRouteThroughEarpiece: false,
        });
        // Activate the AVAudioSession up-front so the lock-screen
        // Now Playing info we set on the Player's audio actually
        // gets accepted by iOS — MPNowPlayingInfoCenter silently
        // ignores publish calls while the session is inactive.
        await setIsAudioActiveAsync(true);
      } catch (err) {
        console.warn('Audio setup failed:', err);
      }
    })();
  }, []);

  // Player open flag — drives a global fade on the entire navigator
  // tree so every screen (Start tab, SM/QM tabs, detail pages…)
  // dissolves together when the audio Player overlay opens, no
  // matter where the user tapped Play. Keeps the morph illusion
  // consistent across entry points.
  // `playerOpen` already read above (hoisted for shaderPaused).
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
      {/* Atmospheric shader behind everything — rendered at root
          level so it stays visible behind the audio Player overlay
          (which fades the navigator below). Each option is keyed +
          wrapped in an Animated.View with FadeIn / FadeOut so
          switching between video and shader (or between shader
          themes) crossfades instead of hard-swapping. The hard swap
          used to expose a single frame of root-View bg before the
          new layer painted, which read as a brief flash. */}
      <Animated.View
        key={shaderTheme}
        style={StyleSheet.absoluteFill}
        entering={FadeIn.duration(360)}
        exiting={FadeOut.duration(360)}
        pointerEvents="none"
      >
        {shaderTheme === 'earth'
          ? <VideoBackground paused={shaderPaused} />
          : <ShaderBackground theme={shaderTheme} paused={shaderPaused} />}
      </Animated.View>
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
        {/* Tree screen entry — overrides the global slide_from_right
            with a fade. The SM tab's diagram + Enter button reads as
            a "preview" of the tree, so a slide-in felt like jumping
            sideways into a new context. A fade lets the diagram
            visually dissolve into the live tree at the same spot.
            Same `slide_from_right` on the way back (default), which
            preserves the swipe-right back gesture. */}
        <Stack.Screen
          name="silent-mind-tree"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
            animationDuration: 320,
          }}
        />
        <Stack.Screen name="account" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="news/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <Stack.Screen name="video/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </Stack>
      <WebSwipeBack />
      </ThemeProvider>
      </Animated.View>
      <Player />
      <VideoPlayerModal />
      {/* Soft update nudge — only after the intro splash is gone so it
          doesn't stack on top of the launch animation. */}
      {introDone && update && (
        <UpdateBanner version={update.version} url={update.url} onDismiss={dismissUpdate} />
      )}
      {!introDone && <IntroSplash onDone={() => setIntroDone(true)} />}
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerLogo: { width: 100, height: 32 },
});
