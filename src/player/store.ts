import { create } from 'zustand';
import type { AudioTrack } from '../content/catalog';

type OpenOptions = {
  /**
   * When true the player skips the pre-play screen (description + QM
   * params + 'Begin' circle) and starts playback right away. Used for
   * call sites where the user's intent is unambiguous — typically the
   * big play button on the Start tab.
   */
  autoStart?: boolean;
  /**
   * Optional accent colour override. When passed, the Player tints
   * its play button (and other accent UI) with this colour instead of
   * the lane-derived default. Used by the journey tree to carry the
   * rainbow hue of the tapped dot into the Player.
   */
  accent?: string;
  /**
   * Number of seconds to count down on a settle-in screen before
   * autoStart fires. Used by the Start screen quick-meditation pills
   * to mirror the QM Training pre-round countdown UX. When set,
   * `autoStart` is also implied (the user already tapped Play; we
   * just want the pre-roll moment before audio starts).
   */
  preRollSeconds?: number;
};

type PlayerState = {
  track: AudioTrack | null;
  playlist: AudioTrack[];
  index: number;
  isOpen: boolean;
  /** Consumed once by the Player on mount / track swap, then cleared. */
  autoStart: boolean;
  /** Optional accent override — see OpenOptions.accent. null when default. */
  accentOverride: string | null;
  /** Pre-roll countdown seconds — consumed once on Player mount. */
  preRollSeconds: number;
  /**
   * Live "audio is currently playing" flag, mirrored from expo-audio's
   * status inside `Player`. Lives on the store so other parts of the
   * UI (e.g. the global RippleField background) can react to it
   * without subscribing to expo-audio directly.
   */
  playing: boolean;
  open: (track: AudioTrack, playlist?: AudioTrack[], opts?: OpenOptions) => void;
  consumeAutoStart: () => boolean;
  setPlaying: (p: boolean) => void;
  close: () => void;
  playNext: () => void;
  playPrev: () => void;
  hasNext: () => boolean;
  hasPrev: () => boolean;
};

// Only playable tracks are useful for prev/next navigation.
// Remote tracks now resolve via track.id through audioRegistry, so we no
// longer require a literal `source` field — `!comingSoon` is sufficient.
const playable = (ts: AudioTrack[] | undefined) =>
  (ts ?? []).filter((t) => !t.comingSoon);

export const usePlayerStore = create<PlayerState>((set, get) => ({
  track: null,
  playlist: [],
  index: -1,
  isOpen: true && false,
  autoStart: false,
  accentOverride: null,
  preRollSeconds: 0,
  playing: false,
  open: (track, playlist, opts) => {
    const pl = playable(playlist && playlist.length ? playlist : [track]);
    const idx = Math.max(0, pl.findIndex((t) => t.id === track.id));
    const preRoll = Math.max(0, Math.round(opts?.preRollSeconds ?? 0));
    set({
      track: pl[idx] ?? track,
      playlist: pl,
      index: idx,
      isOpen: true,
      // A preRoll implies autoStart — the user already pressed Play,
      // we're just showing the settle-in moment first.
      autoStart: !!opts?.autoStart || preRoll > 0,
      accentOverride: opts?.accent ?? null,
      preRollSeconds: preRoll,
    });
  },
  consumeAutoStart: () => {
    const v = get().autoStart;
    if (v) set({ autoStart: false });
    return v;
  },
  setPlaying: (p) => set({ playing: p }),
  close: () => set({ isOpen: false, autoStart: false, playing: false, accentOverride: null, preRollSeconds: 0 }),
  playNext: () => {
    const { playlist, index } = get();
    if (index < 0 || index >= playlist.length - 1) return;
    const next = playlist[index + 1];
    if (next) set({ track: next, index: index + 1 });
  },
  playPrev: () => {
    const { playlist, index } = get();
    if (index <= 0) return;
    const prev = playlist[index - 1];
    if (prev) set({ track: prev, index: index - 1 });
  },
  hasNext: () => {
    const { playlist, index } = get();
    return index >= 0 && index < playlist.length - 1;
  },
  hasPrev: () => {
    const { index } = get();
    return index > 0;
  },
}));
