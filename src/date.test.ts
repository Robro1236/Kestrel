import { localDay } from './date';

// protects=dates show the phone's own day, not the UTC day; fails_when=an evening time west of UTC reads as tomorrow, or the format isn't YYYY-MM-DD; no_claim=does not check every screen uses it
test('localDay: local day, not the UTC day', () => {
  const lateEvening = new Date(2026, 10, 14, 23, 30).toISOString();
  const earlyMorning = new Date(2026, 10, 14, 0, 15).toISOString();
  expect(localDay(lateEvening)).toBe('2026-11-14');
  expect(localDay(earlyMorning)).toBe('2026-11-14');
});
