/**
 * Audio source registry: maps track IDs to bundled (require) or remote (URL) sources.
 * Single source of truth for audio source resolution.
 */

export type AudioSource = {
  bundled?: number; // require() module ID
  remote?: string; // URL string
};

// Bundled audio sources (included in app build) — exported for use in catalog.ts
export const BUNDLED_AUDIO = {
  homeOneMin: require('../../assets/audio/Home/One minute meditation.mp3'),
  homeThreeMin: require('../../assets/audio/Home/Three minutes meditation.mp3'),
  bell: require('../../assets/audio/bell.mp3'),
  bellShort: require('../../assets/audio/bell_short.mp3'),
  tick: require('../../assets/audio/tick.mp3'),
  // QM3 Home rounds (first 3 rounds only, bundled for offline home practice)
  qm3Br1: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.mp3'),
  qm3Br2: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.mp3'),
  qm3Br3: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.mp3'),
  qm3Inter1: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.mp3'),
  qm3Inter2: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.mp3'),
} as const;

// All transcripts are bundled (small .wjson files, ~5KB each, total ~250KB).
// The audio .mp3 stay remote on WordPress, but transcripts must be local for offline playback.
export const BUNDLED_TRANSCRIPTS = {
  homeOneMin: require('../../assets/audio/Home/Words/One minute meditation.wjson'),
  homeThreeMin: require('../../assets/audio/Home/Words/Three minutes meditation.wjson'),
  // Part0 (intro)
  introWelcome: require('../../assets/audio/Part0/Words/1. Welcome.wjson'),
  introSilentMind: require('../../assets/audio/Part0/Words/2. Silent Mind.wjson'),
  introPrepareSpace: require('../../assets/audio/Part0/Words/3. Prepare the space.wjson'),
  introQMFormat: require('../../assets/audio/Part0/Words/4. QM Format.wjson'),
  // Part1
  p1_1: require('../../assets/audio/Part1/Words/1 - Turning Inward (Eyes-open, introductory practice).wjson'),
  p1_2: require('../../assets/audio/Part1/Words/2 - Self-Observation and Breath Following.wjson'),
  p1_3: require('../../assets/audio/Part1/Words/3 - Center of Gravity.wjson'),
  // Part2
  p2_1: require('../../assets/audio/Part2/Words/1 - Follow the Air.wjson'),
  p2_2: require('../../assets/audio/Part2/Words/2 - Follow and witness the Air.wjson'),
  p2_3: require('../../assets/audio/Part2/Words/3 - Unfollow and witness the air.wjson'),
  p3_1: require('../../assets/audio/Part2/Words/4 - Emptiness.wjson'),
  // QMPart1 — QM3 (overall + per-round)
  qm3: require('../../assets/audio/QMPart1/Words/QM3_7rounds_Breath and Self-Observation.wjson'),
  qm3_round1: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.wjson'),
  qm3_round2: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.wjson'),
  qm3_round3: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.wjson'),
  qm3_round4: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round04.wjson'),
  qm3_round5: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round05.wjson'),
  qm3_round6: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round06.wjson'),
  qm3_round7: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round07.wjson'),
  qm3_inter1: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.wjson'),
  qm3_inter2: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.wjson'),
  qm3_inter3: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03_inter.wjson'),
  qm3_inter4: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round04_inter.wjson'),
  qm3_inter5: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round05_inter.wjson'),
  qm3_inter6: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round06_inter.wjson'),
  // QMPart1 — QM5 (Center of Gravity)
  qm5: require('../../assets/audio/QMPart1/Words/QM5_5rounds_Center of Gravity.wjson'),
  qm5_round1: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round01.wjson'),
  qm5_round2: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round02.wjson'),
  qm5_round3: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round03.wjson'),
  qm5_round4: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round04.wjson'),
  qm5_round5: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round05.wjson'),
  qm5_inter1: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round01_inter.wjson'),
  qm5_inter2: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round02_inter.wjson'),
  qm5_inter3: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round03_inter.wjson'),
  qm5_inter4: require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round04_inter.wjson'),
  // QMPart2 — QM3 6rounds Unfollow and Witness
  qm23_unfollow: require('../../assets/audio/QMPart2/Words/QM3_6rounds_ErkinGuided_UnfollowAndWitness.wjson'),
} as const;

import { WP_AUDIO_MAP } from './wpAudioMap.generated';

/**
 * Resolve a remote audio path to its public WordPress URL. We pass paths in
 * the legacy `Folder/Original Name.mp3` shape (which mirrors how the assets
 * are organized on disk); the WP_AUDIO_MAP keys are the basenames, so we
 * strip the folder. WP flattens uploads to /YYYY/MM/<sanitized>.mp3 and
 * gen-wp-audio-map.mjs is the source of truth for that translation.
 */
const REMOTE_PATTERN = (path: string): string | null => {
  const filename = path.split('/').pop()!;
  return WP_AUDIO_MAP[filename] ?? null;
};

/**
 * Get audio source for a track ID (and optional round number for QM tracks)
 * @param trackId - The track identifier (e.g., 'p1-1' or 'qm1-2')
 * @param roundIndex - Optional round index (0-based) for multi-round QM tracks
 * @returns { bundled?, remote? } or null if not found
 */
export function getAudioSource(trackId: string, roundIndex?: number): AudioSource | null {
  // home-qm3 (the Start screen "QM · Three rounds" quick CTA) walks
  // through the same bundled QM3 audio as the per-round entries below,
  // but indexed by roundIndex 0..2 instead of having distinct track
  // ids. resolveAudioSource is called with track.id='home-qm3' +
  // roundIndex, so we have to handle that shape here too — otherwise
  // the resolve threw "Audio source not found" and the Player got
  // stuck loading.
  if (trackId === 'home-qm3' && roundIndex !== undefined) {
    const homeQm3Rounds = [BUNDLED_AUDIO.qm3Br1, BUNDLED_AUDIO.qm3Br2, BUNDLED_AUDIO.qm3Br3];
    const src = homeQm3Rounds[roundIndex];
    if (src !== undefined) return { bundled: src };
  }

  // Map bundled track IDs to their audio sources
  const bundledMap: Record<string, number> = {
    'home-1min': BUNDLED_AUDIO.homeOneMin,
    'home-3min': BUNDLED_AUDIO.homeThreeMin,
    'qm3-home-round-01': BUNDLED_AUDIO.qm3Br1,
    'qm3-home-round-02': BUNDLED_AUDIO.qm3Br2,
    'qm3-home-round-03': BUNDLED_AUDIO.qm3Br3,
    'qm3-home-inter-01': BUNDLED_AUDIO.qm3Inter1,
    'qm3-home-inter-02': BUNDLED_AUDIO.qm3Inter2,
  };

  if (trackId in bundledMap) {
    return { bundled: bundledMap[trackId] };
  }

  // Map remote tracks by explicit ID → filename mapping
  const remoteMap: Record<string, string> = {
    // Part0 (intro tracks — remote)
    'intro-1': 'Part0/1. Welcome.mp3',
    'intro-2': 'Part0/2. Silent Mind.mp3',
    'intro-4': 'Part0/4. QM Format.mp3',
    // Part1
    'p1-1': 'Part1/1 - Turning Inward (Eyes-open, introductory practice).mp3',
    'p1-2': 'Part1/2 - Self-Observation and Breath Following.mp3',
    'p1-3': 'Part1/3 - Center of Gravity.mp3',
    // Part2
    'p2-1': 'Part2/1 - Follow the Air.mp3',
    'p2-2': 'Part2/2 - Follow and witness the Air.mp3',
    'p2-3': 'Part2/3 - Unfollow and witness the air.mp3',
    // Part3
    'p3-1': 'Part2/4 - Emptiness.mp3',
  };

  if (trackId in remoteMap) {
    const url = REMOTE_PATTERN(remoteMap[trackId]);
    return url ? { remote: url } : null;
  }

  // Handle QM tracks with rounds
  const qmRoundMap: Record<string, { folder: string; pattern: string }> = {
    'qm1-2': {
      folder: 'QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation',
      pattern: 'breath7_round',
    },
    'qm1-4': {
      folder: 'QMPart1/Rounds/QM5_5rounds_Center of Gravity',
      pattern: 'gravity5_round',
    },
    'qm2-3': {
      folder: 'QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness',
      pattern: 'unfollow6_round',
    },
  };

  if (trackId in qmRoundMap && roundIndex !== undefined) {
    const { folder, pattern } = qmRoundMap[trackId];
    const roundNum = String(roundIndex + 1).padStart(2, '0');
    const fileName = `${pattern}${roundNum}.mp3`;
    const url = REMOTE_PATTERN(`${folder}/${fileName}`);
    return url ? { remote: url } : null;
  }

  return null;
}

/**
 * Get transcript source for a track ID (and optional round number for QM tracks)
 * @param trackId - The track identifier
 * @param roundIndex - Optional round index (0-based) for multi-round QM tracks
 */
export function getTranscriptSource(
  trackId: string,
  roundIndex?: number,
  isInter?: boolean,
): AudioSource | null {
  // QM rounds — per-round/per-inter transcripts
  if (roundIndex !== undefined) {
    const roundNum = roundIndex + 1;
    if (trackId === 'qm1-2') {
      const key = isInter
        ? `qm3_inter${roundNum}` as keyof typeof BUNDLED_TRANSCRIPTS
        : `qm3_round${roundNum}` as keyof typeof BUNDLED_TRANSCRIPTS;
      const t = BUNDLED_TRANSCRIPTS[key];
      if (t !== undefined) return { bundled: t };
    }
    if (trackId === 'qm1-4') {
      const key = isInter
        ? `qm5_inter${roundNum}` as keyof typeof BUNDLED_TRANSCRIPTS
        : `qm5_round${roundNum}` as keyof typeof BUNDLED_TRANSCRIPTS;
      const t = BUNDLED_TRANSCRIPTS[key];
      if (t !== undefined) return { bundled: t };
    }
    // qm2-3: only the overall transcript is bundled (per-round wjson not present)
    if (trackId === 'qm2-3') return { bundled: BUNDLED_TRANSCRIPTS.qm23_unfollow };
  }

  // Single-track transcripts
  const bundledMap: Record<string, number> = {
    'home-1min': BUNDLED_TRANSCRIPTS.homeOneMin,
    'home-3min': BUNDLED_TRANSCRIPTS.homeThreeMin,
    'qm3-home': BUNDLED_TRANSCRIPTS.qm3,
    // Part0 (intro)
    'intro-1': BUNDLED_TRANSCRIPTS.introWelcome,
    'intro-2': BUNDLED_TRANSCRIPTS.introSilentMind,
    'intro-3': BUNDLED_TRANSCRIPTS.introPrepareSpace,
    'intro-4': BUNDLED_TRANSCRIPTS.introQMFormat,
    // Part1
    'p1-1': BUNDLED_TRANSCRIPTS.p1_1,
    'p1-2': BUNDLED_TRANSCRIPTS.p1_2,
    'p1-3': BUNDLED_TRANSCRIPTS.p1_3,
    // Part2
    'p2-1': BUNDLED_TRANSCRIPTS.p2_1,
    'p2-2': BUNDLED_TRANSCRIPTS.p2_2,
    'p2-3': BUNDLED_TRANSCRIPTS.p2_3,
    // Part3
    'p3-1': BUNDLED_TRANSCRIPTS.p3_1,
    // QM track-level transcripts (overall)
    'qm1-2': BUNDLED_TRANSCRIPTS.qm3,
    'qm1-4': BUNDLED_TRANSCRIPTS.qm5,
    'qm2-3': BUNDLED_TRANSCRIPTS.qm23_unfollow,
  };

  if (trackId in bundledMap) {
    return { bundled: bundledMap[trackId] };
  }

  return null;
}

/**
 * Check if a track ID is bundled (no download needed)
 */
export function isBundled(trackId: string): boolean {
  const bundledMap: Record<string, number> = {
    'home-1min': BUNDLED_AUDIO.homeOneMin,
    'home-3min': BUNDLED_AUDIO.homeThreeMin,
    'qm3-home-round-01': BUNDLED_AUDIO.qm3Br1,
    'qm3-home-round-02': BUNDLED_AUDIO.qm3Br2,
    'qm3-home-round-03': BUNDLED_AUDIO.qm3Br3,
    'qm3-home-inter-01': BUNDLED_AUDIO.qm3Inter1,
    'qm3-home-inter-02': BUNDLED_AUDIO.qm3Inter2,
  };
  return trackId in bundledMap;
}

/**
 * Get inter/break audio source for QM tracks
 * @param trackId - The track identifier (e.g., 'qm1-2')
 * @param interIndex - Inter index (0-based, between rounds)
 */
export function getInterSource(trackId: string, interIndex: number): AudioSource | null {
  // home-qm3: bundled inters (only 2 — between rounds 1-2 and 2-3).
  if (trackId === 'home-qm3') {
    const homeQm3Inters = [BUNDLED_AUDIO.qm3Inter1, BUNDLED_AUDIO.qm3Inter2];
    const src = homeQm3Inters[interIndex];
    return src !== undefined ? { bundled: src } : null;
  }
  const qmInterMap: Record<string, { folder: string; pattern: string; maxInters: number }> = {
    'qm1-2': {
      folder: 'QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation',
      pattern: 'breath7_round',
      maxInters: 6,
    },
    'qm1-4': {
      folder: 'QMPart1/Rounds/QM5_5rounds_Center of Gravity',
      pattern: 'gravity5_round',
      maxInters: 4,
    },
    'qm2-3': {
      folder: 'QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness',
      pattern: 'unfollow6_round',
      maxInters: 5,
    },
  };

  if (trackId in qmInterMap) {
    const config = qmInterMap[trackId];
    if (interIndex >= config.maxInters) return null;
    const interNum = String(interIndex + 1).padStart(2, '0');
    const fileName = `${config.pattern}${interNum}_inter.mp3`;
    const url = REMOTE_PATTERN(`${config.folder}/${fileName}`);
    return url ? { remote: url } : null;
  }

  return null;
}

/**
 * Get inter transcript source for QM tracks (bundled — transcripts are always local)
 */
export function getInterTranscriptSource(trackId: string, interIndex: number): AudioSource | null {
  const interNum = interIndex + 1;
  if (trackId === 'qm1-2') {
    const t = BUNDLED_TRANSCRIPTS[`qm3_inter${interNum}` as keyof typeof BUNDLED_TRANSCRIPTS];
    if (t !== undefined) return { bundled: t };
  }
  if (trackId === 'qm1-4') {
    const t = BUNDLED_TRANSCRIPTS[`qm5_inter${interNum}` as keyof typeof BUNDLED_TRANSCRIPTS];
    if (t !== undefined) return { bundled: t };
  }
  // qm2-3: per-inter wjson not present, use overall transcript
  if (trackId === 'qm2-3') return { bundled: BUNDLED_TRANSCRIPTS.qm23_unfollow };

  return null;
}

/**
 * Get WordPress URL for a given local audio path. Returns null if not on WP.
 */
export function getRemoteUrl(path: string): string | null {
  return REMOTE_PATTERN(path);
}
