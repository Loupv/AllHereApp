export const colors = {
  bg: '#00102E',
  bgSoft: '#06183B',
  bgDeep: '#000823',
  bgTab: '#00162A',
  surface: 'rgba(255,255,255,0.05)',
  surfaceElevated: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.24)',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.72)',
  textDim: 'rgba(255,255,255,0.48)',
  accent: '#9E3694',
  accentSoft: 'rgba(158,54,148,0.35)',
  accentDeep: '#6F1F68',
  // QM tab accent — closer to the original teal, a touch darker and
  // slightly less saturated for a more grounded feel.
  accentAlt: '#2C8581',
  accentAltSoft: 'rgba(44,133,129,0.35)',
  accentAltDeep: '#185653',
  bgTabAlt: '#002428',
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

export const type = {
  display: { fontFamily: fonts.displayBlack, fontSize: 32, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  h1: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1, textTransform: 'uppercase' as const },
  h2: { fontFamily: fonts.bodySemibold, fontSize: 20, letterSpacing: 0.3 },
  h3: { fontFamily: fonts.bodySemibold, fontSize: 16 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 0.3 },
  overline: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase' as const },
  button: { fontFamily: fonts.displayBlack, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' as const },
};
