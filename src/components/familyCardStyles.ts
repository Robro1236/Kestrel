import { StyleSheet } from 'react-native';

import { colors, fonts, ui } from '../theme';

// Look of the family plan card (app/family.tsx). Change the design here; the screen holds only logic.
export const styles = StyleSheet.create({
  container: ui.screen,
  card: ui.card,
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -0.4 },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  groupTitle: ui.cardTitle,
  field: { gap: 4 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  photoSlot: { gap: 4, alignItems: 'center' },
  photo: { width: 104, height: 104, borderRadius: 14 },
  addPhoto: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addPhotoText: { fontFamily: fonts.semi, fontSize: 13, color: colors.primary },
  removePhoto: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,25,23,0.7)', alignItems: 'center', justifyContent: 'center' },
  photoName: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  error: { fontFamily: fonts.semi, fontSize: 14, color: colors.danger },
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
