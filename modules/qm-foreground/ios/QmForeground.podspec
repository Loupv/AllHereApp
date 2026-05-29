Pod::Spec.new do |s|
  s.name           = 'QmForeground'
  s.version        = '1.0.0'
  s.summary        = 'No-op on iOS. Android-only generic foreground service for the QM custom bell-timer keep-alive.'
  s.description    = <<-DESC
    On Android this module runs a plain-notification foreground service so
    the QM custom bell-timer (driven by react-native-background-timer) and
    its audio cues keep running while the screen is locked, without the
    expo-audio media-player notification. iOS needs none of this — the
    silent-loop + UIBackgroundModes:["audio"] already keeps the app awake —
    so the iOS surface is an empty stub.
  DESC
  s.author         = 'All Here'
  s.homepage       = 'https://allhere.org'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
