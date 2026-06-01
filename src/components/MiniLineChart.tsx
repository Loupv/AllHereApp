import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  /** Series values; `null` breaks the line (gap), matching the LMT curve. */
  data: (number | null)[];
  color: string;
  height?: number;
  /** Fractional x-positions (0..1) for round boundary guide lines. */
  dividers?: number[];
};

/**
 * Tiny dependency-free line chart (react-native-svg) for the LMT report
 * curves. Auto-scales Y to the series' own min/max, draws each run of
 * non-null points as its own polyline so silence gaps read as breaks, and
 * marks round boundaries with faint vertical guides.
 *
 * Uses a 0..100 viewBox with `preserveAspectRatio="none"` so it fills the
 * parent width without needing an onLayout measure.
 */
export function MiniLineChart({ data, color, height = 96, dividers = [] }: Props) {
  const vals = data.filter((v): v is number => v != null && Number.isFinite(v));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const span = max - min || 1;
  const n = data.length;

  // Split into contiguous non-null segments → one polyline each.
  const segments: string[] = [];
  let cur: string[] = [];
  data.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length > 1) segments.push(cur.join(' '));
      cur = [];
      return;
    }
    const x = n > 1 ? (i / (n - 1)) * 100 : 0;
    const y = 100 - ((v - min) / span) * 100;
    cur.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (cur.length > 1) segments.push(cur.join(' '));

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {dividers.map((d, i) => (
          <Line
            key={`d${i}`}
            x1={d * 100}
            y1={0}
            x2={d * 100}
            y2={100}
            stroke={colors.border}
            strokeWidth={0.5}
          />
        ))}
        {segments.map((pts, i) => (
          <Polyline
            key={`s${i}`}
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
