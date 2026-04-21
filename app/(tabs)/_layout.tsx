import { Tabs } from 'expo-router';
import { Text, View, Image, StyleSheet } from 'react-native';
import { colors, type } from '../../src/theme';
import { useNotifications } from '../../src/player/notificationStore';

const LOGO = require('../../assets/images/logo-header.png');

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
  const { newsUnread, videoUnread } = useNotifications();

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
          height: 72,
          paddingTop: 6,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { ...type.overline, fontSize: 10 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Start', tabBarIcon: ({ focused }) => <TabIcon label="◐" focused={focused} /> }} />
      <Tabs.Screen name="silent-mind" options={{ title: 'Silent Mind', tabBarIcon: ({ focused }) => <TabIcon label="◉" focused={focused} /> }} />
      <Tabs.Screen name="news" options={{ title: 'News', tabBarIcon: ({ focused }) => <TabIcon label="◇" focused={focused} badge={newsUnread} /> }} />
      <Tabs.Screen name="video" options={{ title: 'Video', tabBarIcon: ({ focused }) => <TabIcon label="▷" focused={focused} badge={videoUnread} /> }} />
      <Tabs.Screen name="silent-flute" options={{ title: 'Silent Flute', tabBarIcon: ({ focused }) => <TabIcon label="♪" focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 18 },
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
