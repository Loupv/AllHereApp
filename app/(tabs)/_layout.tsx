import { Tabs } from 'expo-router';
import { Text, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../src/theme';
import { useNotifications } from '../../src/player/notificationStore';
import { useRemoteStore } from '../../src/content/remoteStore';
import { newsArticles } from '../../src/content/news';
import { videoItems } from '../../src/content/catalog';

// Fixed height that fits: 4 px top padding + 26 px icon + React
// Navigation's internal icon→label margin + ~14 px label line-box
// (fontSize 9 at lineHeight 14) + 10 px bottom padding. Bumped from 58
// → 66 because Android was still clipping the label descenders.
export const TAB_BAR_BASE = 66;
// Max width of the tab-items row on wide viewports.
const TAB_BAR_ITEMS_MAX_WIDTH = 900;

const LOGO = require('../../assets/images/allhere-logo.png');

function TabIcon({ label, focused, badge }: { label: string; focused: boolean; badge?: number }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconGlyph, { color: focused ? colors.accent : colors.textDim }]}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Side padding that keeps the flex-distributed tab items centred in
  // the bar, with a capped spread of TAB_BAR_ITEMS_MAX_WIDTH.
  const sidePad = Math.max(0, (width - TAB_BAR_ITEMS_MAX_WIDTH) / 2);
  // Badge count on the Media tab now covers news + media together (the
  // two feeds were merged — News tab was removed in favour of About).
  const seenMedia = useNotifications(s => s.seenMedia);
  const remoteNews = useRemoteStore(s => s.news);
  const remoteMedia = useRemoteStore(s => s.videos);

  const newsList = remoteNews.length > 0 ? remoteNews : newsArticles;
  const mediaList = remoteMedia.length > 0 ? remoteMedia : videoItems;
  // Dedupe in case a remote id happens to appear in both streams.
  const mergedIds = Array.from(new Set([...newsList.map(a => a.id), ...mediaList.map(v => v.id)]));
  const videoUnread = mergedIds.filter(id => !seenMedia[id]).length;

  return (
    <View style={styles.root}>
      {/* The shared atmospheric gradient now lives at the root layout
          (app/_layout.tsx) so detail pages (silent-mind/[id], etc.)
          render against the same backdrop. This wrapper is purely
          structural — transparent scene + transparent tab bar let the
          root gradient show through. */}
    <Tabs
      screenOptions={{
        // Headers transparent too, so the gradient continues all the
        // way to the top edge. Border kept hairline so a faint
        // separation remains between the logo bar and content.
        headerStyle: { backgroundColor: 'transparent', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        headerTintColor: colors.text,
        headerTitle: () => <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />,
        headerTitleAlign: 'center',
        // Horizontal shift between tabs so the new screen comes in
        // from the side instead of cross-fading in place. Mirrors the
        // SwipeTabs gesture direction.
        animation: 'shift',
        // Responsive tab bar height: base 72 + OS bottom safe area.
        // Height/padding are generous enough that two-line labels
        // ('QM Training' etc.) don't get clipped.
        tabBarStyle: {
          // Transparent so the shared gradient continues behind the
          // labels — the dark edge of the gradient is opaque enough
          // there to keep them legible without a flat panel.
          backgroundColor: 'transparent',
          // No hairline separator — the bar reads as part of the page.
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          // Height hugs the content — we deliberately do NOT add
          // `insets.bottom` to the bar height. On Android edge-to-edge
          // devices the bar was rendering 24–48 px of `colors.bg`
          // below the labels, which read as "dead blue space" above
          // the system gesture bar. With the height clamped to
          // TAB_BAR_BASE the labels sit right against the system nav.
          height: TAB_BAR_BASE,
          paddingTop: 4,
          paddingBottom: 10,
          // Symmetric side padding keeps the full-width bar (bg +
          // top border) while horizontally centring the flex-
          // distributed tab items inside TAB_BAR_ITEMS_MAX_WIDTH.
          paddingLeft: sidePad,
          paddingRight: sidePad,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        // Uppercase labels on a single line. We can't reuse `type.overline`
        // here (its 2.5 letter-spacing pushed 'QM TRAINING' past the item
        // edge on phone widths) — tight 0.6 tracking keeps the caps
        // discipline while fitting the label on one line.
        tabBarLabelStyle: {
          fontFamily: fonts.bodySemibold,
          fontSize: 9,
          // Explicit lineHeight + no top/bottom margin — Android was
          // giving the label an under-sized line-box and clipping the
          // descenders. 14 px line-height guarantees a clean baseline.
          lineHeight: 14,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginTop: 0,
          marginBottom: 0,
          includeFontPadding: false,
        },
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Start',
          tabBarIcon: ({ focused }) => <TabIcon label="◐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="silent-mind"
        options={{
          title: 'Silent Mind',
          tabBarIcon: ({ focused }) => <TabIcon label="◉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="qm"
        options={{
          title: 'QM Training',
          tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="video"
        options={{
          title: 'Media',
          tabBarIcon: ({ focused }) => <TabIcon label="▷" focused={focused} badge={videoUnread} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          tabBarIcon: ({ focused }) => <TabIcon label="◆" focused={focused} />,
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  iconWrap: { width: 32, height: 26, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 20 },
  headerLogo: { width: 100, height: 32 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 9, fontFamily: 'Montserrat_700Bold' },
});
