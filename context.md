# Project context

## What is All Here

All Here is a Geneva-based meditation company that combines ancient
practice with neuroscience and EEG technology. The marketing site is
[allhere.org](https://allhere.org). This repo is the companion mobile
app (Expo / React Native), targeting iOS + Android + web.

The app is a guided-meditation player + program browser. It is **not**
a social app, and there's no gamification (no streaks, no points,
deliberately).

## Two programs, one catalog

Content is organised around two parallel programs, each in three parts
("volets"):

- **Silent Mind (SM)** — guided, untimed practices. Brand accent:
  magenta `#9E3694`.
- **QM Training (QM)** — Quantified Meditation. Same practices, but
  delivered as short timed rounds with pauses between them. Brand
  accent: teal `#36A09E`.

Both programs share identical Part 1 / 2 / 3 ids (`part1`, `part2`,
`part3`) so a user reading one detail page can jump to the twin in the
other program. This is what the "Go to QM Training · Part 1" and
"Back to Silent Mind · Part 1" CTAs wire up.

The canonical data for all of this lives in
[`src/content/catalog.ts`](./src/content/catalog.ts) — `AudioTrack`,
`Volet`, `silentMindVolets`, `qmVolets`, the program banners, etc. If
you want to add a track, that's the file.

## The five tabs

| Tab | Route | Purpose |
|---|---|---|
| Start | `app/(tabs)/index.tsx` | Phase-based landing page — A (new user) / B (intro in progress) / C (intro done, main journey). |
| Silent Mind | `app/(tabs)/silent-mind.tsx` | SM program overview → Part 1/2/3 list. |
| QM Training | `app/(tabs)/qm.tsx` | QM program overview → Part 1/2/3 list. |
| Media | `app/(tabs)/video.tsx` | Video content (YouTube / Vimeo embeds). Unread badge on the tab icon. |
| About | `app/(tabs)/about.tsx` | Brand + positioning page. |

Start-page phases are derived from `useProgress.listened` (the set of
completed track ids). They change the page layout rather than just
swapping copy — intro audios come and go, the main CTA changes, etc.

## Design philosophy

- **Lightness over density.** We've done several rounds of simplification.
  Borders, filled cards and heavy overlays keep losing ground to
  hairline separators, sentence-case labels, and softer overlays. When
  in doubt, lighten.
- **Reserved accent.** Magenta / teal are for active state and brand
  identity. They're not available for decoration — meta text, chevrons,
  decorative icons go `textDim`.
- **Uppercase means state.** Overline/uppercase labels are reserved for
  true state labels (`ROUND 1/3`, `GATEWAY COMPLETED`, `QM TRAINING ·`
  program eyebrow). Section titles go sentence-case (see `type.sectionLabel`).
- **One list motif.** Start intro rows, VoletCard, ContentCard, About
  pillars — all use the same hairline-separated row pattern. Adding a
  new list surface? Use that pattern.
- **Slide for sub-folders.** Navigating into a Part detail page
  slides from the right. Tab switches are instant. Signals "I'm
  descending into a sub-section" vs "I'm moving laterally".

## Audio model

- Every playable track has a `source` (Metro `require()` handle) and,
  for QM tracks, a `rounds: RoundsConfig` describing round length,
  break length, optional intro, optional per-round interstitials.
- Transcripts (`.wjson` files in the same folder as the mp3) are
  word-level timestamps produced by Whisper. Load via
  `src/content/loadTranscript.ts`.
- Waveforms are precomputed: see the "Waveform pipeline" section in
  `CLAUDE.md`.

## What's mock / placeholder right now

See `BACKLOG.md` for the authoritative list. Highlights:

- Auth is mocked (Skip / Apple / Google / Email — none actually wired).
- Progress state is in-memory only (`kv.ts` falls back to memory on
  native). AsyncStorage / MMKV migration is a backlog item.
- Audio ships in the bundle — the web build is ~900 MB. CDN migration
  is a backlog item.
- Several tracks / videos are placeholders (Thai Forest, Silent Flute,
  Big Buck Bunny videos). Final cuts pending.
- Some QM round splits misfired during extraction (see BACKLOG.md for
  the list of rounds needing a manual retailoring).

## What ships vs. what's internal

- The app's bundled catalog is the current baseline.
- There's a `remoteStore` (`src/content/remoteStore.ts`) which, when
  populated, overrides the bundled news / media lists. Useful later
  for CMS-driven content without a store resubmission.
