export const colors = {
  bg: '#00102E',
  bgSoft: '#06183B',
  bgDeep: '#000823',
  bgTab: '#00162A',
  surface: 'rgba(255,255,255,0.05)',
  surfaceElevated: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.24)',
  // Slightly off-white base — pure #FFFFFF felt harsh against the
  // dark backgrounds. Muted/dim follow suit through the same RGB.
  text: '#E8EAF0',
  textMuted: 'rgba(232,234,240,0.72)',
  textDim: 'rgba(232,234,240,0.48)',
  accent: '#9E3694',
  accentSoft: 'rgba(158,54,148,0.35)',
  accentDeep: '#6F1F68',
  // QM tab accent — original teal, complementary to the Silent Mind
  // magenta.
  accentAlt: '#36A09E',
  accentAltSoft: 'rgba(54,160,158,0.35)',
  accentAltDeep: '#1F6F6E',
  // Same identity as the Silent Mind navy (#00162A), just nudged a hair
  // toward green so the QM tab isn't a perfect clone. Minor hue shift,
  // same darkness and saturation.
  bgTabAlt: '#001A26',
  placeholder: '#718096',
};

export const fonts = {
  body: 'Montserrat_400Regular',
  bodyMedium: 'Montserrat_500Medium',
  bodySemibold: 'Montserrat_600SemiBold',
  display: 'Montserrat_800ExtraBold',
  displayBlack: 'Montserrat_900Black',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

// Four intentional tiers + a section helper.
//
//   title     — hero-level display (landing pages, player track title)
//   h2/h3     — card / block headings
//   body      — prose
//   caption   — inline secondary text
//   sectionLabel — "Start with", "Intro audios", "Replay quick meditation":
//                  sentence-case, medium weight. NOT uppercase. Section
//                  titles should read as labels, not as pressed state.
//   overline  — reserved for **true state labels** only: ROUND 1/3,
//                  GATEWAY COMPLETED, the program CTA eyebrow. Avoid using
//                  it as a generic small-caps style.
//   button    — primary CTA.
// Soft dark drop-shadow shared across every text style. Barely
// visible on the dark home / detail backgrounds the app uses
// most of the time, but ensures white text stays legible when a
// bright shader background (daytime SKY clouds, dappled EARTH,
// etc.) sits behind. Applied to every style so individual
// components don't need to opt-in.
const textShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

export const type = {
  display:      { ...textShadow, fontFamily: fonts.displayBlack, fontSize: 32, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  h1:           { ...textShadow, fontFamily: fonts.display, fontSize: 26, letterSpacing: 1, textTransform: 'uppercase' as const },
  h2:           { ...textShadow, fontFamily: fonts.bodySemibold, fontSize: 20, letterSpacing: 0.3 },
  h3:           { ...textShadow, fontFamily: fonts.bodySemibold, fontSize: 16 },
  body:         { ...textShadow, fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  caption:      { ...textShadow, fontFamily: fonts.body, fontSize: 13, letterSpacing: 0.3 },
  sectionLabel: { ...textShadow, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 0.4 },
  overline:     { ...textShadow, fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase' as const },
  button:       { ...textShadow, fontFamily: fonts.displayBlack, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' as const },
};
