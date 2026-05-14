import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Line, Circle, Path } from 'react-native-svg';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { silentMindProgram } from '../../src/content/catalog';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout } from '../../src/hooks/useLayout';
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

const STEP_Y = 56;
const DOT_R = 10;
const DIAGRAM_PAD_Y = 14;
const DIAGRAM_HEIGHT = (DIAGRAM_STEPS.length - 1) * STEP_Y + DIAGRAM_PAD_Y * 2;
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

function TreeDiagram() {
  return (
    <View style={styles.diagramRow}>
      {/* Direction-of-travel hint — dashed vertical line + chevron
          pointing UP to signal "walk this from bottom to top". Sits
          to the LEFT of the trunk so it reads as a margin annotation
          rather than as part of the tree itself. */}
      <Svg width={ARROW_WIDTH} height={DIAGRAM_HEIGHT}>
        <Line
          x1={ARROW_X}
          y1={DIAGRAM_PAD_Y + 10}
          x2={ARROW_X}
          y2={DIAGRAM_HEIGHT - DIAGRAM_PAD_Y}
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={1.5}
          strokeDasharray="3,5"
          strokeLinecap="round"
        />
        <Path
          d={`M ${ARROW_X - 5} ${ARROW_HEAD_Y + 8} L ${ARROW_X} ${ARROW_HEAD_Y} L ${ARROW_X + 5} ${ARROW_HEAD_Y + 8}`}
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
          y1={DIAGRAM_PAD_Y}
          x2={TRUNK_X}
          y2={DIAGRAM_HEIGHT - DIAGRAM_PAD_Y}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
        />
        {DIAGRAM_STEPS.map((s, i) => {
          const cy = DIAGRAM_PAD_Y + i * STEP_Y;
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
          const cy = DIAGRAM_PAD_Y + i * STEP_Y;
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
  const tabPad = useTabBarPadding();
  const { columnMax } = useLayout();
  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="silent-mind">
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}>
          <View style={[styles.column, { maxWidth: columnMax }]}>
            <ProgramHeader
              eyebrow={silentMindProgram.eyebrow}
              title={silentMindProgram.title}
              description={silentMindProgram.intro}
              accent={colors.accent}
            />

            {/* Diagram lives in its own vertically-centred wrapper —
                the `flex: 1 / justifyContent: 'center'` sandwich
                between the header above and the Enter button below
                pushes the diagram to roughly the middle of the page
                without locking its exact Y. */}
            <View style={styles.diagramCenter}>
              <TreeDiagram />
              <Text style={styles.diagramCaption}>
                Walk the tree from the bottom up — each audio you
                complete unlocks the next step.
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/silent-mind-tree' as never)}
              style={({ pressed }) => [
                styles.enterBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.enterBtnLabel}>Enter</Text>
            </Pressable>
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
  column: { width: '100%', alignSelf: 'center', flex: 1 },
  // Vertical-centering wrapper for the diagram. flex:1 + center
  // pushes the diagram to the middle of the remaining space between
  // header and Enter button.
  diagramCenter: {
    flex: 1,
    justifyContent: 'center',
    // Android phones have less iPhone-style notch padding to absorb, so
    // we trim the diagram's vertical breathing room to keep the Enter
    // button visible above the fold without scrolling.
    paddingVertical: Platform.OS === 'android' ? spacing.xs : spacing.lg,
  },
  // Diagram block — trunk SVG + labels in a single row, centred as
  // a unit so the WHOLE block (trunk + labels) lands at the column
  // centre. Combined with the wider LABELS_WIDTH this keeps long
  // labels (Stability & Equanimity) from being clipped.
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'center',
    height: DIAGRAM_HEIGHT,
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
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    // Match the diagram's right-shift so the caption sits visually
    // under the diagram column rather than under the page's
    // geometric centre.
    marginLeft: spacing.xl,
  },
  enterBtn: {
    alignSelf: 'center',
    // Pushed down further from the diagram caption — gives the CTA
    // its own beat at the bottom of the page instead of crowding the
    // explainer text.
    marginTop: spacing.xxl + spacing.md,
    marginBottom: spacing.xl,
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
