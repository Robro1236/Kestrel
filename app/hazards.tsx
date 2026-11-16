import { ScrollView } from 'react-native';

import { onHeaderScroll } from '../src/components/Header';
import { AirBanner, useAirQuality } from '../src/components/AirBanner';
import { Hazards } from '../src/components/Hazards';
import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import { isAtLeastModerate } from '../src/kit/rules';
import { useLocalArea } from '../src/useLocalArea';
import { ui, pageScroll } from '../src/theme';

export default function HazardsScreen() {
  const a = useLocalArea();
  const air = useAirQuality(a?.place.lat, a?.place.lon);
  if (!a) return <Loading />;
  const hazards = a.area?.hazards ?? null;
  // Nothing to show (failed, outside the US, or nothing rated): air quality goes first.
  const empty = !a.inUs || (hazards ? !hazards.some((h) => isAtLeastModerate(h.rating)) : a.areaFailed);
  const list = <Hazards key="hazards" hazards={hazards} inUs={a.inUs} county={a.area?.county} fetchedAt={a.area?.fetched_at} failed={a.areaFailed} />;
  const airCard = <AirBanner key="air" air={air} />;
  return (
    <ScrollView style={pageScroll} onScroll={onHeaderScroll} scrollEventThrottle={16} contentContainerStyle={ui.screen}>
      <PageHeader title="Local hazards" place={a.place.label} />
      {empty ? [airCard, list] : [list, airCard]}
    </ScrollView>
  );
}
