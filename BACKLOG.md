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
- [ ] Host audio assets on a CDN (S3 / Cloudflare R2) rather than shipping in bundle — the app is ~900 MB because mp3s ship with the web build.
- [ ] Persist progress & auth state (zustand + AsyncStorage / MMKV).
- [ ] Fine-tune transcript sync for audios that drift (Whisper word-level + manual pass for mispronunciations / brand terms like "All Here").

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
