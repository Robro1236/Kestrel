import jmp from './jmp.json';

// protects=the water baseline label reads a sane table (US counts as safe, every value is a real percentage)
// fails_when=jmp.json is regenerated with aggregates, nulls, out-of-range values, or without the US
// no_claim=does not prove the figures match the current WHO/UNICEF JMP release
test('jmp.json is a valid ISO2 -> percentage table', () => {
  const entries = Object.entries(jmp.countries);
  expect(entries.length).toBeGreaterThan(100);
  for (const [iso2, { pct, year }] of entries) {
    expect(iso2).toMatch(/^[A-Z]{2}$/);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
    expect(year).toBeGreaterThanOrEqual(2015);
  }
  expect(jmp.countries.US.pct).toBeGreaterThanOrEqual(90);
});
