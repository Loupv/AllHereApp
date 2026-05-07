import Svg, { Path } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import type { MediaKind as CatalogMediaKind } from '../content/catalog';

/**
 * Re-export the catalog's MediaKind alias so every consumer shares the
 * exact same union type. The two types were structurally identical but
 * nominally different, which made TS refuse a cross-assignment.
 */
export type MediaKind = CatalogMediaKind;

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

function Camera({ color, size = 22 }: { color: string; size?: number }) {
  // Compact camcorder silhouette — body on the left, lens-cone on
  // the right. Reads as "video device" rather than "play button"
  // so it doesn't compete with the global ▶ play affordance.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
        fill={color}
      />
      <Path
        d="M16 11l5-3v8l-5-3v-2z"
        fill={color}
      />
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
  if (kind === 'video') return <Camera color={color} size={size} />;
  // 'text' + 'article' both render the paragraph glyph
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
