import { fireEvent, render, screen } from '@testing-library/react-native';

import Now from '../app/now';
import { EMERGENCIES, pickFromAlerts } from './kit/emergencies';
import { useLocalArea } from './useLocalArea';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), replace: jest.fn() }) }));
jest.mock('./useLocalArea', () => ({ useLocalArea: jest.fn() }));
const AsyncStorage = require('@react-native-async-storage/async-storage');

const alert = (event: string, ends: string | null = null) => ({ id: event, event, headline: event, severity: 'Severe', ends });

// protects=an active NWS alert picks the right emergency, the most urgent first, and expired or unrelated alerts pick nothing; fails_when=a regex misses a real NWS event name, priority flips (heat over evacuation), or an ended warning still drives the screen; no_claim=NWS event names never change
test('pickFromAlerts: maps NWS events to emergencies in priority order', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const id = (events: string[]) => pickFromAlerts(events.map((e) => alert(e)), now)?.emergency.id ?? null;
  expect(id(['Flash Flood Warning'])).toBe('flood');
  expect(id(['Red Flag Warning'])).toBe('wildfire');
  expect(id(['Excessive Heat Warning'])).toBe('heat');
  expect(id(['Blizzard Warning'])).toBe('winter');
  expect(id(['Tropical Storm Warning'])).toBe('hurricane');
  expect(id(['Heat Advisory', 'Evacuation Immediate'])).toBe('evacuate');
  expect(id(['Flood Watch', 'Tornado Warning'])).toBe('tornado');
  expect(id(['Special Weather Statement'])).toBeNull();
  expect(pickFromAlerts([alert('Tornado Warning', '2026-11-15T11:00:00Z')], now)).toBeNull();
  // Every choice carries 3-4 steps and a Ready.gov source.
  for (const e of EMERGENCIES) {
    expect(e.steps.length).toBeGreaterThanOrEqual(3);
    expect(e.url).toMatch(/^https:\/\/www\.ready\.gov\//);
  }
});

// protects=the screen opens on the emergency the active warning points to and says why, shows only kit items this household has with their packed state, and lists 911 plus the nearest office numbers; fails_when=the pre-pick or its reason is lost, a kit item the household doesn't have shows up, checked items read as unpacked, or 911 shows outside the US; no_claim=OpenStreetMap numbers are current
test('Now: pre-picks from a flood warning, shows kit state and who to call', async () => {
  await AsyncStorage.setItem('checked', JSON.stringify(['water', 'radio']));
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
  const places = {
    lat: 0, lon: 0, fetched_at: '2026-11-15T10:00:00Z', shelters: [],
    places: [
      { category: 'hospital', name: 'County Hospital', phone: '(209) 555-0100', lat: 0, lon: 0, distance_km: 2 },
      { category: 'police', name: 'Far Police', phone: null, lat: 0, lon: 0, distance_km: 1 },
    ],
  };
  const area = (inUs: boolean) => ({
    place: { lat: 0, lon: 0, label: 'Tracy, CA' }, inUs, area: null, places,
    household: { adults: 2, children: 0, seniors: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false },
    warnings: { lat: 0, lon: 0, fetched_at: '2026-11-15T10:00:00Z', alerts: [alert('Flood Warning')] },
  }) as never;
  jest.mocked(useLocalArea).mockReturnValue(area(true));

  await render(<Now />);
  expect(await screen.findByText(/active Flood Warning here/)).toBeTruthy();
  expect(screen.getByText('Move to higher ground or a higher floor.')).toBeTruthy();
  expect(screen.getByText(/Source: Ready.gov, Floods/)).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Flood', checked: true })).toBeTruthy();
  // No flood hazard or pets, so no boots or carrier; water and radio are packed.
  expect(screen.queryByText(/boots/i)).toBeNull();
  expect(screen.getByLabelText(/^Water.*, packed$/)).toBeTruthy();
  expect(screen.getByText('2 of 6 packed')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Call 911' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Call County Hospital, (209) 555-0100' })).toBeTruthy();
  expect(screen.queryByText('Far Police')).toBeNull();

  // Picking another emergency switches the steps and drops the "picked for you" note.
  await fireEvent.press(screen.getByRole('radio', { name: 'Earthquake' }));
  expect(screen.getByText('Expect aftershocks. Be ready to Drop, Cover and Hold On again.')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Earthquake', checked: true })).toBeTruthy();
  expect(screen.queryByText(/active Flood Warning/)).toBeNull();
  await screen.unmount();

  jest.mocked(useLocalArea).mockReturnValue(area(false));
  await render(<Now />);
  await screen.findByText(/active Flood Warning here/);
  expect(screen.queryByRole('link', { name: 'Call 911' })).toBeNull();
  expect(screen.getByText(/call your local emergency number/)).toBeTruthy();
});

// protects=an old saved copy (e.g. a stale fallback without numbers) is replaced by a fresh lookup; fails_when=Now trusts any saved copy for the place and never refetches; no_claim=the live lookup succeeds
test('Now: a saved copy shows first, then a fresh lookup replaces it', async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  const copy = (phone: string | null) => ({
    lat: 0, lon: 0, fetched_at: '2026-11-15T10:00:00Z', shelters: [],
    places: [{ category: 'hospital', name: 'County Hospital', phone, lat: 0, lon: 0, distance_km: 2 }],
  });
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => copy('(209) 555-0100') }) as unknown as typeof fetch;
  jest.mocked(useLocalArea).mockReturnValue({
    place: { lat: 0, lon: 0, label: 'Tracy, CA' }, inUs: true, area: null, places: copy(null),
    household: { adults: 1, children: 0, seniors: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false },
    warnings: null,
  } as never);

  await render(<Now />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Earthquake' }));
  expect(await screen.findByRole('link', { name: 'Call County Hospital, (209) 555-0100' })).toBeTruthy();
  expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('kind=places'), expect.anything());
});

// protects=Who to call names an ER, not a clinic OSM tags as a hospital; fails_when=Now takes the nearest OSM "hospital" with a phone; no_claim=the CMS list is complete
test('Now: Hospital is an official ER, not a nearer clinic', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
  jest.mocked(useLocalArea).mockReturnValue({
    place: { lat: 0, lon: 0, label: 'Tracy, CA' }, inUs: true, area: null,
    places: {
      lat: 0, lon: 0, fetched_at: '2026-11-15T10:00:00Z', shelters: [],
      places: [{ category: 'hospital', name: 'Tracy Medical Offices', phone: '+1 209-839-3200', lat: 0, lon: 0, distance_km: 1 }],
      er_hospitals: [{ name: 'SUTTER TRACY COMMUNITY HOSPITAL', city: 'TRACY', phone: '(209) 835-1500' }],
    },
    household: { adults: 1, children: 0, seniors: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false },
    warnings: null,
  } as never);

  await render(<Now />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Earthquake' }));
  expect(await screen.findByRole('link', { name: 'Call Sutter Tracy Community Hospital, (209) 835-1500' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Tracy Medical Offices/ })).toBeNull();
});
