import { create } from 'zustand';

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

export const useAuth = create<State>((set) => ({
  user: null,
  login: (provider, info) => set({
    user: {
      name: info?.name ?? (provider === 'email' ? 'Guest' : provider[0].toUpperCase() + provider.slice(1) + ' user'),
      email: info?.email,
      provider,
    },
  }),
  logout: () => set({ user: null }),
}));
