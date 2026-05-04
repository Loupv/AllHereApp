import { create } from 'zustand';
import { kv } from '../content/kv';

/**
 * User preferences for session sound cues — applies to both the QM
 * Training timer (qm-training screen) and the guided Player (SM + QM
 * audios). Persisted via the `kv` helper (localStorage on web,
 * AsyncStorage best-effort on native) so changes survive reloads.
 */
export type SessionPrefs = {
  /** "3 / 2 / 1" tick burst before round 1 + during the last 3 s of
   *  every break in the QM Training timer. */
  countdownEnabled: boolean;
  /** Bell variant id from `bellRegistry.BELL_SOUNDS`. The special
   *  value `'none'` means "no bell at all" (overrides the toggle
   *  below). */
  bellSoundId: string;
  /** Play the bell at the start AND the end of every guided audio
   *  (SM + QM Player). Ignored when `bellSoundId === 'none'`. */
  bellAtAudioBoundaries: boolean;
};

type Store = SessionPrefs & {
  setCountdownEnabled: (v: boolean) => void;
  setBellSoundId: (id: string) => void;
  setBellAtAudioBoundaries: (v: boolean) => void;
};

const STORAGE_KEY = 'ah_session_prefs_v1';

const DEFAULTS: SessionPrefs = {
  countdownEnabled: true,
  bellSoundId: 'classic',
  bellAtAudioBoundaries: true,
};

const initial: SessionPrefs = {
  ...DEFAULTS,
  ...(kv.get<Partial<SessionPrefs>>(STORAGE_KEY) ?? {}),
};

const persist = (next: SessionPrefs) => kv.set(STORAGE_KEY, next);

// Strip the action methods before persisting so we only write the
// SessionPrefs payload to storage. Centralised here to avoid
// duplicating the destructure in every setter.
const snapshotPrefs = (s: Store): SessionPrefs => ({
  countdownEnabled: s.countdownEnabled,
  bellSoundId: s.bellSoundId,
  bellAtAudioBoundaries: s.bellAtAudioBoundaries,
});

export const useSessionPrefs = create<Store>((set, get) => ({
  ...initial,
  setCountdownEnabled: (v) => {
    set({ countdownEnabled: v });
    persist(snapshotPrefs(get()));
  },
  setBellSoundId: (id) => {
    set({ bellSoundId: id });
    persist(snapshotPrefs(get()));
  },
  setBellAtAudioBoundaries: (v) => {
    set({ bellAtAudioBoundaries: v });
    persist(snapshotPrefs(get()));
  },
}));
