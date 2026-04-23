import { useEffect, useState } from 'react';
import { kv } from '../src/content/kv';
import { useNotifications } from '../src/player/notificationStore';
import { View, Image, StyleSheet } from 'react-native';
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
import { PhoneFrame } from '../src/components/PhoneFrame';
import { VideoPlayerModal } from '../src/components/VideoPlayerModal';
import { useAuth } from '../src/auth/authStore';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  const user = useAuth(s => s.user);

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
    <PhoneFrame>
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
          // Render the All Here wordmark in the header for every stack
          // screen (detail pages like /about, /news/[id], /silent-mind/[id]
          // …) — the (tabs) group overrides headerShown:false so its own
          // tab-layout logo stays in charge there.
          headerTitle: () => <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />,
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="silent-mind/[id]" options={{ title: '' }} />
        <Stack.Screen name="news/[id]" options={{ title: '' }} />
        <Stack.Screen name="about" options={{ title: '' }} />
      </Stack>
      <Player />
      <VideoPlayerModal />
      {!user ? <LoginScreen /> : null}
      {!introDone && <IntroSplash onDone={() => setIntroDone(true)} />}
    </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerLogo: { width: 100, height: 32 },
});
