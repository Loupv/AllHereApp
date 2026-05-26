import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { parseWhisperJson, parseWhisperData, TranscriptCue, WhisperJson } from './transcript';

// -----------------------------------------------------------------------------
// Remote transcript pipeline
// -----------------------------------------------------------------------------
// Every bundled .wjson now carries `{ key, rev }` (see scripts/stamp-transcripts.mjs).
// At runtime we resolve a transcript by:
//   1. in-memory cache (this session)
//   2. on-disk cache, if its rev >= the latest known remote rev
//   3. remote (R2), if remote rev > whatever we have locally — then cache it
//   4. fall back to the bundled (require-d) object
//
// The R2 index is fetched once per session, lazily on the first
// keyed-object call. If the network is unavailable we silently use
// whatever local copy we have (disk if newer than bundled, else bundled).
// -----------------------------------------------------------------------------

const R2_BASE = 'https://pub-6a724d9bbeda4ced9917d2f1e7611501.r2.dev';
const INDEX_URL = `${R2_BASE}/transcripts/index.json`;
const transcriptUrl = (key: string) => `${R2_BASE}/transcripts/${encodeURIComponent(key)}.wjson`;

const cacheDir = () => `${FileSystem.documentDirectory}transcripts/`;
const cachePath = (key: string) => `${cacheDir()}${key}.wjson`;

type IndexEntry = { rev: number };
type Index = Record<string, IndexEntry>;

// in-session cues (per key for bundled-with-key flow, or per URL for raw remote)
const memCache = new Map<string, TranscriptCue[]>();
// fall-back cache for inline / un-keyed WhisperJson objects
const objectFallbackCache = new WeakMap<object, TranscriptCue[]>();

let indexPromise: Promise<Index | null> | null = null;
const fetchIndex = (): Promise<Index | null> => {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    try {
      const res = await fetch(INDEX_URL, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as Index;
    } catch {
      // Offline / 404 / DNS — just stay with bundled.
      return null;
    }
  })();
  return indexPromise;
};

const ensureCacheDir = async (): Promise<void> => {
  try {
    const info = await FileSystem.getInfoAsync(cacheDir());
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir(), { intermediates: true });
    }
  } catch {
    // Best-effort; if mkdir fails the writeAsStringAsync will throw too
    // and we'll just skip the disk cache for this entry.
  }
};

const readDisk = async (key: string): Promise<{ raw: string; rev: number } | null> => {
  try {
    const info = await FileSystem.getInfoAsync(cachePath(key));
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(cachePath(key));
    const data = JSON.parse(raw);
    return { raw, rev: typeof data.rev === 'number' ? data.rev : 1 };
  } catch {
    return null;
  }
};

const writeDisk = async (key: string, raw: string): Promise<void> => {
  await ensureCacheDir();
  try {
    await FileSystem.writeAsStringAsync(cachePath(key), raw);
  } catch {
    // Disk-full or sandbox issue — non-fatal; we just won't have a
    // local copy and will hit the network again next session.
  }
};

const fetchRemote = async (key: string): Promise<string | null> => {
  try {
    const res = await fetch(transcriptUrl(key), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

export const loadTranscript = async (
  source: number | string | WhisperJson,
): Promise<TranscriptCue[]> => {
  // -------------------------------------------------------------------
  // Bundled-with-key path: the common case. The require()'d wjson
  // module has `key` + `rev` baked in by stamp-transcripts.mjs.
  // -------------------------------------------------------------------
  if (typeof source === 'object' && source !== null) {
    const key = (source as WhisperJson).key;
    const bundledRev = (source as WhisperJson).rev ?? 1;

    // No key (inline transcript, e.g. tests, or legacy bundled files
    // not yet stamped). Bypass the remote pipeline entirely.
    if (!key) {
      const cached = objectFallbackCache.get(source);
      if (cached) return cached;
      const cues = parseWhisperData(source as WhisperJson);
      objectFallbackCache.set(source, cues);
      return cues;
    }

    const memHit = memCache.get(key);
    if (memHit) return memHit;

    const commit = (data: WhisperJson): TranscriptCue[] => {
      const cues = parseWhisperData(data);
      memCache.set(key, cues);
      return cues;
    };

    // Side-channels: index + disk. We deliberately await the index
    // before deciding what to do — it's small (~10 KB) and the rest
    // of the player UI doesn't block on transcripts (Player.tsx
    // renders the audio first, transcript fills in async).
    const [index, disk] = await Promise.all([fetchIndex(), readDisk(key)]);
    const remoteRev = index?.[key]?.rev ?? null;
    const diskRev = disk?.rev ?? 0;

    // Pull from R2 only when it would give us something strictly newer
    // than what we already have locally.
    if (remoteRev !== null && remoteRev > Math.max(bundledRev, diskRev)) {
      const raw = await fetchRemote(key);
      if (raw) {
        try {
          const data = JSON.parse(raw) as WhisperJson;
          // Don't trust the file blindly — only cache if it has the
          // expected rev / segments shape.
          if (data && Array.isArray(data.segments)) {
            await writeDisk(key, raw);
            return commit(data);
          }
        } catch {
          // Fall through to local fallback.
        }
      }
    }

    // Disk newer than bundled → use disk. (e.g. previous session
    // already pulled rev:2 from R2 and we're now offline.)
    if (disk && diskRev > bundledRev) {
      try {
        const data = JSON.parse(disk.raw) as WhisperJson;
        if (data && Array.isArray(data.segments)) return commit(data);
      } catch {
        // Bad cache file — fall through to bundled.
      }
    }

    // Default: the bundled version is the freshest we have.
    return commit(source as WhisperJson);
  }

  // -------------------------------------------------------------------
  // Raw remote URL: legacy path, kept in case any caller still passes
  // a string. Cached by URL.
  // -------------------------------------------------------------------
  if (typeof source === 'string') {
    const memHit = memCache.get(source);
    if (memHit) return memHit;
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const raw = await res.text();
    const cues = parseWhisperJson(raw);
    memCache.set(source, cues);
    return cues;
  }

  // -------------------------------------------------------------------
  // Legacy asset-module-id path. Not exercised in the current build
  // (the .wjson custom Metro transformer returns objects, not asset
  // ids), but kept as a safety net.
  // -------------------------------------------------------------------
  if (typeof source === 'number') {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const res = await fetch(uri);
    const raw = await res.text();
    return parseWhisperJson(raw);
  }

  return [];
};
