#!/usr/bin/env node
// One-shot maintenance: inject `key` and `rev` fields into every
// bundled .wjson transcript so the runtime can (a) identify which
// remote file to look up, and (b) compare local vs server version
// during the lazy-update flow in src/content/loadTranscript.ts.
//
// Re-runnable. For each bundled transcript:
//   - if `key` is missing  → write the key derived from BUNDLED_TRANSCRIPTS
//   - if `rev` is missing  → set rev = 1 (baseline)
//   - if `key` mismatches  → warn, do NOT overwrite (manual review)
//   - if `rev` exists      → leave it alone (use bump-transcript-rev.mjs)
//
// Source of truth: the BUNDLED_TRANSCRIPTS block in
// src/content/audioRegistry.ts. We parse it with a regex rather than
// importing it (audioRegistry uses Metro's require() shape, not
// node-resolvable from a script context).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const REGISTRY = path.join(ROOT, 'src/content/audioRegistry.ts');
const src = fs.readFileSync(REGISTRY, 'utf8');

// Locate the BUNDLED_TRANSCRIPTS object literal block.
const blockMatch = src.match(/BUNDLED_TRANSCRIPTS\s*=\s*\{([\s\S]*?)\}\s*as\s*const;/);
if (!blockMatch) {
  console.error('Could not locate BUNDLED_TRANSCRIPTS block in audioRegistry.ts');
  process.exit(1);
}
const block = blockMatch[1];

// Extract `key: require('../../assets/...wjson')` pairs.
const PAIR_RE = /(\w+):\s*require\('([^']+\.wjson)'\)/g;
const pairs = [];
let m;
while ((m = PAIR_RE.exec(block)) !== null) {
  pairs.push({ key: m[1], rel: m[2] });
}
console.log(`Found ${pairs.length} bundled transcript entries.`);

let stamped = 0;
let skippedAlreadyStamped = 0;
const warnings = [];

for (const { key, rel } of pairs) {
  // The require paths are relative to src/content/. Resolve to repo absolute.
  const abs = path.resolve(ROOT, 'src/content', rel);
  if (!fs.existsSync(abs)) {
    warnings.push(`MISSING FILE for key ${key}: ${abs}`);
    continue;
  }
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (e) {
    warnings.push(`READ FAIL ${key}: ${e.message}`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    warnings.push(`PARSE FAIL ${key}: ${e.message}`);
    continue;
  }

  let changed = false;

  if (data.key === undefined) {
    data.key = key;
    changed = true;
  } else if (data.key !== key) {
    warnings.push(`KEY MISMATCH ${rel}: registry says "${key}", file has "${data.key}" — left untouched`);
  }

  if (data.rev === undefined) {
    data.rev = 1;
    changed = true;
  }

  if (changed) {
    // Reorder so key + rev sit at the top for readability — git diff
    // friendliness over micro-perf.
    const ordered = { key: data.key, rev: data.rev };
    for (const k of Object.keys(data)) {
      if (k === 'key' || k === 'rev') continue;
      ordered[k] = data[k];
    }
    fs.writeFileSync(abs, JSON.stringify(ordered));
    stamped++;
  } else {
    skippedAlreadyStamped++;
  }
}

console.log(`Stamped: ${stamped}`);
console.log(`Already had key+rev: ${skippedAlreadyStamped}`);
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log('  ' + w);
}
