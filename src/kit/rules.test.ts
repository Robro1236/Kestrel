import { buildKit, KIT_GROUPS, waterGallons, type Hazard, type Household } from './rules';

const base: Household = {
  adults: 2, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false,
};
const ids = (h: Household, hazards: Hazard[] = []) => buildKit(h, hazards).map((i) => i.id);
const qty = (h: Household, hazards: Hazard[], id: string) => buildKit(h, hazards).find((i) => i.id === id)?.qty;
const rm = (type: string): Hazard => ({ type, rating: 'Relatively Moderate' });

const BASE_IDS = [
  'water', 'food', 'can-opener', 'flashlight', 'radio', 'first-aid', 'whistle', 'dust-masks',
  'charger', 'documents', 'cash', 'map', 'sanitation', 'wrench',
];

// protects=the water quantity a judge sees for the acceptance household (criterion 2)
// fails_when=people, pet or heat-wave gallons are miscounted
// no_claim=does not prove 1 gal/person/day is right for every climate
test('water: 2 adults + 1 infant + 1 dog is 12 gallons, 15 with a heat-wave rating', () => {
  const h = { ...base, infants: 1, dogs: 1 };
  expect(qty(h, [], 'water')).toBe('12 gallons');
  expect(qty(h, [rm('heat_wave')], 'water')).toBe('15 gallons');
  expect(waterGallons({ ...base, cats: 2 }, [])).toBe(8);
});

// protects=a plain household gets exactly the always-on list, with per-person quantities
// fails_when=a conditional item leaks into the base kit or a base item goes missing
// no_claim=does not check the wording of labels or reasons
test('base kit has only the always items', () => {
  expect(ids(base)).toEqual(BASE_IDS);
  expect(qty(base, [], 'dust-masks')).toBe('2 masks');
  expect(qty(base, [], 'food')).toBe('3 days for 2 people');
});

// protects=infant items appear exactly when infants > 0, diapers scale by 24 each (criterion 3)
// fails_when=infant items show for a household with no infants, or the diaper count is wrong
// no_claim=does not prove 24 diapers is enough for every infant
test('infant items', () => {
  const extra = ids({ ...base, infants: 2 }).filter((i) => !BASE_IDS.includes(i));
  expect(extra).toEqual(['formula', 'diapers', 'wipes', 'rash-cream']);
  expect(qty({ ...base, infants: 2 }, [], 'diapers')).toBe('48 diapers');
});

// protects=child items appear exactly when children > 0
// fails_when=child items are tied to infants or always shown
// no_claim=nothing about which comfort item suits a child
test('child items', () => {
  const extra = ids({ ...base, children: 1 }).filter((i) => !BASE_IDS.includes(i));
  expect(extra).toEqual(['comfort', 'child-id']);
});

// protects=senior/mobility items appear for either trigger, once
// fails_when=only one of the two triggers works, or both together duplicate items
// no_claim=does not cover specific medical devices
test('senior or mobility items', () => {
  const want = ['glasses', 'mobility-parts', 'medical-power'];
  for (const h of [{ ...base, seniors: 1 }, { ...base, mobility: true }, { ...base, seniors: 1, mobility: true }]) {
    expect(ids(h).filter((i) => !BASE_IDS.includes(i))).toEqual(want);
  }
});

// protects=medication and pet items appear exactly when their inputs are yes / > 0 (criterion 3)
// fails_when=medication items show without the flag, or a cat-only household gets no pet items
// no_claim=does not prove a 7-day supply is obtainable
test('medication and pet items', () => {
  expect(ids({ ...base, medication: true }).filter((i) => !BASE_IDS.includes(i))).toEqual(['medications', 'medication-list']);
  expect(ids({ ...base, cats: 1 }).filter((i) => !BASE_IDS.includes(i))).toEqual(['pet-food', 'pet-carrier', 'pet-records', 'pet-photo']);
  // A rabbit or bird gets the same pet items and a cat's water; a household saved before otherPets existed still adds up.
  expect(ids({ ...base, otherPets: 1 }).filter((i) => !BASE_IDS.includes(i))).toEqual(['pet-food', 'pet-carrier', 'pet-records', 'pet-photo']);
  expect(waterGallons({ ...base, otherPets: 2 }, [])).toBe(8);
  expect(waterGallons(base, [])).toBe(6);
});

// protects=each FEMA hazard type adds its own items and nothing else
// fails_when=a hazard key is misspelled, mapped to the wrong items, or winter hazards duplicate items
// no_claim=does not prove these keys match what the lookup function sends (T3 must use the same names)
test('each hazard trigger', () => {
  const cases: Record<string, string[]> = {
    earthquake: ['eq-shoes', 'eq-strap', 'eq-gas'],
    inland_flood: ['flood-boots', 'flood-route', 'flood-insurance'],
    coastal_flood: ['flood-boots', 'flood-route', 'flood-insurance'],
    heat_wave: ['heat-fan', 'heat-towels', 'heat-checkin'],
    wildfire: ['fire-n95', 'fire-gobag', 'fire-purifier'],
    hurricane: ['hurricane-shutters', 'hurricane-batteries', 'hurricane-fuel'],
    tornado: ['tornado-helmet', 'tornado-room'],
    winter_weather: ['winter-blankets', 'winter-warmers', 'winter-salt'],
    cold_wave: ['winter-blankets', 'winter-warmers', 'winter-salt'],
    ice_storm: ['winter-blankets', 'winter-warmers', 'winter-salt'],
    drought: [],
  };
  for (const [type, want] of Object.entries(cases)) {
    expect(ids(base, [rm(type)]).filter((i) => !BASE_IDS.includes(i))).toEqual(want);
  }
  const allWinter = ids(base, [rm('winter_weather'), rm('cold_wave'), rm('ice_storm')]);
  expect(allWinter.filter((i) => i === 'winter-blankets')).toHaveLength(1);
  expect(qty(base, [rm('wildfire')], 'fire-n95')).toBe('4 masks');
});

// protects=only Relatively Moderate, Relatively High and Very High count as a risk
// fails_when=a low or non-rating value ("Not Applicable", "No Rating") triggers hazard items
// no_claim=does not prove FEMA's ratings are accurate for a given address
test('rating threshold', () => {
  for (const rating of ['Relatively Moderate', 'Relatively High', 'Very High']) {
    expect(ids(base, [{ type: 'earthquake', rating }])).toContain('eq-shoes');
  }
  for (const rating of ['Relatively Low', 'Very Low', 'No Rating', 'Not Applicable', 'Insufficient Data', '']) {
    expect(ids(base, [{ type: 'earthquake', rating }])).toEqual(BASE_IDS);
  }
});

// protects=infants never get masks or helmets, and pets never count as people
// fails_when=an infant or a pet raises the dust mask, N95 or helmet count
// no_claim=does not check the wording of the infant note on helmets
test('masks and helmets count everyone but infants and pets', () => {
  const h = { ...base, infants: 1, dogs: 2, cats: 1 };
  const hz = [rm('wildfire'), rm('tornado')];
  expect(qty(h, hz, 'dust-masks')).toBe('2 masks');
  expect(qty(h, hz, 'fire-n95')).toBe('4 masks');
  expect(qty(h, hz, 'tornado-helmet')).toBe('2, one per person');
  expect(qty({ ...base, adults: 0, infants: 1 }, hz, 'tornado-helmet')).toBeUndefined();
});

// protects=extras are advice, not checklist items: no amount, and every essential has none of them
// fails_when=a tip gets a per-person amount, or an essential like water is marked as a tip
// no_claim=does not judge which items are essential
test('tips have no amount and essentials stay on the checklist', () => {
  const kit = buildKit({ ...base, children: 2, dogs: 1 }, [rm('tornado'), rm('winter_weather')]);
  const tips = kit.filter((i) => i.tip);
  expect(tips.map((i) => i.id)).toEqual(['comfort', 'child-id', 'pet-photo', 'tornado-room', 'winter-warmers', 'winter-salt']);
  expect(tips.filter((i) => i.qty)).toEqual([]);
  expect(kit.filter((i) => BASE_IDS.includes(i.id) && i.tip)).toEqual([]);
  expect(kit.find((i) => i.id === 'water')?.details).toBeTruthy();
});

// protects=every kit item lands in a named checklist section, basics by topic, household and hazard extras in their own; fails_when=an item has no group and vanishes from the plan, or a hazard item shows under the household; no_claim=the section names are the clearest wording
test('groups: every item has a section, extras sorted by household and hazard', () => {
  const all = ['earthquake', 'inland_flood', 'heat_wave', 'wildfire', 'hurricane', 'tornado', 'winter_weather'].map(rm);
  const kit = buildKit({ ...base, infants: 1, children: 1, seniors: 1, dogs: 1, medication: true }, all);
  for (const i of kit) expect(KIT_GROUPS).toContain(i.group);
  const g = (id: string) => kit.find((i) => i.id === id)?.group;
  expect(g('water')).toBe('Water and food');
  expect(g('radio')).toBe('Light and power');
  expect(g('cash')).toBe('Papers and money');
  expect(g('diapers')).toBe('For your household');
  expect(g('pet-food')).toBe('For your household');
  expect(g('hurricane-batteries')).toBe("For your area's hazards");
  expect(g('fire-n95')).toBe("For your area's hazards");
});
