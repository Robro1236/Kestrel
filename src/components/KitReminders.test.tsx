import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { KitReminders, REMINDERS } from './KitReminders';

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { YEARLY: 'yearly' },
}));

const N = Notifications as jest.Mocked<typeof Notifications>;
const LABEL = /Remind me to check my kit/;

// protects=the reminder switch schedules one yearly heat and one fire reminder on phones, cancels them when turned off, and explains a denied permission; fails_when=it shows on web or outside the US, schedules without permission, uses the wrong month/day, or leaves reminders after turning off; no_claim=the phone actually delivers them on the date (needs a device)
test('KitReminders: schedules yearly heat and fire reminders, cancels them, handles denial', async () => {
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);

  await render(<KitReminders inUs={false} />);
  expect(screen.queryByText(LABEL)).toBeNull();
  await screen.unmount();

  const os = Platform.OS;
  Platform.OS = 'web';
  await render(<KitReminders inUs />);
  expect(screen.queryByText(LABEL)).toBeNull();
  await screen.unmount();
  Platform.OS = os;

  await render(<KitReminders inUs />);
  await fireEvent.press(await screen.findByText(LABEL));
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  expect(N.scheduleNotificationAsync.mock.calls.map(([req]) => [req.identifier, req.trigger])).toEqual([
    ['kit-heat', expect.objectContaining({ type: 'yearly', month: 4, day: 15, hour: 9 })],
    ['kit-fire', expect.objectContaining({ type: 'yearly', month: 5, day: 15, hour: 9 })],
  ]);
  expect(screen.getByRole('switch').props.accessibilityState).toMatchObject({ checked: true });

  await fireEvent.press(screen.getByRole('switch'));
  expect(N.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id)).toEqual(REMINDERS.map((r) => r.id));
  expect(screen.getByRole('switch').props.accessibilityState).toMatchObject({ checked: false });
  await screen.unmount();

  // Already scheduled shows as on; a denied permission schedules nothing and says why.
  N.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'kit-heat' }] as never);
  await render(<KitReminders inUs />);
  expect((await screen.findByRole('switch')).props.accessibilityState).toMatchObject({ checked: true });
  await screen.unmount();

  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
  N.scheduleNotificationAsync.mockClear();
  await render(<KitReminders inUs />);
  await fireEvent.press(await screen.findByText(LABEL));
  expect(await screen.findByText(/Notifications are off for Kestrel/)).toBeTruthy();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});
