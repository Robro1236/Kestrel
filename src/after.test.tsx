import { fireEvent, render, screen } from '@testing-library/react-native'; 

import After from '../app/after';
import Water from '../app/water';
import { Menu } from './components/Menu';
import { HiddenWater, heaterDays } from './components/HiddenWater';
import { useLocalArea } from './useLocalArea';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, replace: jest.fn() }), usePathname: () => '/plan' }));
jest.mock('./useLocalArea', () => ({ useLocalArea: jest.fn() }));
const area = (inUs: boolean, extra = {}) => ({ place: { lat: 0, lon: 0, label: 'Tracy, CA' }, inUs, ...extra }) as never;

// protects=the water heater comparison uses the household's 3-day need and never overstates it; fails_when=a big household is told the heater covers all 3 days, or the day count rounds up; no_claim=the household's tank really holds 40 gallons
test('HiddenWater: compares the household need with a typical water heater', async () => {
  expect(heaterDays(12)).toBe(10);
  expect(heaterDays(48)).toBe(2);
  expect(heaterDays(130)).toBe(0);

  await render(<HiddenWater gallons={12} />);
  expect(screen.getByText(/enough for all 3 days on its own/)).toBeTruthy();
  expect(screen.getByText(/shut the main water valve/)).toBeTruthy();
  await screen.unmount();
  await render(<HiddenWater gallons={48} />);
  expect(screen.getByText(/about 2 days of that/)).toBeTruthy();
});

// protects=the after-disaster screen shows every safety checklist with its source, and the FEMA aid card only in the US; fails_when=a topic or its source is dropped, or people outside the US are sent to FEMA; no_claim=the official guidance is unchanged since it was copied
test('After: lists the checklists with sources, FEMA aid only in the US', async () => {
  jest.mocked(useLocalArea).mockReturnValue(area(true));
  await render(<After />);
  for (const t of ['Stay safe first', 'Photograph damage before you clean up', 'Food after a power outage', 'When tap water is safe again', 'Apply for disaster aid']) {
    expect(screen.getByRole('header', { name: t })).toBeTruthy();
  }
  expect(screen.getAllByText(/^Source: /)).toHaveLength(5);
  expect(screen.getByRole('link', { name: 'Apply at DisasterAssistance.gov' })).toBeTruthy();
  await screen.unmount();

  jest.mocked(useLocalArea).mockReturnValue(area(false));
  await render(<After />);
  expect(screen.getByRole('header', { name: 'Food after a power outage' })).toBeTruthy();
  expect(screen.queryByText('Apply for disaster aid')).toBeNull();
});

// protects=the Water tab shows the hidden-water card above the treatment steps, as DESIGN.md keeps "make water safe" last; fails_when=the card is missing or moves below the treatment card; no_claim=the system card's own placement when EPA has no record
test('Water: hidden-water card sits above the make-water-safe steps', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
  jest.mocked(useLocalArea).mockReturnValue(area(false, { household: { adults: 2, children: 0, seniors: 0, infants: 0, dogs: 0, cats: 0 } }));
  await render(<Water />);
  const heads = screen.getAllByRole('header').map((h) => h.props.children);
  expect(heads.indexOf('Water already in your home')).toBe(heads.indexOf('If you need to make water safe') - 1);
});

// protects=the menu links to the after-disaster screen, and the page you're on can't be opened again; fails_when=the link is missing or goes anywhere but /after, or Home on the plan navigates; no_claim=the menu's animation or the greyed look
test('Menu: links to After a disaster', async () => {
  await render(<Menu />);
  await fireEvent.press(screen.getByLabelText('Menu'));
  await fireEvent.press(screen.getByText('Home'));
  expect(mockNavigate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('After a disaster'));
  expect(mockNavigate).toHaveBeenCalledWith('/after');
});
