import { fireEvent, render, screen } from '@testing-library/react-native';

import { Linking } from 'react-native';

import { NearbyHelp, type PlacesResult } from './NearbyHelp';

const result = (name: string, lat = 37.78, lon = -121.54): PlacesResult => ({
  lat,
  lon,
  places: [{ category: 'pharmacy', name, lat: 37.79, lon: -121.54, distance_km: 1.1 }],
  shelters: [],
  fetched_at: '2026-11-14T10:00:00.000Z',
});

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

// protects=acceptance criterion 8 for Nearby help: offline, the saved places show even when storage hands them over after mount; fails_when=`saved` is only read on the first render, so a late value is ignored; no_claim=T4 really saves and passes the result
test('NearbyHelp: offline, a saved result that arrives late still shows', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  const props = { lat: 37.78, lon: -121.54, inUs: true, county: 'San Joaquin County' };

  await render(<NearbyHelp {...props} />);
  expect(await screen.findByText(/Couldn't load nearby places/)).toBeTruthy();
  expect(screen.queryByText(/Walgreens/)).toBeNull();

  await screen.rerender(<NearbyHelp {...props} saved={result('Walgreens')} />);
  expect(await screen.findByText(/Walgreens/)).toBeTruthy();
});

// protects=offline, a saved copy from another location is never shown as nearby help; fails_when=`saved` is used without checking it was fetched for (about) the current point; no_claim=the 1 km cutoff is the right size
test('NearbyHelp: offline, a saved result from another city is not shown', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  await render(<NearbyHelp lat={-1.29} lon={36.82} inUs={false} county={null} saved={result('Tracy Pharmacy')} />);
  expect(await screen.findByText(/Couldn't load nearby places/)).toBeTruthy();
  expect(screen.queryByText(/Tracy Pharmacy/)).toBeNull();
});

// protects=after a location change, places from the old location are not shown as nearby; fails_when=the previous fetch result stays on screen while the new one loads; no_claim=the plan screen keeps NearbyHelp mounted across location changes
test('NearbyHelp: changing location clears the old places while loading', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => result('Tracy Pharmacy') }) as unknown as typeof fetch;
  await render(<NearbyHelp lat={37.78} lon={-121.54} inUs county={null} />);
  expect(await screen.findByText(/Tracy Pharmacy/)).toBeTruthy();

  let answer: (r: unknown) => void = () => {};
  globalThis.fetch = jest.fn(() => new Promise((res) => (answer = res))) as unknown as typeof fetch;
  await screen.rerender(<NearbyHelp lat={-1.29} lon={36.82} inUs={false} county={null} />);
  expect(screen.queryByText(/Tracy Pharmacy/)).toBeNull();
  expect(screen.getByText('Finding nearby help…')).toBeTruthy();

  // Answer the pending lookup so its 60 s timeout is cleared and jest exits cleanly.
  answer({ ok: true, json: async () => result('Nairobi Chemist') });
  expect(await screen.findByText(/Nairobi Chemist/)).toBeTruthy();
});

// protects=users are told when the list is the shorter Photon fallback; fails_when=a photon-sourced result shows no note, or an Overpass one shows it; no_claim=the function reports source correctly (lookup.test.ts covers that)
test('NearbyHelp: says when places came from the Photon fallback', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  const props = { lat: 37.78, lon: -121.54, inUs: false, county: null };
  await render(<NearbyHelp {...props} saved={{ ...result('Grant Line Pharmacy'), source: 'photon' }} />);
  expect(await screen.findByText(/some places may be missing/)).toBeTruthy();

  await screen.rerender(<NearbyHelp {...props} saved={result('Walgreens')} />);
  expect(await screen.findByText(/Walgreens/)).toBeTruthy();
  expect(screen.queryByText(/some places may be missing/)).toBeNull();
});

// protects=a place with a phone number shows a tappable call link that dials the digits, and US users get a Call 2-1-1 link; fails_when=the number is hidden, a hospital's line shows without the call-911 note, the tel: link keeps spaces or brackets, or a place without a number shows a call link; no_claim=the phone opens its dialer
test('NearbyHelp: phone numbers are tappable call links', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
  const saved = result('Walgreens');
  saved.places.push({ category: 'hospital', name: 'Kaiser', phone: '+1 (209) 555-0100', lat: 37.79, lon: -121.54, distance_km: 1.1 });
  await render(<NearbyHelp lat={37.78} lon={-121.54} inUs county={null} saved={saved} />);

  await fireEvent.press(await screen.findByLabelText('Call Kaiser, +1 (209) 555-0100'));
  expect(open).toHaveBeenCalledWith('tel:+12095550100');
  expect(screen.queryByLabelText(/^Call Walgreens/)).toBeNull();
  expect(screen.getByText('In an emergency call 911. These are office lines.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Call 2-1-1'));
  expect(open).toHaveBeenLastCalledWith('tel:211');
});
