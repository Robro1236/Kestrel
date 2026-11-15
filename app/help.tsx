import { ScrollView } from 'react-native';

import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import { NearbyHelp } from '../src/components/NearbyHelp';
import { saveResult } from '../src/storage';
import { useLocalArea } from '../src/useLocalArea';
import { ui } from '../src/theme';

export default function HelpScreen() {
  const a = useLocalArea();
  if (!a) return <Loading />;
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <PageHeader title="Nearby help" place={a.place.label} />
      <NearbyHelp
        lat={a.place.lat}
        lon={a.place.lon}
        inUs={a.inUs}
        county={a.area?.county ?? null}
        saved={a.places}
        onResult={(r) => saveResult('places', r)}
      />
    </ScrollView>
  );
}
