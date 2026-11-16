import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { onHeaderScroll } from '../src/components/Header';
import { CountyHelp, SAN_JOAQUIN_FIPS } from '../src/components/CountyHelp';
import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import { useLocalArea } from '../src/useLocalArea';
import { colors, fonts, ui, pageScroll } from '../src/theme';

export default function CountyScreen() {
  const a = useLocalArea();
  if (!a) return <Loading />;
  return (
    <ScrollView style={pageScroll} onScroll={onHeaderScroll} scrollEventThrottle={16} contentContainerStyle={ui.screen}>
      <PageHeader title="County alerts" place={a.place.label} />
      {a.area?.county_fips === SAN_JOAQUIN_FIPS ? (
        <CountyHelp countyFips={a.area.county_fips} />
      ) : (
        <View style={ui.card}>
          <Text style={styles.text}>
            {a.area
              ? `Kestrel doesn't have local links for ${a.area.county ?? 'your county'} yet. Search for your county's emergency alert signup.`
              : a.areaFailed
                ? "Couldn't load your county. Check your connection and try again."
                : 'Checking your county…'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ text: { fontFamily: fonts.body, fontSize: 15, color: colors.muted } });
