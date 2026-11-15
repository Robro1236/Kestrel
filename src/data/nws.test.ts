import { fetchWarnings, parseAlerts } from './nws';

// Trimmed from a real /alerts/active response (shape recorded in docs/data-sources.md).
const SAMPLE = {
  type: 'FeatureCollection',
  features: [
    {
      properties: {
        '@id': 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.abc',
        event: 'Flash Flood Warning',
        headline: 'Flash Flood Warning issued November 14 at 2:44PM CST until November 14 at 8:45PM CST by NWS Norman OK',
        severity: 'Severe',
        ends: '2026-11-14T20:45:00-06:00',
        expires: '2026-11-14T21:00:00-06:00',
      },
    },
    // No `ends`: kept until `expires`.
    { properties: { '@id': 'b', event: 'Wind Advisory', headline: 'Wind Advisory', severity: 'Moderate', ends: null, expires: '2026-11-15T06:00:00-06:00' } },
    // Already over: dropped.
    { properties: { '@id': 'c', event: 'Freeze Warning', headline: 'Old', severity: 'Severe', ends: '2026-11-13T09:00:00-06:00' } },
    // No event name: dropped.
    { properties: { '@id': 'd' } },
  ],
};
const NOW = new Date('2026-11-14T15:00:00-06:00');

// protects=the warning fields a judge sees (event, headline, severity, end time) from a sample alert response; fails_when=fields are misread, `expires` is passed off as `ends`, an alert with only `expires` is dropped early, or ended/nameless alerts show; no_claim=today's live NWS alerts (which may be empty) parse the same way
test('nws: parses a sample alert response', () => {
  expect(parseAlerts(SAMPLE, NOW)).toEqual([
    {
      id: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.abc',
      event: 'Flash Flood Warning',
      headline: SAMPLE.features[0].properties.headline,
      severity: 'Severe',
      ends: '2026-11-14T20:45:00-06:00',
      expires: '2026-11-14T21:00:00-06:00',
    },
    // `expires` is kept apart from `ends`: it's when the message is replaced, not when the danger ends.
    { id: 'b', event: 'Wind Advisory', headline: 'Wind Advisory', severity: 'Moderate', ends: null, expires: '2026-11-15T06:00:00-06:00' },
  ]);
  expect(parseAlerts({ features: [] }, NOW)).toEqual([]);
});

// protects=the "Couldn't check warnings" path: bad bodies and HTTP errors reject instead of looking like "no warnings"; fails_when=an error body or a 500 resolves to an empty alert list; no_claim=the NWS URL format stays the same
test('nws: errors reject, never an empty list', async () => {
  expect(() => parseAlerts({ status: 400, title: 'Bad Request' })).toThrow();
  const respond = (ok: boolean, body: unknown) =>
    (globalThis.fetch = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as typeof fetch);
  respond(false, {});
  await expect(fetchWarnings(35.4676, -97.5164)).rejects.toThrow(/HTTP 500/);
  respond(true, { features: [] });
  const w = await fetchWarnings(35.4676, -97.5164);
  expect(w.alerts).toEqual([]);
  expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe('https://api.weather.gov/alerts/active?point=35.4676,-97.5164');
});
