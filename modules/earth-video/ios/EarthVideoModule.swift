import ExpoModulesCore

public class EarthVideoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EarthVideo")

    View(EarthVideoView.self) {
      // The `source` prop is a local file URL (file://…) resolved by
      // expo-asset on the JS side before mounting. The view rejects a
      // no-op when the URL is unchanged so React re-renders are cheap.
      Prop("source") { (view: EarthVideoView, url: URL) in
        view.setSource(url)
      }
    }
  }
}
