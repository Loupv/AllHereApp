import { create } from 'zustand';
import type { AudioTrack } from '../content/catalog';

type PlayerState = {
  track: AudioTrack | null;
  isOpen: boolean;
  open: (track: AudioTrack) => void;
  close: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  track: null,
  isOpen: false,
  open: (track) => set({ track, isOpen: true }),
  close: () => set({ isOpen: false }),
}));
