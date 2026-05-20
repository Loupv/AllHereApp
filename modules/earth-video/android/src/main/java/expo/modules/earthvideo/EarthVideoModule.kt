package expo.modules.earthvideo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android stub. The session-stealing problem this module solves is
 * iOS-specific (AVPlayer ↔ AVAudioSession election). Android doesn't
 * have an equivalent single-session model — ExoPlayer / MediaPlayer
 * can run a muted background video without claiming the foreground
 * media notification. When we wire Android up, this should become an
 * ExoPlayer view (audio track disabled). For now the JS callers fall
 * back to a static image on Android.
 */
class EarthVideoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EarthVideo")

    View(EarthVideoView::class) {
      Prop("source") { _: EarthVideoView, _: String -> }
    }
  }
}
