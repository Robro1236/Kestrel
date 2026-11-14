export type Household = {
  adults: number;
  seniors: number;
  children: number;
  infants: number;
  dogs: number;
  cats: number;
  medication: boolean;
  mobility: boolean;
};

// Same shape as `hazards` in the lookup?kind=area response.
export type Hazard = { type: string; rating: string };

export type KitItem = {
  id: string;
  label: string;
  qty?: string;
  reason: string;
  source: 'Ready.gov' | 'Red Cross' | 'CDC';
};

const AT_LEAST_MODERATE = new Set(['Relatively Moderate', 'Relatively High', 'Very High']);

export const isAtLeastModerate = (rating: string) => AT_LEAST_MODERATE.has(rating);

const peopleIn = (h: Household) => h.adults + h.seniors + h.children + h.infants;

const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

function hazardCheck(hazards: Hazard[]) {
  return (...types: string[]) =>
    hazards.some((x) => types.includes(x.type) && isAtLeastModerate(x.rating));
}

// 3-day kit: 1 gal per person per day, 3 per dog, 1 per cat, +1 per person where heat waves are a risk.
export function waterGallons(h: Household, hazards: Hazard[]): number {
  const people = peopleIn(h);
  const heat = hazardCheck(hazards)('heat_wave') ? people : 0;
  return Math.ceil(people * 3 + h.dogs * 3 + h.cats + heat);
}

export function buildKit(h: Household, hazards: Hazard[]): KitItem[] {
  const people = peopleIn(h);
  const pets = h.dogs + h.cats;
  const risk = hazardCheck(hazards);
  const heat = risk('heat_wave');
  const items: KitItem[] = [];
  const add = (
    id: string,
    label: string,
    reason: string,
    qty?: string,
    source: KitItem['source'] = 'Ready.gov',
  ) => items.push({ id, label, reason, source, ...(qty ? { qty } : {}) });

  add(
    'water',
    'Water',
    `One gallon per person per day for 3 days${pets ? ', plus water for your pets' : ''}${heat ? ', plus extra for heat' : ''}.`,
    count(waterGallons(h, hazards), 'gallon'),
  );
  add('food', 'Non-perishable food', 'Shops may be closed or out of stock.', `3 days for ${count(people, 'person').replace('persons', 'people')}`);
  add('can-opener', 'Manual can opener', 'Canned food is no use without one when the power is out.');
  add('flashlight', 'Flashlight and spare batteries', 'Power cuts are common in every kind of emergency.');
  add('radio', 'Battery or hand-crank radio (NOAA weather)', 'Official updates still reach you when phones and internet are down.');
  add('first-aid', 'First aid kit', 'Help may take longer than usual to arrive.', undefined, 'Red Cross');
  add('whistle', 'Whistle', 'To signal for help.');
  add('dust-masks', 'Dust masks', 'To filter dusty or contaminated air.', count(people, 'mask'));
  add('charger', 'Phone charger and power bank', 'To keep your phone working without mains power.');
  add('documents', 'Copies of IDs and insurance in a waterproof bag', 'You may need to prove who you are or make a claim.');
  add('cash', 'Cash', 'Card machines and ATMs stop working in a power cut.');
  add('map', 'Local paper map', 'Phone maps need signal and battery.');
  add('sanitation', 'Moist towelettes and garbage bags', 'For hygiene when water is limited.');
  add('wrench', 'Wrench or pliers', 'To turn off utilities.');

  if (h.infants > 0) {
    add('formula', 'Formula and bottles', 'Infants need their own food supply.', '3 days');
    add('diapers', 'Diapers', 'About 8 a day for each infant.', count(h.infants * 24, 'diaper'));
    add('wipes', 'Baby wipes', 'For changes when water is limited.');
    add('rash-cream', 'Diaper rash cream', 'Changes may be less frequent than usual.');
  }
  if (h.children > 0) {
    add('comfort', 'Comfort item or game', 'Familiar things help children cope.', `${h.children}, one per child`, 'Red Cross');
    add('child-id', 'Child ID cards with a contact number', 'In case you get separated.', count(h.children, 'card'), 'Red Cross');
  }
  if (h.seniors > 0 || h.mobility) {
    add('glasses', 'Spare glasses or hearing-aid batteries', 'Replacements are hard to get in an emergency.', undefined, 'Red Cross');
    add('mobility-parts', 'Mobility aid spare parts', 'Repairs may not be available.', undefined, 'Red Cross');
    add('medical-power', 'Backup power for medical devices', 'Powered devices must keep running in a power cut.');
  }
  if (h.medication) {
    add('medications', 'Medications', 'Pharmacies may be closed.', '7-day supply', 'Red Cross');
    add('medication-list', 'List of medications and doses', 'So any doctor or pharmacist can help you.', undefined, 'Red Cross');
  }
  if (pets > 0) {
    add('pet-food', 'Pet food', 'Shelters and shops may have none.', `3 days for ${count(pets, 'pet')}`);
    add('pet-carrier', 'Leash or carrier', 'To move pets safely; many shelters require one.');
    add('pet-records', 'Pet medications and vet records', 'Shelters and boarding often ask for vaccination records.');
    add('pet-photo', 'Recent pet photo', 'To help find your pet if you get separated.');
  }

  if (risk('earthquake')) {
    add('eq-shoes', 'Sturdy shoes and gloves by each bed', 'Broken glass is the most common earthquake injury.');
    add('eq-strap', 'Strap heavy furniture and the water heater', 'They can topple in a quake.');
    add('eq-gas', 'Know your gas shutoff', 'A leaking gas line can start a fire after a quake.');
  }
  if (risk('inland_flood', 'coastal_flood')) {
    add('flood-bag', 'Waterproof document bag', 'Flooding is a risk in your county.');
    add('flood-boots', 'Rubber boots', 'Floodwater is often contaminated.');
    add('flood-route', 'Know your evacuation route', 'Roads flood fast; plan the way out before you need it.');
    add('flood-insurance', 'Flood insurance check', 'Standard home insurance usually does not cover floods.');
  }
  if (heat) {
    add('heat-fan', 'Battery fan', 'Air conditioning fails in a power cut.');
    add('heat-towels', 'Cooling towels', 'To bring body temperature down quickly.');
    add('heat-checkin', 'Plan to check on seniors', 'Older adults are at the highest risk in extreme heat.', undefined, 'CDC');
  }
  if (risk('wildfire')) {
    add('fire-n95', 'N95 masks', 'Dust masks do not filter wildfire smoke.', count(people * 2, 'mask'), 'CDC');
    add('fire-gobag', 'Go-bag by the door', 'Wildfire evacuations can come with minutes of warning.');
    add('fire-purifier', 'Air purifier or DIY box-fan filter', 'To keep one room clear of smoke.', undefined, 'CDC');
  }
  if (risk('hurricane')) {
    add('hurricane-shutters', 'Plywood or shutters plan', 'To protect windows from wind and debris.');
    add('hurricane-batteries', 'Extra batteries', 'Hurricane power cuts can last for days.');
    add('hurricane-fuel', 'Fuel up the car', 'Gas stations close or run dry before a storm.');
  }
  if (risk('tornado')) {
    add('tornado-helmet', 'Helmets', 'Head injuries from debris are the main tornado danger.', `${people}, one per person`);
    add('tornado-room', 'Know your safe room', 'Lowest floor, no windows.');
  }
  if (risk('winter_weather', 'cold_wave', 'ice_storm')) {
    add('winter-blankets', 'Blankets', 'Heating can fail in a winter power cut.', count(people, 'blanket'));
    add('winter-warmers', 'Hand warmers', 'For warmth without power.');
    add('winter-salt', 'Rock salt or sand', 'To make icy steps and paths safe.');
  }
  return items;
}
