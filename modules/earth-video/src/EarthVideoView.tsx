import { requireNativeView } from 'expo';
import * as React from 'react';

import { EarthVideoViewProps } from './EarthVideo.types';

const NativeView: React.ComponentType<EarthVideoViewProps> =
  requireNativeView('EarthVideo');

export default function EarthVideoView(props: EarthVideoViewProps) {
  return <NativeView {...props} />;
}
