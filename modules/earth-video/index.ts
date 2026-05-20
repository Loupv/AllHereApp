// Native module wrapping AVSampleBufferDisplayLayer on iOS — see
// ios/EarthVideoView.swift for the motivation. Default export is the
// React component; the module surface itself has no JS-callable
// methods.
export { default } from './src/EarthVideoView';
export type { EarthVideoViewProps } from './src/EarthVideo.types';
