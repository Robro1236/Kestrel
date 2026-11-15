import { waterGuidance } from './guidance';
import { fetchElevation } from './elevation';

const base = { gallons: 12, countryCode: 'US', hazards: [], activeAlerts: [], elevationM: 18 };
const step = (g: ReturnType<typeof waterGuidance>, id: string) => g.steps.find((s) => s.id === id)?.text ?? '';

// protects=acceptance criterion 6, the JMP < 90 label; fails_when=a low-coverage country (AF, 30.6%) shows no warning or the US shows one; no_claim=jmp.json matches the latest JMP release
test('water baseline: below 90% warns with the data year, US shows nothing', () => {
  const af = waterGuidance({ ...base, countryCode: 'AF' }).baseline;
  expect(af?.text).toMatch(/^Tap water here may not be safe/);
  expect(af?.source).toBe('WHO/UNICEF JMP, 2024 data');
  expect(waterGuidance(base).baseline).toBeNull();
  expect(waterGuidance({ ...base, countryCode: 'us' }).baseline).toBeNull();
});

// protects=acceptance criterion 6, the missing-country label; fails_when=a country missing from jmp.json (Kenya) or an unknown country shows "may not be safe" or nothing; no_claim=Kenya stays missing from future JMP releases
test('water baseline: missing or unknown country gets the no-data label', () => {
  expect(waterGuidance({ ...base, countryCode: 'KE' }).baseline?.text).toMatch(/^We don't have tap water data/);
  expect(waterGuidance({ ...base, countryCode: null }).baseline?.text).toMatch(/^We don't have tap water data/);
});

// protects=the disaster warning shows exactly for flood, hurricane or earthquake at >= Relatively Moderate; fails_when=a low rating or another hazard (tornado) triggers it, or a qualifying one doesn't; no_claim=the wording matches every health department's advice
test('water disaster warning: flood, hurricane, earthquake at moderate or above', () => {
  const r = (type: string, rating = 'Relatively Moderate') => waterGuidance({ ...base, hazards: [{ type, rating }] }).disaster;
  expect(r('inland_flood')?.source).toMatch(/^CDC/);
  expect(r('coastal_flood')).not.toBeNull();
  expect(r('hurricane', 'Very High')).not.toBeNull();
  expect(r('earthquake')).not.toBeNull();
  expect(r('earthquake', 'Relatively Low')).toBeNull();
  expect(r('tornado', 'Very High')).toBeNull();
  expect(waterGuidance(base).disaster).toBeNull();
});

// protects=an active NWS flood or hurricane alert marks the warning urgent, even with no hazard rating; fails_when=a Flood Watch is not urgent, or a Freeze Warning is; no_claim=NWS keeps these event names
test('water active alert: flood or hurricane event makes the warning urgent', () => {
  const flood = waterGuidance({ ...base, activeAlerts: ['Freeze Warning', 'Flash Flood Watch'] });
  expect(flood.urgent).toBe(true);
  expect(flood.disaster).not.toBeNull();
  expect(waterGuidance({ ...base, activeAlerts: ['Hurricane Warning'] }).urgent).toBe(true);
  const freeze = waterGuidance({ ...base, activeAlerts: ['Freeze Warning'] });
  expect(freeze.urgent).toBe(false);
  expect(freeze.disaster).toBeNull();
});

// protects=acceptance criterion 5, the CDC 6,500 ft boil rule; fails_when=2000 m says 1 minute, 1981 m says 3, or an unknown elevation drops the 3-minute rule; no_claim=Open-Meteo's elevation is right for the user's exact spot
test('water boil: 3 minutes only above 1981 m, both when unknown', () => {
  expect(step(waterGuidance({ ...base, elevationM: 2000 }), 'boil')).toMatch(/rolling boil for 3 minutes/);
  expect(step(waterGuidance({ ...base, elevationM: 1981 }), 'boil')).toMatch(/rolling boil for 1 minute\./);
  expect(step(waterGuidance({ ...base, elevationM: null }), 'boil')).toMatch(/1 minute \(3 minutes above 6,500 feet\)/);
});

// protects=the bleach totals from the spec (8 drops/gal, 40 drops = 1/2 tsp); fails_when=12 gallons is not 96 drops ~ 1 1/4 teaspoons or 5 gallons is not 40 drops ~ 1/2 teaspoon; no_claim=the user's bleach is 5-9% strength
test('water bleach: drops and teaspoons for the kit gallons', () => {
  expect(step(waterGuidance(base), 'bleach')).toMatch(/For your 12 gallons: 96 drops, about 1 1\/4 teaspoons\./);
  expect(step(waterGuidance({ ...base, gallons: 5 }), 'bleach')).toMatch(/40 drops, about 1\/2 teaspoon\./);
  expect(step(waterGuidance({ ...base, gallons: 10 }), 'bleach')).toMatch(/80 drops, about 1 teaspoon\./);
  expect(waterGuidance(base).steps.every((s) => s.source.startsWith('CDC'))).toBe(true);
});

// protects=boil time falls back safely; fails_when=a failed or malformed elevation call returns a number; no_claim=Open-Meteo keeps the `elevation` array shape
test('elevation: failures give null', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ elevation: [1234.5] }) }) as unknown as typeof fetch;
  expect(await fetchElevation(35.47, -97.52)).toBe(1234.5);
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as unknown as typeof fetch;
  expect(await fetchElevation(35.47, -97.52)).toBeNull();
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  expect(await fetchElevation(35.47, -97.52)).toBeNull();
});
