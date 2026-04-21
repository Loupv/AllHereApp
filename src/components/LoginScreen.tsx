import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Image } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth, AuthProvider } from '../auth/authStore';
import { AppleIcon, GoogleIcon, MailIcon } from './ProviderIcons';
import { colors, radius, spacing, type } from '../theme';

const LOGO = require('../../assets/images/allhere-logo.png');

export function LoginScreen() {
  const login = useAuth(s => s.login);
  const [mode, setMode] = useState<'main' | 'email'>('main');
  const [email, setEmail] = useState('');

  const handleProvider = (provider: AuthProvider) => login(provider);
  const handleEmailSubmit = () => {
    if (!email.includes('@')) return;
    login('email', { email, name: email.split('@')[0] });
  };

  return (
    <View style={styles.root}>
      {/* Brand block — mirrors IntroSplash so the logo/tagline don't jump */}
      <View style={styles.brand}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>WHERE MEDITATION MEETS{'\n'}SCIENCE & TECHNOLOGY</Text>
      </View>

      {/* Fade-in the interactive part so it only arrives after the intro has wrapped up */}
      <Animated.View entering={FadeIn.delay(2400).duration(500)} style={styles.actions}>
        {mode === 'main' ? (
          <View style={styles.buttons}>
            <Pressable onPress={() => handleProvider('apple')} style={({ pressed }) => [styles.btn, styles.btnDark, pressed && styles.pressed]}>
              <AppleIcon size={15} />
              <Text style={styles.btnText}>Continue with Apple</Text>
            </Pressable>
            <Pressable onPress={() => handleProvider('google')} style={({ pressed }) => [styles.btn, styles.btnLight, pressed && styles.pressed]}>
              <GoogleIcon size={15} />
              <Text style={[styles.btnText, styles.btnTextDark]}>Continue with Google</Text>
            </Pressable>
            <Pressable onPress={() => setMode('email')} style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}>
              <MailIcon size={15} />
              <Text style={styles.btnText}>Continue with email</Text>
            </Pressable>
            <Pressable onPress={() => login('email', { name: 'Guest' })} hitSlop={8}>
              <Text style={styles.skipLink}>Skip for now</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.buttons}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@allhere.org"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />
            <Pressable onPress={handleEmailSubmit} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}>
              <Text style={styles.btnText}>Continue</Text>
            </Pressable>
            <Pressable onPress={() => setMode('main')}>
              <Text style={styles.backLink}>← Back</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      <Animated.Text entering={FadeIn.delay(2600).duration(500)} style={styles.legal}>
        By continuing you agree to our{' '}
        <Text style={styles.legalLink}>Terms of Use</Text>
        {' '}and{' '}
        <Text style={styles.legalLink}>Privacy Policy</Text>.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 50,
  },
  brand: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logo: { width: 200, height: 66 },
  tagline: {
    ...type.overline, color: colors.textMuted, textAlign: 'center',
    marginTop: 24, fontSize: 10, lineHeight: 18,
  },
  actions: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttons: { width: '100%', maxWidth: 280, gap: spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 10,
  },
  pressed: { opacity: 0.85 },
  btnDark: { backgroundColor: '#000' },
  btnLight: { backgroundColor: '#fff' },
  btnOutline: { borderColor: colors.borderStrong, borderWidth: 1 },
  btnPrimary: { backgroundColor: colors.accent },
  btnText: { ...type.button, color: '#fff', fontSize: 11, letterSpacing: 1.2 },
  btnTextDark: { color: '#000' },
  input: {
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderColor: colors.borderStrong, borderWidth: 1,
    color: colors.text,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
  },
  backLink: { ...type.caption, color: colors.accent, textAlign: 'center', marginTop: spacing.sm, fontSize: 11 },
  skipLink: { ...type.caption, color: colors.textDim, textAlign: 'center', marginTop: spacing.sm, textDecorationLine: 'underline', fontSize: 11 },
  legal: {
    position: 'absolute',
    bottom: '6%',
    left: spacing.xl,
    right: spacing.xl,
    ...type.overline, color: colors.textDim, fontSize: 9,
    textAlign: 'center', lineHeight: 14,
  },
  legalLink: { color: colors.accent, textDecorationLine: 'underline' },
});
