import { render, screen } from '@testing-library/react-native';

import Plan from '../app/plan';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockRouter = { replace: jest.fn() }; // one object, like the real hook; a new one each render reruns the plan's effect
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('./supabase', () => ({
  lookup: jest.fn().mockRejectedValue(new Error('offline')),
  recordPlan: jest.fn().mockRejectedValue(new Error('offline')),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');

// protects=the plan screen shows the kit and Nearby help, and a US user keeps the US help links when the area lookup fails; fails_when=plan.tsx drops NearbyHelp, or inUs comes only from the area result; no_claim=the live lookup returns in_us correctly
test('plan: offline US user still gets the kit and US help links', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  await AsyncStorage.setItem('household', JSON.stringify({ adults: 2, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false }));
  await AsyncStorage.setItem('location', JSON.stringify({ lat: 37.78, lon: -121.54, label: 'Tracy, California', countryCode: 'US' }));

  await render(<Plan />);
  expect(await screen.findByText("Couldn't load your area's hazards, so this is the basic kit.")).toBeTruthy();
  expect(screen.getByText('Nearby help')).toBeTruthy();
  expect(screen.getByRole('link', { name: '211.org' })).toBeTruthy();
  expect(screen.queryByText('Check your local emergency services.')).toBeNull();
  expect(require('./supabase').recordPlan).toHaveBeenCalledTimes(1); // the counter insert is wired, and its failure doesn't break the plan
});

// protects=a GPS user (no saved country) gets the same US/non-US answer in Warnings and Nearby help when the area lookup fails; fails_when=NearbyHelp falls back to its own rule and drops the US help links while Warnings still treats the place as US; no_claim=that guessing US is right for a GPS user abroad
test('plan: GPS user with the area lookup down gets US help links, like Warnings', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  await AsyncStorage.clear();
  await AsyncStorage.setItem('household', JSON.stringify({ adults: 1, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false }));
  await AsyncStorage.setItem('location', JSON.stringify({ lat: 35.47, lon: -97.52, label: 'Your location' }));

  await render(<Plan />);
  expect(await screen.findByText("Couldn't load your area's hazards, so this is the basic kit.")).toBeTruthy();
  expect(screen.queryByText(/only available in the US/)).toBeNull();
  expect(screen.getByRole('link', { name: '211.org' })).toBeTruthy();
});
