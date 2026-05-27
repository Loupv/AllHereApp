# Backlog

## Content
- [ ] Swap the bell + tick session sounds for cleaner samples. The
  current `assets/audio/bell.mp3` / `bell_short.mp3` / `tick.mp3` are
  placeholder-quality; the bell could read warmer and the tick less
  clicky. Curate a matching set (start bell, end bell, mid-tick) that
  shares a single sonic identity.
- [ ] Segment `assets/audio/Home/One minute meditation.mp3`: extract the intro portion so the actual 1-minute practice runs exactly 60s. Either trim the intro off the main file, or split into `intro.mp3` + `practice.mp3` and play intro before the practice (like QM intros).
- [ ] Retail QM round segmentation where the auto-split misfired (see `/assets/audio/*/Rounds/`):
  - `QM3_6Rounds_Breath…` — round 2 forced
  - `QM3_7rounds_Breath…` — round 3 too short
  - `QM5_5rounds_Center of Gravity` — round 5 truncated by outro silence
  - `QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.mp3`
    contains the "end of round THREE" audio instead of "end of round
    two" (heard at end of round 2 in the session). The accompanying
    `.wjson` is correct ("End of round two." at 7.00–8.90s) — only the
    mp3 content is mis-aligned. Same broken file mirrored on WP CDN
    (`wp-content/uploads/2026/04/breath7_round02_inter.mp3`, identical
    `content-length: 2400454`), so re-uploading the corrected segment
    fixes both clients. Requires the original master mp3 to re-slice;
    not in repo or on WP CDN that I could find.
- [ ] Add `introSource` to each QM `rounds` config once intro files are split out.
- [ ] Replace video placeholders (Big Buck Bunny etc.) with final cuts.
- [ ] Silent Flute tab currently has placeholder entries — wire real tracks.
- [ ] Replace Thai Forest placeholder thumbs with clean nature images (no baked-in text).
- [ ] Find video-based header captures from allhere.org for per-tab hero banners.

## Auth
- [ ] Replace mock login (Skip / Apple / Google / Email) with real providers:
  - Apple: `expo-apple-authentication`
  - Google: `expo-auth-session` + Google provider
  - Email: backend endpoint + JWT

## Infrastructure
- [ ] Host audio assets on a CDN (S3 / Cloudflare R2) rather than shipping in bundle — the app is ~900 MB because mp3s ship with the web build. Critical before native store submission too: iOS hard-caps the IPA at 4 GB but App Store warns from 200 MB; Android AAB needs dynamic delivery configured to avoid a 500 MB+ initial APK.
- [ ] Persist progress & auth state (zustand + AsyncStorage / MMKV). Today `kv.ts` falls back to in-memory on native, so progress is lost on every app relaunch — same problem on native as on web.
- [ ] Fine-tune transcript sync for audios that drift (Whisper word-level + manual pass for mispronunciations / brand terms like "All Here").

## Performance & memory
- [ ] **Shader baseline GPU cost on high-end Android (immediate lag).**
  Distinct from the rAF-orphan leak (fixed 2026-05-27, which only cured
  lag that *accumulated* over a session). `FRAG_SKY` does ~9 `fbm`
  calls × 5 octaves ≈ 45 noise evals per pixel at native res
  (1440p+ = 3.7M+ px), heavy even at the `frameIdx % 3` ~20 fps
  throttle. Levers: render the GLView at reduced resolution (0.5×) and
  upscale → 4× fewer fragment invocations (biggest win, bg is blurred
  anyway); drop fbm octaves 5→3 on sky; consider a static gradient
  fallback on low-RAM Android.
- [ ] **Sky horizontal-bars — verify the dither fix on the affected
  device.** Output dithering shipped 2026-05-27 (sub-perceptual
  triangular dither on every shader). If bars persist it's a deeper
  coordinate-precision issue (`gl_FragCoord/uRes` quantising the noise
  sampling under mediump) needing a runtime `GL_FRAGMENT_PRECISION_HIGH`
  guard, not output dithering.
- [ ] **VideoBackground: honour the `paused` prop (currently a no-op).**
  The Earth loop is mounted in up to 3 places (`_layout.tsx` root,
  `Player.tsx` overlay, `silent-mind-tree.tsx`). When the Player
  overlay opens over an "earth" root screen, two full-screen video
  decoders run at once (2× `<video>` on web, 2× ExoPlayer on Android,
  2× AVSampleBufferDisplayLayer on iOS), and `paused` doesn't stop any
  of them. Either honour `paused` (pause native/exo/html5 decode +
  short-circuit the iOS CADisplayLink) or share a single instance.
  Cost: CPU + memory + battery, worst on Android mid-range.

## Testing (automated)
Prioritised by ROI. Nothing wired yet — `npx tsc --noEmit` is the only
current check.
- [ ] **Tier 1 — content validation (vitest, Node, no RN runtime).**
  Highest ROI. Catches the recurring Whisper/registry bug class
  automatically:
  - Every `.wjson`: valid JSON, `key`+`rev` present, monotone
    timestamps, no zero-duration word loops, no known hallucination
    patterns (`"Thank you."` on silence, bare `"You"`, `"And of
    round"`, single-word segments with prob < 0.1).
  - `catalog.ts` ↔ `audioRegistry.ts` consistency: every track id
    resolves to audio + transcript; every `BUNDLED_TRANSCRIPTS` key
    has a file on disk; every R2 `index.json` key exists.
  - `waveforms.generated.ts` covers all bundled mp3s.
- [ ] **Tier 2 — pure-logic unit tests.** The subtle bugs live here:
  - `useSmoothTime`: extract the status→time reducer into a pure
    function and test phantom guards / monotonic / pause-rebase with
    synthetic status sequences (this is where the pause-jumpback and
    Android phantom-end bugs lived).
  - `parseWhisperData` / `applyCorrections` / `rebuildBySentence`.
  - `getAudioSource` / `getTranscriptSource` / round-index mapping.
  - `loadTranscript` precedence (mem → disk → remote → bundled), mock
    fetch + FS.
- [ ] **Tier 3 — web UI via Playwright** against `npm run web`. Assert
  the bg `<video>` is present + playing, transcript reveals over time,
  and un-revealed text is transparent (computed-style check — would
  have caught the black-shadow regression directly).
- [ ] **Tier 4 — native E2E (Maestro).** Lower priority; background
  audio / lock-screen is hard to automate and changes rarely.
- [ ] **CI**: GitHub Actions → `tsc --noEmit` + vitest (Tier 1+2) on
  push, Playwright web smoke on PRs.

## Native — to address before store submission
- [ ] **Background playback**: declare `UIBackgroundModes: ["audio"]` in `app.json > expo > ios > infoPlist`, plus `FOREGROUND_SERVICE` permission + service notification on Android. Without this, audio cuts as soon as the screen locks — unacceptable for a meditation app.
- [ ] **Lock-screen Now Playing controls**: hook `MPNowPlayingInfoCenter` (iOS) and `MediaSession` (Android) so the user gets play/pause + track title on the lock screen, AirPods double-tap, CarPlay. `expo-audio` doesn't wire this automatically.
- [ ] **Audio interruptions**: test phone-call / Siri / AirPods unpair flow — `expo-audio` should pause but the resume behaviour is inconsistent.
- [ ] **Round-to-round gap in QM**: each round triggers a fresh `useAudioPlayer(roundSource)` → fetch + decode → ~100–300 ms of silence between rounds on native. Pre-load the next round in the background while the current one plays.
- [ ] **Pre-load next-up SM track on Start**: removes the brief delay on first tap of the round CTA.
- [ ] **Mask-image fallback on native**: the CSS `mask-image` we use on the transcript top/bottom fade and on the EnergyColumn (under header / above tab bar) is web-only. Add `@react-native-masked-view/masked-view` so native gets the same softening — otherwise lines / text clip on hard edges.
- [ ] **Blur fallback on native for the EnergyColumn**: the `filter: blur(5px)` that gives the column its diffuse "Milky Way" feel is web-only. On native the strokes look sharp / wiry. Either swap to an SVG `<FeGaussianBlur>` filter (gratis via react-native-svg) or layer an `expo-blur` BlurView. Without this, native looks visibly less atmospheric than web.
- [ ] **Verify safe-area + tab-bar layout** on iPhone Dynamic Island, iPad, Android with gesture nav (the hardcoded `TAB_BAR_BASE = 66` may need tuning per platform).
- [ ] **Performance pass on Android mid-range**: the EnergyColumn renders 18 wave paths × 80 sample points + 14 stars + 6 sharp filaments, all updated per frame. SVG on Android can stutter with this volume — consider `react-native-skia` if a bottleneck shows up on a Pixel 5-era device.

## UX explorations
- [ ] Shared animated play button across the first three tabs (Start / SM / QM): the
  bottom of the screen is a single persistent animated play control, the top of
  the screen handles navigation between the tab's different contents. Raises
  real UX questions (what plays when nothing is selected? how do we indicate
  the "armed" track? does this replace the Player screen or live on top of
  it?) — needs a discussion pass before implementation.

## Nice-to-haves
- [ ] Persist user preferences (rounds default, break seconds) per track.
- [ ] Settings screen (theme, notifications, language).
- [ ] Offline caching of audio files.

## Transcript hygiene — resolved 2026-05-26
- [x] `Part1/Words/2 - Self-Observation and Breath Following.wjson` —
  the 4× "Observe." tight cluster (segs 48–51 in the original file,
  <1 s span) was Whisper stutter; kept seg 48, dropped 49–51. The
  remaining 7 "Observe." occurrences in the file are well-spaced
  (30–90 s apart, 1.4 s durations) and read as real rhythmic cues
  from the teacher — left as-is.
- [x] `Part1/Words/1 - Turning Inward.wjson` — kept one of the
  "You are just simply present…" pair (segs 50–51 collapsed to 1×).
  Both terminal "Thank you." silence-fills dropped.
- [x] `QMPart1/Words/QM3_7rounds_Breath and Self-Observation.wjson` —
  verified the historical "Attention." dedupe: 5 remaining occurrences
  are all single, 70–240 s apart, no suspicious clusters. Earlier
  dedupe was correct, no restore needed.

## Audit
- [x] Player Close audit — top-corner Close in the audio Player overlay is reachable in every visible state (verified). QM Training "Exit training" link was hidden behind the bottom tab bar — fixed by adding `useTabBarPadding` to the session view + bumping the text from `caption` `textDim` to `overline` `textMuted` so it reads as an actual button.
- [x] 3 s pre-roll countdown added to Start quick meditations (1 min / 3 min / 3 × 3 min). Tapped pill replaces its label with the count; other pills dim and disable during the countdown; player opens with `autoStart: true` when the count reaches 0.
- [x] Emptiness (`p3-1`) transcript end fixed — last 4 segments were Whisper hallucinations (3× repeated "Emptiness entering inside your chest." + "Thank you."). Stripped; transcript now ends at the actual final words ~19:13.
- [x] Root shader theme now reads the user's SM journey position (next SM after last-listened SM) instead of the global `nextTrackId()`. New `themeForJourneyPosition(listened)` in `src/shaders/index.ts`. A user who unlocked Space via SMs but skipped a QM no longer sees the bg snap back to Earth.
- [ ] Unify play-button Y across every screen. Today Start nudges its CircleButton up 56 px to roughly match where the Player's flex-layout circle lands — that's a workaround, not a fix. The Player, Start, SM Tree (per-dot mode), and QM Training session should pin to ONE shared anchor (either an absolute `playCenterY` or a matching flex-spacer ratio). The 56-px nudge is the smell signalling this needs proper unification.
- [ ] Remove the rounds-count slider from the QM countdown screen. The Custom modal already exposes that choice upstream; the slider inside the active countdown is a leftover that lets users accidentally trim a round mid-flight.
- [ ] Pick a better mid-blue for the Sky part colour. Current `#3D6BBA` (used by `JOURNEY_ACCENTS.part2`, Start's fixed blue, and the SM tree's Part 2 trunk) reads a bit too saturated against the sky shader and against the SM magenta accent. Try something closer to `#5079C8` / `#4D7AB8` — true mid-blue that sits between Part 1's green and Part 3's purple without competing with either.
- [ ] Cross-screen text-size audit. Pass over every `fontSize:` in `app/` and `src/components/` and challenge each against the type tiers in `src/theme/index.ts` (`display` / `h1`–`h3` / `body` / `caption` / `sectionLabel` / `overline` / `button`). Drop ad-hoc one-offs where a tier fits. Especially: Player title vs Start title vs SM tab title — they should read as the same hierarchy across surfaces.
