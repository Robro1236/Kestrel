import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { onHeaderScroll } from '../src/components/Header';
import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import type { IconName } from '../src/components/Icon';
import { IconBadge, Step } from '../src/components/Steps';
import { Tap } from '../src/components/Tap';
import { useLocalArea } from '../src/useLocalArea';
import { colors, fonts, ui, pageScroll } from '../src/theme';

// ordered: the lines are a sequence, so they get numbers.
type Topic = { title: string; icon: IconName; ordered?: boolean; lines: string[]; source: string; link?: [string, string] };

// Fixed official checklists for the first days after a disaster. No live data, so it works offline.
const TOPICS: Topic[] = [
  {
    title: 'Stay safe first',
    icon: 'shield',
    lines: [
      'Run generators, grills and camp stoves outdoors only, at least 20 feet from doors and windows. Carbon monoxide has no smell.',
      'Stay out of floodwater. It can hide live wires and sewage, and 6 inches of moving water can knock you down.',
      'Keep away from downed power lines and report them to the power company.',
    ],
    source: 'CDC and Ready.gov',
  },
  {
    title: 'Photograph damage before you clean up',
    icon: 'camera',
    ordered: true,
    lines: [
      'Take photos and video of every room and all damage before you move or throw anything out.',
      'Keep receipts for repairs, hotels and supplies.',
      'Call your insurance company as soon as you can, and write down who you spoke to and when.',
    ],
    source: 'FEMA',
  },
  {
    title: 'Food after a power outage',
    icon: 'snow',
    lines: [
      'A closed fridge keeps food safe for about 4 hours. A full freezer holds for 48 hours, a half-full one for 24.',
      'Throw out meat, fish, milk, eggs and leftovers that sat above 40°F for more than 2 hours.',
      'Throw out any food that touched floodwater. Never taste food to check it. When in doubt, throw it out.',
    ],
    source: 'FoodSafety.gov (USDA)',
  },
  {
    title: 'When tap water is safe again',
    icon: 'drop',
    lines: [
      'Use bottled or treated water until your water utility or local officials say tap water is safe.',
      'Follow any boil-water notice until it is lifted, then run cold taps for a few minutes.',
      'If your private well flooded, do not use it until it has been disinfected and tested.',
    ],
    source: 'CDC',
  },
];

const AID: Topic = {
  title: 'Apply for disaster aid',
  icon: 'doc',
  lines: [
    'If your county is part of a federal disaster declaration, you can apply to FEMA for help with housing, repairs and other needs.',
    'Apply online or call 1-800-621-3362. Have your address, insurance details and bank details ready.',
  ],
  source: 'FEMA',
  link: ['Apply at DisasterAssistance.gov', 'https://www.disasterassistance.gov'],
};

export default function AfterScreen() {
  const a = useLocalArea();
  if (!a) return <Loading />;
  // FEMA aid is US only; elsewhere the card would point people to the wrong agency.
  const topics = a.inUs ? [...TOPICS, AID] : TOPICS;
  return (
    <ScrollView style={pageScroll} onScroll={onHeaderScroll} scrollEventThrottle={16} contentContainerStyle={ui.screen}>
      <PageHeader title="After a disaster" place={a.place.label} />
      {topics.map((t) => (
        <View key={t.title} style={ui.card}>
          <View style={styles.head}>
            <IconBadge name={t.icon} />
            <Text accessibilityRole="header" style={[ui.cardTitle, styles.grow]}>{t.title}</Text>
          </View>
          {t.lines.map((l, i) => (
            <Step key={l} n={t.ordered ? i + 1 : undefined}>
              <Text style={styles.text}>{l}</Text>
            </Step>
          ))}
          {t.link ? (
            <Tap accessibilityRole="link" onPress={() => Linking.openURL(t.link![1])} style={styles.linkHit}>
              <Text style={styles.link}>{t.link[0]}</Text>
            </Tap>
          ) : null}
          <Text style={styles.source}>Source: {t.source}.</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  linkHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.semi, color: colors.primary, textDecorationLine: 'underline', fontSize: 15 },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
