import { create } from 'zustand';
import { newsArticles } from '../content/news';
import { videoItems } from '../content/catalog';

type State = {
  newsUnread: number;
  videoUnread: number;
  markNewsRead: () => void;
  markVideoRead: () => void;
};

export const useNotifications = create<State>((set) => ({
  newsUnread: newsArticles.length,
  videoUnread: videoItems.length,
  markNewsRead: () => set({ newsUnread: 0 }),
  markVideoRead: () => set({ videoUnread: 0 }),
}));
