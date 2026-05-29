import ExpoModulesCore

// iOS no-op. Background keep-alive on iOS is handled by the silent-loop
// AVAudioSession + UIBackgroundModes:["audio"] in the app; there is no
// equivalent foreground-service concept, so start/stop do nothing.
public class QmForegroundModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QmForeground")

    Function("start") { (_: String, _: String) in
      // no-op
    }

    Function("stop") {
      // no-op
    }
  }
}
