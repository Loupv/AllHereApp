import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { kv } from '../content/kv';

export type AuthProvider = 'google' | 'apple' | 'email';

export type User = {
  name: string;
  email?: string;
  provider: AuthProvider;
};

type State = {
  user: User | null;
  login: (provider: AuthProvider, info?: Partial<User>) => void;
  logout: () => void;
};

const STORAGE_KEY = 'ah_auth_v1';

// Hand-rolled persistence (see progressStore for the rationale — zustand's
// `persist` middleware silently broke web mount in this project). The
// payload is a single `User | null`, so a one-shot `kv` round-trip per
// login/logout is plenty.
//
// Hydration nuance: on native, `kv.get` is *synchronous* but reads from an
// in-memory cache that's empty at module load (AsyncStorage is async).
// So a cold-start `kv.get(STORAGE_KEY)` returns `undefined` even when a
// previous session saved a user — and the LoginScreen flashes back up
// despite the user already being signed in.
//
// On web, localStorage IS synchronous, so `kv.get` works on the first
// call. We use it for initial state there and skip the async hydrate.
const initialUser: User | null = kv.get<User>(STORAGE_KEY) ?? null;

export const useAuth = create<State>((set) => ({
  user: initialUser,
  login: (provider, info) => {
    const user: User = {
      name: info?.name ?? (provider === 'email' ? 'Guest' : provider[0].toUpperCase() + provider.slice(1) + ' user'),
      email: info?.email,
      provider,
    };
    set({ user });
    kv.set(STORAGE_KEY, user);
  },
  logout: () => {
    set({ user: null });
    kv.remove(STORAGE_KEY);
  },
}));

// Native cold-start hydration. The synchronous `kv.get` above missed the
// stored user (memCache empty at module load); fall back to the async
// AsyncStorage read and patch the store once it resolves. Skipped on web
// since localStorage already gave us the right answer.
if (Platform.OS !== 'web' && initialUser == null) {
  AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as User;
        // Only patch if no one logged in / out in the meantime.
        if (useAuth.getState().user == null) {
          useAuth.setState({ user: stored });
        }
      } catch { /* malformed payload — ignore, user just signs in again */ }
    })
    .catch(() => { /* AsyncStorage unavailable — fall back to login flow */ });
}
