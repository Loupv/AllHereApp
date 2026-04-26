# Working notes for Claude

Conventions and gotchas specific to this repo. Read `context.md` for the
what / why, and `references.md` for pointers to canonical files.

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
