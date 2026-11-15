import { useState } from 'react';
import { ScrollView } from 'react-native';

import { HiddenWater } from '../src/components/HiddenWater';
import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import { WaterSafety, WaterTreatment } from '../src/components/WaterSafety';
import { WaterSystem } from '../src/components/WaterSystem';
import { activeOnly } from '../src/data/nws';
import { waterGallons } from '../src/kit/rules';
import { useLocalArea } from '../src/useLocalArea';
import { ui } from '../src/theme';

export default function WaterScreen() {
  const a = useLocalArea();
  const [noSystem, setNoSystem] = useState(false);
  if (!a) return <Loading />;
  const hazards = a.area?.hazards ?? [];
  const props = {
    lat: a.place.lat,
    lon: a.place.lon,
    gallons: waterGallons(a.household, hazards),
    countryCode: a.place.countryCode ?? a.area?.country_code ?? null,
    hazards,
    activeAlerts: activeOnly(a.warnings?.alerts ?? []).map((w) => w.event),
  };
  const system = <WaterSystem key="system" lat={a.place.lat} lon={a.place.lon} inUs={a.inUs} onMissing={setNoSystem} />;
  // Keyed, so moving the system card to the bottom keeps its state instead of refetching.
  const cards = [<WaterSafety key="safety" {...props} />, ...(noSystem ? [] : [system]), <HiddenWater key="hidden" gallons={props.gallons} />, <WaterTreatment key="treat" {...props} />, ...(noSystem ? [system] : [])];
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <PageHeader title="Water" place={a.place.label} />
      {cards}
    </ScrollView>
  );
}
