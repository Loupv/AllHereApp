import { create } from 'zustand';
import type { NewsArticle } from './news';
import type { VideoItem } from './catalog';

/**
 * Lightweight module-level store for lists fetched from allhere.org.
 * Lets child routes (e.g. /news/[id]) find a remote item by id without
 * having to refetch. Also the sink updated by useRemoteList on each
 * successful fetch.
 */
type State = {
  news: NewsArticle[];
  videos: VideoItem[];
  setNews: (items: NewsArticle[]) => void;
  setVideos: (items: VideoItem[]) => void;
};

export const useRemoteStore = create<State>((set) => ({
  news: [],
  videos: [],
  setNews: (news) => set({ news }),
  setVideos: (videos) => set({ videos }),
}));
