import { act, render, screen } from '@testing-library/react-native';

import Home from '../app/index';
import { preparedCount } from './supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), canGoBack: () => true }), // not a fresh launch, so no redirect
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('./supabase', () => ({ preparedCount: jest.fn() }));

// protects=home shows "N households prepared", and hides it (no error, Start still there) when the count fails
// fails_when=the count line is missing, shows "null"/an error, or the screen waits on the count
// no_claim=does not prove the live prepared_count() RPC answers
test('home: shows the count, hides it on failure', async () => {
  jest.mocked(preparedCount).mockResolvedValueOnce(1204);
  const { unmount } = await render(<Home />);
  expect(await screen.findByText('1,204 households prepared')).toBeTruthy();
  unmount();

  jest.mocked(preparedCount).mockResolvedValueOnce(null);
  await render(<Home />);
  expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  await act(async () => {}); // let the failed count settle before checking it stays hidden
  expect(screen.queryByText(/prepared/)).toBeNull();
});
