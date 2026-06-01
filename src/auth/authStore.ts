import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { kv } from '../content/kv';

export type AuthProvider = 'google' | 'apple' | 'email';

export type User = {
  /** Server-side user id (from /v1/auth/*). */
  userId: string;
  email: string | null;
  provider: AuthProvider;
  /** Session JWT — bearer for authenticated calls. */
  session: string;
};

type State = {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
};

const STORAGE_KEY = 'ah_auth_v1';

// Hand-rolled persistence (zustand's `persist` middleware broke web mount in
// this project — see progressStore). On native, `kv.get` is synchronous but
// reads an in-memory cache that's empty at module load, so we async-hydrate
// below. Web's localStorage is sync, so initial state is correct there.
//
// NOTE: the session JWT is stored in AsyncStorage (not encrypted). Fine for
// an MVP; harden with `expo-secure-store` before handling anything sensitive.
const initialUser: User | null = kv.get<User>(STORAGE_KEY) ?? null;

export const useAuth = create<State>((set) => ({
  user: initialUser,
  login: (user) => {
    set({ user });
    kv.set(STORAGE_KEY, user);
  },
  logout: () => {
    set({ user: null });
    kv.remove(STORAGE_KEY);
  },
}));

// Native cold-start hydration — the synchronous `kv.get` above missed the
// stored user (memCache empty at module load); read AsyncStorage directly
// and patch the store once it resolves (unless someone logged in/out since).
if (Platform.OS !== 'web' && initialUser == null) {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as User;
        if (useAuth.getState().user == null) useAuth.setState({ user: stored });
      } catch {
        /* malformed payload — ignore, user signs in again */
      }
    })
    .catch(() => {
      /* AsyncStorage unavailable — fall back to the login flow */
    });
}
