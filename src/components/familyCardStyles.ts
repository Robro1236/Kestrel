import { StyleSheet } from 'react-native';

import { colors, fonts, ui } from '../theme';

// Look of the family plan card (app/family.tsx). Change the design here; the screen holds only logic.
export const styles = StyleSheet.create({
  container: ui.screen,
  card: ui.card,
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -0.4 },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  field: { gap: 4 },
  label: { fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.subtle },
  input: { fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 12, padding: 14, fontSize: 16, color: colors.ink },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  primary: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { fontFamily: fonts.bold, color: '#fff', fontSize: 18 },
  linkHit: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { fontFamily: fonts.semi, color: colors.primary, fontSize: 16 },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle, textAlign: 'center' },
});
