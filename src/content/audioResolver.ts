/**
 * Audio resolver: resolves audio sources to playable URIs.
 * Handles bundled → cache → download fallback strategy.
 */

import { Asset } from 'expo-asset';
import * as audioDownloader from '../services/audioDownloader';
import * as audioCacheManager from '../services/audioCacheManager';
import { getAudioSource, getInterSource, isBundled } from './audioRegistry';

export type ResolvedAudio = {
  uri: string;
  isCached: boolean;
  isRemote: boolean;
};

/**
 * Resolve an audio source to a playable URI
 * @param trackId - Track identifier
 * @param roundIndex - Optional round index (0-based) for multi-round QM tracks
 * @param isInter - Whether this is an inter/break audio (default: false)
 * @param onProgress - Progress callback for downloads (bytesDownloaded, totalBytes)
 * @returns Resolved audio with URI and metadata
 * @throws Error if resolution fails
 */
export async function resolveAudioSource(
  trackId: string,
  roundIndex?: number | boolean | ((bytes: number, total: number) => void),
  isInterOrOnProgress?: boolean | ((bytes: number, total: number) => void),
  onProgress?: (bytes: number, total: number) => void,
): Promise<ResolvedAudio> {
  // Handle overloads:
  //   resolveAudioSource(trackId, onProgress)
  //   resolveAudioSource(trackId, roundIndex, onProgress)
  //   resolveAudioSource(trackId, roundIndex, isInter, onProgress)
  // The previous version's outer guard was `typeof isInterOrOnProgress
  // === 'function'`, which made the 4-arg branch unreachable (a boolean
  // is never a function). For QM tracks the Player calls with
  // (trackId, 0, false, fn) — roundIndex stayed undefined,
  // getAudioSource('qm1-4', undefined) returned null, and the resolve
  // threw "Audio source not found". Restructure as three independent
  // sibling branches keyed off the actual types.
  let actualRoundIndex: number | undefined;
  let actualIsInter = false;
  let actualOnProgress: ((bytes: number, total: number) => void) | undefined;

  if (typeof roundIndex === 'function') {
    // (trackId, onProgress)
    actualOnProgress = roundIndex;
  } else if (typeof isInterOrOnProgress === 'boolean') {
    // (trackId, roundIndex, isInter, onProgress)
    actualRoundIndex = roundIndex as number | undefined;
    actualIsInter = isInterOrOnProgress;
    actualOnProgress = onProgress;
  } else if (typeof isInterOrOnProgress === 'function') {
    // (trackId, roundIndex, onProgress)
    actualRoundIndex = roundIndex as number | undefined;
    actualOnProgress = isInterOrOnProgress;
  } else {
    // (trackId, roundIndex)  — no progress callback, no isInter
    actualRoundIndex = roundIndex as number | undefined;
  }

  // Get the appropriate source based on whether this is an inter or regular round
  const source = actualIsInter && actualRoundIndex !== undefined
    ? getInterSource(trackId, actualRoundIndex)
    : getAudioSource(trackId, actualRoundIndex);

  if (!source) {
    throw new Error(`Audio source not found for track "${trackId}"${actualRoundIndex !== undefined ? ` round ${actualRoundIndex}` : ''}${actualIsInter ? ' (inter)' : ''}`);
  }

  // Case 1: Bundled asset
  if (source.bundled) {
    try {
      const asset = Asset.fromModule(source.bundled);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      return {
        uri,
        isCached: true,
        isRemote: false,
      };
    } catch (err) {
      throw new Error(`Failed to load bundled audio for "${trackId}": ${err}`);
    }
  }

  // Case 2: Remote audio
  if (!source.remote) {
    throw new Error(`No audio source configured for track "${trackId}"`);
  }

  // Use trackId with round/inter suffix for caching
  const cacheKey = actualRoundIndex !== undefined ? `${trackId}-${actualIsInter ? 'inter' : 'round'}-${actualRoundIndex}` : trackId;

  // Check cache first — if the file is already on disk, prefer it
  // (no network, instant start, works offline)
  const cachedUri = await audioCacheManager.getCachedUri(cacheKey);
  if (cachedUri) {
    return {
      uri: cachedUri,
      isCached: true,
      isRemote: true,
    };
  }

  // Not cached: hand the remote URL to the player for streaming playback
  // (expo-audio buffers as it goes — playback can start within a few
  // seconds instead of waiting for the full file). In parallel, fire off
  // a background download so the next play of this track is instant + offline.
  audioDownloader
    .downloadAudio(cacheKey, source.remote, actualOnProgress)
    .catch((err) => {
      console.warn(`[audioResolver] background cache failed for ${cacheKey}:`, err);
    });

  return {
    uri: source.remote,
    isCached: false,
    isRemote: true,
  };
}

/**
 * Batch resolve multiple audio sources (for prefetching)
 */
export async function resolveAudioSourceBatch(
  trackIds: string[],
): Promise<Map<string, ResolvedAudio>> {
  const results = new Map<string, ResolvedAudio>();

  for (const trackId of trackIds) {
    try {
      const resolved = await resolveAudioSource(trackId);
      results.set(trackId, resolved);
    } catch (err) {
      console.warn(`Failed to resolve audio for "${trackId}":`, err);
      // Continue with next track instead of failing batch
    }
  }

  return results;
}

/**
 * Prefetch audio in background (for better UX during playback)
 */
export async function prefetchAudio(trackId: string): Promise<void> {
  try {
    if (isBundled(trackId)) {
      // Bundled audio already available, no prefetch needed
      return;
    }

    // Check if already cached
    const isCached = await audioCacheManager.isCached(trackId);
    if (isCached) {
      return;
    }

    // Start download in background (don't await, fire-and-forget)
    const source = getAudioSource(trackId);
    if (source?.remote) {
      audioDownloader.downloadAudio(trackId, source.remote).catch((err) => {
        console.warn(`Background prefetch failed for "${trackId}":`, err);
      });
    }
  } catch (err) {
    console.warn(`Prefetch setup failed for "${trackId}":`, err);
  }
}
