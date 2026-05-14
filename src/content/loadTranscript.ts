import { Asset } from 'expo-asset';
import { parseWhisperJson, parseWhisperData, TranscriptCue, WhisperJson } from './transcript';
import * as audioCacheManager from '../services/audioCacheManager';

const bundledCache = new Map<number, TranscriptCue[]>();
const objectCache = new WeakMap<object, TranscriptCue[]>();
const remoteCache = new Map<string, TranscriptCue[]>();

export const loadTranscript = async (source: number | string | WhisperJson): Promise<TranscriptCue[]> => {
  // Bundled transcript loaded as an inline JS module — .wjson is a
  // sourceExt with a custom Metro transformer that wraps the JSON as
  // `module.exports = <json>`, so require() returns the parsed object
  // directly (not an asset module ID). This is the only branch that
  // gets hit on native in the current build; the asset-id branch
  // below is kept as a fallback for any caller that hasn't migrated.
  if (typeof source === 'object' && source !== null) {
    const cached = objectCache.get(source);
    if (cached) return cached;
    const cues = parseWhisperData(source as WhisperJson);
    objectCache.set(source, cues);
    return cues;
  }

  // Bundled transcript (legacy asset module ID path — no longer
  // exercised after the wjson-as-sourceExt switch but harmless to
  // keep around in case we revert).
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
