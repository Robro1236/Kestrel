const mockInsert = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
jest.mock('./supabaseRest', () => ({ createClient: () => ({ from: mockFrom, rpc: mockRpc }) }));
const mockStorage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
type Supa = typeof import('./supabase');
type Storage = typeof import('./storage');
const { recordPlan, preparedCount } = require('./supabase') as Supa;

beforeEach(() => jest.clearAllMocks());

// protects=the counter goes up by exactly 1 per device, a timestamp-only row, and a failed insert is retried next visit (criterion 12)
// fails_when=supabase's { error } result is treated as success (flag stays set, row lost), the row carries household or location data, or a second visit inserts again
// no_claim=does not prove the real kit_plans RLS accepts the insert; checked in the browser network tab
test('recordPlan + recordPlanOnce: one timestamp-only row per device, retried after a failed insert', async () => {
  await mockStorage.clear();
  mockInsert.mockResolvedValueOnce({ error: { message: 'offline' } }).mockResolvedValue({ error: null });
  // Each visit is a fresh page load (new module state) with the same device storage.
  const visit = () => {
    let storage!: Storage;
    jest.isolateModules(() => (storage = require('./storage')));
    return storage.recordPlanOnce(recordPlan);
  };
  await visit(); // insert fails
  expect(await mockStorage.getItem('planRecorded')).toBe('false');
  await visit(); // retried, succeeds
  await visit(); // already recorded
  expect(mockInsert).toHaveBeenCalledTimes(2);
  expect(mockInsert).toHaveBeenLastCalledWith({});
  expect(mockFrom).toHaveBeenCalledWith('kit_plans');
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
