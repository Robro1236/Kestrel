import { airTier, fetchAirQuality, showAirBanner } from './airQuality';

// protects=acceptance criterion 4 and the four tier labels; fails_when=AQI 100 shows a banner, 101 does not, or a tier edge (150/151, 200/201, 300/301) lands in the wrong tier; no_claim=the tip wording is medically right
test('air banner: hidden at 100, tiers at their edges', () => {
  expect(showAirBanner(100)).toBe(false);
  expect(airTier(100)).toBeNull();
  expect(showAirBanner(101)).toBe(true);
  const label = (aqi: number) => airTier(aqi)?.label;
  expect([101, 150, 151, 200, 201, 300, 301, 500].map(label)).toEqual([
    'Unhealthy for sensitive groups', 'Unhealthy for sensitive groups',
    'Unhealthy', 'Unhealthy',
    'Very unhealthy', 'Very unhealthy',
    'Hazardous', 'Hazardous',
  ]);
  expect(label(100.4)).toBe('Unhealthy for sensitive groups');
});

// protects=no banner without data ("never show air is fine without data"); fails_when=a failed call, HTTP error or missing us_aqi yields a number; no_claim=Open-Meteo still names the field us_aqi
test('air quality: failures and missing AQI give null', async () => {
  const respond = (ok: boolean, body: unknown) =>
    (globalThis.fetch = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as typeof fetch);

  respond(true, { current: { us_aqi: 132, pm2_5: 48.1 } });
  expect(await fetchAirQuality(37.78, -121.54)).toMatchObject({ aqi: 132, pm25: 48.1 });
  respond(true, { current: {} });
  expect(await fetchAirQuality(37.78, -121.54)).toBeNull();
  respond(false, {});
  expect(await fetchAirQuality(37.78, -121.54)).toBeNull();
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  expect(await fetchAirQuality(37.78, -121.54)).toBeNull();
});
