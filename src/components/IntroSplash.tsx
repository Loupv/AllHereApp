import { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Pressable, Text, TextInput, ActivityIndicator, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as AppleAuthentication from 'expo-apple-authentication';
import pkg from '../../package.json';
import { colors, type, radius, spacing } from '../theme';
import { useAuth, type AuthProvider } from '../auth/authStore';
import {
  signInWithApple,
  signInWithGoogle,
  requestEmailOtp,
  verifyEmailOtp,
  appleAvailable,
  googleAvailable,
} from '../auth/signIn';
import { GoogleIcon, MailIcon } from './ProviderIcons';

// Full version (e.g. V1.3.30) — reads straight from package.json (the
// source of truth, kept in sync with app.json at release time). Going
// through expo-constants surfaced a stale "V0.1" on the web build.
const RAW_VERSION = (pkg as { version?: string }).version ?? '0.0.0';
const VERSION = `V${RAW_VERSION}`;

const LOGO = require('../../assets/images/allhere-logo.png');

/**
 * Loading / welcome screen. Plays the brand intro, then — for signed-out
 * users — reveals the sign-in options (anonymous-first: "Continue without
 * account" is always available). Returning signed-in users skip straight
 * through, preserving the old auto-dismiss splash behaviour.
 */
export function IntroSplash({ onDone }: { onDone: () => void }) {
  // Captured once so a login mid-screen doesn't flip the layout.
  const alreadyAuthed = useRef(useAuth.getState().user != null).current;

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);
  const subOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);
  const rootOpacity = useSharedValue(1);

  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [mode, setMode] = useState<'choices' | 'email' | 'code'>('choices');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const dismiss = () => {
    rootOpacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(onDone)();
    });
  };

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    subOpacity.value = withDelay(500, withTiming(1, { duration: 700 }));
    if (alreadyAuthed) {
      // Returning user — behave like the old splash: settle, then dismiss.
      rootOpacity.value = withDelay(
        2200,
        withTiming(0, { duration: 600, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) runOnJS(onDone)();
        }),
      );
    } else {
      // Signed-out — reveal the sign-in options after the logo settles.
      btnOpacity.value = withDelay(1100, withTiming(1, { duration: 600 }));
    }
  }, []);

  const logoStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  const run = async (provider: AuthProvider, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(provider);
    try {
      await fn();
      dismiss();
    } catch {
      // User cancelled or the flow failed — re-enable and stay on screen.
      setBusy(null);
    }
  };

  const sendCode = async () => {
    if (busy || !email.includes('@')) return;
    setBusy('email');
    try {
      await requestEmailOtp(email.trim());
      setMode('code');
    } catch {
      /* couldn't send — stay on the email step */
    }
    setBusy(null);
  };
  const verifyCode = () => run('email', () => verifyEmailOtp(email.trim(), code.trim()));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <View style={styles.brand}>
        <Animated.View style={logoStyle}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[styles.sub, subStyle]}>
          WHERE MEDITATION MEETS{'\n'}SCIENCE & TECHNOLOGY
        </Animated.Text>
      </View>

      {!alreadyAuthed && (
        <Animated.View style={[styles.authBlock, btnStyle]} pointerEvents="box-none">
          {mode === 'choices' && (
            <>
              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={radius.pill}
                  style={styles.appleBtn}
                  onPress={() => void run('apple', signInWithApple)}
                />
              )}
              {googleAvailable && (
                <Pressable style={[styles.btn, styles.btnLight]} disabled={!!busy} onPress={() => void run('google', signInWithGoogle)}>
                  {busy === 'google' ? (
                    <ActivityIndicator color="#1F1F1F" />
                  ) : (
                    <>
                      <GoogleIcon size={18} />
                      <Text style={[styles.btnText, styles.btnTextDark]}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>
              )}
              <Pressable style={[styles.btn, styles.btnDark]} disabled={!!busy} onPress={() => setMode('email')}>
                <MailIcon size={15} color={colors.text} />
                <Text style={[styles.btnText, styles.btnTextLight]}>Continue with email</Text>
              </Pressable>
              <Pressable hitSlop={10} disabled={!!busy} onPress={dismiss} style={styles.skip}>
                <Text style={styles.skipText}>Continue without account</Text>
              </Pressable>
            </>
          )}

          {mode === 'email' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => void sendCode()}
              />
              <Pressable style={[styles.btn, styles.btnLight]} disabled={!!busy} onPress={() => void sendCode()}>
                {busy === 'email' ? <ActivityIndicator color="#1F1F1F" /> : <Text style={[styles.btnText, styles.btnTextDark]}>Send code</Text>}
              </Pressable>
              <Pressable hitSlop={10} disabled={!!busy} onPress={() => setMode('choices')} style={styles.skip}>
                <Text style={styles.skipText}>Back</Text>
              </Pressable>
            </>
          )}

          {mode === 'code' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
                autoFocus
                value={code}
                onChangeText={setCode}
                onSubmitEditing={verifyCode}
              />
              <Pressable style={[styles.btn, styles.btnLight]} disabled={!!busy} onPress={verifyCode}>
                {busy === 'email' ? <ActivityIndicator color="#1F1F1F" /> : <Text style={[styles.btnText, styles.btnTextDark]}>Verify &amp; sign in</Text>}
              </Pressable>
              <Pressable hitSlop={10} disabled={!!busy} onPress={() => setMode('email')} style={styles.skip}>
                <Text style={styles.skipText}>Back</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      )}

      <Animated.Text style={[styles.version, subStyle]}>{VERSION}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
  },
  brand: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logo: { width: 200, height: 66 },
  sub: {
    ...type.overline,
    color: colors.textMuted,
    marginTop: 24,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 18,
  },
  authBlock: {
    position: 'absolute',
    left: spacing.lg + spacing.md,
    right: spacing.lg + spacing.md,
    bottom: 72,
    gap: 10,
  },
  appleBtn: { height: 46, width: '100%' },
  btn: {
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnLight: { backgroundColor: '#FFFFFF' },
  btnDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  btnText: { ...type.button, fontSize: 15 },
  btnTextDark: { color: '#1F1F1F' },
  btnTextLight: { color: colors.text },
  input: {
    height: 46,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
  },
  soon: {
    ...type.overline,
    fontSize: 9,
    color: colors.textDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textDim,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  skip: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  skipText: { ...type.caption, color: colors.textMuted },
  version: {
    ...type.overline,
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 2,
  },
});
