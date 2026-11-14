// One mock instance shared across jest.resetModules(), standing in for the device's storage.
const mockStorage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);
const AsyncStorage = mockStorage;

type Storage = typeof import('./storage');
let s: Storage;
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.resetModules();
  s = require('./storage');
});

// protects=the home counter rises by exactly 1 per device (criterion 12)
// fails_when=a second build, or two mounts at once, inserts another kit_plans row
// no_claim=does not prove the Supabase insert itself succeeds
test('recordPlanOnce records once, even when called twice at once', async () => {
  const record = jest.fn().mockResolvedValue(undefined);
  await Promise.all([s.recordPlanOnce(record), s.recordPlanOnce(record)]);
  await s.recordPlanOnce(record);
  jest.resetModules(); // a later page load, same device storage
  await (require('./storage') as Storage).recordPlanOnce(record);
  expect(record).toHaveBeenCalledTimes(1);
});

// protects=a failed counter insert is retried on the next visit instead of being lost
// fails_when=the flag stays set after a failed insert
// no_claim=does not cover a failure between the insert succeeding and the flag being read
test('recordPlanOnce retries after a failure', async () => {
  const record = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  await s.recordPlanOnce(record);
  await s.recordPlanOnce(record);
  expect(record).toHaveBeenCalledTimes(2);
});

// protects=each source's last result survives a reload with its date (criterion 8)
// fails_when=two sources saving at once overwrite each other, or the date is lost
// no_claim=does not prove the browser keeps localStorage between visits
test('saveResult keeps every source with its date', async () => {
  const when = new Date('2026-11-14T10:00:00Z');
  await Promise.all([s.saveResult('area', { county: 'X' }, when), s.saveResult('warnings', [], when)]);
  expect(await s.loadResult('area')).toEqual({ data: { county: 'X' }, savedAt: '2026-11-14T10:00:00.000Z' });
  expect(await s.loadResult('warnings')).toEqual({ data: [], savedAt: '2026-11-14T10:00:00.000Z' });
  expect(await s.loadResult('places')).toBeNull();
});

// protects=the app keeps working for the session when storage is broken
// fails_when=a storage error or corrupt JSON throws into the UI
// no_claim=does not test real browser quota errors
test('storage failures are swallowed', async () => {
  await AsyncStorage.setItem('household', '{not json');
  expect(await s.load('household')).toBeNull();
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('quota'));
  await expect(s.save('checked', ['water'])).resolves.toBeUndefined();
});
