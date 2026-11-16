import { Platform, StyleSheet } from 'react-native';

// Design tokens. Change the look here; screens and cards read from it.
// Style: a warm field guide (think Stripe Press). Full principles: docs/DESIGN.md. Rules for every screen:
// 1. Headings in the serif (fonts.display), never bold; body in Plus Jakarta Sans by weight family, not fontWeight.
// 2. Warm paper base, near-black ink, and one accent (primary) only for actions, progress and active states.
// 3. Red and amber only where they carry safety meaning: weather warnings, bad air, water violations.
// 4. Depth comes from soft layered shadows and a 1px top highlight, not heavy borders.
// 5. Numbers that change (counts, %, AQI) use tabular figures.
export const fonts = {
  display: 'InstrumentSerif_400Regular',
  body: 'PlusJakartaSans_400Regular',
  semi: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const colors = {
  bg: '#f5f2ec',
  surface: '#fffdf9',
  ink: '#1c1917',
  text: '#292524',
  muted: '#57534e',
  subtle: '#6b645d',
  border: '#e6e0d6',
  track: '#e6e0d6',
  primary: '#0f5e57',
  veil: 'rgba(245,242,236,0.82)', // greys out a finished card under its big check
  primarySoft: '#e4efec',
  success: '#0f5e57',
  successSoft: '#e4efec',
  danger: '#b42318',
  dangerInk: '#7a1a12',
  dangerSoft: '#fdecea',
  warn: '#b45309',
  warnInk: '#7c2d12',
  warnSoft: '#fff4e5',
};

// On web the header floats over the page (it slides away on scroll), so scroll content starts below it.
export const HEADER_BAR = 64;
export const headerPad = Platform.OS === 'web' ? HEADER_BAR : 0;

export const ui = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(28,25,23,0.05), 0 10px 24px -14px rgba(28,25,23,0.18)',
  },
  pageTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -0.4 },
  cardTitle: { fontSize: 24, fontFamily: fonts.display, color: colors.ink, letterSpacing: -0.3 },
  eyebrow: { fontSize: 12, fontFamily: fonts.bold, color: colors.subtle, letterSpacing: 0.8, textTransform: 'uppercase' },
  screen: { padding: 16, paddingTop: 16 + headerPad, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 600, alignSelf: 'center' },});
