import { fireEvent, render, screen } from '@testing-library/react-native';

import { HAZARD_ADVICE } from '../kit/hazardAdvice';
import { Hazards } from './Hazards';

// The 11 FEMA NRI types the lookup function returns (supabase/functions/lookup/area.ts HAZARD_FIELDS).
const TYPES = ['earthquake', 'inland_flood', 'coastal_flood', 'heat_wave', 'wildfire', 'hurricane', 'tornado', 'winter_weather', 'cold_wave', 'ice_storm', 'drought'];

// protects=every hazard type has cited Ready.gov advice, and tapping a hazard shows it; fails_when=a type has no advice or no source, or the row doesn't expand/collapse; no_claim=the advice wording matches Ready.gov (checked by hand)
test('Hazards: each hazard opens its Ready.gov advice', async () => {
  for (const t of TYPES) {
    const a = HAZARD_ADVICE[t];
    expect(a?.url).toMatch(/^https:\/\/www\.ready\.gov\//);
    expect(a.steps.length).toBeGreaterThan(0);
  }

  await render(
    <Hazards hazards={[{ type: 'tornado', rating: 'Very High' }, { type: 'drought', rating: 'Very Low' }]} inUs county="Oklahoma County" failed={false} />,
  );
  expect(screen.queryByText(/Drought/)).toBeNull();
  const row = screen.getByRole('button', { name: 'Tornado, Very High. What to do' });
  expect(screen.queryByText(/Source: Ready.gov/)).toBeNull();

  await fireEvent.press(row);
  expect(screen.getByText(/go to your safe place immediately/)).toBeTruthy();
  expect(screen.getByText('Source: Ready.gov, "Tornadoes" (updated June 2, 2026)')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Read more about tornado on Ready.gov' })).toBeTruthy();

  await fireEvent.press(row);
  expect(screen.queryByText(/go to your safe place immediately/)).toBeNull();
});

// protects=the hazards card opens with the county's highest FEMA rating in one line; fails_when=the line names a lower-rated hazard or is missing; no_claim=FEMA ratings are current
test('Hazards: names the top risk first', async () => {
  await render(<Hazards hazards={[{ type: 'heat_wave', rating: 'Relatively High' }, { type: 'earthquake', rating: 'Very High' }]} inUs county="San Joaquin County" failed={false} />);
  expect(screen.getByText("San Joaquin County's top risk: Earthquake, rated Very High. Tap a hazard for what to do.")).toBeTruthy();
});
