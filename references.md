# References

Where to find things. Internal first, then external docs.

## Internal — canonical files

### Data / content
- [`src/content/catalog.ts`](./src/content/catalog.ts) — **single source of
  truth for all content**. `AudioTrack`, `Volet`, `RoundsConfig`,
  `silentMindVolets`, `qmVolets`, program banners, helper functions
  (`trackProgram`, `trackDuration`).
- [`src/content/news.ts`](./src/content/news.ts) — bundled news items
  (overridden by `remoteStore` when populated).
- [`src/content/transcript.ts`](./src/content/transcript.ts) +
  [`loadTranscript.ts`](./src/content/loadTranscript.ts) — Whisper
  word-level transcripts (`.wjson` files beside each mp3).
- [`src/content/waveforms.generated.ts`](./src/content/waveforms.generated.ts)
  — **auto-generated, do not edit**. Regenerate with `npm run gen:waveforms`.
- [`src/content/kv.ts`](./src/content/kv.ts) — key/value storage shim
  (`localStorage` on web, in-memory on native).

### State stores (zustand)
- [`src/player/store.ts`](./src/player/store.ts) — current track +
  playlist + open/close.
- [`src/player/progressStore.ts`](./src/player/progressStore.ts) —
  `listened` map (used by Start phase logic).
- [`src/player/notificationStore.ts`](./src/player/notificationStore.ts)
  — unread badges.
- [`src/auth/authStore.ts`](./src/auth/authStore.ts) — mock auth.

### Core components
- [`src/components/Player.tsx`](./src/components/Player.tsx) — the
  audio player (preplay + play, QM rounds machine, waveform scrubber,
  transcript view). ~1080 lines, mostly intentionally monolithic.
- [`src/components/WaveformProgress.tsx`](./src/components/WaveformProgress.tsx)
  — the scrubber waveform (160 flex bars, split boundary bar).
- [`src/components/ContentCard.tsx`](./src/components/ContentCard.tsx)
  — the hairline row used in every list surface. Clone its pattern
  when adding another list.
- [`src/components/VoletCard.tsx`](./src/components/VoletCard.tsx) —
  program-part card on the SM / QM tab lists.
- [`src/components/AnimatedGradient.tsx`](./src/components/AnimatedGradient.tsx)
  — the progressive radial gradient used on Start, shaped by phase.
- [`src/components/SwipeTabs.tsx`](./src/components/SwipeTabs.tsx) —
  horizontal-swipe wrapper between top-level tabs.

### Routing
- [`app/_layout.tsx`](./app/_layout.tsx) — root Stack, font loading,
  splash, login gate, global Player overlay, slide-from-right
  animation on detail pages.
- [`app/(tabs)/_layout.tsx`](./app/(tabs)/_layout.tsx) — bottom tab bar
  (icons, badges, centred items on wide viewports).

### Theme
- [`src/theme/index.ts`](./src/theme/index.ts) — colours, spacing,
  radius, type tiers. **Start here** when styling anything.

### Scripts
- [`scripts/gen-waveforms.mjs`](./scripts/gen-waveforms.mjs) — ffmpeg →
  peaks → generated TS module.

## Internal — docs

- [`CLAUDE.md`](./CLAUDE.md) — working notes and conventions for agents.
- [`context.md`](./context.md) — project context (what / why).
- [`BACKLOG.md`](./BACKLOG.md) — known gaps, UX explorations, infra work.

## External — libraries we depend on

- **expo-router v6** — file-based routing.
  [docs](https://docs.expo.dev/router/introduction/) ·
  [Stack options](https://docs.expo.dev/router/advanced/stack/) ·
  [animation enum](https://reactnavigation.org/docs/native-stack-navigator/#animation).
- **expo-audio** — active audio lib in Expo SDK 54. We are **not**
  using `expo-av` (deprecated).
  [docs](https://docs.expo.dev/versions/latest/sdk/audio/).
- **expo-video** — video player.
  [docs](https://docs.expo.dev/versions/latest/sdk/video/).
- **expo-asset** — `Asset.fromModule(require(...))`. We rely on
  `Asset.name` for waveform lookups (see `waveformKey` in Player).
  [docs](https://docs.expo.dev/versions/latest/sdk/asset/).
- **react-native-reanimated v4** — `useSharedValue`,
  `useAnimatedProps`, `withTiming`, `FadeInDown`.
  [docs](https://docs.swmansion.com/react-native-reanimated/).
- **react-native-svg** — used for the radial gradient on Start and
  a few inline icons.
  [docs](https://github.com/software-mansion/react-native-svg).
- **zustand v5** — store library.
  [docs](https://zustand.docs.pmnd.rs/).
- **@expo-google-fonts/montserrat** — the only font family. Weights
  400, 500, 600, 800, 900.

## External — tools

- **ffmpeg** — required on PATH for `npm run gen:waveforms`.
  Install: `brew install ffmpeg` on macOS.
- **Whisper** — used offline to generate the `.wjson` transcripts that
  ship alongside each mp3. Not called at build time.

## Brand + positioning

- [allhere.org](https://allhere.org) — public site. Source of positioning
  copy used in the About page and hero eyebrows.

## Design decisions, archived

Rather than trying to list every design choice, the `CLAUDE.md` file
captures the *current* conventions. For the rationale behind older
decisions, `git log --oneline` on `src/theme/index.ts`,
`app/(tabs)/index.tsx` and the major component files reads well —
commit messages have been deliberately descriptive (`style: lighten
UI, ...`, `feat(start): phase-based lifecycle page`, etc.).
