import { act, render, screen, waitFor } from '@testing-library/react-native';

import { AirBanner, useAirQuality } from './AirBanner';

const respond = (body: unknown) =>
  (globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }) as unknown as typeof fetch);

// The hook and the card together, the way the plan screen uses them.
function Air({ lat, lon }: { lat: number; lon: number }) {
  return <AirBanner air={useAirQuality(lat, lon)} />;
}

// protects=acceptance criterion 4 on screen: the alert banner shows its tier and source above AQI 100, and at or below it only the quiet card shows; fails_when=AirBanner renders without data, ignores the 100 cutoff, or drops the source line; no_claim=the plan screen places the card where users see it
test('AirBanner: shows the tier above AQI 100, only the quiet card at 80', async () => {
  respond({ current: { us_aqi: 132.4, pm2_5: 48.1 } });
  await render(<Air lat={37.78} lon={-121.54} />);
  expect(await screen.findByText(/Unhealthy for sensitive groups \(US AQI 132\)/)).toBeTruthy();
  expect(screen.getByText(/Source: Open-Meteo/)).toBeTruthy();

  respond({ current: { us_aqi: 80, pm2_5: 10 } });
  await screen.rerender(<Air lat={-1.29} lon={36.82} />);
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  await act(() => new Promise((r) => setTimeout(r, 0))); // let the AQI 80 answer land
  expect(screen.queryByText(/Air quality:/)).toBeNull();
  expect(screen.getByText('Moderate · AQI 80')).toBeTruthy();
});
