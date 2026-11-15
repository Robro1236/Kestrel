import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, ui } from '../theme';

// shortcut: assumes a typical 40-50 gallon US tank; ask the household's tank size if people want an exact number.
const HEATER_LOW = 40;

// How many days of the household's 3-day need the low end of a typical water heater covers.
export function heaterDays(gallons: number): number {
  return Math.floor((HEATER_LOW * 3) / gallons);
}

const STEPS = [
  'Turn off the power or gas to the water heater.',
  'Close the cold-water valve at the top of the tank, then open a hot-water tap in the house so air can get in.',
  'Open the drain valve at the bottom into clean containers. Let the water cool first if you can, it can scald.',
  'Refill the tank before turning the power or gas back on. Gas may need a professional to relight.',
];

// Water already in the home: fixed Ready.gov guidance, compared with the household's 3-day need.
export function HiddenWater({ gallons }: { gallons: number }) {
  const days = heaterDays(gallons);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Water already in your home</Text>
      <Text style={styles.text}>
        You need <Text style={styles.qty}>{gallons} gallons</Text> for 3 days. A typical water heater holds{' '}
        <Text style={styles.qty}>40–50 gallons</Text>,{' '}
        {days >= 3 ? 'enough for all 3 days on its own.' : `about ${days} ${days === 1 ? 'day' : 'days'} of that.`}
      </Text>
      <Text style={styles.text}>
        It is only safe if you shut the main water valve into your home as soon as you hear of broken water or sewage lines,
        before bad water gets in.
      </Text>
      <Text style={styles.label}>Drain the water heater</Text>
      {STEPS.map((s, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.num}>{i + 1}</Text>
          <Text style={[styles.text, styles.stepText]}>{s}</Text>
        </View>
      ))}
      <Text style={styles.label}>Also usable</Text>
      <Text style={styles.text}>
        Water in your pipes: open the highest tap in the house, then fill containers from the lowest one. Ice cubes. Last
        resort: the toilet tank (not the bowl), treated first, and never if it has a chemical cleaner in it.
      </Text>
      <Text style={styles.text}>Don't drink water from waterbeds, pools, hot tubs or radiators.</Text>
      <Text style={styles.source}>Source: Ready.gov, Water.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: ui.card,
  heading: ui.cardTitle,
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  qty: { fontFamily: fonts.bold, color: colors.primary, fontVariant: ['tabular-nums'] },
  label: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink, marginTop: 4 },
  step: { flexDirection: 'row', gap: 10 },
  num: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, width: 16, fontVariant: ['tabular-nums'] },
  stepText: { flex: 1 },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
