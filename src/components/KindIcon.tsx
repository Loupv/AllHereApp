import Svg, { Path } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';

export type MediaKind = 'audio' | 'video' | 'text';

// Emoji glyphs render multicolor on iOS / colored on web — they can't be
// tinted via `color`. These tiny SVGs use `currentColor`-style fills driven
// by the `color` prop so the icon actually picks up the accent.

function Headphones({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Arc + two ear cups */}
      <Path
        d="M4 14a8 8 0 0 1 16 0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M3.5 14h2.7c.7 0 1.2.5 1.2 1.2v4.1c0 .7-.5 1.2-1.2 1.2H4.7c-.7 0-1.2-.5-1.2-1.2v-5.3zm17 0v5.3c0 .7-.5 1.2-1.2 1.2h-1.5c-.7 0-1.2-.5-1.2-1.2v-4.1c0-.7.5-1.2 1.2-1.2h2.7z"
        fill={color}
      />
    </Svg>
  );
}

function Play({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 5l12 7-12 7V5z" fill={color} />
    </Svg>
  );
}

function Text_({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5h14v2H5V5zm0 5h14v2H5v-2zm0 5h10v2H5v-2z" fill={color} />
    </Svg>
  );
}

export function KindIcon({ kind, color, size = 22 }: { kind: MediaKind; color: string; size?: number }) {
  if (kind === 'audio') return <Headphones color={color} size={size} />;
  if (kind === 'video') return <Play color={color} size={size} />;
  return <Text_ color={color} size={size} />;
}

// Small inline wrapper when you want the icon to sit inside a flex row
// without its own pressability.
export function KindIconInline(props: { kind: MediaKind; color: string; size?: number }) {
  return (
    <View style={styles.wrap}>
      <KindIcon {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
