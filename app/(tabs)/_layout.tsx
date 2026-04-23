import { Tabs } from 'expo-router';
import { Text, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type } from '../../src/theme';
import { useNotifications } from '../../src/player/notificationStore';
import { useRemoteStore } from '../../src/content/remoteStore';
import { newsArticles } from '../../src/content/news';
import { videoItems } from '../../src/content/catalog';

// Base height of the tab bar before adding the OS bottom inset. Needs
// to accommodate the icon (28 px) + a two-line label ('Silent Mind',
// 'QM Format') without cropping the bottom of the second line.
export const TAB_BAR_BASE = 72;
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

function TwoLineLabel({ lines, focused }: { lines: [string, string]; focused: boolean }) {
  return (
    <Text
      numberOfLines={2}
      style={[
        styles.twoLineLabel,
        { color: focused ? colors.accent : colors.textDim },
      ]}
    >
      {lines[0]}{'\n'}{lines[1]}
    </Text>
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
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTintColor: colors.text,
        headerTitle: () => <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />,
        headerTitleAlign: 'center',
        // Responsive tab bar height: base 72 + OS bottom safe area.
        // Height/padding are generous enough that two-line labels
        // ('QM Format' etc.) don't get clipped.
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: TAB_BAR_BASE + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(6, insets.bottom),
          // Symmetric side padding keeps the full-width bar (bg +
          // top border) while horizontally centring the flex-
          // distributed tab items inside TAB_BAR_ITEMS_MAX_WIDTH.
          paddingLeft: sidePad,
          paddingRight: sidePad,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { ...type.overline, fontSize: 10 },
        sceneStyle: { backgroundColor: colors.bg },
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
          tabBarLabel: ({ focused }) => <TwoLineLabel lines={['Silent', 'Mind']} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="qm"
        options={{
          title: 'QM Format',
          tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
          tabBarLabel: ({ focused }) => <TwoLineLabel lines={['QM', 'Format']} focused={focused} />,
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
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 18 },
  headerLogo: { width: 100, height: 32 },
  twoLineLabel: {
    ...type.overline,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
  },
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
