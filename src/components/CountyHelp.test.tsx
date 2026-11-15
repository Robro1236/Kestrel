import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { CountyHelp } from './CountyHelp';

// protects=San Joaquin County users get the alert sign-up, zone map and cooling-center links with a source line, and other counties get nothing; fails_when=the section shows for the wrong county, hides for 06077, a link points elsewhere, or the source line is dropped; no_claim=the county pages still load today
test('CountyHelp: San Joaquin links show for 06077 only', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<CountyHelp countyFips="06077" />);
  expect(screen.getByText('San Joaquin County')).toBeTruthy();
  expect(screen.getByText(/Source: San Joaquin County Office of Emergency Services/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Sign up for SJReady alerts' }));
  expect(open).toHaveBeenLastCalledWith('https://member.everbridge.net/index/397890065268824');
  await fireEvent.press(screen.getByRole('link', { name: 'Find your zone on the county map' }));
  expect(open).toHaveBeenLastCalledWith('https://perimetermap.com/San-Joaquin-CA');

  await screen.rerender(<CountyHelp countyFips="06001" />);
  expect(screen.queryByText('San Joaquin County')).toBeNull();
  await screen.rerender(<CountyHelp countyFips={null} />);
  expect(screen.queryByText('San Joaquin County')).toBeNull();
});
