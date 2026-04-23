import { Text, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { AboutFooter } from '../../src/components/AboutFooter';
import { silentMindVolets, silentMindProgram } from '../../src/content/catalog';
import { colors, spacing, type } from '../../src/theme';

// Bottom tab bar height (see _layout.tsx) + Stack header roughly. Used
// to align the AboutFooter's top rule with the tab bar's top edge.
const TAB_BAR_HEIGHT = 64;
const HEADER_HEIGHT = 60;

export default function SilentMindScreen() {
  const { height } = useWindowDimensions();
  // Force the main content block to fill the visible area above the tab
  // bar, so the AboutFooter that comes right after starts exactly at the
  // tab bar's top edge. The footer's tagline stays tucked under the bar
  // until the user scrolls.
  const mainMinHeight = Math.max(0, height - HEADER_HEIGHT - TAB_BAR_HEIGHT);

  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="silent-mind">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ minHeight: mainMinHeight }}>
          <View style={styles.hero}>
            <Image source={silentMindProgram.banner} style={styles.banner} resizeMode="cover" />
            <View style={styles.bannerOverlay} />
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>{silentMindProgram.eyebrow}</Text>
              <Text style={styles.title}>{silentMindProgram.title}</Text>
            </View>
          </View>

          <Text style={styles.intro}>{silentMindProgram.intro}</Text>

          {/* Equal-flex spacers above and below the cards block, so the
              Part 1/2/3 cards stay tight together but ride at the
              midpoint of the remaining vertical space. */}
          <View style={styles.topSpacer} />
          <View style={styles.voletsList}>
            {silentMindVolets
              .filter(v => v.id !== 'intro')
              .map((v) => (
                <VoletCard
                  key={v.id}
                  volet={v}
                  basePath="/silent-mind"
                  accent={colors.accent}
                  accentRgb="158,54,148"
                />
              ))}
          </View>
          <View style={styles.bottomSpacer} />
        </View>
        <AboutFooter />
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0 },
  // Hero back near its original 150 px — but the title sits a bit
  // higher thanks to a larger paddingBottom, leaving fewer pixels
  // between the title and the page content underneath.
  hero: { height: 130, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.xs, textAlign: 'center', fontSize: 10 },
  title: { ...type.display, color: colors.text, fontSize: 24, textAlign: 'center', lineHeight: 30 },
  intro: {
    ...type.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  // Cards stay stacked tight together (as they were). The surrounding
  // flex-grow spacers below distribute the leftover vertical room so
  // the block doesn't collide with the hero or fall far from the footer.
  voletsList: {},
  topSpacer: { flex: 1, minHeight: spacing.sm },
  bottomSpacer: { flex: 1, minHeight: spacing.sm },
});
