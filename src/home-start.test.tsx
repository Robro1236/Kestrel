import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => {} }));
jest.mock('./supabase', () => ({ preparedCount: () => Promise.resolve(null) }));

// protects=the ?start demo link clears saved answers but keeps the counted-once mark; fails_when=the household or plan survives, or the device is counted again; no_claim=the URL handling in a browser
test('home: start over clears answers but keeps the counted mark', async () => {
  const { startOver } = require('../app/index');
  await AsyncStorage.multiSet([['household', '{}'], ['location', '{}'], ['familyPlan', '{}'], ['planRecorded', 'true']]);
  await startOver();
  expect(await AsyncStorage.getAllKeys()).toEqual(['planRecorded']);
});
