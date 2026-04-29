import { Text, View, Image, Pressable, Linking, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, type } from '../../src/theme';
import { noOrphan } from '../../src/utils/noOrphan';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

// Brand wordmark, reused from the splash + the nav header so the
// spelling / weight stays consistent. Rendered above the eyebrow in
// the about body — see styles.aboutLogo for size / spacing.
const LOGO = require('../../assets/images/allhere-logo.png');

// Hero asset — kept as a single source of truth for native (<Image>)
// and web (CSS `background-image`). On web, Metro's asset registry
// returns an object whose `.uri` is a `/assets/...` URL we can drop
// straight into a CSS `url(...)`. On native the require() resolves
// to an opaque module id consumed by <Image> — `HERO_URI` stays
// empty there since native doesn't take the web branch.
const HERO_SOURCE = require('../../assets/images/lounge-1.jpg');
const HERO_URI: string =
  Platform.OS === 'web' && HERO_SOURCE && typeof HERO_SOURCE === 'object' && 'uri' in HERO_SOURCE
    ? (HERO_SOURCE as { uri: string }).uri
    : '';

const pillars = [
  {
    icon: require('../../assets/images/icon-science.png'),
    title: 'Science',
    body:
      'We make meditation measurable with our advanced brain tracking system, validated by fundamental research and rigorous R&D.',
  },
  {
    icon: require('../../assets/images/icon-technology.png'),
    title: 'Technology',
    body:
      'We support meditation development by integrating research-grade EEG with real-time visualization and multisensory immersive technology.',
  },
  {
    icon: require('../../assets/images/icon-practice.png'),
    title: 'Meditation Practice',
    body:
      'We train methods to reduce random mind-wandering and enhance meditative attention in order to achieve a profound state of Stability and Silence of Mind.',
  },
];

export default function AboutTabScreen() {
  const tabPad = useTabBarPadding();
  const { columnMax } = useLayout();
  const { width: screenW } = useWindowDimensions();
  // Hero strip dimensions computed from the actual viewport — that
  // way the IMG element is sized in absolute pixels (no Yoga
  // percentage / aspectRatio gymnastics that have been intermittently
  // shrinking the image on iOS). Source picture is 674 × 702
  // (≈ square); we render it at full screen width and let the
  // wrapper crop the height to a banner.
  const heroW = Math.min(screenW, columnMax);
  const heroSrcAspect = 674 / 702; // ≈ 0.96
  const heroImgH = heroW / heroSrcAspect;        // image natural height at full width
  const heroFrameH = Math.max(220, Math.min(360, Math.round(heroW / 1.6))); // banner height
  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="about">
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabPad, alignItems: 'center' }]}>
          <View style={[styles.column, { maxWidth: columnMax }]}>
          {/* Hero frame is sized so the bottom third of the source
              picture is what shows through, regardless of viewport
              width. On web we render the picture as a `background-
              image` on a plain View (so we can pin `background-
              position` to the bottom edge — react-native-web's Image
              hard-codes that to centre). On native we keep an actual
              <Image> and use the bottom-anchor trick: full width,
              source aspect ratio, absolute bottom: 0 inside an
              overflow:hidden wrapper. */}
          <View
            style={[
              styles.heroWrap,
              { width: heroW, height: heroFrameH },
              Platform.OS === 'web' && {
                // @ts-expect-error — web-only CSS props.
                backgroundImage: `url(${HERO_URI})`,
                backgroundSize: 'cover',
                backgroundPosition: '50% 100%',
                backgroundRepeat: 'no-repeat',
              },
            ]}
          >
            {Platform.OS !== 'web' ? (
              // Native: Image rendered with EXPLICIT pixel dimensions
              // — width = full screen width, height = source's
              // intrinsic height at that width. Anchored to the
              // bottom of the wrapper via absolute positioning so the
              // top overflows + clips. No percentages, no aspectRatio
              // → no Yoga ambiguity that was leaving the IMG narrower
              // than the wrapper on iOS.
              <Image
                source={HERO_SOURCE}
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: heroW,
                  height: heroImgH,
                }}
                resizeMode="cover"
              />
            ) : null}
          </View>
          <View style={styles.body}>
            {/* All Here wordmark — anchors the section to the brand
                and bridges the hero pic to the title block below. The
                same asset the splash + the navigation header use, so
                spelling stays consistent across every surface. */}
            <Image
              source={LOGO}
              style={styles.aboutLogo}
              resizeMode="contain"
            />
            {/* "About All Here" eyebrow removed — the wordmark above
                already spells the brand, and the title below carries
                the page's positioning. The eyebrow was a third
                identical-grammar line and read as redundant. */}
            <Text style={styles.title}>{noOrphan('Where meditation meets\nscience & technology')}</Text>
            <Text style={styles.lead}>
              {noOrphan('Founded in Geneva, All Here is inspiring the world to meditate through immersive, quantifiable technologies.')}
            </Text>

            {/* Inline stats: no cards / borders — three quiet columns
                of value + label, aligned to the text above. */}
            <View style={styles.stats}>
              {/* `noOrphan` ties the last two words with a non-breaking
                  space — fine on wide labels, but in these narrow stat
                  columns the joined pair ('neuroscience research',
                  'meditators analyzed') overflows and the text engine
                  breaks mid-word. Plain strings let the labels wrap on
                  ordinary spaces instead. */}
              <View style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>Decades</Text>
                <Text style={styles.statLabel}>of advanced meditation practice</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>4 years</Text>
                <Text style={styles.statLabel}>of neuroscience research</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>+400</Text>
                <Text style={styles.statLabel}>expert meditators analyzed</Text>
              </View>
            </View>

            {pillars.map(p => (
              <View key={p.title} style={styles.pillar}>
                <Image source={p.icon} style={styles.pillarIcon} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pillarTitle}>{noOrphan(p.title)}</Text>
                  <Text style={styles.pillarBody}>{noOrphan(p.body)}</Text>
                </View>
              </View>
            ))}

            {/* The old "outro" paragraph used to live here — it repeated the
                lead's positioning ("we combine traditions with neuroscience…")
                so it was dropped to let the three pillars carry that story. */}

            {/* Plain text link — no pill, no accent border. The arrow
                and underline carry the affordance. */}
            <Pressable
              onPress={() => openExternal('https://allhere.org')}
              hitSlop={8}
              style={({ pressed }) => [styles.siteLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.siteLinkUrl}>allhere.org →</Text>
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: {},
  column: { width: '100%', alignSelf: 'center' },
  // Clipping frame: 160 px tall. The image inside is rendered taller
  // and anchored to the bottom of the wrapper, so the bottom of the
  // photo stays in view while the top is clipped.
  // Hero framing — restored to the original 160 / 320 pair. The image
  // is rendered taller than the wrapper and bottom-anchored so the
  // lower half of the picture (the part we actually want to show) lands
  // on screen. Don't change these numbers in a pass where you're only
  // tightening typography — the crop is tuned visually.
  // Source image is 674 × 702 (≈ 1:1.04). The wrapper fills the column
  // width and adopts an aspect ratio of sourceW / (sourceH / 3) ≈ 2.88
  // — that's the slice of the source we want to expose, capped between
  // 140 and 280 px tall so very narrow phones still get a usable band
  // and very wide tablets don't blow up the hero.
  heroWrap: {
    // Width + height come from inline-computed values at the call
    // site (see `heroW` / `heroFrameH` in `AboutTabScreen`) so the
    // IMG inside can be sized in absolute pixels rather than
    // percentages — that's what fixed the iOS-side "image isn't full
    // width" bug we were chasing. Everything else is layout chrome.
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  // The Image fills the wrapper and crops to cover. On web,
  // react-native-web renders the actual image as a CSS background on
  // an inner div (the IMG element is just an a11y fallback) — so we
  // override `backgroundPosition` via the style prop to bias the crop
  // to the bottom edge. On native we keep the bottom-anchor trick:
  // Image gets the source aspect ratio at full width and is absolute-
  // positioned at bottom: 0, top overflows + clips.
  hero: Platform.OS === 'web'
    ? ({
        width: '100%',
        height: '100%',
        // @ts-expect-error — backgroundPosition is a CSS prop honoured
        // by react-native-web's Image but absent from the RN typings.
        // Visible band biased to the upper portion of the source
        // (~18% from the top) — midway between the earlier 25% (too
        // low) and 10% (too high). Lands on the subject's
        // shoulders / upper torso.
        backgroundPosition: '50% 18%',
      } as any)
    : {
        // Image fills the wrapper entirely (StyleSheet.absoluteFill =
        // position: absolute + top/right/bottom/left: 0). `resizeMode
        // = "cover"` (set in JSX) handles the source-to-box fitting
        // at the native level — no Yoga aspect-ratio math, no
        // percentage-vs-aspectRatio conflict that was leaving the IMG
        // narrower than the wrapper on iOS. Default cover crops
        // centrally; if we want a top-anchor specifically, that's a
        // separate tuning step once full-width is confirmed.
        ...StyleSheet.absoluteFillObject,
      },
  body: { padding: spacing.lg },
  // Brand wordmark above the eyebrow. Same proportions used in the
  // navigation header (100 × 32) so the visual identity is consistent
  // across surfaces. Centred + a small bottom margin so it sits as
  // its own beat between the hero pic and the "About All Here"
  // eyebrow that follows.
  aboutLogo: { width: 140, height: 44, alignSelf: 'center', marginBottom: spacing.md },
  // Sentence-case section label — brand/positioning cue without the
  // uppercase/accent weight.
  eyebrow: { ...type.sectionLabel, color: colors.textDim, marginBottom: spacing.sm },
  // Dropped from 26 → 22: the hero image already carries most of the
  // "landing" weight, the title doesn't need to compete with it.
  title: { ...type.display, color: colors.text, fontSize: 22, marginBottom: spacing.md, lineHeight: 28 },
  // Lead now reads as a prose paragraph, not a second hero banner.
  lead: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  // No filled cards — just three quiet columns. A hairline below the row
  // separates it from the pillars that follow.
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomColor: 'rgba(255,255,255,0.09)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1 },
  statValue: { ...type.h3, color: colors.text, marginBottom: 2, fontSize: 14 },
  statLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  // Hairline pillar rows — same list motif as ContentCard / VoletCard.
  // Tightened sizes so the stack of three pillars doesn't dominate.
  pillar: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomColor: 'rgba(255,255,255,0.09)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pillarIcon: { width: 36, height: 36 },
  pillarTitle: { ...type.h3, color: colors.text, marginBottom: 2, fontSize: 14 },
  pillarBody: { ...type.body, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  // Borderless text link — underline + arrow carry the affordance.
  siteLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  siteLinkUrl: {
    ...type.body,
    color: colors.text,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
