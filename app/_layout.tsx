import { useEffect, useState } from 'react';
import { kv } from '../src/content/kv';
import { useNotifications } from '../src/player/notificationStore';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

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
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Shared atmospheric gradient — sits at the root so every
          screen (tabs + detail pages like silent-mind/[id], qm/[id],
          news/[id]) renders against the same backdrop. The Stack's
          contentStyle is transparent so this is what shows through.
          Per-part palettes (Earth / Sky / Space) used to be a backlog
          idea, but we deliberately keep one shared gradient app-wide
          for consistency. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AnimatedGradient centerY={0.55} animateCenter={false} />
      </View>
      {/* Global energy column — a soft vertical shaft of luminous
          waves running floor → ceiling. Sits **behind** UI (no
          zIndex, so it stacks under the Stack screens, the Player
          overlay, and the tab bar) — the user explicitly wants it
          to feel like a backdrop, not an overlay. `pointerEvents="none"`
          so taps continue to land on underlying UI. Frozen while
          nothing is playing; ondulates while audio plays. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Default accent ('#9D8AE8') gives the fog a saturated lavender
            that survives the heavy blur. Sharp filaments + stars stay
            white via `crispAccent`. */}
        <EnergyColumn opacity={0.75} active={audioPlaying} />
      </View>
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
          // Horizontal slide when pushing a detail page from a tab — the
          // "opening a sub-folder" cue. Applies to every non-(tabs) child
          // (silent-mind/[id], qm/[id], news/[id], video/[id]). Tab
          // switches themselves keep their own root-level behaviour.
          animation: 'slide_from_right',
          // Native swipe-back from the left edge to dismiss a detail page
          // (iOS already does this by default; we set it explicitly so
          // Android's native-stack also picks it up). Web gets an
          // equivalent handler via <WebSwipeBack /> below.
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="silent-mind/[id]" options={{ title: '' }} />
        <Stack.Screen name="qm/[id]" options={{ title: '' }} />
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerLogo: { width: 100, height: 32 },
});
