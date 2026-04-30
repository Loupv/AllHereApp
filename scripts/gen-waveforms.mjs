#!/usr/bin/env node
/**
 * gen-waveforms.mjs
 *
 * Walks assets/audio/** for .mp3 files (skipping `excluded/`), decodes each to
 * 8kHz mono 16-bit PCM via ffmpeg, buckets the samples, and writes a TS module
 * at src/content/waveforms.generated.ts mapping a normalized filename key to a
 * normalized peaks array.
 *
 * Density is **time-based** rather than fixed-count: each track gets
 * `PEAKS_PER_SECOND` peaks per second of audio (so a 5-min track has 6000
 * values, a 20-min track 24000). This is what lets the play button react
 * tightly to the voice envelope at runtime — sampling 160 buckets across a
 * 20-min audio yielded ≈1 peak / 7.5 s, far too coarse.
 *
 * The visual waveform bar in the player is downsampled at render time
 * (see WaveformProgress) so the higher density costs nothing visually.
 *
 * Run with:   node scripts/gen-waveforms.mjs
 *
 * The Player uses `Asset.fromModule(source).name` at runtime to look up peaks
 * by the same normalized key (see WaveformProgress + player integration).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT, 'assets', 'audio');
const OUT_FILE = path.join(ROOT, 'src', 'content', 'waveforms.generated.ts');
// Per-second density. 20 peaks/sec = 50 ms per bucket, fine enough for the
// play button to follow the voice envelope without wobbling on every
// consonant. Bumping this further mostly grows the bundle without a perceptible
// gain; halving it makes the reaction noticeably laggy.
const PEAKS_PER_SECOND = 20;
const SAMPLE_RATE = 8000;               // plenty for peak extraction
const BYTES_PER_SAMPLE = 2;             // s16le

/** Walks dir and returns all .mp3 paths (absolute), only from bundled folders:
 *  - assets/audio/Home/ (home meditations)
 *  - assets/audio/QMPart1/Rounds/QM3_7rounds_Breath\ and\ Self-Observation/ (QM3 home)
 *  - assets/audio/*.mp3 (UI sounds: bell, tick)
 *  Skips Part0, Part1, Part2, Part3, QMPart1 (except QM3), QMPart2 (moved to WordPress)
 */
function findMp3s(dir, acc = []) {
  const bundledFolders = [
    path.join(AUDIO_ROOT, 'Home'),
    path.join(AUDIO_ROOT, 'QMPart1', 'Rounds', 'QM3_7rounds_Breath and Self-Observation'),
  ];

  // Add UI sounds at root level
  const entries = fs.readdirSync(AUDIO_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(AUDIO_ROOT, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
      acc.push(full);
    }
  }

  // Add bundled folder contents
  for (const bundledFolder of bundledFolders) {
    if (fs.existsSync(bundledFolder)) {
      walkDir(bundledFolder, acc);
    }
  }

  return acc;
}

/** Recursively walk a directory and collect all .mp3 files */
function walkDir(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
      acc.push(full);
    }
  }
}

/**
 * The runtime lookup key must survive Metro's asset hashing and the expo-asset
 * `name` field, which drops the extension but keeps the original filename. So
 * our key is just the lowercase stem with spaces / special chars collapsed.
 */
function keyFromFilePath(absPath) {
  const base = path.basename(absPath, path.extname(absPath));
  return base
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '_')       // collapse non-alphanum
    .replace(/^_+|_+$/g, '');
}

/** Decode mp3 → raw s16le mono PCM, returned as a Buffer. */
function decodePcm(absPath) {
  const res = spawnSync('ffmpeg', [
    '-v', 'error',
    '-i', absPath,
    '-ac', '1',
    '-ar', String(SAMPLE_RATE),
    '-f', 's16le',
    '-',
  ], { maxBuffer: 1024 * 1024 * 256 });
  if (res.status !== 0) {
    throw new Error(`ffmpeg failed on ${absPath}: ${res.stderr?.toString() || '?'}`);
  }
  return res.stdout;
}

/**
 * Convert a PCM buffer (s16le, mono) into a normalized peaks array.
 *
 * Bucket count is `PEAKS_PER_SECOND × duration_seconds` so audios of
 * different lengths share the same time resolution (50 ms per peak at the
 * default 20 / s). Each bucket reports RMS of its window — RMS is visually
 * more stable than max-abs (which strobes on consonants) — then the array
 * is normalized against the per-track max with a mild curve so quiet
 * passages stay readable.
 */
function pcmToPeaks(buf) {
  const totalSamples = Math.floor(buf.length / BYTES_PER_SAMPLE);
  if (totalSamples === 0) return [];
  const samplesPerBucket = Math.max(1, Math.floor(SAMPLE_RATE / PEAKS_PER_SECOND));
  const buckets = Math.max(1, Math.floor(totalSamples / samplesPerBucket));
  const peaks = new Array(buckets).fill(0);
  let maxRms = 0;
  for (let b = 0; b < buckets; b++) {
    const start = b * samplesPerBucket;
    const end = b === buckets - 1 ? totalSamples : start + samplesPerBucket;
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      const sample = buf.readInt16LE(i * BYTES_PER_SAMPLE);
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, (end - start))) / 32768;
    peaks[b] = rms;
    if (rms > maxRms) maxRms = rms;
  }
  if (maxRms <= 0) return peaks;
  return peaks.map(v => Math.pow(v / maxRms, 0.7));
}

function main() {
  if (!fs.existsSync(AUDIO_ROOT)) {
    console.error('audio root not found:', AUDIO_ROOT);
    process.exit(1);
  }
  const mp3s = findMp3s(AUDIO_ROOT).sort();
  console.log(`Found ${mp3s.length} mp3 files in bundled audio folders (Home, QM3 home rounds, UI sounds).`);

  const out = {};
  const collisions = [];
  for (const abs of mp3s) {
    const key = keyFromFilePath(abs);
    if (key in out) {
      collisions.push(`${key}  ←  ${path.relative(AUDIO_ROOT, abs)}`);
      continue;
    }
    try {
      const pcm = decodePcm(abs);
      const peaks = pcmToPeaks(pcm);
      out[key] = peaks.map(v => Math.round(v * 1000) / 1000); // 3 decimals — keep bundle small
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('!');
      console.error(`\n  failed on ${abs}:`, e.message);
    }
  }
  process.stdout.write('\n');
  if (collisions.length) {
    console.warn('\nKey collisions (second occurrence ignored):');
    for (const c of collisions) console.warn('  -', c);
  }

  const header = [
    '/* AUTO-GENERATED by scripts/gen-waveforms.mjs — do not edit by hand. */',
    '/* eslint-disable */',
    '',
    'export const WAVEFORMS: Record<string, number[]> = {',
  ].join('\n');
  const body = Object.keys(out)
    .sort()
    .map(k => `  ${JSON.stringify(k)}: [${out[k].join(',')}],`)
    .join('\n');
  const footer = '\n};\n';
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, header + '\n' + body + footer, 'utf8');
  const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`Wrote ${Object.keys(out).length} waveforms (${sizeKb} kB) → ${path.relative(ROOT, OUT_FILE)}`);
}

main();
