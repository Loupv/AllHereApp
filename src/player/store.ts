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
};

type PlayerState = {
  track: AudioTrack | null;
  playlist: AudioTrack[];
  index: number;
  isOpen: boolean;
  /** Consumed once by the Player on mount / track swap, then cleared. */
  autoStart: boolean;
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
  playing: false,
  open: (track, playlist, opts) => {
    const pl = playable(playlist && playlist.length ? playlist : [track]);
    const idx = Math.max(0, pl.findIndex((t) => t.id === track.id));
    set({
      track: pl[idx] ?? track,
      playlist: pl,
      index: idx,
      isOpen: true,
      autoStart: !!opts?.autoStart,
    });
  },
  consumeAutoStart: () => {
    const v = get().autoStart;
    if (v) set({ autoStart: false });
    return v;
  },
  setPlaying: (p) => set({ playing: p }),
  close: () => set({ isOpen: false, autoStart: false, playing: false }),
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
