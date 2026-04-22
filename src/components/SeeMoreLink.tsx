import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { colors, spacing, type } from '../theme';

type Props = {
  label: string;   // e.g. "Updates"
  url: string;     // external URL on allhere.org
  lead?: string;   // optional overriding lead text
};

/**
 * Small footer-ish block inserted above AboutFooter to point at the matching
 * section on allhere.org, so users understand this tab surfaces a curated
 * slice of the main site.
 */
export function SeeMoreLink({ label, url, lead }: Props) {
  const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const openExternal = () => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };
  return (
    <View style={styles.root}>
      <Text style={styles.lead}>{lead ?? `See more ${label.toLowerCase()} at`}</Text>
      <Pressable onPress={openExternal} hitSlop={8}>
        <Text style={styles.link}>{display} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  lead: { ...type.overline, color: colors.textMuted, fontSize: 10 },
  link: { ...type.caption, color: colors.accent },
});
