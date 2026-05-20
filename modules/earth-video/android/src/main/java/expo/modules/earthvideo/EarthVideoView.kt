package expo.modules.earthvideo

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * Android stub view — see EarthVideoModule.kt for context. Renders a
 * plain ExpoView (transparent), letting the JS layer composite a
 * static image fallback behind it on Android.
 */
class EarthVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext)
