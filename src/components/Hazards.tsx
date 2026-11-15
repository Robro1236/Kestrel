import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { Step } from './Steps';
import { colors, fonts, ui } from '../theme';

import { HAZARD_ADVICE } from '../kit/hazardAdvice';
import { localDay } from '../date';
import { isAtLeastModerate, type Hazard } from '../kit/rules';

const LABELS: Record<string, string> = {
  earthquake: 'Earthquake',
  inland_flood: 'Inland flooding',
  coastal_flood: 'Coastal flooding',
  heat_wave: 'Heat wave',
  wildfire: 'Wildfire',
  hurricane: 'Hurricane',
  tornado: 'Tornado',
  winter_weather: 'Winter weather',
  cold_wave: 'Cold wave',
  ice_storm: 'Ice storm',
  drought: 'Drought',
};
const RANK = ['Very High', 'Relatively High', 'Relatively Moderate'];

type Props = {
  // From lookup?kind=area; null while loading or when it failed with nothing saved.
  hazards: Hazard[] | null;
  inUs: boolean;
  county?: string;
  fetchedAt?: string;
  failed: boolean;
};

export function Hazards({ hazards, inUs, county, fetchedAt, failed }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = (hazards ?? [])
    .filter((h) => isAtLeastModerate(h.rating))
    .sort((a, b) => RANK.indexOf(a.rating) - RANK.indexOf(b.rating));
  let body;
  if (!hazards) body = <Text style={styles.note}>{failed ? "Couldn't load your area's hazards right now." : "Checking your area's hazards…"}</Text>;
  else if (!inUs) body = <Text style={styles.note}>Hazard data is only available in the US for now.</Text>;
  else if (!shown.length) body = <Text style={styles.note}>No hazards rated Relatively Moderate or higher{county ? ` for ${county}` : ''}.</Text>;
  else
    body = shown.map((h) => {
      const label = LABELS[h.type] ?? h.type;
      const advice = HAZARD_ADVICE[h.type];
      const expanded = open === h.type;
      const row = (
        <>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.end}>
            <Text style={styles.rating}>{h.rating}</Text>
            {advice ? <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} color={colors.muted} /> : null}
          </View>
        </>
      );
      return (
        <View key={h.type} style={styles.item}>
          {advice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${h.rating}. What to do`}
              aria-expanded={expanded}
              onPress={() => setOpen(expanded ? null : h.type)}
              style={styles.row}
            >
              {row}
            </Pressable>
          ) : (
            <View style={styles.row}>{row}</View>
          )}
          {advice && expanded ? (
            <View style={styles.advice}>
              {advice.steps.map((s) => (
                <Step key={s}>
                  <Text style={styles.step}>{s}</Text>
                </Step>
              ))}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Read more about ${label.toLowerCase()} on Ready.gov`}
                onPress={() => Linking.openURL(advice.url)}
                style={styles.link}
              >
                <Text style={styles.linkText}>Read more on Ready.gov</Text>
              </Pressable>
              <Text style={styles.source}>Source: Ready.gov, "{advice.page}" (updated {advice.updated})</Text>
            </View>
          ) : null}
        </View>
      );
    });
  return (
    <View style={styles.section}>
      {body}
      {hazards && inUs ? (
        <Text style={styles.source}>
          Source: FEMA National Risk Index (county level){county ? `, ${county}` : ''}
          {fetchedAt ? `, ${failed ? 'saved' : 'fetched'} ${localDay(fetchedAt)}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: ui.card,
  item: { borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  label: { fontFamily: fonts.semi, fontSize: 16 },
  end: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  advice: { backgroundColor: colors.bg, borderRadius: 8, padding: 12, gap: 6, marginBottom: 8 },
  step: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.semi, color: colors.primary, fontSize: 15 },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
