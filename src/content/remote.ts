/**
 * Dynamic content fetched from allhere.org's WordPress REST API.
 *
 * WordPress exposes every post/page/custom-post-type as JSON at
 *   https://allhere.org/wp-json/wp/v2/<type>
 * with `_embed=1` inlining the featured media (image URL), so one request
 * gives us everything we need to render a card.
 *
 * Failure mode: if the fetch fails (offline, CORS, 5xx), callers fall back
 * to the last cached payload (via kv), then to the static bundled content,
 * so the app always renders something.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { NewsArticle } from './news';
import type { VideoItem } from './catalog';
import { kv } from './kv';
import { useRemoteStore } from './remoteStore';

const BASE = 'https://allhere.org/wp-json/wp/v2';
const PER_PAGE = 20;
const CACHE_PREFIX = 'ah_remote_v2_'; // bump when item shape changes

// ---------- tiny HTML helpers (WP returns HTML inside strings) ----------

const decodeEntities = (s: string) =>
  s.replace(/&#8217;/g, '’')
   .replace(/&#8216;/g, '‘')
   .replace(/&#8220;/g, '“')
   .replace(/&#8221;/g, '”')
   .replace(/&#8211;/g, '–')
   .replace(/&#8212;/g, '—')
   .replace(/&#038;/g, '&')
   .replace(/&amp;/g, '&')
   .replace(/&nbsp;/g, ' ')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"')
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

const stripHtml = (s: string) =>
  decodeEntities(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

// Break HTML into rough paragraph strings for the detail view.
const htmlToParagraphs = (html: string): string[] => {
  const ps = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map(m => stripHtml(m[1]));
  const cleaned = ps.filter(Boolean);
  if (cleaned.length) return cleaned;
  const single = stripHtml(html);
  return single ? [single] : [];
};

/**
 * Pick the smallest featured-media size that still looks crisp on a phone
 * (typically `medium_large` ~768px wide, falling back to `large`, then to
 * the original). Saves a lot of bandwidth vs. always fetching the 2400px
 * master asset.
 */
const featuredUrl = (p: any): string | undefined => {
  const fm = p?._embedded?.['wp:featuredmedia']?.[0];
  if (!fm) return undefined;
  const sizes = fm.media_details?.sizes ?? {};
  return (
    sizes.medium_large?.source_url ??
    sizes.large?.source_url ??
    sizes.medium?.source_url ??
    fm.source_url
  );
};

const firstDate = (p: any): string =>
  typeof p?.date === 'string' ? p.date.slice(0, 10) : '';

// ---------- News / Updates ----------

export async function fetchUpdates(): Promise<NewsArticle[]> {
  const r = await fetch(`${BASE}/posts?per_page=${PER_PAGE}&_embed=1`);
  if (!r.ok) throw new Error(`posts ${r.status}`);
  const data = await r.json();
  return data.map((p: any): NewsArticle => ({
    id: `wp-${p.id}`,
    eyebrow: (p._embedded?.['wp:term']?.[0]?.[0]?.name as string) || 'Update',
    title: stripHtml(p.title?.rendered ?? ''),
    excerpt: stripHtml(p.excerpt?.rendered ?? '').slice(0, 280),
    date: firstDate(p),
    image: { uri: featuredUrl(p) ?? '' },
    body: htmlToParagraphs(p.content?.rendered ?? ''),
    contentHtml: p.content?.rendered ?? '',
    link: p.link,
    remote: true,
  }));
}

// ---------- Videos ----------
//
// allhere.org doesn't expose an mp4 feed — videos live embedded inside
// "in-the-headlines" and "podcast" custom post types. We surface those as
// cards that open the corresponding article on the site in a new tab /
// external browser, instead of playing inline.

async function fetchType(type: string): Promise<any[]> {
  const r = await fetch(`${BASE}/${type}?per_page=${PER_PAGE}&_embed=1`);
  if (!r.ok) return [];
  return r.json();
}

export async function fetchVideos(): Promise<VideoItem[]> {
  const [headlines, podcasts] = await Promise.all([
    fetchType('in-the-headlines').catch(() => []),
    fetchType('podcast').catch(() => []),
  ]);
  const toItem = (p: any, eyebrow: string): VideoItem => ({
    id: `wp-${p.id}`,
    title: stripHtml(p.title?.rendered ?? ''),
    subtitle: stripHtml(p.excerpt?.rendered ?? '').slice(0, 140) || eyebrow,
    duration: firstDate(p),
    poster: { uri: featuredUrl(p) ?? '' },
    contentHtml: p.content?.rendered ?? '',
    link: p.link,
    remote: true,
  });
  const items = [
    ...headlines.map((p: any) => toItem(p, 'Headline')),
    ...podcasts.map((p: any) => toItem(p, 'Podcast')),
  ];
  // Drop items with no featured image — cards would look empty
  return items.filter(it => typeof it.poster === 'object' && !!it.poster.uri);
}

// ---------- Hooks ----------

type RemoteSink<T> = (items: T[]) => void;

type RemoteConfig<T> = {
  /** Cache key (suffixed with CACHE_PREFIX) */
  key: string;
  fetcher: () => Promise<T[]>;
  /** Static bundled items used until the first remote payload arrives */
  fallback: T[];
  /** Optional side-channel: kept in sync with the resolved list (e.g. Zustand setter) */
  sink?: RemoteSink<T>;
};

/**
 * Returns a list that starts with cached/static items and swaps to the
 * freshly-fetched list as soon as it lands. Exposes `refresh()` so UI can
 * bind a pull-to-refresh, and `refreshing` so it can render a spinner.
 */
export function useRemoteList<T>({ key, fetcher, fallback, sink }: RemoteConfig<T>) {
  const cacheKey = CACHE_PREFIX + key;
  const cached = useRef(kv.get<T[]>(cacheKey));
  const initial = (cached.current && cached.current.length) ? cached.current : fallback;

  const [items, setItems] = useState<T[]>(initial);
  const [loading, setLoading] = useState(!cached.current);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const list = await fetcher();
      if (list && list.length) {
        setItems(list);
        kv.set(cacheKey, list);
        sink?.(list);
      }
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [cacheKey, fetcher, sink]);

  // Push whatever we have (cache or static) into the sink on mount so the
  // detail route can resolve items even if the tab's list isn't yet visible.
  useEffect(() => { sink?.(items); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // First fetch on mount
  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const refresh = useCallback(() => load(true), [load]);

  return { items, loading, refreshing, error, refresh };
}

// Convenience wrappers so each tab is a one-liner.
export const useNewsFeed = (fallback: NewsArticle[]) =>
  useRemoteList<NewsArticle>({
    key: 'news',
    fetcher: fetchUpdates,
    fallback,
    sink: useRemoteStore.getState().setNews,
  });

export const useVideoFeed = (fallback: VideoItem[]) =>
  useRemoteList<VideoItem>({
    key: 'videos',
    fetcher: fetchVideos,
    fallback,
    sink: useRemoteStore.getState().setVideos,
  });
