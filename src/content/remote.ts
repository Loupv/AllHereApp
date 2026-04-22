/**
 * Dynamic content fetched from allhere.org's WordPress REST API.
 *
 * WordPress exposes every post/page/custom-post-type as JSON at
 *   https://allhere.org/wp-json/wp/v2/<type>
 * with `_embed=1` inlining the featured media (image URL), so one request
 * gives us everything we need to render a card.
 *
 * Failure mode: if the fetch fails (offline, CORS, 5xx), callers fall back
 * to the static bundled content shipped in `news.ts` / `catalog.ts`, so the
 * app always renders something.
 */

import type { NewsArticle } from './news';
import type { VideoItem } from './catalog';

const BASE = 'https://allhere.org/wp-json/wp/v2';
const PER_PAGE = 20;

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
   .replace(/&quot;/g, '"');

const stripHtml = (s: string) =>
  decodeEntities(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

// Break HTML into rough paragraph strings for the detail view.
const htmlToParagraphs = (html: string): string[] => {
  // Grab each <p>…</p>, then fall back to a single block if none were found.
  const ps = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map(m => stripHtml(m[1]));
  const cleaned = ps.filter(Boolean);
  if (cleaned.length) return cleaned;
  const single = stripHtml(html);
  return single ? [single] : [];
};

const featuredUrl = (p: any): string | undefined =>
  p?._embedded?.['wp:featuredmedia']?.[0]?.source_url;

const firstDate = (p: any): string =>
  typeof p?.date === 'string' ? p.date.slice(0, 10) : '';

// ---------- News / Updates ----------

export type RemoteNewsArticle = NewsArticle & {
  link?: string;   // original URL on allhere.org (absent on bundled items)
  remote?: true;
};

export async function fetchUpdates(): Promise<RemoteNewsArticle[]> {
  const r = await fetch(`${BASE}/posts?per_page=${PER_PAGE}&_embed=1`);
  if (!r.ok) throw new Error(`posts ${r.status}`);
  const data = await r.json();
  return data.map((p: any): RemoteNewsArticle => ({
    id: `wp-${p.id}`,
    eyebrow: (p._embedded?.['wp:term']?.[0]?.[0]?.name as string) || 'Update',
    title: stripHtml(p.title?.rendered ?? ''),
    excerpt: stripHtml(p.excerpt?.rendered ?? '').slice(0, 280),
    date: firstDate(p),
    image: { uri: featuredUrl(p) ?? '' } as any, // local items use require() (number); remote uses {uri}
    body: htmlToParagraphs(p.content?.rendered ?? ''),
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

export type RemoteVideoItem = Omit<VideoItem, 'source'> & {
  link: string;
  source?: any;
  remote: true;
};

async function fetchType(type: string): Promise<any[]> {
  const r = await fetch(`${BASE}/${type}?per_page=${PER_PAGE}&_embed=1`);
  if (!r.ok) return [];
  return r.json();
}

export async function fetchVideos(): Promise<RemoteVideoItem[]> {
  const [headlines, podcasts] = await Promise.all([
    fetchType('in-the-headlines').catch(() => []),
    fetchType('podcast').catch(() => []),
  ]);
  const toItem = (p: any, eyebrow: string): RemoteVideoItem => ({
    id: `wp-${p.id}`,
    title: stripHtml(p.title?.rendered ?? ''),
    subtitle: stripHtml(p.excerpt?.rendered ?? '').slice(0, 140) || eyebrow,
    duration: firstDate(p),
    poster: { uri: featuredUrl(p) ?? '' } as any,
    link: p.link,
    remote: true,
  });
  const items = [
    ...headlines.map((p: any) => toItem(p, 'Headline')),
    ...podcasts.map((p: any) => toItem(p, 'Podcast')),
  ];
  // Keep only items with a real featured image so cards don't look empty
  return items.filter(it => (it.poster as any)?.uri);
}

// ---------- Hooks: fetch once, keep in-memory cache, fall back to static ----------

import { useEffect, useState } from 'react';

const memCache: Record<string, any> = {};

export function useRemoteList<T>(key: string, fetcher: () => Promise<T[]>, fallback: T[]) {
  const [items, setItems] = useState<T[]>(memCache[key] ?? fallback);
  const [loading, setLoading] = useState(!memCache[key]);
  useEffect(() => {
    let alive = true;
    fetcher()
      .then((list) => {
        if (!alive) return;
        if (list && list.length) {
          memCache[key] = list;
          setItems(list);
        }
      })
      .catch(() => { /* keep static fallback */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [key]);
  return { items, loading };
}
