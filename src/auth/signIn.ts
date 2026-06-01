/**
 * Sign-in flows. Each does the native provider dance, gets a verified
 * idToken, hands it to the backend (/v1/auth/*), and stores the returned
 * session in `authStore`. The backend links the current anonymous device
 * to the account, so prior activity carries over.
 *
 * Native-only (Apple is iOS-only; Google needs the native module). On web
 * these are no-ops — the loading screen offers "continue without account".
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { apiUrl, apiHeaders } from '../analytics/config';
import { getDeviceId } from '../analytics/device';
import { useAuth, type AuthProvider } from './authStore';

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '995573673473-1phdgt49e3c0a9g2ug7fv6h3bpuj1m07.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '995573673473-9ph32u38c6vcdea1lua29cvnd7s0em27.apps.googleusercontent.com';

export const appleAvailable = Platform.OS === 'ios';
export const googleAvailable = Platform.OS !== 'web';

let googleConfigured = false;
const configureGoogle = () => {
  if (googleConfigured || Platform.OS === 'web') return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
  googleConfigured = true;
};

/** Trade a provider idToken for a session and store it. */
const exchange = async (provider: AuthProvider, idToken: string): Promise<void> => {
  const res = await fetch(apiUrl(`/v1/auth/${provider}`), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ id_token: idToken, device_id: getDeviceId() ?? undefined }),
  });
  if (!res.ok) throw new Error(`auth/${provider} HTTP ${res.status}`);
  const data = (await res.json()) as { session: string; user_id: string; email: string | null };
  useAuth.getState().login({ userId: data.user_id, email: data.email ?? null, provider, session: data.session });
};

export const signInWithApple = async (): Promise<void> => {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) throw new Error('no Apple identity token');
  await exchange('apple', cred.identityToken);
};

export const requestEmailOtp = async (email: string): Promise<void> => {
  const res = await fetch(apiUrl('/v1/auth/email/request'), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`email/request HTTP ${res.status}`);
};

export const verifyEmailOtp = async (email: string, code: string): Promise<void> => {
  const res = await fetch(apiUrl('/v1/auth/email/verify'), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ email, code, device_id: getDeviceId() ?? undefined }),
  });
  if (!res.ok) throw new Error(`email/verify HTTP ${res.status}`);
  const data = (await res.json()) as { session: string; user_id: string; email: string | null };
  useAuth.getState().login({ userId: data.user_id, email: data.email ?? null, provider: 'email', session: data.session });
};

export const signInWithGoogle = async (): Promise<void> => {
  configureGoogle();
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  // The lib's return shape moved to `{ type, data }` in recent versions;
  // fall back to the legacy flat shape for safety.
  const idToken =
    (result as { data?: { idToken?: string | null } }).data?.idToken ??
    (result as { idToken?: string | null }).idToken ??
    null;
  if (!idToken) throw new Error('no Google id token');
  await exchange('google', idToken);
};
