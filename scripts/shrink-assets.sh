#!/usr/bin/env bash
# Shrink the bundled app assets — deletes confirmed-unused files and
# re-encodes the in-use ones. Run from the repo root.
#
# Usage:
#   bash scripts/shrink-assets.sh             # dry-run (default)
#   bash scripts/shrink-assets.sh --apply     # actually delete + encode
#
# Verified unused via grep across app/ and src/ on 2026-05-13.

set -e
APPLY=0
if [[ "${1:-}" == "--apply" ]]; then APPLY=1; fi
say() { echo "→ $*"; }
do_it() { if [[ $APPLY == 1 ]]; then "$@"; else say "DRY: $*"; fi; }

cd "$(dirname "$0")/.."

# -----------------------------------------------------------------
# 1. Delete confirmed-unused images (root of assets/images/)
# -----------------------------------------------------------------
say "Removing unused images from assets/images/…"
for f in \
  assets/images/allhere-logo.svg \
  assets/images/app-screen.png \
  assets/images/banner-image-3.png \
  assets/images/circle-1.png \
  assets/images/circle-2.png \
  assets/images/circle-3.png \
  assets/images/eeg-banner.png \
  assets/images/eeg-solution.png \
  assets/images/logo-header.png \
  assets/images/logo-white.svg \
  assets/images/logo.svg \
  assets/images/lounge-1.jpg \
  assets/images/lounge-2.jpg \
  assets/images/qm-tracker.png \
  assets/images/track-banner.jpg
do
  [[ -f "$f" ]] && do_it rm "$f"
done

# -----------------------------------------------------------------
# 2. Delete confirmed-unused files in assets/images/hero/
#    (only earth.jpg, sky.jpg, space.jpg are referenced)
# -----------------------------------------------------------------
say "Removing unused hero/ files…"
for f in \
  assets/images/hero/banner.jpg \
  assets/images/hero/home.jpg \
  assets/images/hero/intro.jpg \
  assets/images/hero/news.jpg \
  assets/images/hero/thepractice.jpg \
  assets/images/hero/thepractice.mp4 \
  assets/images/hero/thescience.jpg \
  assets/images/hero/thescience.mp4
do
  [[ -f "$f" ]] && do_it rm "$f"
done

# -----------------------------------------------------------------
# 3. Re-encode in-use JPEGs (only used hero atmospheres + main banner)
#    Quality 78 keeps them looking the same behind UI overlays.
# -----------------------------------------------------------------
say "Re-encoding hero JPGs at q=78…"
for f in assets/images/hero/earth.jpg \
         assets/images/hero/sky.jpg \
         assets/images/hero/space.jpg; do
  [[ -f "$f" ]] && do_it magick "$f" -strip -quality 78 -interlace Plane "$f"
done

# -----------------------------------------------------------------
# 4. Re-encode the news PNGs as JPEG q=80 (content thumbs, no
#    transparency needed). Updates require() paths in news.ts too.
# -----------------------------------------------------------------
say "Converting news/ PNGs to JPEG q=80…"
for f in assets/images/news/*.png; do
  out="${f%.png}.jpg"
  [[ -f "$f" ]] && do_it magick "$f" -strip -quality 80 -interlace Plane "$out"
  [[ -f "$f" ]] && do_it rm "$f"
done
say "Reminder: update src/content/news.ts to require('.../news/01-….jpg') instead of .png"

# -----------------------------------------------------------------
# 5. Re-encode meditation audio (ambient voice) at 96 kbps mono.
#    Three-minutes meditation: 7.1 MB → ~ 2 MB
# -----------------------------------------------------------------
say "Re-encoding ambient meditation MP3s at 96 kbps mono…"
for f in "assets/audio/Home/One minute meditation.mp3" \
         "assets/audio/Home/Three minutes meditation.mp3"; do
  [[ -f "$f" ]] || continue
  tmp="${f%.mp3}.tmp.mp3"
  do_it ffmpeg -y -i "$f" -vn -c:a libmp3lame -b:a 96k -ac 1 -ar 44100 "$tmp"
  do_it mv "$tmp" "$f"
done

# -----------------------------------------------------------------
# 6. Optional — bell + tick are already small but mono-able
# -----------------------------------------------------------------
say "Mono-ising bell + tick…"
for f in assets/audio/bell.mp3 \
         assets/audio/bell_short.mp3 \
         assets/audio/tick.mp3; do
  [[ -f "$f" ]] || continue
  tmp="${f%.mp3}.tmp.mp3"
  do_it ffmpeg -y -i "$f" -vn -c:a libmp3lame -b:a 96k -ac 1 -ar 44100 "$tmp"
  do_it mv "$tmp" "$f"
done

# -----------------------------------------------------------------
# Wrap up
# -----------------------------------------------------------------
say ""
say "After-sizes:"
du -sh assets/images assets/images/hero assets/images/news assets/audio assets/video 2>/dev/null || true
say ""
if [[ $APPLY == 0 ]]; then
  echo ""
  echo "This was a DRY RUN — nothing was changed."
  echo "Re-run with:   bash scripts/shrink-assets.sh --apply"
fi
