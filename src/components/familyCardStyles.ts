import { StyleSheet } from 'react-native';

// Look of the family plan card (app/family.tsx). Change the design here; the screen holds only logic.
export const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  note: { fontSize: 15, color: '#333' },
  field: { gap: 4 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14, color: '#555' },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  primary: { backgroundColor: '#0b5cad', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#0b5cad', fontSize: 16, fontWeight: '600' },
  source: { fontSize: 12, color: '#666' },
});
