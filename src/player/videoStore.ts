import { create } from 'zustand';
import type { VideoItem } from '../content/catalog';

type VideoState = {
  video: VideoItem | null;
  isOpen: boolean;
  open: (video: VideoItem) => void;
  close: () => void;
};

export const useVideoStore = create<VideoState>((set) => ({
  video: null,
  isOpen: false,
  open: (video) => set({ video, isOpen: true }),
  close: () => set({ isOpen: false }),
}));
