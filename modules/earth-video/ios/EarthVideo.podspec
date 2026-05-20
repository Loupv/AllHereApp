Pod::Spec.new do |s|
  s.name           = 'EarthVideo'
  s.version        = '1.0.0'
  s.summary        = 'Local Expo module that plays a looping MP4 via AVSampleBufferDisplayLayer (not AVPlayer), so the host audio app keeps its iOS Now Playing lock-screen slot.'
  s.description    = <<-DESC
    Used in the All Here meditation app as the Earth atmosphere background.
    AVPlayer claims an AVAudioSession(category: .playback) on init even when
    muted, which prevents MPNowPlayingInfoCenter from electing the
    expo-audio meditation player as the lock-screen Now Playing source.
    Routing video frames through AVAssetReader + AVSampleBufferDisplayLayer
    avoids that session claim entirely. iOS-only; Android falls back to a
    static image in the JS layer.
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

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
