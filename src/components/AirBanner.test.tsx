import { act, render, screen, waitFor } from '@testing-library/react-native';

import { AirBanner } from './AirBanner';

const respond = (body: unknown) =>
  (globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }) as unknown as typeof fetch);

// protects=acceptance criterion 4 on screen: the banner shows its tier and source above AQI 100 and stays hidden at or below it; fails_when=AirBanner renders without data, ignores the 100 cutoff, or drops the source line; no_claim=the plan screen places the banner where users see it
test('AirBanner: shows the tier above AQI 100, nothing at 80', async () => {
  respond({ current: { us_aqi: 132.4, pm2_5: 48.1 } });
  await render(<AirBanner lat={37.78} lon={-121.54} />);
  expect(await screen.findByText(/Unhealthy for sensitive groups \(US AQI 132\)/)).toBeTruthy();
  expect(screen.getByText(/Source: Open-Meteo/)).toBeTruthy();

  respond({ current: { us_aqi: 80, pm2_5: 10 } });
  await screen.rerender(<AirBanner lat={-1.29} lon={36.82} />);
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  await act(() => new Promise((r) => setTimeout(r, 0))); // let the AQI 80 answer land
  expect(screen.queryByText(/Air quality:/)).toBeNull();
});
