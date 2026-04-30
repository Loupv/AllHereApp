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
  introWelcome: require('../../assets/audio/Part0/1. Welcome.mp3'),
  introSilentMind: require('../../assets/audio/Part0/2. Silent Mind.mp3'),
  introQMFormat: require('../../assets/audio/Part0/4. QM Format.mp3'),
  homeOneMin: require('../../assets/audio/Home/One minute meditation.mp3'),
  homeThreeMin: require('../../assets/audio/Home/Three minutes meditation.mp3'),
  bell: require('../../assets/audio/bell.mp3'),
  bellShort: require('../../assets/audio/bell_short.mp3'),
  tick: require('../../assets/audio/tick.mp3'),
  // QM3 Home rounds
  qm3Br1: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.mp3'),
  qm3Br2: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.mp3'),
  qm3Br3: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.mp3'),
  qm3Inter1: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.mp3'),
  qm3Inter2: require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.mp3'),
} as const;

export const BUNDLED_TRANSCRIPTS = {
  introWelcome: require('../../assets/audio/Part0/Words/1. Welcome.wjson'),
  introSilentMind: require('../../assets/audio/Part0/Words/2. Silent Mind.wjson'),
  introQMFormat: require('../../assets/audio/Part0/Words/4. QM Format.wjson'),
  homeOneMin: require('../../assets/audio/Home/Words/One minute meditation.wjson'),
  homeThreeMin: require('../../assets/audio/Home/Words/Three minutes meditation.wjson'),
  qm3: require('../../assets/audio/QMPart1/Words/QM3_7rounds_Breath and Self-Observation.wjson'),
} as const;

const BASE_URL = 'https://allhere.org/wp-content/uploads/AllHere_NewApp';

// Remote audio sources (served from WordPress)
const REMOTE_PATTERN = (path: string) => `${BASE_URL}/${path}`;

/**
 * Get audio source for a track ID (and optional round number for QM tracks)
 * @param trackId - The track identifier (e.g., 'p1-1' or 'qm1-2')
 * @param roundIndex - Optional round index (0-based) for multi-round QM tracks
 * @returns { bundled?, remote? } or null if not found
 */
export function getAudioSource(trackId: string, roundIndex?: number): AudioSource | null {
  // Map bundled track IDs to their audio sources
  const bundledMap: Record<string, number> = {
    'intro-1': BUNDLED_AUDIO.introWelcome,
    'intro-2': BUNDLED_AUDIO.introSilentMind,
    'intro-4': BUNDLED_AUDIO.introQMFormat,
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
    return { remote: REMOTE_PATTERN(remoteMap[trackId]) };
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
    return { remote: REMOTE_PATTERN(`${folder}/${fileName}`) };
  }

  return null;
}

/**
 * Get transcript source for a track ID (and optional round number for QM tracks)
 * @param trackId - The track identifier
 * @param roundIndex - Optional round index (0-based) for multi-round QM tracks
 */
export function getTranscriptSource(trackId: string, roundIndex?: number): AudioSource | null {
  const bundledMap: Record<string, number> = {
    'intro-1': BUNDLED_TRANSCRIPTS.introWelcome,
    'intro-2': BUNDLED_TRANSCRIPTS.introSilentMind,
    'intro-4': BUNDLED_TRANSCRIPTS.introQMFormat,
    'home-1min': BUNDLED_TRANSCRIPTS.homeOneMin,
    'home-3min': BUNDLED_TRANSCRIPTS.homeThreeMin,
    'qm3-home': BUNDLED_TRANSCRIPTS.qm3,
  };

  if (trackId in bundledMap) {
    return { bundled: bundledMap[trackId] };
  }

  // Map remote transcripts by explicit filename mapping
  const remoteMap: Record<string, string> = {
    'p1-1': 'Part1/Words/1 - Turning Inward (Eyes-open, introductory practice).wjson',
    'p1-2': 'Part1/Words/2 - Self-Observation and Breath Following.wjson',
    'p1-3': 'Part1/Words/3 - Center of Gravity.wjson',
    'p2-1': 'Part2/Words/1 - Follow the Air.wjson',
    'p2-2': 'Part2/Words/2 - Follow and witness the Air.wjson',
    'p2-3': 'Part2/Words/3 - Unfollow and witness the air.wjson',
    'p3-1': 'Part2/Words/4 - Emptiness.wjson',
  };

  if (trackId in remoteMap) {
    return { remote: REMOTE_PATTERN(remoteMap[trackId]) };
  }

  // Handle QM track transcripts with rounds
  const qmTranscriptMap: Record<string, { folder: string; pattern: string }> = {
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

  if (trackId in qmTranscriptMap && roundIndex !== undefined) {
    const { folder, pattern } = qmTranscriptMap[trackId];
    const roundNum = String(roundIndex + 1).padStart(2, '0');
    const fileName = `${pattern}${roundNum}.wjson`;
    return { remote: REMOTE_PATTERN(`${folder}/${fileName}`) };
  }

  return null;
}

/**
 * Check if a track ID is bundled (no download needed)
 */
export function isBundled(trackId: string): boolean {
  const bundledMap: Record<string, number> = {
    'intro-1': BUNDLED_AUDIO.introWelcome,
    'intro-2': BUNDLED_AUDIO.introSilentMind,
    'intro-4': BUNDLED_AUDIO.introQMFormat,
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
    return { remote: REMOTE_PATTERN(`${config.folder}/${fileName}`) };
  }

  return null;
}

/**
 * Get inter transcript source for QM tracks
 */
export function getInterTranscriptSource(trackId: string, interIndex: number): AudioSource | null {
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
    const fileName = `${config.pattern}${interNum}_inter.wjson`;
    return { remote: REMOTE_PATTERN(`${config.folder}/${fileName}`) };
  }

  return null;
}

/**
 * Get WordPress base URL for custom audio paths
 */
export function getRemoteUrl(path: string): string {
  return REMOTE_PATTERN(path);
}
