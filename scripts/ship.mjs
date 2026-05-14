#!/usr/bin/env node
/**
 * Build store-ready artifacts for both platforms in parallel.
 *
 *   npm run ship             → Android AAB  + iOS IPA  (both stores)
 *   npm run ship:android     → Android APK + AAB only
 *   npm run ship:ios         → iOS IPA only
 *
 * What it does for each platform:
 *   - Reads `expo.version` from app.json and writes it into the native
 *     project files (Android `versionName`, iOS `MARKETING_VERSION`)
 *     so app.json stays the single source of truth.
 *   - Bumps the build counter (Android `versionCode`, iOS
 *     `CURRENT_PROJECT_VERSION`) by +1 so every shipped build is
 *     monotonically increasing for the stores. Edit those values in
 *     the native files directly if you need to reset them.
 *   - Builds the artifacts and copies them under `dist/` with
 *     predictable names you can drag straight into Transporter or the
 *     Play Console upload page.
 *
 * The script does NOT submit anything — you upload manually.
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const wantAndroid = args.includes('--android') || args.length === 0;
const wantIOS = args.includes('--ios') || args.length === 0;

// ----------------------------------------------------------------------
// Version sync helpers
// ----------------------------------------------------------------------

function readAppVersion() {
  const appJson = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8'));
  return appJson.expo.version;
}

function bumpAndroidVersion(newVersionName) {
  const file = resolve(ROOT, 'android/app/build.gradle');
  let src = readFileSync(file, 'utf8');
  const codeMatch = src.match(/versionCode\s+(\d+)/);
  if (!codeMatch) throw new Error('versionCode not found in android/app/build.gradle');
  const nextCode = Number(codeMatch[1]) + 1;
  src = src.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  src = src.replace(/versionName\s+"[^"]+"/, `versionName "${newVersionName}"`);
  writeFileSync(file, src);
  return { versionName: newVersionName, versionCode: nextCode };
}

function bumpIosVersion(newMarketingVersion) {
  const file = resolve(ROOT, 'ios/AllHereApp.xcodeproj/project.pbxproj');
  let src = readFileSync(file, 'utf8');
  // CURRENT_PROJECT_VERSION may be a decimal like 1.0.10 (EAS style) or
  // a plain integer. App Store Connect treats it as a string ordered
  // lexicographically per dotted component — bumping the last segment
  // keeps both shapes monotonic.
  const versions = [...src.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map(m => m[1]);
  if (!versions.length) throw new Error('CURRENT_PROJECT_VERSION not found in pbxproj');
  const current = versions[0];
  const parts = current.split('.');
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  const next = parts.join('.');
  src = src.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${next};`);
  src = src.replace(
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${newMarketingVersion};`,
  );
  writeFileSync(file, src);
  return { marketingVersion: newMarketingVersion, buildNumber: next };
}

// ----------------------------------------------------------------------
// Build runners
// ----------------------------------------------------------------------

function run(label, cmd, args, opts = {}) {
  return new Promise((resolveP, reject) => {
    console.log(`\n▶ [${label}] ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
    p.on('exit', code => {
      if (code === 0) resolveP();
      else reject(new Error(`[${label}] exited ${code}`));
    });
  });
}

async function buildAndroid() {
  await run('android', './gradlew', ['assembleRelease', 'bundleRelease'], {
    cwd: resolve(ROOT, 'android'),
  });
  const apk = resolve(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
  const aab = resolve(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab');
  const distDir = resolve(ROOT, 'dist');
  mkdirSync(distDir, { recursive: true });
  copyFileSync(apk, resolve(distDir, 'allhere-android.apk'));
  copyFileSync(aab, resolve(distDir, 'allhere-android.aab'));
  return { apk, aab };
}

async function buildIos() {
  const archive = resolve(ROOT, 'build/AllHereApp.xcarchive');
  const exportDir = resolve(ROOT, 'build/ios');
  await run('ios:archive', 'xcodebuild', [
    '-workspace', 'ios/AllHereApp.xcworkspace',
    '-scheme', 'AllHereApp',
    '-configuration', 'Release',
    '-destination', 'generic/platform=iOS',
    '-archivePath', archive,
    'archive',
    'COMPILER_INDEX_STORE_ENABLE=NO',
  ]);
  await run('ios:export', 'xcodebuild', [
    '-exportArchive',
    '-archivePath', archive,
    '-exportPath', exportDir,
    '-exportOptionsPlist', resolve(ROOT, 'scripts/ios-export-options.plist'),
  ]);
  const ipa = resolve(exportDir, 'AllHereApp.ipa');
  if (!existsSync(ipa)) throw new Error(`IPA not found at ${ipa}`);
  const distDir = resolve(ROOT, 'dist');
  mkdirSync(distDir, { recursive: true });
  copyFileSync(ipa, resolve(distDir, 'allhere-ios.ipa'));
  return { ipa };
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

async function main() {
  const version = readAppVersion();
  console.log(`Marketing version (from app.json): ${version}`);

  const platformLines = [];
  if (wantAndroid) {
    const { versionName, versionCode } = bumpAndroidVersion(version);
    platformLines.push(`Android: ${versionName} (versionCode ${versionCode})`);
  }
  if (wantIOS) {
    const { marketingVersion, buildNumber } = bumpIosVersion(version);
    platformLines.push(`iOS:     ${marketingVersion} (build ${buildNumber})`);
  }
  console.log(platformLines.join('\n'));

  const tasks = [];
  if (wantAndroid) tasks.push(buildAndroid());
  if (wantIOS) tasks.push(buildIos());
  await Promise.all(tasks);

  console.log('\n✓ Done.');
  console.log('  dist/allhere-android.apk  → sideload / internal testing');
  console.log('  dist/allhere-android.aab  → Play Console upload');
  console.log('  dist/allhere-ios.ipa      → Transporter upload');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
