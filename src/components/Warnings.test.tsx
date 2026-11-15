import { render, screen } from '@testing-library/react-native';

import { Warnings } from './Warnings';

const saved = (ends: string | null) => ({
  savedAt: '2026-11-14T12:00:00Z',
  data: {
    lat: 35.4676, lon: -97.5164, fetched_at: '2026-11-14T12:00:00Z',
    alerts: [{ id: 'a', event: 'Tornado Warning', headline: 'Tornado Warning issued by NWS Norman OK', severity: 'Extreme', ends }],
  },
});

// protects=the three plain states (not US, failed, none) and the banner for an active alert with its source; fails_when=a failure crashes or reads as "no warnings", the banner hides an active alert, or an ended alert still shows; no_claim=the plan screen fetches and passes the right result
test('Warnings: banner only for active alerts, plain text otherwise', async () => {
  const p = { lat: 35.4676, lon: -97.5164, inUs: true, failed: false };
  await render(<Warnings {...p} inUs={false} warnings={null} />);
  expect(screen.getByText(/only available in the US/)).toBeTruthy();

  await screen.rerender(<Warnings {...p} warnings={null} failed />);
  expect(screen.getByText("Couldn't check warnings right now.")).toBeTruthy();

  await screen.rerender(<Warnings {...p} warnings={{ ...saved(null), data: { ...saved(null).data, alerts: [] } }} />);
  expect(screen.getByText(/^No active warnings from the National Weather Service/)).toBeTruthy();

  await screen.rerender(<Warnings {...p} warnings={saved('2099-01-01T00:00:00Z')} />);
  expect(screen.getByText('Tornado Warning issued by NWS Norman OK')).toBeTruthy();
  expect(screen.getByText(/^Source: National Weather Service/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Read the full warnings on weather.gov' })).toBeTruthy();

  await screen.rerender(<Warnings {...p} warnings={saved('2020-01-01T00:00:00Z')} />);
  expect(screen.queryByText('Tornado Warning issued by NWS Norman OK')).toBeNull();
});

// protects=an alert with no end time shows when its next update is due, never as "Until", and times name their zone; fails_when=`expires` reads as the end of the danger, or the time has no zone; no_claim=the zone shown is the place's (it's the phone's)
test('Warnings: "Next update by" when NWS gives no end time', async () => {
  const alert = { id: 'b', event: 'Wind Advisory', headline: 'Wind Advisory', severity: 'Moderate', ends: null, expires: '2099-01-01T12:00:00Z' };
  const warnings = { savedAt: '2026-11-14T12:00:00Z', data: { lat: 35.4676, lon: -97.5164, fetched_at: '2026-11-14T12:00:00Z', alerts: [alert] } };
  await render(<Warnings lat={35.4676} lon={-97.5164} inUs failed={false} warnings={warnings} />);
  expect(screen.getByText(/^Next update by .+ (UTC|GMT[-+0-9:]*|[A-Z]{2,5})$/)).toBeTruthy();
  expect(screen.queryByText(/^Until /)).toBeNull();
});
