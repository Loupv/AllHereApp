# Backlog

## Content
- [ ] Segment `assets/audio/Home/One minute meditation.mp3`: extract the intro portion so the actual 1-minute practice runs exactly 60s. Either trim the intro off the main file, or split into `intro.mp3` + `practice.mp3` and play intro before the practice (like QM intros).
- [ ] Retail QM round segmentation where the auto-split misfired (see `/assets/audio/*/Rounds/`):
  - `QM3_6Rounds_Breath…` — round 2 forced
  - `QM3_7rounds_Breath…` — round 3 too short
  - `QM5_5rounds_Center of Gravity` — round 5 truncated by outro silence
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

## Audit
- [x] Player Close audit — Close button is unconditionally rendered in the header except during `finished`, which itself auto-closes the Player in `handleRoundEnd`. Verified reachable from `break`, `loading`, `buffering`, `error`, `paused`, `playing`.
- [x] 3 s pre-roll countdown added to Start quick meditations (1 min / 3 min / 3 × 3 min). Tapped pill replaces its label with the count; other pills dim and disable during the countdown; player opens with `autoStart: true` when the count reaches 0.
- [x] Emptiness (`p3-1`) transcript end fixed — last 4 segments were Whisper hallucinations (3× repeated "Emptiness entering inside your chest." + "Thank you."). Stripped; transcript now ends at the actual final words ~19:13.
- [x] Root shader theme now reads the user's SM journey position (next SM after last-listened SM) instead of the global `nextTrackId()`. New `themeForJourneyPosition(listened)` in `src/shaders/index.ts`. A user who unlocked Space via SMs but skipped a QM no longer sees the bg snap back to Earth.
