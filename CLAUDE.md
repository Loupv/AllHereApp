# Working notes for Claude

Conventions and gotchas specific to this repo. Read `context.md` for the
what / why, and `references.md` for pointers to canonical files.

## ⚠️ Worktree vs main — read this BEFORE any build or Bash command

The dev environment runs from a **git worktree** at
`/Users/vuarness/Documents/GitHub/AllHereApp/.claude/worktrees/<name>/`,
but the **app must always be built and assets must always be written
into the main checkout** at `/Users/vuarness/Documents/GitHub/AllHereApp/`.

We've been burnt by this 4+ times. The rules are non-negotiable:

1. **Every Bash command that depends on cwd MUST start with**
   `cd /Users/vuarness/Documents/GitHub/AllHereApp &&`.
   This includes: `npx expo run:ios`, `pod install`, `npm install`,
   `npm run gen:waveforms`, and anything else that reads `package.json`,
   `app.json`, `ios/`, `android/`, or assets via relative paths.

2. **Every Edit / Write tool call MUST use an absolute path under
   `/Users/vuarness/Documents/GitHub/AllHereApp/`.**
   Never use relative paths — they resolve against the worktree and
   silently land in the wrong place.

3. **Every Bash `cp`, `mv`, `rm`, etc. MUST use absolute paths** for
   both source and destination. `cp file.webp assets/video/` will go to
   the worktree's assets dir; `cp file.webp /Users/vuarness/.../AllHereApp/assets/video/` goes to main.

4. **Symptoms that you've been building the worktree by mistake:**
   - The .app file is named `AllHereApp.app` instead of `AllHere.app`
   - Build output starts `Signing AllHereApp » AllHereApp.app`
   - The home-screen icon label is "AllHereApp" not "Silent Mind"
   - DerivedData path doesn't match the previous successful build's
   - Recent code changes don't appear in the running app
   If you see ANY of these, stop, `cd /Users/vuarness/Documents/GitHub/AllHereApp`,
   and rebuild. Do not assume the wrong app is "close enough" — it isn't.

5. **The cwd does NOT persist between Bash calls.** Each `npx expo run:ios`
   needs its own `cd /Users/vuarness/Documents/GitHub/AllHereApp && …`
   prefix — you cannot `cd` once and expect later calls to inherit it.

6. **`pwd` at the top of a build command is a cheap sanity check** —
   if it prints the worktree path, the command will write to the
   worktree. Abort and prepend the `cd`.

Main repo's iOS project: `ios/AllHereApp.xcodeproj`, `PRODUCT_NAME = AllHere`.
Worktree's iOS project: `ios/AllHereApp.xcodeproj`, `PRODUCT_NAME = AllHereApp`.
The PRODUCT_NAME divergence is the easiest tell that you've built the wrong tree.

If you must run from worktree cwd (e.g. quick `grep`/`ls` to inspect
state), that's fine — just don't `expo run:ios` or `cp asset` without
the explicit absolute-path discipline above.

## Stack

- Expo SDK 54, React Native 0.81, TypeScript 5.9
- expo-router v6 (file-based routing in `app/`)
- expo-audio (`expo-audio`, **not** `expo-av`) + expo-video for media
- react-native-reanimated v4 for animation; react-native-svg for gradients
- zustand v5 for store state (no Redux)
- `@expo-google-fonts/montserrat` for type

No styled-components, no nativewind — plain `StyleSheet.create`. Theme
tokens live in `src/theme/index.ts`.

## Commands

```
npm start               # expo dev server
npm run ios             # launch on iOS simulator
npm run web             # web preview (localhost:8081)
npm run gen:waveforms   # regenerate src/content/waveforms.generated.ts
                        # (requires ffmpeg on PATH; skips assets/audio/excluded/)
```

No test runner wired up. `npx tsc --noEmit` is the closest thing — ignore
errors under `reference/` (legacy Figma export, not in the build graph).

## File layout

```
app/                          expo-router tree
  _layout.tsx                 root Stack, fonts, splash, login gate, Player overlay
  (tabs)/_layout.tsx          bottom tab bar
  (tabs)/index.tsx            Start (phase-based: A / B / C)
  (tabs)/silent-mind.tsx      SM program — list of Part 1/2/3
  (tabs)/qm.tsx               QM Training program — list of Part 1/2/3
  (tabs)/video.tsx            Media tab
  (tabs)/about.tsx            About
  silent-mind/[id].tsx        SM Part detail (pushes from /silent-mind)
  qm/[id].tsx                 QM Part detail
  news/[id].tsx, video/[id].tsx

src/
  components/                 reusable UI
  content/                    data — catalog.ts is the single source of truth
  player/                     zustand stores (player, progress, notifications)
  theme/                      colors, spacing, radius, type tokens
  hooks/                      useLayout, useTabBarPadding
  auth/                       mock auth store (no real providers yet)

scripts/gen-waveforms.mjs     ffmpeg-based peaks extraction
assets/audio/**               tracked audio (mp3 + .wjson transcripts)
  excluded/                   files the waveform script skips
```

Detail pages (`app/silent-mind/[id].tsx` etc.) live **outside** the
`(tabs)` group so they push on top of the tab stack. The `(tabs)` group
hides its header and owns the bottom bar.

## Visual language (recent consolidation)

- **List surfaces unified**: Start intro list, `VoletCard`, `ContentCard`,
  About pillars — all borderless with a `StyleSheet.hairlineWidth`
  separator and `rgba(255,255,255,0.09)` colour. Accent rails (4 px) on
  the left keep per-row identity where needed.
- **Type tiers** (see `src/theme/index.ts`):
  - `display` — hero titles (uppercase, extra-bold)
  - `h2` / `h3` — block headings (sentence-case)
  - `body` — prose
  - `caption` — inline secondary text
  - `sectionLabel` — "Start with", "Intro audios", section titles
    (sentence-case, medium weight, **NOT uppercase**)
  - `overline` — **reserved for true state labels only**: `ROUND 1/3`,
    `GATEWAY COMPLETED`, program eyebrow on CTAs. Don't reuse it as a
    generic small-caps style.
  - `button` — primary CTA
- **Accent discipline**: reserve `colors.accent` for active state
  (primary CTA, current cue, played waveform) and program identity
  (`QM TRAINING ·` eyebrow on teal, `SILENT MIND ·` on magenta). Decorative
  icons / chevrons / meta text → `colors.textDim`.
- **Program accents**:
  - Silent Mind → `colors.accent` (magenta `#9E3694`)
  - QM Training → `colors.accentAlt` (teal `#36A09E`)
  - QM tab uses a distinct background `colors.bgTabAlt` (`#001A26`) so
    it's recognisable even without the tab bar visible.
- **Hero banners** on SM / QM / Media / Part pages: 130 px band +
  `rgba(0,16,46,0.35)` (SM) / `rgba(0,26,38,0.35)` (QM) overlay.
- **Navigation animation**: root Stack uses `animation: 'slide_from_right'`
  for detail pages; the `(tabs)` group has `animation: 'none'` so tab
  switches are instant.

## Waveform pipeline

1. `scripts/gen-waveforms.mjs` walks `assets/audio/**/*.mp3` (skipping
   `excluded/`), pipes each file through ffmpeg to s16le PCM, computes
   160 RMS buckets with a γ 0.7 curve, normalises per-track, and writes
   `src/content/waveforms.generated.ts`.
2. At runtime `src/components/Player.tsx::peaksForSource(source)`
   resolves `Asset.fromModule(source).name`, normalises it with the same
   key function as the script (lowercase, NFKD, strip accents, collapse
   non-alphanum to `_`), and looks it up in `WAVEFORMS`.
3. `WaveformProgress` renders 160 flex bars with a split "boundary" bar
   at the current playhead.

**Filename rule**: every mp3 keyed by its stem must be unique across the
tree (the script warns on collisions). QM round files were renamed with
session tags (`breath7_`, `gravity5_`, `sky5_`, `sky6_`, `unfollow6_`)
for this reason — follow the same pattern when adding new rounds.

Regenerate after adding / renaming audio:

```
npm run gen:waveforms
```

## Transcript pipeline (remote-updatable .wjson)

The Whisper-generated `.wjson` files used to render the progressive
word transcript under each audio are bundled into the app **and**
mirrored on Cloudflare R2 so we can patch hallucinations / typos
without re-shipping a build.

**File shape** — every bundled `.wjson` has two metadata fields
injected at the top by `scripts/stamp-transcripts.mjs`:

```jsonc
{ "key": "p3_1", "rev": 2, "segments": [ ... ] }
```

- `key` mirrors the entry name in `BUNDLED_TRANSCRIPTS` in
  `src/content/audioRegistry.ts` (e.g. `"p3_1"`, `"qm3_round4"`).
  Single source of truth for the remote path.
- `rev` starts at 1 and is **bumped by hand** every time you edit the
  content. Bumping is what triggers a remote refresh on user devices.

**Runtime resolution** (`src/content/loadTranscript.ts`) — for each
keyed transcript:

1. in-memory cache (session-scoped)
2. on-disk cache at `${FileSystem.documentDirectory}transcripts/<key>.wjson`
   if its `rev` ≥ the latest remote `rev`
3. R2 fetch if `index[key].rev > max(bundled.rev, disk.rev)` — then
   written to disk and used
4. bundled `.wjson` (require'd)

The R2 index (`https://pub-6a724d9bbeda4ced9917d2f1e7611501.r2.dev/transcripts/index.json`)
is fetched lazily once per session. If the index fetch fails (offline)
we silently use the best local copy. Per-key fetch failures fall back
the same way. Untyped / inline WhisperJson objects (no `key`) bypass
the remote pipeline entirely.

**Editing workflow:**

1. Edit the `.wjson` file (segments / text / words).
2. Bump its `rev` (`+1` from whatever it is).
3. `node scripts/upload-transcripts-to-r2.mjs` — pushes the file +
   rewrites `transcripts/index.json` on R2. Idempotent; only re-uploads
   files whose remote rev differs from local. `--dry-run` and `--force`
   flags available.

**Adding a new bundled transcript:**

1. Add the `require()` line to `BUNDLED_TRANSCRIPTS` in
   `audioRegistry.ts`.
2. `node scripts/stamp-transcripts.mjs` — injects `{ key, rev: 1 }` if
   missing. Re-runnable; idempotent.
3. `node scripts/upload-transcripts-to-r2.mjs` to publish the baseline.

**Whisper hallucination patterns to watch for** (see the May 2026 audit
that cleaned ~16.7 K lines across 25 files):

- Mid-meditation `"Thank you."` / bare `"You"` / `"."` / `"..."` segments
  on silence — almost always silence-fill hallucinations.
- YouTube-outro phrases (`"Thank you for watching"`, URLs like
  `"www.mesmerism.info"`, `"This video was made possible by..."`).
- Duplicate consecutive segments with same text.
- In-segment word loops with zero-duration words.
- Tense / preposition mishears (`"And of round"` vs `"End of round"`,
  `"Remain for witness"` vs `"Remain a witness"`).

When auditing, classify findings RED (clear hallucination, no listen
needed) / ORANGE (likely mishear, listen first) / YELLOW (ambiguous
duplicate, judgment call) and confirm with the user before bulk-fixing.

## State

- `src/player/store.ts` — current track, playlist, autoStart flag. The
  Player is globally mounted in `app/_layout.tsx` as an overlay.
- `src/player/progressStore.ts` — `listened` map (trackId → true) for
  phase transitions on Start. Session-scoped (in-memory).
- `src/player/notificationStore.ts` — unread badges on Media tab.
- `src/content/kv.ts` — shim: `localStorage` on web, in-memory on
  native. Swap in `AsyncStorage` / MMKV later; callers don't change.

## Gotchas

- **Asset names on web**: `Asset.fromModule(src).name` on web can include
  the extension (`.mp3`) and a hash suffix. The `waveformKey` helper
  strips both — don't change it without testing on web.
- **Player root background**: must be `transparent`, not `colors.bg` —
  otherwise the `AnimatedGradient` behind it is invisible.
- **Pre-existing `reference/` tsc errors**: ignore. That folder is the
  Figma-exported prototype, not compiled by Metro.
- **Big leaf files**: `app/(tabs)/index.tsx` (~800 lines) and
  `src/components/Player.tsx` (~1080 lines) deliberately stay monolithic
  — the phase state machine and the player have lots of tightly-coupled
  styling and audio hooks. Don't carve them up without a plan.
- **QM round naming**: new QM round files must include a session prefix
  tag unique across the tree (see "Waveform pipeline" above).

## Commits

- Style matches existing: lowercase type prefix (`feat:`, `fix:`,
  `style:`) + area in parens, imperative body.
- Always add the trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Don't amend unless the user asks — hook failures create a new commit
  after the fix, not an amend.
