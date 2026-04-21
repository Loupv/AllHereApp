import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
});
