export type RoundsConfig = {
  max: number;
  roundLengthMinutes: number;
  defaultRounds?: number;
  breakSeconds: number;
  roundSources?: number[];
  roundTranscripts?: number[];
  // Interstitial audio played during the break between rounds (optional).
  // If present at index i, plays between round i+1 and round i+2.
  roundInters?: (number | null)[];
  roundInterTranscripts?: (number | null)[];
  introSource?: number;
  introTranscript?: number;
};

/**
 * Optional rich description: each entry is a paragraph rendered on its own
 * line with its own weight / style. `\n` inside `text` adds a hard line break
 * within the same paragraph, which lets a title wrap to two lines while
 * staying in the same visual block.
 */
export type DescriptionLine = {
  text: string;
  style?: 'bold' | 'italic' | 'normal';
};

export type AudioTrack = {
  id: string;
  title: string;
  source?: number;
  transcript?: number;
  durationHint?: string;
  artwork?: number;
  description?: string | DescriptionLine[];
  rounds?: RoundsConfig;
  comingSoon?: boolean;
};

/**
 * Locate the program the given track belongs to, so UI can link back to
 * the matching tab. Returns 'silent-mind' when the id is found in any
 * silentMindVolets track, 'qm' when found in qmVolets, or null for
 * home-only tracks (the Start journey audios) or anything else.
 */
export function trackProgram(id: string): 'silent-mind' | 'qm' | null {
  for (const v of silentMindVolets) {
    if (v.tracks.some(t => t.id === id)) return 'silent-mind';
  }
  for (const v of qmVolets) {
    if (v.tracks.some(t => t.id === id)) return 'qm';
  }
  return null;
}

/**
 * Locate where a track sits in the journey for the discreet
 * "INTRODUCTION · 1 / 3" style eyebrow shown above the round CTA in
 * the Player. Walks Silent Mind volets first (intro → part1 → part2 →
 * part3, including each part's QM tail tracks) then QM volets — same
 * order as the Start screen's `journeyTracks`.
 */
export function trackLocation(
  id: string,
): { label: string; position: number; total: number } | undefined {
  type Section = { label: string; tracks: AudioTrack[] };
  const sections: Section[] = [
    ...silentMindVolets.map(v => ({
      // Fall back to subtitle when title is empty — the intro volet
      // has `title: ''` (we removed the redundant "Introduction"
      // eyebrow) but we still want a meaningful label here, e.g.
      // "INTRODUCTION · 1 / 3" instead of " · 1 / 3".
      label: v.title || v.subtitle || '',
      tracks: [...v.tracks, ...(v.qmTracks ?? [])].filter(t => !t.comingSoon),
    })),
    ...qmVolets.map(v => ({
      label: `QM · ${v.title || v.subtitle || ''}`,
      tracks: v.tracks.filter(t => !t.comingSoon),
    })),
  ];
  for (const s of sections) {
    const idx = s.tracks.findIndex(t => t.id === id);
    if (idx >= 0 && s.tracks.length > 0) {
      return { label: s.label, position: idx + 1, total: s.tracks.length };
    }
  }
  return undefined;
}

/**
 * Display duration for a track:
 * - explicit durationHint wins (e.g. "20:54" or "11 min")
 * - otherwise derive from a QM rounds config: rounds × round length + breaks
 * - else undefined (no pill shown)
 */
export function trackDuration(t: AudioTrack): string | undefined {
  if (t.durationHint) return t.durationHint;
  const r = t.rounds;
  if (r) {
    const totalMin = r.max * r.roundLengthMinutes + (r.max - 1);
    return `${totalMin} min`;
  }
  return undefined;
}

export type Volet = {
  id: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  description?: string;
  image?: number;
  tracks: AudioTrack[];
  qmTracks?: AudioTrack[];
  locked?: boolean;
  lockedMessage?: string;
};

export const silentMindProgram = {
  eyebrow: 'Silent Mind Program',
  title: 'The Three-Part Journey',
  intro:
    'Our program trains Meditative Attention,\n' +
    'leading to Stability and Silence of Mind.',
  banner: require('../../assets/images/hero/space.jpg'),
};

/**
 * Introduction audios. Previously wrapped in a Silent Mind "intro"
 * volet, now promoted to a first-class list surfaced directly on the
 * Start page — the intro is the welcome onto the app itself, not a
 * sub-part of the Silent Mind program.
 */
export const introAudios: AudioTrack[] = [
  {
    id: 'intro-1', title: 'Welcome',
    source: require('../../assets/audio/Part0/1. Welcome.mp3'),
    transcript: require('../../assets/audio/Part0/Words/1. Welcome.wjson'),
    durationHint: '2:30',
    description: "Welcome to the Silent Mind program, All Here's journey into a quiet and attentive way of being. A vertical progression toward advanced meditation practice.",
  },
  // 'Prepare the space' (intro-3) is intentionally pulled for now —
  // tracking the change here so it's easy to restore: the asset files
  // still exist under assets/audio/Part0/, just unreferenced.
  {
    id: 'intro-2', title: 'Silent Mind',
    source: require('../../assets/audio/Part0/2. Silent Mind.mp3'),
    transcript: require('../../assets/audio/Part0/Words/2. Silent Mind.wjson'),
    durationHint: '2:17',
    description: "At the heart of our practice is the development of the Silent Mind — a practical method to reduce fluctuations of consciousness and cultivate a profound inner presence.",
  },
  {
    id: 'intro-4', title: 'QM Training',
    source: require('../../assets/audio/Part0/4. QM Format.mp3'),
    transcript: require('../../assets/audio/Part0/Words/4. QM Format.wjson'),
    durationHint: '1:13',
    description: [
      { text: 'An introduction to the\nQuantified Meditation format', style: 'bold' },
      { text: 'High intensity training', style: 'italic' },
      { text: 'Multiple rounds, short breaks', style: 'italic' },
      { text: 'Train to reproduce the same meditative state on demand', style: 'italic' },
    ],
  },
];

export const silentMindVolets: Volet[] = [
  // Intro volet — wraps the introAudios array so the prologue lives
  // inside the Silent Mind program tree (same data shape as parts).
  // The Start page's big play button walks this volet first, then
  // Part 1 → 2 → 3, mirroring the user's journey.
  {
    id: 'intro',
    title: '',
    subtitle: 'Introduction',
    // No tagline on the intro card — the three numbered parts each
    // carry a poetic tagline (The Earth / Sky / Space), but the intro
    // is meant to read as a quiet single-line entry, just "Introduction".
    description:
      'Three short audios to get oriented: who we are, what the Silent Mind is, and how QM Training complements it.',
    tracks: introAudios,
  },
  {
    id: 'part1',
    title: 'Part 1',
    subtitle: 'Mind-Body',
    tagline: 'The Earth',
    description:
      'Enhance attention and self-awareness through mind-body connection and reduction of the mental noise.',
    image: require('../../assets/images/hero/earth.jpg'),
    tracks: [
      {
        id: 'p1-1', title: 'Turning Inward',
        source: require('../../assets/audio/Part1/1 - Turning Inward (Eyes-open, introductory practice).mp3'),
        transcript: require('../../assets/audio/Part1/Words/1 - Turning Inward (Eyes-open, introductory practice).wjson'),
        durationHint: '19:24',
        description: 'An introductory eyes-open practice. Find a suitable, comfortable location away from disturbance, then turn the attention of the mind gently inward.',
      },
      {
        id: 'p1-2', title: 'Breath and Self-Observation',
        source: require('../../assets/audio/Part1/2 - Self-Observation and Breath Following.mp3'),
        transcript: require('../../assets/audio/Part1/Words/2 - Self-Observation and Breath Following.wjson'),
        durationHint: '20:54',
        description: 'Turn the attention of the mind towards the breathing body — moving from thoughts to the breath, then to observing the breath itself.',
      },
      {
        id: 'p1-3', title: 'Center of Gravity',
        source: require('../../assets/audio/Part1/3 - Center of Gravity.mp3'),
        transcript: require('../../assets/audio/Part1/Words/3 - Center of Gravity.wjson'),
        durationHint: '23:48',
        description: 'The Center of Gravity practice — strongly related to the sense of self, developing internal presence and stable anchoring of attention.',
      },
    ],
    qmTracks: [
      {
        id: 'qm1-2', title: 'Breath and Self-Observation',
        transcript: require('../../assets/audio/QMPart1/Words/QM3_7rounds_Breath and Self-Observation.wjson'),
        description: 'Turn the mind towards the breathing process — notice the body exhaling, inhaling, then resting attention on the natural breath.',
        rounds: {
          max: 7, roundLengthMinutes: 3, breakSeconds: 60,
          roundSources: [
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round04.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round05.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round06.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round07.mp3'),
          ],
          roundTranscripts: [
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round04.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round05.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round06.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round07.wjson'),
          ],
          roundInters: [
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round04_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round05_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round06_inter.mp3'),
          ],
          roundInterTranscripts: [
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round04_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round05_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round06_inter.wjson'),
          ],
        },
      },
      {
        id: 'qm1-4', title: 'Center of Gravity',
        transcript: require('../../assets/audio/QMPart1/Words/QM5_5rounds_Center of Gravity.wjson'),
        description: 'Start with a long exhalation — empty yourself of air, then let the body inhale freely. Deepen into the Center of Gravity practice.',
        rounds: {
          max: 5, roundLengthMinutes: 5, breakSeconds: 60,
          roundSources: [
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round01.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round02.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round03.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round04.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round05.mp3'),
          ],
          roundTranscripts: [
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round01.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round02.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round03.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round04.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round05.wjson'),
          ],
          roundInters: [
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round01_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round02_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round03_inter.mp3'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round04_inter.mp3'),
          ],
          roundInterTranscripts: [
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round01_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round02_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round03_inter.wjson'),
            require('../../assets/audio/QMPart1/Rounds/QM5_5rounds_Center of Gravity/gravity5_round04_inter.wjson'),
          ],
        },
      },
    ],
  },
  {
    id: 'part2',
    title: 'Part 2',
    subtitle: 'Stability & Equanimity',
    tagline: 'The Sky',
    description:
      'Deepen practice with breath observation and gravity center focus. Develop sustained attention and mental stability through real-time visual feedback.',
    image: require('../../assets/images/hero/sky.jpg'),
    tracks: [
      {
        id: 'p2-1', title: 'Follow the Air',
        source: require('../../assets/audio/Part2/1 - Follow the Air.mp3'),
        transcript: require('../../assets/audio/Part2/Words/1 - Follow the Air.wjson'),
        durationHint: '13:42',
        description: 'Follow the air coming in and going out of your body. Feel the flow and settle into the natural rhythm of breathing.',
      },
      {
        id: 'p2-2', title: 'Follow and witness the Air',
        source: require('../../assets/audio/Part2/2 - Follow and witness the Air.mp3'),
        transcript: require('../../assets/audio/Part2/Words/2 - Follow and witness the Air.wjson'),
        durationHint: '26:35',
        description: 'Follow the airflow, then step back and witness its movement. A transition from active following to quiet observation.',
      },
      {
        id: 'p2-3', title: 'Unfollow and witness the air',
        source: require('../../assets/audio/Part2/3 - Unfollow and witness the air.mp3'),
        transcript: require('../../assets/audio/Part2/Words/3 - Unfollow and witness the air.wjson'),
        durationHint: '21:00',
        description: 'Stabilize the mind and its attention on a single, very subtle object: the air. Observe the airflow without trying to follow it.',
      },
    ],
    qmTracks: [
      // 'Cosmic Sky' (qm2-2) is intentionally pulled for now — the
      // SM Part 2 sequence currently has no matching guidance for it,
      // so it would unlock as an orphan QM with no SM counterpart.
      // Asset files still exist under assets/audio/QMPart2/, just
      // unreferenced; flip back when an SM "Cosmic Sky" lands.
      {
        id: 'qm2-3', title: 'Unfollow and Witness the Air',
        transcript: require('../../assets/audio/QMPart2/Words/QM3_6rounds_ErkinGuided_UnfollowAndWitness.wjson'),
        description: "QM3 training by All Here — designed to train the ability to quickly mobilize presence. Six rounds of three minutes each with one-minute breaks in between.",
        rounds: {
          max: 6, roundLengthMinutes: 3, breakSeconds: 60,
          introSource: require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_intro.mp3'),
          introTranscript: require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_intro.wjson'),
          roundSources: [
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round01.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round02.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round03.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round04.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round05.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round06.mp3'),
          ],
          roundTranscripts: [
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round01.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round02.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round03.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round04.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round05.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round06.wjson'),
          ],
          roundInters: [
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round01_inter.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round02_inter.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round03_inter.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round04_inter.mp3'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round05_inter.mp3'),
          ],
          roundInterTranscripts: [
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round01_inter.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round02_inter.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round03_inter.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round04_inter.wjson'),
            require('../../assets/audio/QMPart2/Rounds/QM3_6rounds_ErkinGuided_UnfollowAndWitness/unfollow6_round05_inter.wjson'),
          ],
        },
      },
    ],
  },
  {
    id: 'part3',
    title: 'Part 3',
    subtitle: 'Towards Silence',
    tagline: 'The Space',
    description:
      'Cultivate deep contemplative states and autonomous practice. Access profound silence and inner peace with minimal guidance and subtle tracking.',
    image: require('../../assets/images/hero/space.jpg'),
    tracks: [
      {
        id: 'p3-1', title: 'Emptiness',
        source: require('../../assets/audio/Part2/4 - Emptiness.mp3'),
        transcript: require('../../assets/audio/Part2/Words/4 - Emptiness.wjson'),
        durationHint: '20:58',
        description: 'Building on the breathing body and presence of air, open to the practice of emptiness — witnessing the space between and behind experience.',
      },
      { id: 'p3-2', title: 'The Dark Practice & Vertical Axis', comingSoon: true },
      { id: 'p3-3', title: 'The Light Practice', comingSoon: true },
      { id: 'p3-4', title: 'In the Black Hall', comingSoon: true },
      { id: 'p3-5', title: 'The Light & Dark Practice', comingSoon: true },
    ],
  },
];

const oneMinute: AudioTrack = {
  id: 'home-1min',
  title: 'One minute meditation',
  source: require('../../assets/audio/Home/One minute meditation.mp3'),
  transcript: require('../../assets/audio/Home/Words/One minute meditation.wjson'),
  durationHint: '1:50',
  description: 'One minute to arrive. A single breath, a moment of attention — your first taste of the practice.',
};

const threeMinutes: AudioTrack = {
  id: 'home-3min',
  title: 'Three minutes meditation',
  source: require('../../assets/audio/Home/Three minutes meditation.mp3'),
  transcript: require('../../assets/audio/Home/Words/Three minutes meditation.wjson'),
  durationHint: '3:07',
  description: 'Three minutes of guided attention. Settle a little deeper — a steadier taste of the practice.',
};

// Home tier 3 — a first taste of Quantified Meditation: 3 × 3-min rounds
// with 1-min inters, reusing the segmented Breath audio.
const qm3RoundsHome: AudioTrack = {
  id: 'home-qm3',
  title: 'QM · Three rounds',
  durationHint: '11 min',
  description: 'A first taste of Quantified Meditation: three rounds of three minutes with one-minute pauses between them.',
  rounds: {
    max: 3,
    roundLengthMinutes: 3,
    breakSeconds: 60,
    // No intro on the Start screen "3min × 3" quick CTA — tapping
    // that pill should drop the user straight into round 1, since
    // they explicitly chose the short-format meditation. The "QM
    // Training" intro audio is still surfaced in the Home intro list
    // (the volet) for users who want the framing.
    roundSources: [
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.mp3'),
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.mp3'),
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.mp3'),
    ],
    roundTranscripts: [
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01.wjson'),
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02.wjson'),
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round03.wjson'),
    ],
    roundInters: [
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.mp3'),
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.mp3'),
    ],
    roundInterTranscripts: [
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round01_inter.wjson'),
      require('../../assets/audio/QMPart1/Rounds/QM3_7rounds_Breath and Self-Observation/breath7_round02_inter.wjson'),
    ],
  },
};

export const startJourneySteps = [
  {
    id: 'step-1min',
    label: '1 minute',
    description: 'A first taste — just one minute to arrive.',
    track: oneMinute,
  },
  {
    id: 'step-3min',
    label: '3 minutes',
    description: 'Go a little deeper. Three minutes of guided attention.',
    track: threeMinutes,
  },
  {
    id: 'step-qm3',
    label: 'QM · 3 rounds',
    description: 'A first Quantified Meditation session:\nthree short rounds with one-minute pauses.',
    track: qm3RoundsHome,
  },
];

/**
 * Mirror of silentMindProgram / silentMindVolets scoped to the Quantified
 * Meditation tab. Part 1/2/3 reuse the same id suffix (part1 / part2 / part3)
 * so navigating from a Silent Mind part to its QM twin is a string swap.
 */
export const qmProgram = {
  eyebrow: 'Quantified Meditation',
  title: 'High Intensity Training',
  // Brand-promise byline that sits *inside* the title block, just
  // below the main title — see `ProgramHeader`'s `subtitle` prop. It
  // used to live as line 1 of the description, but visually it
  // belonged with the title, not buried in the body copy below.
  byline: 'A new way to meditate',
  intro:
    'Multiple rounds, short breaks,\n' +
    'reproduce the same meditative state on demand.',
  banner: require('../../assets/images/hero/space.jpg'),
};

// Assemble the QM program from the qmTracks already attached to the Silent
// Mind volets, so the single source of truth stays in `silentMindVolets`.
const voletById = (id: string) => silentMindVolets.find(v => v.id === id)!;

export const qmVolets: Volet[] = [
  {
    id: 'part1',
    title: 'Part 1',
    subtitle: voletById('part1').subtitle,
    tagline: voletById('part1').tagline,
    description: 'Multiple 3 to 5 min rounds with one-minute breaks',
    image: require('../../assets/images/hero/earth.jpg'),
    tracks: voletById('part1').qmTracks ?? [],
  },
  {
    id: 'part2',
    title: 'Part 2',
    subtitle: voletById('part2').subtitle,
    tagline: voletById('part2').tagline,
    description: 'Multiple 3 to 5 min rounds with one-minute breaks',
    image: require('../../assets/images/hero/sky.jpg'),
    tracks: voletById('part2').qmTracks ?? [],
  },
  {
    id: 'part3',
    title: 'Part 3',
    subtitle: voletById('part3').subtitle,
    tagline: voletById('part3').tagline,
    description: 'Multiple 3 to 5 min rounds with one-minute breaks',
    image: require('../../assets/images/hero/space.jpg'),
    // All three rounds are still in production — `locked: true` greys out
    // the whole card in QM and removes the chevron so users don't tap
    // into an empty detail page.
    locked: true,
    tracks: [
      { id: 'qm3-1', title: 'Emptiness (QM)', comingSoon: true },
      { id: 'qm3-2', title: 'The Dark Practice (QM)', comingSoon: true },
      { id: 'qm3-3', title: 'The Light Practice (QM)', comingSoon: true },
    ],
  },
];

export type NewsItem = { id: string; title: string; excerpt: string; date: string };
export const newsItems: NewsItem[] = [];

/**
 * An image source may come from a bundled asset (require() → number on
 * native / opaque object on web) or from a remote URL ({ uri }) — both are
 * valid inputs for <Image source>.
 */
export type ImageSrc = number | { uri: string };

export type MediaKind = 'video' | 'audio' | 'article';

export type VideoItem = {
  id: string;
  title: string;
  subtitle?: string;
  duration: string;
  source?: string;
  poster: ImageSrc;
  link?: string;
  remote?: boolean;
  /** Raw WordPress `content.rendered` HTML — used on web to play embeds (YT/Vimeo) inline */
  contentHtml?: string;
  /** YouTube/Vimeo player URL (scraped from the live page or extracted from
   * contentHtml). When present, the detail view uses it as the hero embed
   * in place of `poster`. */
  embedUrl?: string;
  /** What the user will actually do with the card: watch / listen / read */
  kind?: MediaKind;
};
export const videoItems: VideoItem[] = [
  {
    id: 'v1',
    title: 'Introduction to the Silent Mind',
    subtitle: 'Placeholder — replace with final cut',
    duration: '9:56',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    poster: require('../../assets/images/hero/thepractice.jpg'),
  },
  {
    id: 'v2',
    title: 'Inside the XR Meditation Room',
    subtitle: 'Placeholder — replace with final cut',
    duration: '4:30',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: require('../../assets/images/xr-platform.png'),
  },
  {
    id: 'v3',
    title: 'The Science Behind',
    subtitle: 'Placeholder — replace with final cut',
    duration: '6:12',
    source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: require('../../assets/images/eeg-solution.png'),
  },
];

