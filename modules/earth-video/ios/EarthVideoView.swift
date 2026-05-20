import AVFoundation
import CoreMedia
import ExpoModulesCore
import UIKit

/**
 * Background-video view that plays an MP4 via `AVSampleBufferDisplayLayer`
 * — NOT `AVPlayer`. This is the whole point of the module: AVPlayer
 * unconditionally claims an `AVAudioSession` of category `MediaPlayback`
 * the moment it's instantiated, even when the asset is muted and
 * `showNowPlayingNotification = false`. That session pollution blocks
 * iOS from electing our `expo-audio` meditation player as the
 * lock-screen Now Playing source (verified in Console.app —
 * `MRDElectedPlayerController` never fires while an AVPlayer is alive
 * in the process).
 *
 * AVSampleBufferDisplayLayer is a plain `CALayer` subclass that accepts
 * decoded `CMSampleBuffer`s. It has no audio path, no
 * `AVAudioSession`, no Now Playing registration. We feed it with
 * `AVAssetReader` reading only the video track of the asset, looped on
 * EOF. Result: full-quality MP4 playback with zero session footprint.
 *
 * The CADisplayLink drives enqueue at the source's native fps. We mark
 * each sample buffer with `kCMSampleAttachmentKey_DisplayImmediately`
 * so the layer doesn't try to honor the asset's original PTS — every
 * frame we hand it gets shown on the next display refresh.
 */
/**
 * Weak proxy so `CADisplayLink` doesn't retain `EarthVideoView` strongly.
 * Without this, `displayLink.target = self` + `self.displayLink = link`
 * forms a retain cycle that prevents `deinit` from ever firing — the
 * decoder would keep ticking for the rest of the app session even after
 * React unmounts the component.
 */
private final class DisplayLinkProxy {
  weak var target: EarthVideoView?
  init(_ target: EarthVideoView) { self.target = target }
  @objc func tick() { target?.tick() }
}

class EarthVideoView: ExpoView {
  private let displayLayer = AVSampleBufferDisplayLayer()
  private var reader: AVAssetReader?
  private var trackOutput: AVAssetReaderTrackOutput?
  private var displayLink: CADisplayLink?
  private var displayLinkProxy: DisplayLinkProxy?
  private var assetURL: URL?
  private var nativeFPS: Int = 30
  private let decodeQueue = DispatchQueue(label: "org.allhere.earthvideo.decode", qos: .userInitiated)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    // `.resizeAspectFill` = same behaviour as `contentFit="cover"` in
    // expo-image: fill both dimensions, crop overflow. The earth-hero
    // clip is landscape; phones are portrait → sides crop, top-to-bottom
    // fills.
    displayLayer.videoGravity = .resizeAspectFill
    displayLayer.backgroundColor = UIColor.black.cgColor
    layer.addSublayer(displayLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Wrap the frame update in a no-animation transaction — without
    // this, rotating or laying out triggers a CALayer animation that
    // briefly shrinks the displayLayer to its old bounds while the
    // sample buffers stream in at the new size.
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    displayLayer.frame = bounds
    CATransaction.commit()
  }

  func setSource(_ url: URL) {
    // No-op if the same source was set again (RN re-renders are cheap
    // but re-creating the AVAssetReader is not).
    if assetURL == url { return }
    assetURL = url
    decodeQueue.async { [weak self] in
      self?.openReader()
      DispatchQueue.main.async { self?.startDisplayLink() }
    }
  }

  private func openReader() {
    guard let url = assetURL else { return }
    do {
      let asset = AVURLAsset(url: url)
      guard let videoTrack = asset.tracks(withMediaType: .video).first else {
        NSLog("EarthVideoView: asset has no video track at \(url)")
        return
      }
      nativeFPS = max(1, Int(round(videoTrack.nominalFrameRate)))
      let reader = try AVAssetReader(asset: asset)
      // BGRA32 is the canonical CV pixel format for direct display.
      // We don't need YCbCr here — the H.264 decode pipeline gives us
      // hardware-decoded pixel buffers anyway and the layer expects a
      // format it can sample directly.
      let outputSettings: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      ]
      let trackOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: outputSettings)
      // We pull frames one-shot through the display loop, no shared
      // ownership — skip the copy to save a malloc per frame.
      trackOutput.alwaysCopiesSampleData = false
      reader.add(trackOutput)
      reader.startReading()
      self.reader = reader
      self.trackOutput = trackOutput
    } catch {
      NSLog("EarthVideoView: AVAssetReader init failed: \(error)")
    }
  }

  private func startDisplayLink() {
    displayLink?.invalidate()
    let proxy = DisplayLinkProxy(self)
    displayLinkProxy = proxy
    let dl = CADisplayLink(target: proxy, selector: #selector(DisplayLinkProxy.tick))
    // Match the asset's native fps so we display one frame per source
    // frame. The video is a slow-drift earth atmosphere — running it
    // at 60 fps would just decode the same frame twice on alternate
    // ticks. Capping at source fps halves the GPU work for the same
    // visual result.
    dl.preferredFramesPerSecond = nativeFPS
    dl.add(to: .main, forMode: .common)
    displayLink = dl
  }

  @objc fileprivate func tick() {
    guard displayLayer.isReadyForMoreMediaData else { return }
    // Snapshot the trackOutput once — the decode queue may swap it
    // mid-tick when looping, and we want to read a consistent value
    // for this one frame. ARC keeps the snapshot's reader alive until
    // copyNextSampleBuffer returns even if the property is reassigned.
    guard let trackOutput = self.trackOutput else { return }

    if let sample = trackOutput.copyNextSampleBuffer() {
      setDisplayImmediately(sample)
      displayLayer.enqueue(sample)
    } else {
      // EOF — recreate the reader from the start of the asset. The
      // display layer keeps its last frame on screen during the brief
      // re-open (~1 frame on modern devices), so the loop seam is
      // visually invisible.
      trackOutputDidEnd()
    }
  }

  private func trackOutputDidEnd() {
    // All reader/trackOutput mutations happen on the serial decode
    // queue so writes are ordered and tick() never observes a
    // half-rewritten pair. tick() reads `trackOutput` once into a
    // local before using it, so a nil-then-reassign here is safe — at
    // worst tick() skips one frame.
    decodeQueue.async { [weak self] in
      guard let self = self else { return }
      self.reader = nil
      self.trackOutput = nil
      self.openReader()
    }
  }

  /**
   * Mark the sample buffer with `kCMSampleAttachmentKey_DisplayImmediately`
   * so the AVSampleBufferDisplayLayer doesn't try to match the original
   * PTS (which would let it pause when it thinks the asset has "ended"
   * past `assetDuration`). With this flag, every enqueue results in an
   * immediate display update — and the CADisplayLink controls our
   * effective playback rate.
   */
  private func setDisplayImmediately(_ sample: CMSampleBuffer) {
    let attachmentsArr = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true)
    guard let arr = attachmentsArr, CFArrayGetCount(arr) > 0 else { return }
    let dictPtr = CFArrayGetValueAtIndex(arr, 0)
    let dict = unsafeBitCast(dictPtr, to: CFMutableDictionary.self)
    CFDictionarySetValue(
      dict,
      Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
      Unmanaged.passUnretained(kCFBooleanTrue).toOpaque()
    )
  }

  deinit {
    displayLink?.invalidate()
    displayLink = nil
    displayLinkProxy = nil
    reader?.cancelReading()
  }
}
