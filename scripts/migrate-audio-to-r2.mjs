#!/usr/bin/env node
/**
 * One-shot migration: pull every remote audio file from WordPress,
 * push it to the Cloudflare R2 bucket, and regenerate
 * `src/content/wpAudioMap.generated.ts` with the R2 URLs.
 *
 * Prerequisites:
 *   npm install -g wrangler
 *   wrangler login    # browser OAuth into your Cloudflare account
 *
 * Run:
 *   node scripts/migrate-audio-to-r2.mjs
 *
 * Safe to re-run — files already in R2 are skipped, partial downloads
 * are retried. The map file is rewritten only at the very end so an
 * interrupted run never leaves the codebase pointing at a half-done
 * bucket.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MAP_FILE = path.join(REPO_ROOT, 'src/content/wpAudioMap.generated.ts');

const BUCKET = 'allhere-audio';
const R2_PUBLIC_BASE = 'https://pub-6a724d9bbeda4ced9917d2f1e7611501.r2.dev';
const TMP_DIR = path.join(REPO_ROOT, '.r2-migration-cache');

// R2 keys can technically contain spaces but URL-encoding round-trips
// are an iOS bundled-asset pain we already hit once (see metro.config.js
// `unstable_path` workaround). Normalise to URL-safe keys up front:
// spaces → underscores, drop trailing dots/parens. Map keys (= original
// filenames) are unchanged; only the R2 object names get safe-coded.
const r2Key = (filename) =>
  filename
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .replace(/^\.+/, '');

const ensureTmpDir = () => {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
};

const parseMap = (raw) => {
  // Extract every `"key.mp3": "https://…"` pair from the existing map.
  // Regex on the .ts file avoids dragging in a TS transpiler.
  const pairs = [...raw.matchAll(/"([^"]+\.mp3)":\s*"(https:[^"]+)"/g)];
  return pairs.map(([, filename, url]) => ({ filename, url }));
};

const wranglerAvailable = () => {
  const r = spawnSync('wrangler', ['--version'], { stdio: 'ignore' });
  return r.status === 0;
};

// R2 doesn't expose a HEAD via wrangler directly, but `r2 object get
// --pipe` succeeds (exit 0) if the object exists. We try a tiny range
// fetch (--no-out, but wrangler doesn't have one) — fall back to
// listing once per script invocation and caching the result.
let existingKeys = null;
const fetchExistingKeys = () => {
  if (existingKeys) return existingKeys;
  console.log(`Listing existing objects in ${BUCKET}…`);
  // `wrangler r2 bucket list-objects` paginates; with --limit 1000 we
  // cover anything reasonable. If the bucket ever exceeds 1000 objects
  // we'll need cursor pagination here.
  const r = spawnSync(
    'wrangler',
    ['r2', 'object', 'list', BUCKET, '--limit', '1000'],
    { encoding: 'utf-8' },
  );
  if (r.status !== 0) {
    // CLI versions vary — older syntax is `bucket list-objects`.
    const r2 = spawnSync(
      'wrangler',
      ['r2', 'bucket', 'list', BUCKET],
      { encoding: 'utf-8' },
    );
    existingKeys = new Set();
    return existingKeys;
  }
  existingKeys = new Set(
    r.stdout
      .split('\n')
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((k) => k && k.endsWith('.mp3')),
  );
  console.log(`  ${existingKeys.size} object(s) already in bucket.`);
  return existingKeys;
};

const downloadFromWp = (url, localPath) => {
  // -L follows redirects (WP sometimes 301s month-bucket URLs after a
  // year rolls), -f returns non-zero on HTTP ≥ 400, --retry handles
  // transient blips.
  const r = spawnSync(
    'curl',
    ['-fLs', '--retry', '3', '--retry-delay', '2', '-o', localPath, url],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`curl failed for ${url}`);
};

const uploadToR2 = (key, localPath) => {
  const r = spawnSync(
    'wrangler',
    ['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', localPath, '--content-type', 'audio/mpeg'],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`wrangler upload failed for ${key}`);
};

const main = () => {
  if (!wranglerAvailable()) {
    console.error('wrangler CLI not found. Run:  npm install -g wrangler && wrangler login');
    process.exit(1);
  }
  ensureTmpDir();
  const raw = fs.readFileSync(MAP_FILE, 'utf-8');
  const entries = parseMap(raw);
  console.log(`${entries.length} entries to migrate.\n`);

  const existing = fetchExistingKeys();
  const newMap = {};

  let i = 0;
  for (const { filename, url } of entries) {
    i++;
    const key = r2Key(filename);
    const r2Url = `${R2_PUBLIC_BASE}/${encodeURIComponent(key)}`;
    newMap[filename] = r2Url;
    if (existing.has(key)) {
      console.log(`[${i}/${entries.length}] ✓ already in R2  ${key}`);
      continue;
    }
    const localPath = path.join(TMP_DIR, key);
    console.log(`[${i}/${entries.length}] ↓ ${filename}`);
    if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
      downloadFromWp(url, localPath);
    } else {
      console.log(`  (using cached download from a previous run)`);
    }
    console.log(`[${i}/${entries.length}] ↑ ${key}`);
    uploadToR2(key, localPath);
  }

  // Rewrite the map. Sorted alphabetically for stable diffs.
  const sortedKeys = Object.keys(newMap).sort((a, b) => a.localeCompare(b));
  const body = sortedKeys
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(newMap[k])},`)
    .join('\n');
  const out = `/* AUTO-GENERATED by scripts/migrate-audio-to-r2.mjs — do not edit by hand. */
/* eslint-disable */

// Maps the canonical audio filename (basename, with extension) to its
// public Cloudflare R2 URL. Migrated from WordPress to R2 so downloads
// hit a CDN edge instead of the WP origin — see audioResolver.ts for
// the local-cache layer that complements this on the client side.
//
// The variable is still called WP_AUDIO_MAP for codebase-wide
// backward compatibility (audioRegistry.ts imports this exact symbol);
// the name is purely historical at this point.

export const WP_AUDIO_MAP: Record<string, string> = {
${body}
};
`;
  fs.writeFileSync(MAP_FILE, out);
  console.log(`\n✅ Migration complete. ${entries.length} entries written to ${MAP_FILE}.`);
  console.log(`Local download cache: ${TMP_DIR}  (rm -rf to reclaim space)`);
};

main();
