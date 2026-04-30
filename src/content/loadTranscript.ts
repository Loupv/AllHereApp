import { Asset } from 'expo-asset';
import { parseWhisperJson, TranscriptCue } from './transcript';
import * as audioCacheManager from '../services/audioCacheManager';

const bundledCache = new Map<number, TranscriptCue[]>();
const remoteCache = new Map<string, TranscriptCue[]>();

export const loadTranscript = async (source: number | string): Promise<TranscriptCue[]> => {
  // Bundled transcript (require() module ID)
  if (typeof source === 'number') {
    const cached = bundledCache.get(source);
    if (cached) return cached;
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const res = await fetch(uri);
    const raw = await res.text();
    const cues = parseWhisperJson(raw);
    bundledCache.set(source, cues);
    return cues;
  }

  // Remote transcript (URL string)
  const cached = remoteCache.get(source);
  if (cached) return cached;

  try {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const raw = await res.text();
    const cues = parseWhisperJson(raw);
    remoteCache.set(source, cues);
    return cues;
  } catch (err) {
    console.warn('Failed to load remote transcript:', err);
    throw err;
  }
};
