#!/usr/bin/env node
/**
 * Rebuild `src/content/wpAudioMap.generated.ts` so every entry points
 * at the Cloudflare R2 bucket the audio was hand-uploaded into.
 *
 * Strategy: for each (filename → WP URL) pair in the current map,
 * discover where the user dropped that filename inside R2 by HEAD-
 * probing a small set of candidate keys. Candidates are derived from
 *   1) The on-disk path under `assets/audio/` (when the same filename
 *      exists there) — the user almost certainly mirrored that layout.
 *   2) Heuristic folders based on filename prefix (qmu5_* →
 *      QMUnguided/QMU5rounds, breath7_* → QMPart1/Rounds/QM3_…, etc.).
 *   3) Plain bucket-root as a last resort.
 *
 * The first probe that returns HTTP 200 wins. Anything we can't find
 * is left pointing at the old WP URL (with a console warning) so the
 * app keeps working while you fix the stragglers by hand.
 *
 * Run:
 *   node scripts/rebuild-r2-audio-map.mjs
 *
 * Doesn't need wrangler / authentication — only HEAD-probes the public
 * R2.dev URL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MAP_FILE = path.join(REPO_ROOT, 'src/content/wpAudioMap.generated.ts');
const ASSETS_AUDIO = path.join(REPO_ROOT, 'assets/audio');

const R2_PUBLIC_BASE = 'https://pub-6a724d9bbeda4ced9917d2f1e7611501.r2.dev';

const parseMap = (raw) => {
  const pairs = [...raw.matchAll(/"([^"]+\.mp3)":\s*"(https:[^"]+)"/g)];
  return pairs.map(([, filename, url]) => ({ filename, url }));
};

// Build filename → relative folder map by walking assets/audio/.
// Multiple folders can contain the same filename (rare); we keep all
// matches and probe each.
const buildLocalIndex = () => {
  const index = new Map(); // filename → folder[]
  const walk = (dir, rel = '') => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const sub = path.join(rel, ent.name);
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, sub);
      else if (ent.isFile() && ent.name.endsWith('.mp3')) {
        const folder = rel; // e.g. "Part1/Words" or "QMUnguided/QMU5rounds"
        const arr = index.get(ent.name) ?? [];
        arr.push(folder);
        index.set(ent.name, arr);
      }
    }
  };
  walk(ASSETS_AUDIO);
  return index;
};

// Encode each path segment but preserve the slash separator.
const encodeKey = (key) =>
  key
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');

// Pick candidate R2 keys for a given filename. Order matters: more
// specific guesses first so probing terminates fast on the common case.
const candidatesFor = (filename, localIndex) => {
  const out = [];
  // 1) Same path as on disk.
  for (const folder of localIndex.get(filename) ?? []) {
    out.push(folder ? `${folder}/${filename}` : filename);
  }
  // 2) Heuristic folders by prefix.
  if (/^qmu5_/.test(filename)) out.push(`QMUnguided/QMU5rounds/${filename}`);
  if (/^qmu12_/.test(filename)) out.push(`QMUnguided/QMU12rounds/${filename}`);
  if (filename === 'qmu_round.mp3') out.push(`QMUnguided/qmu_round.mp3`);
  if (/^breath7_/.test(filename)) {
    out.push(
      `QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/${filename}`,
    );
    out.push(`Home/ThreeTimesThree/${filename}`);
  }
  if (/^gravity5_/.test(filename)) {
    out.push(
      `QMPart1/Rounds/QM5_5rounds_Center of Gravity/${filename}`,
    );
  }
  if (/^sky5_/.test(filename) || /^sky6_/.test(filename)) {
    out.push(`QMPart2/Rounds/${filename}`);
  }
  if (/^unfollow/.test(filename)) {
    out.push(`QMPart1/Rounds/${filename}`);
  }
  // 3) Common SM intro / Part0 area.
  if (/^\d+\./.test(filename) || /^\d+ - /.test(filename)) {
    out.push(`Part0/${filename}`);
    out.push(`Part1/${filename}`);
    out.push(`Part2/${filename}`);
    out.push(`Part3/${filename}`);
    out.push(`Part1/Words/${filename}`);
    out.push(`Part2/Words/${filename}`);
    out.push(`Part3/Words/${filename}`);
  }
  // 4) Bucket root fallback.
  out.push(filename);
  // De-duplicate while preserving order.
  return [...new Set(out)];
};

const probe = async (encodedKey) => {
  const url = `${R2_PUBLIC_BASE}/${encodedKey}`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok ? url : null;
  } catch {
    return null;
  }
};

const main = async () => {
  const raw = fs.readFileSync(MAP_FILE, 'utf-8');
  const existingPairs = parseMap(raw);
  const localIndex = buildLocalIndex();

  // Union of (a) filenames already in the WP_AUDIO_MAP — catches
  // remote-only files like qmu_round.mp3 that aren't in
  // assets/audio/ — and (b) every MP3 currently under assets/audio/,
  // which catches NEW files added since the map was last
  // generated (e.g. moving "4 - Emptiness.mp3" → "1 - Emptiness.mp3"
  // under Part3 after a content reorganisation).
  const byFilename = new Map(); // filename → { url? } (url = fallback)
  for (const { filename, url } of existingPairs) byFilename.set(filename, { url });
  for (const filename of localIndex.keys()) {
    if (!byFilename.has(filename)) byFilename.set(filename, {});
  }
  const entries = [...byFilename.entries()].map(([filename, { url }]) => ({ filename, url }));

  console.log(`${entries.length} entries to remap (${existingPairs.length} from old map, ${entries.length - existingPairs.length} new from assets/audio). Probing R2…\n`);

  const newMap = {};
  const missing = [];

  // Batch in groups of 16 to avoid hammering R2 with one socket per
  // request but stay reasonable in wall time (~10–15s for 79 files).
  const BATCH = 16;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async ({ filename, url }) => {
        const candidates = candidatesFor(filename, localIndex);
        for (const key of candidates) {
          const encoded = encodeKey(key);
          const found = await probe(encoded);
          if (found) return { filename, foundUrl: found };
        }
        return { filename, foundUrl: null, originalWpUrl: url };
      }),
    );
    for (const { filename, foundUrl, originalWpUrl } of results) {
      if (foundUrl) {
        newMap[filename] = foundUrl;
        console.log(`  ✓ ${filename}`);
      } else if (originalWpUrl) {
        newMap[filename] = originalWpUrl; // keep WP so the app still works
        missing.push(filename);
        console.log(`  ✗ ${filename}  (left on WP)`);
      } else {
        // New asset (locally bundled, not on R2, no WP fallback known).
        // Skip from the map — the runtime will fall through to the
        // bundled require() in audioRegistry.
        missing.push(filename);
        console.log(`  ✗ ${filename}  (bundled-only, no remote)`);
      }
    }
  }

  const sortedKeys = Object.keys(newMap).sort((a, b) => a.localeCompare(b));
  const body = sortedKeys
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(newMap[k])},`)
    .join('\n');
  const out = `/* AUTO-GENERATED by scripts/rebuild-r2-audio-map.mjs — do not edit by hand. */
/* eslint-disable */

// Maps the canonical audio filename (basename, with extension) to its
// public URL. Most entries now point at Cloudflare R2; any that
// weren't found in the bucket fall back to the original WordPress URL
// so the app keeps working while the migration finishes.
//
// The variable is still called WP_AUDIO_MAP for codebase-wide
// backward compatibility (audioRegistry.ts imports this exact symbol);
// the name is historical at this point.

export const WP_AUDIO_MAP: Record<string, string> = {
${body}
};
`;
  fs.writeFileSync(MAP_FILE, out);
  console.log(
    `\n✅ Map rewritten. ${entries.length - missing.length}/${entries.length} on R2.`,
  );
  if (missing.length) {
    console.log(`\nStill on WordPress (${missing.length}):`);
    for (const f of missing) console.log(`  - ${f}`);
    console.log(
      `\nUpload these manually to R2 (preserving folder structure) and re-run the script.`,
    );
  }
};

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
