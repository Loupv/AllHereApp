import { Asset } from 'expo-asset';
import { parseWhisperJson, TranscriptCue } from './transcript';

const cache = new Map<number, TranscriptCue[]>();

export const loadTranscript = async (module: number): Promise<TranscriptCue[]> => {
  const cached = cache.get(module);
  if (cached) return cached;
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const res = await fetch(uri);
  const raw = await res.text();
  const cues = parseWhisperJson(raw);
  cache.set(module, cues);
  return cues;
};
