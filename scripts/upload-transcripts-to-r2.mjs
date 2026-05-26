#!/usr/bin/env node
/**
 * Upload bundled .wjson transcripts to Cloudflare R2 and rebuild the
 * `transcripts/index.json` that the runtime consults to know when to
 * pull a newer copy.
 *
 * Prerequisites:
 *   npm install -g wrangler
 *   wrangler login
 *
 * Run:
 *   node scripts/upload-transcripts-to-r2.mjs           # upload changed only
 *   node scripts/upload-transcripts-to-r2.mjs --dry-run # preview, no changes
 *   node scripts/upload-transcripts-to-r2.mjs --force   # upload every key
 *
 * The script walks every .wjson under assets/audio/, picks the ones
 * that have `{ key, rev }` (= the ones stamped by stamp-transcripts.mjs
 * = the ones actually bundled into the app). For each, it compares the
 * local rev with the rev in the current remote index; if they differ
 * (or there's no remote entry), the file is re-uploaded. Index is
 * rewritten at the very end so an interrupted run never publishes a
 * map that points at files we haven't actually pushed yet.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets/audio');

const BUCKET = 'allhere-audio';
const R2_PUBLIC_BASE = 'https://pub-6a724d9bbeda4ced9917d2f1e7611501.r2.dev';
const REMOTE_PREFIX = 'transcripts/';
const REMOTE_INDEX_KEY = `${REMOTE_PREFIX}index.json`;
const REMOTE_INDEX_URL = `${R2_PUBLIC_BASE}/${REMOTE_INDEX_KEY}`;

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// Try `wrangler` from PATH first, fall back to `npx wrangler` which
// expo/RN projects usually have available as a transient dep.
const WRANGLER = (() => {
  if (spawnSync('wrangler', ['--version'], { stdio: 'ignore' }).status === 0) {
    return ['wrangler'];
  }
  if (spawnSync('npx', ['--no-install', 'wrangler', '--version'], { stdio: 'ignore' }).status === 0) {
    return ['npx', '--no-install', 'wrangler'];
  }
  // Last resort: let npx download wrangler on demand.
  return ['npx', '--yes', 'wrangler'];
})();

const wranglerAvailable = () => {
  // We always have *something* (npx auto-installs as fallback). The real
  // failure mode is unauthenticated, which surfaces from `wrangler r2`
  // calls themselves.
  return true;
};

// Walk assets/audio recursively and yield every .wjson path.
const walkWjson = function* (dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkWjson(p);
    else if (entry.isFile() && entry.name.endsWith('.wjson')) yield p;
  }
};

// Pull the current remote index. 404 → empty. Anything else → fatal.
const fetchRemoteIndex = async () => {
  try {
    const res = await fetch(`${REMOTE_INDEX_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error(`remote index HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    // No DNS / no network → treat as empty so a first-ever upload still works.
    console.warn(`Could not fetch remote index (${e.message}). Assuming empty.`);
    return {};
  }
};

const uploadFile = (remoteKey, localPath, contentType) => {
  if (DRY) {
    console.log(`  [dry] PUT ${remoteKey} ← ${path.relative(REPO_ROOT, localPath)}`);
    return;
  }
  const r = spawnSync(
    WRANGLER[0],
    [...WRANGLER.slice(1), 'r2', 'object', 'put', `${BUCKET}/${remoteKey}`, '--file', localPath, '--content-type', contentType, '--remote'],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`wrangler upload failed for ${remoteKey}`);
};

const main = async () => {
  if (!DRY && !wranglerAvailable()) {
    console.error('wrangler CLI not found. Run:  npm install -g wrangler && wrangler login');
    process.exit(1);
  }

  // Scan local
  const local = []; // { key, rev, path }
  const seenKeys = new Set();
  for (const p of walkWjson(ASSETS_DIR)) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
      console.warn(`SKIP ${p}: parse error (${e.message})`);
      continue;
    }
    if (!data.key || typeof data.rev !== 'number') continue;
    if (seenKeys.has(data.key)) {
      console.warn(`DUPLICATE KEY "${data.key}" — already seen, skipping ${p}`);
      continue;
    }
    seenKeys.add(data.key);
    local.push({ key: data.key, rev: data.rev, path: p });
  }
  console.log(`Found ${local.length} stamped transcripts under assets/audio/.\n`);

  // Remote index
  const remoteIndex = await fetchRemoteIndex();
  const knownRevs = Object.fromEntries(
    Object.entries(remoteIndex).map(([k, v]) => [k, v?.rev ?? 0]),
  );

  // Diff
  const toUpload = [];
  let upToDate = 0;
  for (const entry of local) {
    const remoteRev = knownRevs[entry.key] ?? null;
    if (!FORCE && remoteRev === entry.rev) {
      upToDate++;
    } else {
      toUpload.push({ ...entry, remoteRev });
    }
  }

  console.log(`Up to date: ${upToDate}`);
  console.log(`Will upload: ${toUpload.length}\n`);
  for (const e of toUpload) {
    const tag = e.remoteRev === null ? 'NEW' : `${e.remoteRev}→${e.rev}`;
    console.log(`  ${tag.padEnd(7)} ${e.key}  (${path.relative(REPO_ROOT, e.path)})`);
  }
  if (toUpload.length === 0 && !FORCE) {
    console.log('\nNothing to do.');
    return;
  }

  console.log();

  // Upload each .wjson
  for (const e of toUpload) {
    const remoteKey = `${REMOTE_PREFIX}${e.key}.wjson`;
    uploadFile(remoteKey, e.path, 'application/json');
  }

  // Rebuild index from the union of (existing remote that we kept) +
  // (everything we just uploaded) + (everything that was already up
  // to date).
  const newIndex = {};
  for (const entry of local) {
    newIndex[entry.key] = { rev: entry.rev };
  }
  // Also keep keys that are in remote but no longer in local (someone
  // might have removed a wjson from the bundle but still wants the R2
  // copy reachable). They retain their old rev.
  for (const [k, v] of Object.entries(remoteIndex)) {
    if (!(k in newIndex)) newIndex[k] = v;
  }

  // Write to a temp file then upload as application/json.
  const tmp = path.join(os.tmpdir(), `transcripts-index-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(newIndex, null, 2));
  console.log(`\nUploading index.json (${Object.keys(newIndex).length} keys)...`);
  uploadFile(REMOTE_INDEX_KEY, tmp, 'application/json');
  if (!DRY) fs.unlinkSync(tmp);

  console.log(DRY ? '\nDry run complete.' : '\nDone.');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
