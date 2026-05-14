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
- [ ] Production transcripts for Part 3 coming-soon tracks (`p3-2`..`p3-5`) once those audios land.

## Auth
- [ ] Replace mock login (Skip / Apple / Google / Email) with real providers:
  - Apple: `expo-apple-authentication`
  - Google: `expo-auth-session` + Google provider
  - Email: backend endpoint + JWT

## Infrastructure
- [ ] Host audio assets on a CDN (S3 / Cloudflare R2) rather than shipping in bundle. Currently ~37 MB of audio + ~14 MB of images are bundled in the IPA. Critical for App Store warnings (200 MB threshold).
- [ ] Persist progress & auth state (zustand + AsyncStorage / MMKV). Today `kv.ts` falls back to in-memory on native, so progress is lost on every app relaunch — same problem on native as on web.
- [ ] Fine-tune transcript sync for audios that drift (Whisper word-level + manual pass for mispronunciations / brand terms like "All Here").
- [ ] Move bundled `Home/` and `QMPart1/Rounds/QM3_7rounds_Breath…/*` audios to remote (already in WP_AUDIO_MAP). Frees ~25 MB but needs `useTrackDownload` integration UX-tested first — users currently get instant play because these are bundled.
- [ ] Trim `@expo-google-fonts/montserrat` import to only the weights we actually use (Regular / Medium / SemiBold / ExtraBold / Black — 5 of 18). Saves ~1.5 MB.

## App-size cleanup (one-shot)
- [ ] Run `bash scripts/shrink-assets.sh --apply` — deletes confirmed-unused images + re-encodes the in-use ones (~28 MB saved). Pairs with a `sed` in `src/content/news.ts` to swap `.png` → `.jpg` for the 8 news images the script converts. Do the two together in one commit.

## Native — to address before store submission
- [x] **Background playback**: `UIBackgroundModes: ["audio"]` (iOS) + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (Android) already declared in `app.json`.
- [x] **Round-to-round prefetch**: `prefetchAudio(next-round, +1)` wired in Player. Validate gap is gone on real device.
- [x] **Pre-load next-up SM track on Start**: same prefetch path covers the playlist; verify on iPhone.
- [ ] **Lock-screen Now Playing controls**: hook `MPNowPlayingInfoCenter` (iOS) and `MediaSession` (Android) so the user gets play/pause + track title on the lock screen, AirPods double-tap, CarPlay. `expo-audio` doesn't wire this automatically.
- [ ] **Audio interruptions**: test phone-call / Siri / AirPods unpair flow — `expo-audio` should pause but the resume behaviour is inconsistent.
- [ ] **Mask-image fallback on native**: the CSS `mask-image` we use on the transcript top/bottom fade and on the EnergyColumn (under header / above tab bar) is web-only. Add `@react-native-masked-view/masked-view` so native gets the same softening — otherwise lines / text clip on hard edges.
- [ ] **Blur fallback on native for the EnergyColumn**: the `filter: blur(5px)` that gives the column its diffuse "Milky Way" feel is web-only. On native the strokes look sharp / wiry. Either swap to an SVG `<FeGaussianBlur>` filter or layer an `expo-blur` BlurView.
- [ ] **Verify safe-area + tab-bar layout** on iPhone Dynamic Island, iPad, Android with gesture nav (the hardcoded `TAB_BAR_BASE = 66` may need tuning per platform).
- [ ] **Performance pass on Android mid-range**: the EnergyColumn renders 18 wave paths × 80 sample points + 14 stars + 6 sharp filaments, all updated per frame. SVG on Android can stutter with this volume — consider `react-native-skia` if a bottleneck shows up on a Pixel 5-era device.

## Performance / heat
- [x] Pause the root atmospheric shader when the Player overlay is open (its own backdrop is visible instead). Saves a 20-min meditation session of GPU cycles.
- [x] Drop AtmosphereBackground render rate from 30 fps to 20 fps — slow-motion shaders don't need more.
- [x] Halve the SM tree particle field cap (240 → 120 trunk, 10 → 6 per branch).
- [ ] Render `AtmosphereBackground` at 0.5× resolution then upscale via CSS / transform — meditation shaders are low-frequency and won't show pixelation, but the per-pixel GLSL cost drops ~75%.
- [ ] Audit reanimated worklets still running when their host screen isn't visible (SM tree's `flowTime`, `trunkClock`, `branchClock` only matter when the tree is mounted — verify the tree unmounts when navigating away vs stays warm in memory).

## App Store submission
- [ ] Take real iPhone screenshots in 1242×2688 (6.5") or 1290×2796 (6.7") for App Store Connect. The HTML mockups in `app-store-previews/` are placeholders only; Apple needs actual app captures for review.
- [ ] Set up `eas submit --platform ios` flow after each production build to push to TestFlight automatically.

## UX explorations
- [ ] Shared animated play button across the first three tabs (Start / SM / QM): the bottom of the screen is a single persistent animated play control, the top of the screen handles navigation between the tab's different contents. Raises real UX questions (what plays when nothing is selected? how do we indicate the "armed" track? does this replace the Player screen or live on top of it?) — needs a discussion pass before implementation.
- [ ] Strict-sequential SM lock: only Welcome is unlocked at first launch, everything else gates on the previous SM being listened. Existing testers who already used the OLD permissive rule will land mid-journey with their progress intact — but a returning user who reset progress (account menu) gets a single playable dot. Consider a short onboarding hint the first time the SM tree opens with no progress.

## Nice-to-haves
- [ ] Persist user preferences (rounds default, break seconds) per track.
- [ ] Settings screen (theme, notifications, language).
- [ ] Offline caching of audio files. (Partial: per-track Save Offline via `useTrackDownload` ships now, but no bulk "save the whole journey" option.)

## Audit
- [ ] Verify every Player entry point has a working Close affordance (Start big play, SM tree dot, SM tree bottom-sheet Play, QM Guided list, QM Unguided preset, etc.). The Close X in the top corner should be reachable from every state the player can land in — including 'break', 'error', 'ended'.
- [ ] Add a pre-roll countdown (3 s) to the Start screen's 1 min / 3 min / 3 × 3 min quick meditations, mirroring the `PRE_ROUND_SECONDS = 5` countdown used at the start of every QM session. Today they jump straight into audio, which feels jarring versus the QM flow.
- [ ] Audit the Emptiness (`p3-1`) transcript — the end seems to bug. Check timestamp alignment past the last few minutes; possibly truncated, off-by-N, or missing the final words array.
- [ ] Root shader theme on the Silent Mind TAB (`app/(tabs)/silent-mind.tsx`) stays on `earth` (forest) even when the user has progressed into Part 3 / unlocked Space. The `useShaderThemeStore` / `themeForNextTrack(nextId)` logic in `_layout.tsx` drives the bg by NEXT-UP track id — but on the SM tab the "next" reading isn't being refreshed when the user is past the journey. Decide: should the SM tab atmosphere follow journey peak instead of next-up? Or should the tab override to its own theme?
- [ ] Re-verify offline-playback behaviour in a Release build (not dev). The "play barré" icon the user reported when offline was likely an `expo-asset` dev-mode artefact (Metro unreachable → asset placeholder). Should not appear in production-style builds; confirm.
- [ ] Verify accessibility on iOS VoiceOver: chevron scroll-hint buttons (no label), CircleNode dots (no aria-style hint about the track they represent), Pressable hit targets ≥ 44 pt.

## Future tuning (logged for later)
- [ ] If shader still warms the phone after the recent 20 fps + Player-open pause, drop the Player's OWN bg shader to static (single still frame instead of looped GLSL) during long sessions.
- [ ] If the SVG particle field still feels heavy on older devices, switch from `react-native-svg` `<Ellipse>` per particle to a single `react-native-skia` canvas drawing all particles in one pass.
