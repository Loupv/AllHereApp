/**
 * Audio downloader: fetches remote audio files, caches them locally, handles retries.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as audioCacheManager from './audioCacheManager';
import { getAudioSource } from '../content/audioRegistry';

export class AudioDownloadError extends Error {
  constructor(
    message: string,
    public readonly trackId: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'AudioDownloadError';
  }
}

type ProgressCallback = (bytesDownloaded: number, totalBytes: number) => void;

const CACHE_DIR = FileSystem.cacheDirectory + 'allhere_audio/';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [100, 500, 2000]; // ms between retries

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn('Failed to create cache directory:', err);
  }
}

/**
 * Download a file with retry logic
 */
async function fetchWithRetry(
  url: string,
  onProgress?: ProgressCallback,
): Promise<ArrayBuffer> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let downloaded = 0;

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        downloaded += value.length;
        onProgress?.(downloaded, total);
      }

      // Combine chunks into ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const buffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      return buffer.buffer;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Download failed');
}

/**
 * Generate a safe filename for cached audio
 */
function getCacheFileName(trackId: string): string {
  return `audio_${trackId.replace(/[^a-z0-9]/gi, '_')}.mp3`;
}

/**
 * Download and cache audio for a track
 * @param trackId - Track identifier
 * @param url - Remote audio URL
 * @param onProgress - Progress callback (bytesDownloaded, totalBytes)
 * @returns Cached file URI
 * @throws AudioDownloadError if download fails after retries
 */
export async function downloadAudio(
  trackId: string,
  url: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  try {
    // Check cache first
    const cached = await audioCacheManager.getCachedUri(trackId);
    if (cached) {
      try {
        const info = await FileSystem.getInfoAsync(cached);
        if (info.exists) {
          return cached;
        }
      } catch {
        // File doesn't exist, proceed with download
      }
    }

    await ensureCacheDir();

    // Download file
    const buffer = await fetchWithRetry(url, onProgress);

    // Write to cache
    const cacheFileName = getCacheFileName(trackId);
    const cacheUri = CACHE_DIR + cacheFileName;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    await FileSystem.writeAsStringAsync(cacheUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Record in cache metadata
    const fileSize = buffer.byteLength;
    await audioCacheManager.setCached(trackId, cacheUri, fileSize);

    // Cleanup if cache is too large
    await audioCacheManager.clearOldestUntilUnder(500 * 1024 * 1024);

    return cacheUri;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new AudioDownloadError(`Failed to download audio for track "${trackId}"`, trackId, error);
  }
}

/**
 * Download audio by track ID (looks up URL from registry)
 */
export async function downloadAudioByTrackId(
  trackId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const source = getAudioSource(trackId);
  if (!source?.remote) {
    throw new AudioDownloadError(`No remote source found for track "${trackId}"`, trackId);
  }

  return downloadAudio(trackId, source.remote, onProgress);
}

/**
 * Cleanup cached audio file
 */
export async function removeCachedAudio(trackId: string): Promise<void> {
  const uri = await audioCacheManager.getCachedUri(trackId);
  if (uri) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await audioCacheManager.removeCached(trackId);
    } catch (err) {
      console.warn(`Failed to remove cached audio ${trackId}:`, err);
    }
  }
}

/**
 * Clear all cached audio files
 */
export async function clearAllCachedAudio(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await audioCacheManager.clearAllCache();
  } catch (err) {
    console.warn('Failed to clear audio cache directory:', err);
  }
}
