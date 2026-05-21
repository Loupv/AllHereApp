/**
 * Audio cache manager: handles caching of downloaded audio files.
 * Built on top of kv.ts (AsyncStorage + localStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { kv } from '../content/kv';

export type CacheMetadata = {
  uri: string; // Local file URI
  size: number; // Bytes
  timestamp: number; // Unix timestamp
  cached: true;
};

type CacheStore = Record<string, CacheMetadata>;

const CACHE_KEY = 'ah_audio_cache_v1';
const DEFAULT_MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

let cacheStore: CacheStore | null = null;
// Native cold-start hydration. `kv.get` is synchronous and on native it
// reads from an in-memory cache that's EMPTY when the JS bundle first
// evaluates — so the very first `loadCacheStore()` call after a cold
// launch would see `undefined`, fall back to `{}`, and any subsequent
// `setCached()` would overwrite the on-disk metadata with that empty
// map. The actual MP3 files survive in FileSystem.cacheDirectory across
// launches, but without the metadata we wouldn't know which trackId
// maps to which file — so the user would re-download every track on
// every cold start.
// This Promise is awaited inside `loadCacheStore` so the first lookup
// after boot doesn't race with the AsyncStorage read.
const hydrationPromise: Promise<CacheStore | null> = (async () => {
  if (Platform.OS === 'web') return null; // kv covers localStorage sync
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheStore;
  } catch {
    return null;
  }
})();

/**
 * Load cache metadata from persistent storage
 */
async function loadCacheStore(): Promise<CacheStore> {
  if (cacheStore) return cacheStore;
  // Try the sync kv path first — on web localStorage is sync, and on
  // native this returns whatever the AsyncStorage memCache currently
  // holds (populated by the hydration promise below or by a previous
  // kv.set() in the same session).
  const synced = kv.get<CacheStore>(CACHE_KEY);
  if (synced) {
    cacheStore = synced;
    return cacheStore;
  }
  // Native cold start: await the explicit hydration read before
  // deciding the store is empty.
  const hydrated = await hydrationPromise;
  cacheStore = hydrated ?? {};
  return cacheStore;
}

/**
 * Save cache metadata to persistent storage
 */
async function saveCacheStore(): Promise<void> {
  if (!cacheStore) return;
  kv.set(CACHE_KEY, cacheStore);
}

/**
 * Check if a track is cached
 */
export async function isCached(trackId: string): Promise<boolean> {
  const store = await loadCacheStore();
  return trackId in store;
}

/**
 * Get cached URI for a track
 */
export async function getCachedUri(trackId: string): Promise<string | null> {
  const store = await loadCacheStore();
  return store[trackId]?.uri ?? null;
}

/**
 * Get cache metadata for a track
 */
export async function getMetadata(trackId: string): Promise<CacheMetadata | null> {
  const store = await loadCacheStore();
  return store[trackId] ?? null;
}

/**
 * Mark a track as cached with metadata
 */
export async function setCached(
  trackId: string,
  uri: string,
  size: number,
): Promise<void> {
  const store = await loadCacheStore();
  store[trackId] = {
    uri,
    size,
    timestamp: Date.now(),
    cached: true,
  };
  await saveCacheStore();
}

/**
 * Get total cache size in bytes
 */
export async function getTotalCacheSize(): Promise<number> {
  const store = await loadCacheStore();
  return Object.values(store).reduce((sum, meta) => sum + (meta.size ?? 0), 0);
}

/**
 * Clear oldest cached audios until total size is under limit (LRU)
 */
export async function clearOldestUntilUnder(
  maxSizeBytes: number = DEFAULT_MAX_CACHE_SIZE,
): Promise<void> {
  const store = await loadCacheStore();
  const entries = Object.entries(store);
  let totalSize = entries.reduce((sum, [, meta]) => sum + (meta.size ?? 0), 0);

  if (totalSize <= maxSizeBytes) return;

  // Sort by timestamp (oldest first)
  entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

  // Remove oldest until under limit
  for (const [trackId, meta] of entries) {
    if (totalSize <= maxSizeBytes) break;
    delete store[trackId];
    totalSize -= meta.size ?? 0;
  }

  await saveCacheStore();
}

/**
 * Clear all cached audio
 */
export async function clearAllCache(): Promise<void> {
  cacheStore = {};
  await saveCacheStore();
}

/**
 * Get list of all cached track IDs
 */
export async function getCachedTracks(): Promise<string[]> {
  const store = await loadCacheStore();
  return Object.keys(store);
}

/**
 * Remove a specific track from cache
 */
export async function removeCached(trackId: string): Promise<void> {
  const store = await loadCacheStore();
  delete store[trackId];
  await saveCacheStore();
}
