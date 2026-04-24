import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  /** Normalized peaks 0..1. Length defines the bar count — typically 160. */
  peaks: number[];
  /** Playback progress 0..1. Bars to the left are tinted accent, right are dim. */
  progress: number;
  /** Tint for the played portion. Matches the track's SM / QM palette. */
  accent?: string;
  /** Total bar height in px. Each bar's height is `peak * height` with a floor. */
  height?: number;
  /** Minimum bar height so quiet passages still show a visible stub. */
  minBarHeight?: number;
};

/**
 * Horizontal waveform bar — a precomputed peaks array rendered as vertical
 * bars, colored accent up to the current playback progress and dim beyond.
 *
 * The component is purely visual; it expects to live inside a pressable /
 * pan-handling parent that owns seek gestures (see Player's `progressHit`
 * wrapper). Bars use flexbox so the row fills whatever width the parent
 * provides — no explicit layout measurement needed.
 */
export function WaveformProgress({
  peaks,
  progress,
  accent = colors.accent,
  height = 36,
  minBarHeight = 2,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  // Index of the first bar that sits in the "upcoming" zone. Bars with index
  // strictly below this are fully accent; the one exactly at the boundary
  // gets a partial accent treatment (rendered as a split bar below).
  const boundary = clamped * peaks.length;
  const boundaryIdx = Math.floor(boundary);
  const partial = boundary - boundaryIdx;

  const bars = useMemo(() => peaks.map((p, i) => {
    const h = Math.max(minBarHeight, Math.round(p * (height - 2)));
    return { h, played: i < boundaryIdx, boundary: i === boundaryIdx };
  }), [peaks, height, boundaryIdx, minBarHeight]);

  return (
    <View style={[styles.row, { height }]} pointerEvents="none">
      {bars.map((b, i) => {
        if (b.boundary) {
          // Split bar at the playhead — left half accent, right half dim,
          // widths proportional to `partial` so the transition is smooth.
          return (
            <View
              key={i}
              style={[styles.bar, { height: b.h, flexDirection: 'row' }]}
            >
              <View style={{ flex: Math.max(0.0001, partial), backgroundColor: accent, borderRadius: 1 }} />
              <View style={{ flex: Math.max(0.0001, 1 - partial), backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 1 }} />
            </View>
          );
        }
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: b.h,
                backgroundColor: b.played ? accent : 'rgba(255,255,255,0.22)',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 1,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
    minWidth: 1,
  },
});
