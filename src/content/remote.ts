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
import { Platform } from 'react-native';
import type { NewsArticle } from './news';
import { videoItems as BUNDLED_VIDEOS, type VideoItem } from './catalog';
import { kv } from './kv';
import { useRemoteStore } from './remoteStore';

const BASE = 'https://allhere.org/wp-json/wp/v2';
const PER_PAGE = 20;
const CACHE_PREFIX = 'ah_remote_v4_'; // bumped: embeds split out into `embedUrl` field
const EMBED_CACHE_PREFIX = 'ah_embed_v2_'; // per-link embed URL cache (bumped after CORS-proxy fix)

/**
 * Try to find a playable YouTube / Vimeo / Wistia embed on the live
 * allhere.org page for a given post. allhere.org's WP theme injects
 * these iframes via a shortcode / plugin (Really Simple Featured
 * Video) and they do NOT show up in the REST API's content.rendered
 * — so we grab them from the rendered HTML instead and inject an
 * iframe at the top of the post's content on our side.
 *
 * One network round-trip per post that doesn't already carry an
 * inline iframe; results cached in kv for a long time.
 */
/** allhere.org doesn't set CORS on plain HTML pages (only on /wp-json).
 * On web we go through a public CORS proxy; on native there's no CORS
 * so we fetch the page directly. */
const pageFetchUrl = (pageUrl: string) =>
  Platform.OS === 'web'
    ? `https://corsproxy.io/?${encodeURIComponent(pageUrl)}`
    : pageUrl;

// Patterns for any kind of media iframe we know how to render via EmbedPlayer:
// video (YouTube/Vimeo) plus audio (SoundCloud, Spotify, Anchor, Buzzsprout).
const EMBED_HOST_RE =
  /(?:youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com\/video|w\.soundcloud\.com\/player|open\.spotify\.com\/embed|anchor\.fm\/[^/]+\/embed|podcasters\.spotify\.com\/[^/]+\/embed|buzzsprout\.com\/[^/]+\/embed|simplecast\.com\/embed)/;

async function scrapeEmbed(pageUrl: string): Promise<string | null> {
  const cacheKey = EMBED_CACHE_PREFIX + pageUrl;
  const cached = kv.get<string | null>(cacheKey);
  if (cached !== undefined) return cached ?? null;
  try {
    const r = await fetch(pageFetchUrl(pageUrl));
    if (!r.ok) { kv.set(cacheKey, null); return null; }
    const html = await r.text();
    // Pull the first real player embed. Order matters: prefer lazy
    // 'data-lazy-src' (rocket-lazyload) before the raw src since the
    // latter sometimes points at 'about:blank' while the real URL
    // sits in data-lazy-src.
    const lazyRe = new RegExp(`data-lazy-src=["']([^"']*${EMBED_HOST_RE.source}[^"']*)`, 'i');
    const srcRe = new RegExp(`src=["']([^"']*${EMBED_HOST_RE.source}[^"']*)`, 'i');
    for (const re of [lazyRe, srcRe]) {
      const m = html.match(re);
      if (m) {
        const url = m[1];
        if (url && url !== 'about:blank') {
          kv.set(cacheKey, url);
          return url;
        }
      }
    }
    kv.set(cacheKey, null);
    return null;
  } catch {
    return null;
  }
}

/** Pull the first player iframe URL out of a content.rendered blob and
 * return both the URL and the HTML with that iframe removed, so the
 * detail view can render the video as the hero and keep the text body
 * clean (no duplicated iframe below). */
function extractEmbedFromHtml(html: string | undefined): { embedUrl?: string; contentHtml?: string } {
  if (!html) return { contentHtml: html };
  // Match the iframe by src first, then expand to its closing tag and any
  // wrapping <p>/<figure>/<div class="video-wrap">. The previous strict
  // regex broke when the iframe contained inner content (e.g. <br/>),
  // which WordPress's editor sometimes injects. Covers video (YT/Vimeo)
  // AND audio podcast embeds (SoundCloud/Spotify/Anchor/Buzzsprout).
  const srcRe = new RegExp(`<iframe[^>]*src=["']([^"']*${EMBED_HOST_RE.source}[^"']*)["'][^>]*>[\\s\\S]*?<\\/iframe>`, 'i');
  const m = html.match(srcRe);
  if (!m) return { contentHtml: html };
  const url = m[1];
  if (!url) return { contentHtml: html };
  // Strip the iframe AND its tight wrapper (p/figure/video-wrap div) so we
  // don't leave an empty container in the body.
  const start = m.index ?? 0;
  const end = start + m[0].length;
  let stripStart = start;
  let stripEnd = end;
  const wrapperOpen = html.slice(0, start).match(/<(p|figure|div)[^>]*>\s*$/i);
  if (wrapperOpen) {
    const tag = wrapperOpen[1].toLowerCase();
    const closeRe = new RegExp(`^\\s*<\\/${tag}>`, 'i');
    const after = html.slice(end);
    const closeMatch = after.match(closeRe);
    if (closeMatch) {
      stripStart = start - wrapperOpen[0].length;
      stripEnd = end + (closeMatch.index ?? 0) + closeMatch[0].length;
    }
  }
  const contentHtml = html.slice(0, stripStart) + html.slice(stripEnd);
  return { embedUrl: url, contentHtml };
}

/**
 * Synthesize a playable iframe URL from external podcast / video links
 * found inside a WP post's content. allhere.org's editor often pastes
 * just the listen-on badges (Apple Podcasts / Spotify / Buzzsprout)
 * with NO inline iframe — turn the first detected podcast link into a
 * real embed so the detail page renders an actual player instead of
 * just showing the listen-on icons.
 */
function podcastEmbedFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const sp = html.match(/open\.spotify\.com\/episode\/([a-zA-Z0-9]+)/);
  if (sp) return `https://open.spotify.com/embed/episode/${sp[1]}`;
  const ap = html.match(/podcasts\.apple\.com\/[^"'\s]*?id(\d+)(?:[^"'\s]*?\?i=(\d+))?/);
  if (ap) {
    const showId = ap[1];
    const epId = ap[2];
    const base = `https://embed.podcasts.apple.com/podcast/id${showId}`;
    return epId ? `${base}?i=${epId}` : base;
  }
  const bz = html.match(/buzzsprout\.com\/(\d+)\/episodes\/(\d+)/);
  if (bz) return `https://www.buzzsprout.com/${bz[1]}/episodes/${bz[2]}?iframe=true`;
  return undefined;
}

async function enrichWithScrapedEmbed<T extends { contentHtml?: string; link?: string; embedUrl?: string }>(item: T): Promise<T> {
  // Already an inline iframe? Lift it into embedUrl so the detail view
  // can show it as the hero, and strip it from contentHtml.
  if (hasVideo(item.contentHtml)) {
    const { embedUrl, contentHtml } = extractEmbedFromHtml(item.contentHtml);
    if (embedUrl) return { ...item, embedUrl, contentHtml };
    return item;
  }
  // Podcast badges-only posts — synthesize an embed from the first
  // recognized listen-on link. Cheaper than the live-page scrape and
  // covers Forum Radio / similar in-the-headlines podcast posts where
  // the WP content carries only Spotify / Apple / Buzzsprout badges.
  const synth = podcastEmbedFromHtml(item.contentHtml);
  if (synth) return { ...item, embedUrl: synth };
  if (!item.link) return item;
  const embed = await scrapeEmbed(item.link);
  if (!embed) return item;
  return { ...item, embedUrl: embed };
}

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
 * Pick the smallest featured-media size that still looks crisp at the
 * sizes we actually display the image:
 *   - Media tab cards render ~180-360 px wide on phone (1 or 2 col grid).
 *   - News list cards render ~360 px wide.
 *   - Detail page heroes render up to ~600 px wide.
 *
 * `medium` (~300 px wide on most WP sites) is ample for cards and even
 * detail heroes once the device pixel ratio kicks in. Previously we
 * defaulted to `medium_large` (~768 px) which looked great on 4K
 * monitors but hammered phone bandwidth and stalled the Media grid for
 * seconds. Order: `medium` → `medium_large` → `large` → original, so we
 * always get *something* even on posts that don't define every size.
 */
const featuredUrl = (p: any): string | undefined => {
  const fm = p?._embedded?.['wp:featuredmedia']?.[0];
  if (!fm) return undefined;
  const sizes = fm.media_details?.sizes ?? {};
  // Prefer the smallest size that's still crisp at ~300-600 px display
  // (1×–2× retina on phone). The allhere.org WP theme doesn't generate
  // medium / medium_large / large for in-the-headlines posts — they
  // only have thumbnail (~150 px), custom_image_900 (~900 px),
  // woocommerce_single (~600 px) and full (HD original). Falling
  // straight through to `full` was downloading multi-MB hero PNGs for
  // every Media-tab card; clipped half-loaded thumbnails were what the
  // user reported. Order: medium → woocommerce_single (~600) →
  // medium_large → custom_image_900 → large → original.
  return (
    sizes.medium?.source_url ??
    sizes.woocommerce_single?.source_url ??
    sizes.medium_large?.source_url ??
    sizes.custom_image_900?.source_url ??
    sizes.large?.source_url ??
    sizes.thumbnail?.source_url ??
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
  const items = data.map((p: any): NewsArticle => ({
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
  // Second pass: for posts whose content.rendered doesn't already carry
  // an iframe, scrape the rendered page to catch YouTube / Vimeo
  // embeds injected by the WP theme (they don't show up in the API).
  return Promise.all(items.map(enrichWithScrapedEmbed));
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

/**
 * Detect whether a WP post's rendered HTML actually carries a playable
 * video embed (YouTube / Vimeo / Fuji TV / native <video>). Matches both the
 * raw iframe tag and direct watch URLs that WordPress sometimes leaves as
 * oEmbed placeholders that render as iframes on the site.
 */
const VIDEO_PATTERNS: RegExp[] = [
  /<iframe[^>]+src=["'][^"']*(youtube\.com\/embed|player\.vimeo\.com|fod\.fujitv\.co\.jp|youtube-nocookie\.com)/i,
  /<video[\s>]/i,
  /youtube\.com\/watch\?v=/i,
  /youtu\.be\//i,
  /vimeo\.com\/\d+/i,
];

const AUDIO_PATTERNS: RegExp[] = [
  /<audio[\s>]/i,
  /soundcloud\.com\/player/i,
  /open\.spotify\.com\/episode/i,
  /anchor\.fm/i,
  /podcasters\.spotify\.com/i,
];

const hasVideo = (html: string | undefined) =>
  !!html && VIDEO_PATTERNS.some((r) => r.test(html));

const hasAudio = (html: string | undefined) =>
  !!html && AUDIO_PATTERNS.some((r) => r.test(html));

const pickKind = (wpType: string, html: string | undefined): import('./catalog').MediaKind => {
  if (hasVideo(html)) return 'video';
  if (wpType === 'podcast' || hasAudio(html)) return 'audio';
  return 'article';
};

export async function fetchVideos(): Promise<VideoItem[]> {
  const [headlines, podcasts] = await Promise.all([
    fetchType('in-the-headlines').catch(() => []),
    fetchType('podcast').catch(() => []),
  ]);
  const toItem = (p: any, wpType: string): VideoItem => {
    const html = p.content?.rendered ?? '';
    const excerpt = stripHtml(p.excerpt?.rendered ?? '').slice(0, 140);
    return {
      id: `wp-${p.id}`,
      title: stripHtml(p.title?.rendered ?? ''),
      subtitle: excerpt || undefined, // no more fake "Headline" / "Podcast" subtitle
      duration: firstDate(p),
      poster: { uri: featuredUrl(p) ?? '' },
      contentHtml: html,
      link: p.link,
      remote: true,
      kind: pickKind(wpType, html),
    };
  };
  const items = [
    ...headlines.map((p: any) => toItem(p, 'in-the-headlines')),
    ...podcasts.map((p: any) => toItem(p, 'podcast')),
  ];
  // Keep anything that has a featured image — press mentions, podcasts and
  // actual video embeds all belong in the Media tab.
  const filtered = items.filter(
    (it) => typeof it.poster === 'object' && !!it.poster.uri,
  );
  // Second pass: scrape YouTube / Vimeo embeds from the live page for
  // posts that don't already carry an iframe in content.rendered. Also
  // updates `kind` from 'article' → 'video' when a scrape succeeds so the
  // Media tab filters treat them correctly.
  const enriched = await Promise.all(filtered.map(enrichWithScrapedEmbed));
  // Only re-tag as 'video' when the embed URL is from a video host —
  // SoundCloud / Spotify / etc. embeds keep their 'audio' kind so the
  // Media tab filters work correctly.
  const VIDEO_HOST_RE = /(?:youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|fod\.fujitv\.co\.jp)/i;
  const wpItems = enriched.map((it) =>
    it.embedUrl && it.kind !== 'video' && VIDEO_HOST_RE.test(it.embedUrl)
      ? { ...it, kind: 'video' as const }
      : it,
  );
  // Always include the bundled curated videos (e.g. the 3 YouTube
  // explainers). They aren't on the WP feed but should sit alongside
  // headlines/podcasts in the Media tab.
  const bundledIds = new Set(BUNDLED_VIDEOS.map((v) => v.id));
  return [
    ...BUNDLED_VIDEOS,
    ...wpItems.filter((it) => !bundledIds.has(it.id)),
  ];
}

// Exposed for callers that want to know if an item is a true video (vs. a
// press mention or podcast) — e.g. to swap the ▶ badge.
export const itemHasVideoEmbed = (item: { contentHtml?: string }) =>
  hasVideo(item.contentHtml);
export const itemHasAudioEmbed = (item: { contentHtml?: string }) =>
  hasAudio(item.contentHtml);

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
