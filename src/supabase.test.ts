const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mockRpc }) }));
const mockStorage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
type Supa = typeof import('./supabase');
type Storage = typeof import('./storage');
const { recordPlan, preparedCount } = require('./supabase') as Supa;

beforeEach(() => jest.clearAllMocks());

// protects=the counter goes up by exactly 1 per device, sends no household data, and a failed call is retried next visit (criterion 12)
// fails_when=supabase's { error } result is treated as success (flag stays set, count lost), the call carries household or location data, or a second visit counts again
// no_claim=does not prove the live record_plan() RPC exists; checked in the browser network tab
test('recordPlan + recordPlanOnce: one count per device, retried after a failed call', async () => {
  await mockStorage.clear();
  mockRpc.mockResolvedValueOnce({ error: { message: 'offline' } }).mockResolvedValue({ error: null });
  // Each visit is a fresh page load (new module state) with the same device storage.
  const visit = () => {
    let storage!: Storage;
    jest.isolateModules(() => (storage = require('./storage')));
    return storage.recordPlanOnce(recordPlan);
  };
  await visit(); // call fails
  expect(await mockStorage.getItem('planRecorded')).toBe('false');
  await visit(); // retried, succeeds
  await visit(); // already recorded
  expect(mockRpc).toHaveBeenCalledTimes(2);
  expect(mockRpc).toHaveBeenLastCalledWith('record_plan');
});

// protects=the home screen hides the count instead of erroring when it can't load
// fails_when=an RPC error or a thrown network error comes back as a number or throws
// no_claim=does not prove prepared_count() returns the right total
test('preparedCount returns the number, or null on any failure', async () => {
  mockRpc.mockResolvedValueOnce({ data: 41, error: null });
  expect(await preparedCount()).toBe(41);
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } });
  expect(await preparedCount()).toBeNull();
  mockRpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  expect(await preparedCount()).toBeNull();
});
