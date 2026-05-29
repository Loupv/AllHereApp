import { create } from 'zustand';
import { kv, hydrateFromDisk } from '../content/kv';

/**
 * Per-item read/unread tracking persisted in kv so badges survive refresh.
 * - An item is "unread" until its id has been stored in the seen set.
 * - Badge count = |items| − |seen ∩ items|, computed by `countUnread(kind, items)`.
 * - Opening a detail screen calls `markSeen(kind, id)`; the tab's "Mark all
 *   as read" pill calls `markAllSeen(kind, ids)` in one go.
 */

type Kind = 'news' | 'media';

const KEY: Record<Kind, string> = {
  news: 'ah_seen_news_v1',
  media: 'ah_seen_media_v1',
};

const loadSet = (k: Kind): Record<string, true> =>
  kv.get<Record<string, true>>(KEY[k]) ?? {};

type State = {
  seenNews: Record<string, true>;
  seenMedia: Record<string, true>;
  markSeen: (kind: Kind, id: string) => void;
  markAllSeen: (kind: Kind, ids: string[]) => void;
  /** Legacy helpers kept so the rest of the codebase still compiles. */
  markNewsRead: () => void;
  markVideoRead: () => void;
};

export const useNotifications = create<State>((set, get) => ({
  seenNews: loadSet('news'),
  seenMedia: loadSet('media'),
  markSeen: (kind, id) => {
    const curKey = kind === 'news' ? 'seenNews' : 'seenMedia';
    const current = (get() as any)[curKey] as Record<string, true>;
    if (current[id]) return;
    const next = { ...current, [id]: true as const };
    kv.set(KEY[kind], next);
    set({ [curKey]: next } as any);
  },
  markAllSeen: (kind, ids) => {
    const curKey = kind === 'news' ? 'seenNews' : 'seenMedia';
    const next = { ...(get() as any)[curKey] };
    for (const id of ids) next[id] = true;
    kv.set(KEY[kind], next);
    set({ [curKey]: next } as any);
  },
  markNewsRead: () => { /* no-op: we now track per-item. Left here for old call sites. */ },
  markVideoRead: () => { /* idem */ },
}));

// Native cold-start: `loadSet` above reads an empty `memCache`, so the seen
// sets start blank on every fresh launch. Pull them off disk and merge,
// keeping any `markSeen` that landed before the async read resolved.
hydrateFromDisk<Record<string, true>>(KEY.news, (stored) =>
  useNotifications.setState((s) => ({ seenNews: { ...stored, ...s.seenNews } })));
hydrateFromDisk<Record<string, true>>(KEY.media, (stored) =>
  useNotifications.setState((s) => ({ seenMedia: { ...stored, ...s.seenMedia } })));

/** Compute unread count for a given list. */
export function countUnread(kind: Kind, ids: string[]) {
  const seen = useNotifications.getState()[kind === 'news' ? 'seenNews' : 'seenMedia'];
  let n = 0;
  for (const id of ids) if (!seen[id]) n++;
  return n;
}
