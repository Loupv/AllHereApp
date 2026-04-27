import { create } from 'zustand';
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
