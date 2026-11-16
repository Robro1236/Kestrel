import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import Home from '../app/index';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), canGoBack: () => true }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('./supabase', () => ({ preparedCount: jest.fn().mockResolvedValue(null) }));
jest.mock('./useAppFonts', () => ({ useAppFonts: () => [true, null] }));

// protects=home has a Share with a neighbor button that opens the share sheet with the app link; fails_when=the button is missing or the shared text has no link; no_claim=the phone's share sheet itself
test('home: share with a neighbor', async () => {
  const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await render(<Home />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Share with a neighbor' }));
  expect(spy).toHaveBeenCalledWith({ message: expect.stringContaining('https://kestrel-tan.vercel.app') });
});
