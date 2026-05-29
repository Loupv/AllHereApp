import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Line, Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { silentMindProgram } from '../../src/content/catalog';
import { useLayout } from '../../src/hooks/useLayout';
import { TAB_BAR_BASE } from './_layout';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SM tab — explainer for the Silent Mind tree. Layout (top → bottom):
 *   1. ProgramHeader (eyebrow + title + the canonical intro
 *      paragraph from silentMindProgram.intro)
 *   2. Tree diagram, centred as a BLOCK (trunk + labels read as a
 *      single column with the labels to the right of the trunk).
 *      Vertical space above and below balances the block so it
 *      sits roughly mid-screen between header and CTA.
 *   3. "Enter" pill — pushes /silent-mind-tree.
 */

const DIAGRAM_STEPS: { id: string; label: string; tagline?: string; color: string }[] = [
  { id: 'part3', label: 'Towards Silence', tagline: 'The Space', color: '#9B6FDD' },
  { id: 'part2', label: 'Stability & Equanimity', tagline: 'The Sky', color: '#3D6BBA' },
  { id: 'part1', label: 'Mind-Body', tagline: 'The Earth', color: '#3D8E5E' },
  { id: 'intro', label: 'Introduction', color: '#C9A66B' },
];

const DOT_R = 10;
const DIAGRAM_PAD_Y = 14;
const TRUNK_X = DOT_R + 2;
const TRUNK_SVG_WIDTH = TRUNK_X + DOT_R + 2;
const LABELS_WIDTH = 220;
// Direction-of-travel arrow — vertical dashed line + chevron pointing
// UP, sits to the left of the trunk so the user reads "walk this from
// bottom to top". Kept slim (20 px width slot, ~12 px gap to trunk)
// so it doesn't compete with the actual tree column.
const ARROW_WIDTH = 20;
const ARROW_X = ARROW_WIDTH / 2;
const ARROW_GAP = 12;
const ARROW_HEAD_Y = DIAGRAM_PAD_Y - 2;

function TreeDiagram({ stepY }: { stepY: number }) {
  // The vertical step between dots is sized by the parent to fill the
  // space available between the header and the Enter button, so the
  // tree expands into that space instead of leaving a gap under the
  // title. padY stays fixed so the top/bottom labels (which extend
  // ~16 px past the outer dots) never get clipped by RN-Web's default
  // overflow:hidden on the row.
  const STEP_Y = stepY;
  const padY = DIAGRAM_PAD_Y;
  const arrowHeadY = padY - 2;
  const DIAGRAM_HEIGHT = (DIAGRAM_STEPS.length - 1) * STEP_Y + padY * 2;
  return (
    <View style={[styles.diagramRow, { height: DIAGRAM_HEIGHT }]}>
      {/* Direction-of-travel hint — dashed vertical line + chevron
          pointing UP to signal "walk this from bottom to top". Sits
          to the LEFT of the trunk so it reads as a margin annotation
          rather than as part of the tree itself. */}
      <Svg width={ARROW_WIDTH} height={DIAGRAM_HEIGHT}>
        <Line
          x1={ARROW_X}
          y1={padY + 10}
          x2={ARROW_X}
          y2={DIAGRAM_HEIGHT - padY}
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={1.5}
          strokeDasharray="3,5"
          strokeLinecap="round"
        />
        <Path
          d={`M ${ARROW_X - 5} ${arrowHeadY + 8} L ${ARROW_X} ${arrowHeadY} L ${ARROW_X + 5} ${arrowHeadY + 8}`}
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={{ width: ARROW_GAP }} />
      <Svg width={TRUNK_SVG_WIDTH} height={DIAGRAM_HEIGHT}>
        <Line
          x1={TRUNK_X}
          y1={padY}
          x2={TRUNK_X}
          y2={DIAGRAM_HEIGHT - padY}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
        />
        {DIAGRAM_STEPS.map((s, i) => {
          const cy = padY + i * STEP_Y;
          return (
            <Circle
              key={s.id}
              cx={TRUNK_X}
              cy={cy}
              r={DOT_R}
              fill={s.color}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>
      <View style={{ width: LABELS_WIDTH, position: 'relative' }}>
        {DIAGRAM_STEPS.map((s, i) => {
          // Labels are absolutely-positioned strips anchored to each
          // dot's centre Y. Two-line labels (title + italic tagline)
          // need a slightly higher top so the BLOCK reads as centred
          // on the dot. Single-line labels (Introduction) get a
          // smaller offset so the title sits flush with the dot's
          // centre instead of floating above it.
          const cy = padY + i * STEP_Y;
          const yOffset = s.tagline ? 16 : 7;
          return (
            <View
              key={s.id}
              style={[styles.diagramLabelRow, { top: cy - yOffset }]}
            >
              <Text style={styles.diagramLabelTitle} numberOfLines={1}>
                {s.label}
              </Text>
              {s.tagline ? (
                <Text style={styles.diagramLabelTagline} numberOfLines={1}>
                  {s.tagline}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function SilentMindScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { columnMax } = useLayout();
  // The material-top-tabs bar is laid out BELOW the pager, so the scene
  // already excludes the tab-bar height — the screen only needs a small
  // air gap above the bar, not the full TAB_BAR_BASE. The old
  // useTabBarPadding() (= bar height + 16 ≈ 96 px) was dead space that
  // squeezed this single-screen layout and pushed the Enter button
  // under the bar on short viewports.
  const bottomPad = Math.max(insets.bottom, spacing.lg);

  // Size the tree to fill the space between the header and the Enter
  // button, rather than using a fixed step that either overflows (tall
  // tree on a short screen → button hidden) or leaves a dead gap under
  // the title (short tree on a roomy screen → what the A53 showed).
  //
  // Scene height ≈ window minus the bottom tab bar (material-top-tabs
  // lays the bar below the pager, so it's already excluded from the
  // scene — we approximate it with TAB_BAR_BASE). We then carve out
  // the header (measured), the caption + button (estimated), the
  // bottom pad, and a little inter-group breathing room; whatever
  // remains is the diagram's vertical budget. STEP_Y is clamped so the
  // dots never crowd their two-line labels (min) or sprawl on a very
  // tall screen (max = the original 56).
  const { height } = useWindowDimensions();
  const [headerH, setHeaderH] = useState(0);
  const CAPTION_EST = 64; // 2-line caption + its top margin
  const BUTTON_EST = 58; // pill + vertical padding
  const BREATHING = 56; // gaps space-between leaves around the groups
  const sceneH = height - TAB_BAR_BASE;
  const diagramBudget = sceneH - bottomPad - headerH - CAPTION_EST - BUTTON_EST - BREATHING;
  const rawStep = (diagramBudget - DIAGRAM_PAD_Y * 2) / (DIAGRAM_STEPS.length - 1);
  const stepY = Math.max(36, Math.min(56, Math.round(rawStep || 56)));

  // Slow continuous glow on the Enter CTA — accent-tinted box-shadow
  // pulses from a small soft halo to a wider, brighter one on a
  // 2.6 s sine cycle. No scale, no button-opacity change: only the
  // surrounding glow breathes so the button itself stays anchored
  // in place.
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [breath]);
  const enterBtnGlowStyle = useAnimatedStyle(() => {
    const t = breath.value;
    // accent = #9E3694 → rgb(158, 54, 148)
    const alpha = (0.22 + t * 0.42).toFixed(2);
    const blur = 8 + t * 12;
    return {
      boxShadow: `0 0 ${blur}px rgba(158, 54, 148, ${alpha})`,
    };
  });

  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="silent-mind">
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <View style={[styles.column, { maxWidth: columnMax }]}>
            {/* Measure the header height so the diagram can be sized to
                fill exactly the space left below it. */}
            <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
              <ProgramHeader
                eyebrow={silentMindProgram.eyebrow}
                title={silentMindProgram.title}
                description={silentMindProgram.intro}
                accent={colors.accent}
              />
            </View>

            {/* Diagram + caption block. The column's space-between puts
                even gaps above (to header) and below (to the button);
                the diagram's step size (stepY) is computed to fill the
                available height so it expands into the gap rather than
                sitting small and cropped. */}
            <View style={styles.diagramCenter}>
              <TreeDiagram stepY={stepY} />
              <Text style={styles.diagramCaption}>
                Walk the tree from the bottom up — each audio you
                complete unlocks the next step.
              </Text>
            </View>

            {/* Slot wrapper takes flex:1 to soak up the space below
                the diagram block and centres the Enter button inside,
                so the button sits halfway between the caption above
                and the tab bar below — equidistant regardless of
                screen height. The breath lives on an Animated.View
                wrapper around the Pressable (animatedProps on a
                Pressable's function-style don't reliably thread the
                animated values — wrapping is safer). */}
            <View style={styles.enterBtnSlot}>
              {/* Glow lives on an Animated.View wrapper so we can
                  animate a CSS-style boxShadow (RN 0.76+ supports it
                  cross-platform). The Pressable inside stays still —
                  only the halo behind it pulses. */}
              <Animated.View style={[styles.enterBtnGlow, enterBtnGlowStyle]}>
                <Pressable
                  onPress={() => router.push('/silent-mind-tree' as never)}
                  style={({ pressed }) => [
                    styles.enterBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.enterBtnLabel}>Enter</Text>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  // `minHeight` keeps the layout filling the viewport so the diagram
  // wrapper's flex sandwich actually has room to centre. Without it,
  // ScrollView collapses to content height and the diagram just sits
  // flush against the header.
  content: { alignItems: 'center', minHeight: '100%' },
  // space-between distributes the three groups — header, the
  // diagram+caption block, and the Enter button — with EQUAL gaps,
  // top to bottom. Previously two flex:1 sandwiches each centred their
  // own content, which crammed the diagram up against the header
  // (small gap) while the button floated with lots of space below.
  // Even gaps keep nothing squished on short screens (Galaxy A53 etc.).
  column: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  // Wrapper for the diagram + its caption — a natural-height block; the
  // column's space-between handles the gaps above (to header) and below
  // (to the button).
  diagramCenter: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  // Diagram block — trunk SVG + labels in a single row, centred as
  // a unit so the WHOLE block (trunk + labels) lands at the column
  // centre. Combined with the wider LABELS_WIDTH this keeps long
  // labels (Stability & Equanimity) from being clipped.
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'center',
    // height is set inline (depends on the compact step size).
    // Nudge the whole diagram (arrow + trunk + labels) to the right
    // of dead-centre so it sits closer to the visual centre line of
    // the iPhone after subtracting the bottom tab bar's perceived
    // weight on the left edge.
    marginLeft: spacing.xl,
  },
  diagramLabelRow: {
    position: 'absolute',
    left: spacing.sm,
    right: 0,
  },
  // Slightly smaller font + tighter tracking so longer labels fit on
  // a single line without truncation.
  diagramLabelTitle: {
    ...type.overline,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  diagramLabelTagline: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1,
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Short hint right under the diagram — restores a fragment of the
  // explainer prose without redundant repetition of the title block.
  // Extra top margin (xxl) gives the diagram and caption their own
  // breathing band rather than reading as a single block.
  diagramCaption: {
    ...type.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    // Caption belongs to the diagram (one block); keep it close. The
    // inter-group gaps are handled by the column's space-between.
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    // Match the diagram's right-shift so the caption sits visually
    // under the diagram column rather than under the page's
    // geometric centre — but apply the same shift on both edges so
    // the text itself has equal breathing room L / R (was visibly
    // closer to the right edge than the left).
    marginLeft: spacing.xl,
    marginRight: spacing.xl,
  },
  // Slot that hosts the Enter button — takes whatever vertical
  // space remains under the diagram and centres the button inside.
  // The result: Enter sits equidistant between the "Walk the tree…"
  // caption above and the tab bar below, regardless of screen size.
  enterBtnSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  // Wrapper that carries the pulsing accent boxShadow. Same border-
  // radius as the button so the shadow's silhouette matches the
  // pill outline; the wrapper itself has no fill or border.
  enterBtnGlow: {
    borderRadius: radius.pill,
  },
  enterBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl + spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'rgba(158,54,148,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterBtnLabel: {
    ...type.overline,
    color: colors.accent,
    fontSize: 13,
    letterSpacing: 2,
  },
  enterBtnChevron: {
    color: colors.accent,
    fontSize: 16,
    lineHeight: 16,
  },
});
