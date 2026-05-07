import { getAudioSource, getTranscriptSource, BUNDLED_AUDIO, BUNDLED_TRANSCRIPTS } from './audioRegistry';

export type RoundsConfig = {
  max: number;
  roundLengthMinutes: number;
  defaultRounds?: number;
  breakSeconds: number;
  roundSources?: (number | string)[]; // number = bundled, string = remote URL
  roundTranscripts?: (number | string)[];
  // Interstitial audio played during the break between rounds (optional).
  // If present at index i, plays between round i+1 and round i+2.
  roundInters?: (number | string | null)[];
  roundInterTranscripts?: (number | string | null)[];
  introSource?: number | string;
  introTranscript?: number | string;
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
  source?: number | string; // number = bundled, string = remote URL
  transcript?: number | string;
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
  // Each volet contributes ONE section with only its SM tracks. The
  // qmTracks were previously merged into the SM section, which made
  // "Part 1 · 5" instead of "Part 1 · 3" (the SM detail page only
  // shows 3, hence user confusion). qmVolets below provide the QM
  // counterparts under their own "QM · …" label.
  const sections: Section[] = [
    ...silentMindVolets.map(v => ({
      // Fall back to subtitle when title is empty — the intro volet
      // has `title: ''` (we removed the redundant "Introduction"
      // eyebrow) but we still want a meaningful label here, e.g.
      // "INTRODUCTION · 1 / 3" instead of " · 1 / 3".
      label: v.title || v.subtitle || '',
      tracks: v.tracks.filter(t => !t.comingSoon),
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
    // source is remote (Part0 on WordPress) — Player resolves via track.id
    transcript: BUNDLED_TRANSCRIPTS.introWelcome,
    durationHint: '2:00',
    description: "Welcome to the Silent Mind program, All Here's journey towards Stability and Silence of Mind. A vertical progression toward advanced meditation practice.",
  },
  // 'Prepare the space' (intro-3) is intentionally pulled for now —
  // tracking the change here so it's easy to restore: the asset files
  // still exist under assets/audio/Part0/, just unreferenced.
  {
    id: 'intro-2', title: 'Silent Mind',
    transcript: BUNDLED_TRANSCRIPTS.introSilentMind,
    durationHint: '2:17',
    description: "At the heart of our practice is the development of the Silent Mind — a practical method to reduce fluctuations of consciousness and cultivate a profound inner silence.",
  },
  {
    id: 'intro-4', title: 'QM Training',
    transcript: BUNDLED_TRANSCRIPTS.introQMFormat,
    durationHint: '1:13',
    description: 'An introduction to the Quantified Meditation format — high-intensity training with multiple rounds and short breaks, to reproduce the same meditative state on demand.',
  },
];

/**
 * Explicit QM-id → SM-id pairings within a Part. Used by the unlock
 * walker (`isTrackUnlocked`) and the journey-tree renderer to know
 * which SM track gates a given QM track. Title-based matching doesn't
 * work here because catalog titles diverge across the two formats
 * ("QM3 — Breathing Body" vs SM "Breath and Self-Observation"), so we
 * declare the semantic pair by id. Add new entries when QM rounds are
 * added to a part.
 */
export const QM_TO_SM_PAIRING: Record<string, string> = {
  'qm1-2': 'p1-2',
  'qm1-4': 'p1-3',
  'qm2-3': 'p2-3',
};

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
        durationHint: '19:24',
        description: 'An introductory eyes-open practice. Find a suitable, comfortable location away from disturbance, then begin the practice.',
      },
      {
        id: 'p1-2', title: 'Breath and Self-Observation',
        durationHint: '20:54',
        description: 'Turn the attention from thoughts to the breathing process and the breathing body.',
      },
      {
        id: 'p1-3', title: 'Center of Gravity',
        durationHint: '23:48',
        description: 'Developing vertical internal presence and stable anchoring of inner attention.',
      },
    ],
    qmTracks: [
      {
        id: 'qm1-2', title: 'QM3 — Breathing Body',
        description: 'Turn the mind towards the breathing process — notice the body exhaling, inhaling, then resting attention on the natural breath.',
        rounds: {
          max: 7, roundLengthMinutes: 3, breakSeconds: 60,
        },
      },
      {
        id: 'qm1-4', title: 'QM5 — Center of Gravity',
        description: 'Start with a long exhalation — empty yourself of air, then let the body inhale freely, then deepen into the Center of Gravity practice.',
        rounds: {
          max: 5, roundLengthMinutes: 5, breakSeconds: 60,
        },
      },
    ],
  },
  {
    id: 'part2',
    title: 'Part 2',
    subtitle: 'Stability & Equanimity',
    tagline: 'The Sky',
    description: 'Transition beyond breath',
    image: require('../../assets/images/hero/sky.jpg'),
    tracks: [
      {
        id: 'p2-1', title: 'Follow the Air',
        durationHint: '13:42',
        description: 'From breathing body to the element of Air, attention shifts towards a subtler object of meditation.',
      },
      {
        id: 'p2-2', title: 'Follow and witness the Air',
        durationHint: '26:35',
        description: 'Follow the airflow, then step back and witness its movement. A transition from active following to equanimous observation.',
      },
      {
        id: 'p2-3', title: 'Unfollow and witness the air',
        durationHint: '21:00',
        description: 'Withdraw from following the air, and the breathing body. Without participating in any process, remain unmoved and stable.',
      },
    ],
    qmTracks: [
      // 'Cosmic Sky' (qm2-2) is intentionally pulled for now — the
      // SM Part 2 sequence currently has no matching guidance for it,
      // so it would unlock as an orphan QM with no SM counterpart.
      // Asset files still exist under assets/audio/QMPart2/, just
      // unreferenced; flip back when an SM "Cosmic Sky" lands.
      {
        id: 'qm2-3', title: 'QM3 — Unfollow and Witness the Air',
        description: "QM3 training by All Here — designed to train the ability to quickly mobilize presence. Six rounds of three minutes each with one-minute breaks in between.",
        rounds: {
          max: 6, roundLengthMinutes: 3, breakSeconds: 60,
        },
      },
    ],
  },
  {
    id: 'part3',
    title: 'Part 3',
    subtitle: 'Towards Silence',
    tagline: 'The Space',
    description: 'Transition from air to emptiness.',
    image: require('../../assets/images/hero/space.jpg'),
    tracks: [
      {
        id: 'p3-1', title: 'Emptiness',
        durationHint: '20:58',
        description: 'Training the mind on the presence of emptiness, within and without.',
      },
      { id: 'p3-2', title: 'The Dark Practice & Vertical Axis', comingSoon: true },
      { id: 'p3-3', title: 'The Light Practice', comingSoon: true },
      { id: 'p3-4', title: 'The Light & Dark Practice', comingSoon: true },
      { id: 'p3-5', title: 'In the Black Hall', comingSoon: true },
    ],
  },
];

const oneMinute: AudioTrack = {
  id: 'home-1min',
  title: 'One minute meditation',
  source: BUNDLED_AUDIO.homeOneMin,
  transcript: BUNDLED_TRANSCRIPTS.homeOneMin,
  durationHint: '1:06',
  description: 'One minute to arrive. A single breath, a moment of attention — your first taste of the practice.',
};

const threeMinutes: AudioTrack = {
  id: 'home-3min',
  title: 'Three minutes meditation',
  source: BUNDLED_AUDIO.homeThreeMin,
  transcript: BUNDLED_TRANSCRIPTS.homeThreeMin,
  durationHint: '3:07',
  description: 'Three minutes of guided attention. Settle a little deeper — a steadier taste of the practice.',
};

// Home tier 3 — a first taste of Quantified Meditation: 3 × 3-min rounds
// with 1-min inters, reusing the segmented Breath audio.
const qm3RoundsHome: AudioTrack = {
  id: 'home-qm3',
  title: 'QM3 · Three rounds',
  durationHint: '11 min',
  description: 'A first taste of Quantified Meditation: three rounds of three minutes with one-minute breaks between them.',
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
      BUNDLED_AUDIO.qm3Br1,
      BUNDLED_AUDIO.qm3Br2,
      BUNDLED_AUDIO.qm3Br3,
    ],
    roundTranscripts: [
      BUNDLED_TRANSCRIPTS.qm3,
      BUNDLED_TRANSCRIPTS.qm3,
      BUNDLED_TRANSCRIPTS.qm3,
    ],
    roundInters: [
      BUNDLED_AUDIO.qm3Inter1,
      BUNDLED_AUDIO.qm3Inter2,
    ],
    roundInterTranscripts: [
      BUNDLED_TRANSCRIPTS.qm3,
      BUNDLED_TRANSCRIPTS.qm3,
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
    label: 'QM3 · 3 rounds',
    description: 'A first Quantified Meditation session: three short rounds with one-minute breaks.',
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
  intro: 'Multiple rounds, short breaks, reproduce the same meditative state on demand.',
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
    title: 'The Quantified Meditation System™',
    subtitle: 'Real-time window into the meditative mind',
    duration: '4:32',
    embedUrl: 'https://www.youtube.com/embed/GkLzaHzdtoc',
    poster: require('../../assets/images/hero/space.jpg'),
    kind: 'video',
    remote: true,
  },
  {
    id: 'v2',
    title: 'Zenbu Koko Installation',
    subtitle: 'Extended-reality meditation capsule demonstration',
    duration: '3:45',
    embedUrl: 'https://www.youtube.com/embed/HmEGX0_Dh9U',
    poster: require('../../assets/images/xr-platform.png'),
    kind: 'video',
    remote: true,
  },
  {
    id: 'v3',
    title: 'The Silent Mind Platform',
    subtitle: 'Where meditation meets science & technology',
    duration: '5:20',
    embedUrl: 'https://www.youtube.com/embed/HghfgUIleBQ',
    poster: require('../../assets/images/hero/sky.jpg'),
    kind: 'video',
    remote: true,
  },
];

