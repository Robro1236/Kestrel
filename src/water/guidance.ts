// Water safety section (docs/SPEC.md "Water safety"). Pure: every input is passed in.
import jmp from '../data/jmp.json';
import { isAtLeastModerate, type Hazard } from '../kit/rules';

export type WaterLine = { id: string; text: string; source: string };

export type WaterGuidance = {
  gallons: number;
  // Null for countries the JMP rates >= 90% safely managed.
  baseline: WaterLine | null;
  disaster: WaterLine | null;
  // An active flood or hurricane alert: show `disaster` first, highlighted.
  urgent: boolean;
  steps: WaterLine[];
};

type Input = {
  gallons: number;
  countryCode: string | null;
  hazards: Hazard[];
  // Event names of active NWS alerts.
  activeAlerts: string[];
  // Null when the elevation lookup failed.
  elevationM: number | null;
};

const CDC = 'CDC, "How to Make Water Safe in an Emergency" (Sept. 19, 2024)';
const COUNTRIES: Record<string, { pct: number; year: number }> = jmp.countries;

// Eighths of a teaspoon, reduced: 10/8 -> "1 1/4".
function teaspoons(drops: number) {
  const eighths = Math.max(1, Math.round(drops / 10)); // 40 drops = 1/2 tsp, so 10 drops = 1/8 tsp
  const whole = Math.floor(eighths / 8);
  let n = eighths % 8;
  let d = 8;
  while (n && n % 2 === 0) [n, d] = [n / 2, d / 2];
  const frac = n ? `${n}/${d}` : '';
  return `${[whole || '', frac].filter(Boolean).join(' ')} teaspoon${eighths > 8 ? 's' : ''}`;
}

export function waterGuidance({ gallons, countryCode, hazards, activeAlerts, elevationM }: Input): WaterGuidance {
  const row = countryCode ? COUNTRIES[countryCode.toUpperCase()] : undefined;
  const baseline: WaterLine | null = !row
    ? { id: 'baseline', text: "We don't have tap water data for this country. If you're unsure, boil or filter before drinking.", source: 'WHO/UNICEF JMP' }
    : row.pct < 90
      ? { id: 'baseline', text: `Tap water here may not be safe. Boil or filter before drinking. (${row.pct}% of people have safely managed drinking water.)`, source: `WHO/UNICEF JMP, ${row.year} data` }
      : null;

  const risky = hazards.some((h) => ['inland_flood', 'coastal_flood', 'hurricane', 'earthquake'].includes(h.type) && isAtLeastModerate(h.rating));
  const urgent = activeAlerts.some((e) => /flood|hurricane/i.test(e));
  const disaster: WaterLine | null = risky || urgent
    ? { id: 'disaster', text: "After a flood, hurricane or earthquake, your tap water may not be safe. Follow your health department's advice on boiling or treating it.", source: CDC }
    : null;

  const boil = elevationM === null
    ? 'Bring it to a rolling boil for 1 minute (3 minutes above 6,500 feet). Let it cool, then store it in clean, covered containers.'
    : `Bring it to a rolling boil for ${elevationM > 1981 ? '3 minutes (you are above 6,500 feet)' : '1 minute'}. Let it cool, then store it in clean, covered containers.`;
  const drops = Math.ceil(gallons) * 8;

  return {
    gallons,
    baseline,
    disaster,
    urgent,
    steps: [
      { id: 'cloudy', text: 'If the water is cloudy, let it settle, then filter it through a clean cloth, paper towel or coffee filter.', source: CDC },
      { id: 'boil', text: `Boiling is the best way to kill germs. ${boil}`, source: CDC },
      {
        id: 'bleach',
        text: `No way to boil? Add 8 drops (a little less than 1/8 teaspoon) of unscented household bleach (5% to 9% sodium hypochlorite) per gallon, stir, and wait at least 30 minutes. For your ${gallons} gallons: ${drops} drops, about ${teaspoons(drops)}. If the water is cloudy, colored or very cold, use double. Follow the bleach label's own instructions if it has them.`,
        source: CDC,
      },
      { id: 'chemicals', text: 'Boiling and bleach do not remove fuel or chemicals. If those may be in the water, use bottled water.', source: CDC },
    ],
  };
}
