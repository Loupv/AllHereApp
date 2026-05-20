import * as React from 'react';

import { EarthVideoViewProps } from './EarthVideo.types';

/**
 * Web fallback — plays the MP4 in a muted, looping HTML5 <video>. The
 * lock-screen-now-playing problem we solve on iOS via
 * AVSampleBufferDisplayLayer doesn't exist on web (browsers don't have
 * a single MediaPlayback session), so a vanilla <video> is fine.
 */
export default function EarthVideoView(props: EarthVideoViewProps) {
  return (
    <video
      src={props.source}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...(props.style as React.CSSProperties),
      }}
      autoPlay
      loop
      muted
      playsInline
    />
  );
}
