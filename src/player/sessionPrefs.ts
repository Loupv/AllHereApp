import { create } from 'zustand';
import { kv, hydrateFromDisk } from '../content/kv';

/**
 * User preferences for session sound cues. Used by the QM Training
 * timer (qm-training screen) — currently just the bell variant played
 * at round boundaries. Persisted via `kv` (localStorage on web,
 * AsyncStorage on native).
 */
export type SessionPrefs = {
  /** Bell variant id from `bellRegistry.BELL_SOUNDS` — used at QM
   *  Training round boundaries. `'none'` silences it. */
  bellSoundId: string;
};

type Store = SessionPrefs & {
  setBellSoundId: (id: string) => void;
};

const STORAGE_KEY = 'ah_session_prefs_v1';

const DEFAULTS: SessionPrefs = {
  bellSoundId: 'classic',
};

const initial: SessionPrefs = {
  ...DEFAULTS,
  ...(kv.get<Partial<SessionPrefs>>(STORAGE_KEY) ?? {}),
};

const persist = (next: SessionPrefs) => kv.set(STORAGE_KEY, next);

export const useSessionPrefs = create<Store>((set, get) => ({
  ...initial,
  setBellSoundId: (id) => {
    set({ bellSoundId: id });
    persist({ bellSoundId: get().bellSoundId });
  },
}));

// Native cold-start: `kv.get` in `initial` read an empty `memCache`, so the
// store starts on DEFAULTS. Pull the saved prefs off disk and apply them.
hydrateFromDisk<Partial<SessionPrefs>>(STORAGE_KEY, (stored) =>
  useSessionPrefs.setState(stored));
