package expo.modules.qmforeground

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QmForegroundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QmForeground")

    Function("start") { title: String, body: String ->
      val ctx = appContext.reactContext
      if (ctx != null) QmForegroundService.start(ctx, title, body)
    }

    Function("stop") {
      val ctx = appContext.reactContext
      if (ctx != null) QmForegroundService.stop(ctx)
    }
  }
}
