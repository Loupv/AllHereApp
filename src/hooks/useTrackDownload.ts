import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as audioCacheManager from '../services/audioCacheManager';
import * as audioDownloader from '../services/audioDownloader';
import { getAudioSource, getInterSource } from '../content/audioRegistry';
import type { AudioTrack } from '../content/catalog';

export type DownloadState = 'idle' | 'downloading' | 'cached' | 'error';

type DownloadInfo = {
  state: DownloadState;
  progress: number; // 0..100
  download: () => Promise<void>;
};

/**
 * Encapsulates the offline-download flow for a single AudioTrack so a
 * list cell (ContentCard) can render a small download chip without
 * each parent screen re-implementing the resolve / cache / progress
 * dance.
 *
 *  - Single-audio tracks (no `rounds`) → one cache entry keyed by
 *    track.id.
 *  - Multi-round QM tracks → walks every round (and optional inter)
 *    sequentially and reports a global progress (bytes-of-current-
 *    round divided by the round count to keep the bar smooth).
 *
 * State 'cached' means at least one of the resolved resources is on
 * disk; we don't probe every round on mount because that's noisy. The
 * common case (single track) is exact.
 */
function buildCacheKeys(track: AudioTrack): { keys: string[]; remoteFor(key: string): string | null } {
  const keys: string[] = [];
  const remoteMap = new Map<string, string | null>();
  if (track.rounds) {
    const max = track.rounds.max ?? 1;
    for (let i = 0; i < max; i++) {
      const round = getAudioSource(track.id, i);
      if (round?.remote) {
        const key = `${track.id}-round-${i}`;
        keys.push(key);
        remoteMap.set(key, round.remote);
      }
      const inter = getInterSource(track.id, i);
      if (inter?.remote) {
        const key = `${track.id}-inter-${i}`;
        keys.push(key);
        remoteMap.set(key, inter.remote);
      }
    }
  } else {
    const src = getAudioSource(track.id);
    if (src?.remote) {
      const key = track.id;
      keys.push(key);
      remoteMap.set(key, src.remote);
    }
  }
  return { keys, remoteFor: (k) => remoteMap.get(k) ?? null };
}

export function useTrackDownload(track: AudioTrack | undefined): DownloadInfo {
  const [state, setState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const inFlight = useRef(false);

  // On mount / track change, check whether the (first) cache entry is
  // already on disk so we render a 'cached' chip instead of the empty
  // download button.
  useEffect(() => {
    let active = true;
    if (!track) return;
    const { keys } = buildCacheKeys(track);
    if (keys.length === 0) return; // nothing remote to download
    (async () => {
      const uri = await audioCacheManager.getCachedUri(keys[0]);
      if (!active) return;
      if (uri) setState('cached');
    })();
    return () => { active = false; };
  }, [track?.id]);

  const download = useCallback(async () => {
    if (!track || inFlight.current) return;
    const { keys, remoteFor } = buildCacheKeys(track);
    if (keys.length === 0) return;
    // Web has no real disk to write to — expo-file-system's native
    // APIs (getInfoAsync, createDownloadResumable…) are unavailable
    // there, so the chip would spin forever. Browsers cache audio
    // playback automatically anyway. Mark as cached so the UI gives
    // the user useful feedback instead of a stuck 0%.
    if (Platform.OS === 'web') {
      setState('cached');
      setProgress(100);
      return;
    }
    inFlight.current = true;
    setState('downloading');
    setProgress(0);
    // Watchdog: if no progress callback fires for 30 s, assume the
    // download is stuck (server not responding, NSURLSession hang,
    // etc.) and surface the error UI so the user can retry. The
    // timer is rearmed every time setProgress is called.
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let stalled = false;
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        console.warn(`[useTrackDownload] no progress for ${track.id} in 30s — marking error`);
        setState('error');
        inFlight.current = false;
      }, 30000);
    };
    armWatchdog();
    try {
      // Walk every key (round / inter). Per-segment progress is rolled
      // into a smooth global bar by averaging on completed segments
      // plus the current segment's local progress.
      for (let idx = 0; idx < keys.length; idx++) {
        if (stalled) return;
        const key = keys[idx];
        const url = remoteFor(key);
        if (!url) continue;
        const cached = await audioCacheManager.getCachedUri(key);
        if (cached) {
          // Bump progress so the user sees motion when some segments
          // were already cached from a prior partial download.
          const overall = ((idx + 1) / keys.length) * 100;
          setProgress(Math.round(overall));
          armWatchdog();
          continue;
        }
        await audioDownloader.downloadAudio(key, url, (bytes, total) => {
          armWatchdog();
          const segmentPct = total > 0 ? bytes / total : 0;
          const overall = ((idx + segmentPct) / keys.length) * 100;
          // Force at least 1% so the user knows something is happening
          // even before the first byte arrives.
          setProgress(Math.max(1, Math.round(overall)));
        });
      }
      if (stalled) return;
      setProgress(100);
      setState('cached');
    } catch (err) {
      console.warn(`[useTrackDownload] download failed for ${track.id}:`, err);
      if (!stalled) setState('error');
    } finally {
      if (watchdog) clearTimeout(watchdog);
      inFlight.current = false;
    }
  }, [track?.id]);

  return { state, progress, download };
}
