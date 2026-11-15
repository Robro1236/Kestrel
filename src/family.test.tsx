import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Family, { planText } from '../app/family';
import { FamilyPlanLink } from './components/FamilyPlanLink';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const AsyncStorage = require('@react-native-async-storage/async-storage');

// protects=the family plan card keeps what was typed after a reload, and the shared text lists only filled fields; fails_when=edits aren't saved, a saved plan isn't loaded, or empty fields show up in the shared text; no_claim=printing on web or the native share sheet works
test('family: typed plan is saved, reloaded, and shared without empty fields', async () => {
  await render(<Family />);
  await fireEvent.changeText(screen.getByLabelText('Meeting place near home'), 'Mailbox at the corner');
  await fireEvent.changeText(screen.getByLabelText('Evacuation zone'), 'SJC-001');
  await waitFor(async () =>
    expect(JSON.parse(await AsyncStorage.getItem('familyPlan'))).toMatchObject({ nearHome: 'Mailbox at the corner', zone: 'SJC-001' }),
  );

  await screen.unmount();
  await render(<Family />);
  expect(await screen.findByDisplayValue('SJC-001')).toBeTruthy();

  const text = planText(JSON.parse(await AsyncStorage.getItem('familyPlan')));
  expect(text).toBe('Our family emergency plan\nMeeting place near home: Mailbox at the corner\nEvacuation zone: SJC-001');
});

// protects=the plan screen's entry point opens the family plan card; fails_when=the link is missing its name or role, or goes anywhere but /family; no_claim=the link's position or look on the plan screen
test('FamilyPlanLink: opens the family plan card', async () => {
  await render(<FamilyPlanLink />);
  await fireEvent.press(screen.getByRole('link', { name: 'Family plan card' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/family');
});
