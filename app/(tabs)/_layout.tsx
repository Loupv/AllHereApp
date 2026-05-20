import { withLayoutContext } from 'expo-router';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
  MaterialTopTabNavigationEventMap,
} from '@react-navigation/material-top-tabs';
import {
  ParamListBase,
  TabNavigationState,
} from '@react-navigation/native';
import { Pressable, Text, View, Image, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../src/theme';
import { useNotifications } from '../../src/player/notificationStore';
import { useRemoteStore } from '../../src/content/remoteStore';
import { newsArticles } from '../../src/content/news';
import { videoItems } from '../../src/content/catalog';

// Material-top-tabs ships with PagerView under the hood, which gives
// us the swipe-between-tabs gesture for free with proper iOS / Android
// touch arbitration (the tab swipe wins over child Pressables natively
// without us having to fight the RN cancellation handshake). We ask
// for a BOTTOM tab bar — the only visible difference from the default
// material-top look — and replace the bar itself with our own custom
// renderer so the bottom row keeps the icon-glyph + 2-line label
// styling the app already had.
const { Navigator } = createMaterialTopTabNavigator();

// Wrap with expo-router's withLayoutContext so file-system routing
// keeps working: each /(tabs)/* file is still its own screen, the URL
// still updates on navigation, and deep links still resolve.
const Tabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

// Fixed height that fits: 4 px top padding + 26 px icon + React
// Navigation's internal icon→label margin + up to 2 lines of label
// (fontSize 9 at lineHeight 13 = max 26 px) + 8 px bottom padding.
// Two-line tolerance is what stops "SILENT MIND" / "QM TRAINING" from
// truncating to "SILENT MI…" on phone widths.
export const TAB_BAR_BASE = 80;
// Max width of the tab-items row on wide viewports.
const TAB_BAR_ITEMS_MAX_WIDTH = 900;

const LOGO = require('../../assets/images/allhere-logo.png');

// Per-tab metadata in the order it appears in the bar (and in the
// pager). Drives the custom bottom bar below — keeps the file-system
// route names + display labels + glyphs in one table instead of
// scattered across <Tabs.Screen> entries.
type TabMeta = {
  /** route name as it appears in app/(tabs)/<name>(.tsx) */
  route: string;
  /** rendered label (uppercased to 2 lines as needed) */
  label: string;
  /** monochrome glyph drawn above the label */
  icon: string;
  /** notification badge value source (read at render time) */
  badge?: number;
};

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

/**
 * Custom bottom tab bar. Material-top-tabs' default bar is built for
 * the top of the screen with an indicator strip — the visual we want
 * is the same icon+label pair we had under expo-router's bottom Tabs,
 * placed at the bottom of the screen with no indicator.
 *
 * Receives the navigator's `state` (current index, routes) +
 * `navigation` (jumpTo) so taps switch tabs in-place. Swipes between
 * tabs are handled by PagerView itself and don't go through here.
 */
function CustomBottomBar({ state, navigation, tabs, sidePad }: {
  state: TabNavigationState<ParamListBase>;
  navigation: any;
  tabs: TabMeta[];
  sidePad: number;
}) {
  return (
    <View
      style={[
        styles.bar,
        { paddingLeft: sidePad, paddingRight: sidePad },
      ]}
    >
      {state.routes.map((route, index) => {
        const meta = tabs.find(t => t.route === route.name);
        if (!meta) return null;
        const focused = state.index === index;
        const tint = focused ? colors.accent : colors.textDim;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.jumpTo(route.name);
              }
            }}
            style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.iconWrap}>
              <Text style={[styles.iconGlyph, { color: tint }]}>{meta.icon}</Text>
              <TabBadge count={meta.badge ?? 0} />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.label,
                { color: tint },
              ]}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Side padding that keeps the flex-distributed tab items centred in
  // the bar, with a capped spread of TAB_BAR_ITEMS_MAX_WIDTH.
  const sidePad = Math.max(0, (width - TAB_BAR_ITEMS_MAX_WIDTH) / 2);
  // Badge count on the Media tab covers news + media together (the
  // two feeds were merged — News tab was removed in favour of About).
  const seenMedia = useNotifications(s => s.seenMedia);
  const remoteNews = useRemoteStore(s => s.news);
  const remoteMedia = useRemoteStore(s => s.videos);
  const newsList = remoteNews.length > 0 ? remoteNews : newsArticles;
  const mediaList = remoteMedia.length > 0 ? remoteMedia : videoItems;
  const mergedIds = Array.from(new Set([...newsList.map(a => a.id), ...mediaList.map(v => v.id)]));
  const videoUnread = mergedIds.filter(id => !seenMedia[id]).length;

  const tabs: TabMeta[] = [
    { route: 'index',       label: 'Start',       icon: '◐' },
    { route: 'qm',          label: 'QM Training', icon: '◎' },
    { route: 'silent-mind', label: 'Silent Mind', icon: '◉' },
    { route: 'video',       label: 'Media',       icon: '▷', badge: videoUnread },
    { route: 'about',       label: 'About',       icon: '◆' },
  ];

  return (
    // Top safe-area inset added at the layout level — material-top-tabs
    // doesn't ship a header (we removed expo-router's bottom Tabs which
    // used to take care of this), so without this padding the tab
    // content's first line of text would tuck under the iPhone's notch
    // / Dynamic Island. The "SILENT MIND PROGRAM" eyebrow on SM and the
    // teal "QUANTIFIED MEDITATION" eyebrow on QM were the most visible
    // victims — they're tinted accent colours that get lost in the
    // dead-pixel area at the top of OLED iPhones.
    // paddingBottom: insets.bottom lifts the tab bar above the Android
    // gesture-nav handle (edgeToEdgeEnabled=true in app.json lets content
    // draw under it by default). The gesture-nav strip itself stays
    // transparent so the shader behind shows through — the bar just
    // doesn't get clipped anymore.
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <Tabs
      // Bar lives at the bottom; the navigator itself still uses
      // PagerView for content + swipe gestures.
      tabBarPosition="bottom"
      // Custom bar component — see CustomBottomBar above. We pass the
      // tabs metadata + sidePad through `tabBar` so the bar stays
      // pure-presentational and re-renders cheaply.
      tabBar={(props) => (
        <CustomBottomBar {...props} tabs={tabs} sidePad={sidePad} />
      )}
      screenOptions={{
        // Transparent scene + lazy:false so all five tabs live in the
        // pager from the start. PagerView then transitions instantly
        // between mounted children — no first-mount flash.
        lazy: false,
        // Non-Material defaults that keep the visual aligned with the
        // rest of the app.
        sceneStyle: { backgroundColor: 'transparent' },
        swipeEnabled: true,
        // We render our own bar; suppress all built-ins so material's
        // top-bar geometry doesn't show through.
        tabBarShowIcon: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Start' }} />
      <Tabs.Screen name="qm" options={{ title: 'QM Training' }} />
      <Tabs.Screen name="silent-mind" options={{ title: 'Silent Mind' }} />
      <Tabs.Screen name="video" options={{ title: 'Media' }} />
      <Tabs.Screen name="about" options={{ title: 'About' }} />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  // Custom bottom bar styling — mirrors the previous expo-router Tabs
  // look: transparent background (the shared root gradient shows
  // through), no top hairline, fixed TAB_BAR_BASE height, generous
  // horizontal padding so the icon column reads as breathing.
  bar: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    height: TAB_BAR_BASE,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
    paddingTop: 4,
    gap: 2,
  },
  iconWrap: { width: 32, height: 26, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 20 },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    lineHeight: 12,
    // Android with uppercase + letterSpacing has a long-running bug
    // where the trailing letter's right-side bearing is clipped — the
    // "t" in ABOUT, the "a" in MEDIA at certain widths, etc. The
    // text wraps in a tight box and the last character gets shaved.
    // Lowering letterSpacing a touch + adding 2 px of horizontal
    // padding leaves enough breathing room on the trailing edge to
    // avoid the clip without visibly changing the tracking.
    letterSpacing: Platform.OS === 'android' ? 0.4 : 0.6,
    paddingHorizontal: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 2,
  },
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
