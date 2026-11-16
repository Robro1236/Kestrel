import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';

import Home from '../app/index';
import { preparedCount } from './supabase';

// expo-font needs expo-asset, which Jest can't resolve here; fonts are a no-op in tests.
jest.mock('./useAppFonts', () => ({ useAppFonts: () => [true, null] }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, canGoBack: () => false }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('./supabase', () => ({ preparedCount: jest.fn() }));

// protects=opening the app with a saved plan goes straight to /plan, and only once per launch
// fails_when=a returning user lands on the welcome page, or later visits (About Kestrel) also redirect
// no_claim=the real router's canGoBack on a deep link
test('home: a returning user opens to their plan, once', async () => {
  jest.mocked(preparedCount).mockResolvedValue(null);
  await AsyncStorage.multiSet([['household', '{}'], ['location', '{}']]);
  const { unmount } = await render(<Home />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/plan'));
  unmount();
  await render(<Home />);
  expect(await screen.findByRole('button', { name: 'View my plan' })).toBeTruthy();
  expect(mockReplace).toHaveBeenCalledTimes(1);
});
