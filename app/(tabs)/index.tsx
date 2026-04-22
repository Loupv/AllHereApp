import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { AnimatedGradient } from '../../src/components/AnimatedGradient';
import { BigPlayButton, type BigPlayMode } from '../../src/components/BigPlayButton';
import { AboutFooter } from '../../src/components/AboutFooter';
import { startJourneySteps } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress } from '../../src/player/progressStore';
import { colors, radius, spacing, type } from '../../src/theme';

type ModeKey = 'step-1min' | 'step-3min' | 'step-qm3';

const MODES: { key: ModeKey; big: BigPlayMode; label: string; sublabel: string; duration: string }[] = [
  { key: 'step-1min', big: 'one',   label: '1 MIN',      sublabel: 'Arrive in a single breath',        duration: '1 min' },
  { key: 'step-3min', big: 'three', label: '3 MIN',      sublabel: 'Settle a little deeper',            duration: '3 min' },
  { key: 'step-qm3',  big: 'qm3',   label: '3 × 3 MIN',  sublabel: 'Quantified Meditation · 3 rounds',  duration: '11 min' },
];

export default function StartScreen() {
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const { height } = useWindowDimensions();
  const playSize = Math.max(220, Math.min(320, Math.round(height / 3)));

  // Smart default: pick the first step the user hasn't listened to yet, so
  // reopening the home surfaces the next natural step. Falls back to 1 min.
  const defaultMode: ModeKey = useMemo(() => {
    for (const s of startJourneySteps) {
      if (s.track && !listened[s.track.id]) return s.id as ModeKey;
    }
    return 'step-1min';
  }, [listened]);
  const [mode, setMode] = useState<ModeKey>(defaultMode);

  const cfg = MODES.find(m => m.key === mode)!;
  const step = startJourneySteps.find(s => s.id === cfg.key);
  const track = step?.track;
  const isDone = !!(track && listened[track.id]);

  const onPlay = () => {
    if (!track) return;
    const pl = startJourneySteps.map(s => s.track).filter(Boolean) as any;
    openPlayer(track, pl);
  };

  const allDone = startJourneySteps.every(s => s.track && listened[s.track.id]);

  return (
    <View style={styles.root}>
      <SwipeTabs current="index">
        <AnimatedGradient>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>MEDITATION · STEP BY STEP</Text>
              <Text style={styles.title}>To the Silent Mind</Text>
            </View>

            <View style={styles.center}>
              <BigPlayButton
                mode={cfg.big}
                label={isDone ? `LISTEN AGAIN · ${cfg.label}` : `START WITH ${cfg.label}`}
                sublabel={cfg.sublabel}
                size={playSize}
                onPress={onPlay}
              />
            </View>

            <View style={styles.radioRow}>
              {MODES.map(m => {
                const selected = m.key === mode;
                const done = (() => {
                  const s = startJourneySteps.find(s => s.id === m.key);
                  return !!(s?.track && listened[s.track.id]);
                })();
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMode(m.key)}
                    hitSlop={6}
                    style={styles.radio}
                  >
                    <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
                      {selected ? <View style={styles.radioDotInner} /> : null}
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
                        {m.label}
                      </Text>
                      <Text style={styles.radioDuration}>{m.duration}{done ? ' · ✓' : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {allDone ? (
              <Pressable
                onPress={() => router.push('/silent-mind')}
                style={({ pressed }) => [styles.explore, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.exploreEyebrow}>READY FOR MORE ?</Text>
                <Text style={styles.exploreTitle}>Explore the Silent Mind Program →</Text>
              </Pressable>
            ) : null}

            <View style={styles.footerSpacer} />
            <AboutFooter />
          </View>
        </AnimatedGradient>
      </SwipeTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  eyebrow: {
    ...type.overline, color: colors.accent,
    marginBottom: spacing.sm, fontSize: 11, letterSpacing: 3,
  },
  title: {
    ...type.display, color: colors.text,
    fontSize: 26, lineHeight: 32, textAlign: 'center',
  },

  center: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.xl },

  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  radio: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  radioDot: {
    width: 18, height: 18, borderRadius: 9,
    borderColor: 'rgba(255,255,255,0.45)', borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  radioDotSelected: { borderColor: colors.accent },
  radioDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  radioLabel: {
    ...type.overline, fontSize: 10, letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.55)', textAlign: 'center',
  },
  radioLabelSelected: { color: colors.text },
  radioDuration: {
    ...type.caption, color: colors.textMuted, fontSize: 10,
    marginTop: 2,
  },

  explore: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 4,
  },
  exploreEyebrow: { ...type.overline, color: colors.accent, fontSize: 10 },
  exploreTitle: { ...type.h2, color: colors.text, fontSize: 14, textAlign: 'center' },

  footerSpacer: { flex: 1, minHeight: spacing.xl },
});
