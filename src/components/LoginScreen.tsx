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
    <Animated.View entering={FadeIn.duration(400)} style={styles.root}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.tagline}>WHERE MEDITATION MEETS{'\n'}SCIENCE & TECHNOLOGY</Text>

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

      <Text style={styles.legal}>
        By continuing you agree to our{' '}
        <Text style={styles.legalLink}>Terms of Use</Text>
        {' '}and{' '}
        <Text style={styles.legalLink}>Privacy Policy</Text>.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm + 4,
    zIndex: 50,
  },
  logo: { width: 180, height: 60, marginBottom: spacing.xs },
  tagline: {
    ...type.overline, color: colors.textMuted, textAlign: 'center',
    marginBottom: spacing.lg, lineHeight: 18, fontSize: 10,
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
    ...type.overline, color: colors.textDim, fontSize: 9,
    textAlign: 'center', marginTop: spacing.lg, lineHeight: 14,
    maxWidth: 280,
  },
  legalLink: { color: colors.accent, textDecorationLine: 'underline' },
});
