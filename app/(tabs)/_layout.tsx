import { Tabs } from 'expo-router';
import { Text, View, Image, StyleSheet } from 'react-native';
import { colors, type } from '../../src/theme';
import { useNotifications, countUnread } from '../../src/player/notificationStore';
import { useRemoteStore } from '../../src/content/remoteStore';
import { newsArticles } from '../../src/content/news';
import { videoItems } from '../../src/content/catalog';

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
  // Subscribe to the seen maps so the badges re-render when items are marked.
  const seenNews = useNotifications(s => s.seenNews);
  const seenMedia = useNotifications(s => s.seenMedia);
  const remoteNews = useRemoteStore(s => s.news);
  const remoteMedia = useRemoteStore(s => s.videos);

  // Count the SAME list the tab screen actually renders, otherwise the badge
  // can stay stuck at a number while "Mark all as read" sits disabled. Once
  // the tab has fetched (or loaded its cache), remoteStore holds the live
  // list; before that we fall back to the bundled static items.
  const newsList = remoteNews.length > 0 ? remoteNews : newsArticles;
  const mediaList = remoteMedia.length > 0 ? remoteMedia : videoItems;
  const newsUnread = newsList.filter(a => !seenNews[a.id]).length;
  const videoUnread = mediaList.filter(v => !seenMedia[v.id]).length;
  void countUnread; // kept for external use

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTintColor: colors.text,
        headerTitle: () => <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />,
        headerTitleAlign: 'center',
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 80,
          paddingTop: 6,
          paddingBottom: 10,
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
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ focused }) => <TabIcon label="◇" focused={focused} badge={newsUnread} />,
        }}
      />
      <Tabs.Screen
        name="video"
        options={{
          title: 'Media',
          tabBarIcon: ({ focused }) => <TabIcon label="▷" focused={focused} badge={videoUnread} />,
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
