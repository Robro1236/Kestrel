import { activeOnly, type Alert } from '../data/nws';

// Fixed choices for "What's happening?". Steps are copied from the "during" sections of each Ready.gov page; no AI.
export type Emergency = {
  id: string;
  label: string;
  page: string;
  url: string;
  steps: string[];
  // Kit item ids worth grabbing, most important first; the screen keeps only the ones in this household's kit.
  kit: string[];
  // NWS event names that mean this is happening now. Power outages have no NWS alert.
  nws?: RegExp;
};

export const STEPS_CHECKED = '2026-11-15';

// Listed in pick order: when several alerts are active, the first match wins (evacuation beats everything).
export const EMERGENCIES: Emergency[] = [
  {
    id: 'evacuate',
    label: 'Told to evacuate',
    page: 'Evacuation',
    url: 'https://www.ready.gov/evacuation',
    steps: [
      'Take your emergency supply kit. Listen to a battery-powered radio and follow local evacuation instructions.',
      'Follow recommended evacuation routes. Do not take shortcuts, they may be blocked.',
      'Take your pets with you. Only service animals may be allowed in public shelters.',
      'If time allows: lock doors and windows, leave a note saying when you left and where you are going, and check on neighbors who may need a ride.',
    ],
    kit: ['documents', 'medications', 'medication-list', 'cash', 'charger', 'water', 'food', 'first-aid', 'glasses', 'formula', 'diapers', 'pet-carrier', 'pet-records', 'map'],
    nws: /Evacuation/i,
  },
  {
    id: 'tornado',
    label: 'Tornado',
    page: 'Tornadoes',
    url: 'https://www.ready.gov/tornadoes',
    steps: [
      'Go right away to your safe place: a basement, storm shelter, or small interior room with no windows on the lowest floor.',
      'Stay away from windows, doors and outside walls.',
      'Cover your head and neck with your arms, and put furniture or blankets around or on top of you.',
      'Keep listening to NOAA Weather Radio or local alerts for instructions. Do not shelter under bridges.',
    ],
    kit: ['tornado-helmet', 'flashlight', 'whistle', 'first-aid', 'radio', 'charger'],
    nws: /Tornado/i,
  },
  {
    id: 'hurricane',
    label: 'Hurricane',
    page: 'Hurricanes',
    url: 'https://www.ready.gov/hurricanes',
    steps: [
      'If local officials tell you to evacuate, go right away.',
      'For high winds, take refuge in a storm shelter or an interior room.',
      'If flooding traps you, go to the highest level of the building, but not into a closed attic.',
      'Do not walk, swim or drive through flood water. Six inches of fast-moving water can knock you down.',
    ],
    kit: ['water', 'food', 'radio', 'flashlight', 'hurricane-batteries', 'documents', 'cash', 'medications', 'first-aid', 'charger'],
    nws: /Hurricane|Tropical Storm|Storm Surge/i,
  },
  {
    id: 'flood',
    label: 'Flood',
    page: 'Floods',
    url: 'https://www.ready.gov/floods',
    steps: [
      'Find safe shelter right away. Evacuate if told to do so.',
      'Move to higher ground or a higher floor.',
      "Do not walk, swim or drive through flood water. Turn Around, Don't Drown: one foot of moving water can sweep your car away.",
      'Stay off bridges over fast-moving water.',
    ],
    kit: ['flood-boots', 'documents', 'water', 'radio', 'flashlight', 'charger', 'medications', 'first-aid', 'pet-carrier'],
    nws: /Flood/i,
  },
  {
    id: 'wildfire',
    label: 'Wildfire or smoke',
    page: 'Wildfires',
    url: 'https://www.ready.gov/wildfires',
    steps: [
      'Evacuate immediately if authorities tell you to.',
      'If you are trapped, call 9-1-1 and give your location. Turn on lights to help rescuers find you.',
      'Wear an N95 mask to protect yourself from smoke.',
      'If you are not told to leave but it is smoky, stay inside in a room closed off from outside air, with an air cleaner if you have one.',
    ],
    kit: ['fire-n95', 'documents', 'medications', 'water', 'charger', 'radio', 'cash', 'pet-carrier'],
    nws: /Red Flag|Fire Weather|Fire Warning|Smoke/i,
  },
  {
    id: 'heat',
    label: 'Extreme heat',
    page: 'Extreme Heat',
    url: 'https://www.ready.gov/heat',
    steps: [
      'If you have no air conditioning, go to a cooling center.',
      'Drink plenty of fluids, and take cool showers or baths.',
      'Never leave people or pets in a closed car.',
      'Check on family, older adults and neighbors. Signs of heat stroke: very high temperature, red hot dry skin, confusion. Call 9-1-1 if you suspect it.',
    ],
    kit: ['water', 'heat-fan', 'medications'],
    nws: /Heat/i,
  },
  {
    id: 'winter',
    label: 'Winter storm',
    page: 'Winter Weather',
    url: 'https://www.ready.gov/winter-weather',
    steps: [
      'Stay off roads if at all possible. If you are trapped in your car, stay inside it.',
      'Use generators and grills only outdoors, away from windows. Never heat your home with a gas stove or oven.',
      'Limit time outside and wear layers. Watch for signs of frostbite and hypothermia.',
      'Avoid overexertion when shoveling snow.',
    ],
    kit: ['winter-blankets', 'flashlight', 'radio', 'food', 'water', 'can-opener', 'charger', 'medications'],
    nws: /Winter|Blizzard|Ice Storm|Extreme Cold|Cold Weather|Wind Chill/i,
  },
  {
    id: 'earthquake',
    label: 'Earthquake',
    page: 'Earthquakes',
    url: 'https://www.ready.gov/earthquakes',
    steps: [
      'While it shakes: Drop, Cover your head and neck, and Hold On until it stops. If you are inside, stay inside.',
      'In a car, pull over, stop and set your parking brake.',
      'Expect aftershocks. Be ready to Drop, Cover and Hold On again.',
      'If you are in a damaged building, go outside and move away from it. Do not enter damaged buildings.',
    ],
    kit: ['eq-shoes', 'first-aid', 'flashlight', 'whistle', 'dust-masks', 'wrench', 'water', 'radio'],
    nws: /Earthquake/i,
  },
  {
    id: 'power',
    label: 'Power outage',
    page: 'Power Outages',
    url: 'https://www.ready.gov/power-outages',
    steps: [
      'Keep freezers and refrigerators closed.',
      'Use a generator only outdoors and away from windows. Never heat your home with a gas stove or oven.',
      'Unplug appliances and electronics to avoid damage from power surges.',
      'If you rely on refrigerated medicine or a powered medical device, or it is very hot or cold, go to a community place with power.',
    ],
    kit: ['flashlight', 'radio', 'charger', 'hurricane-batteries', 'medical-power', 'food', 'can-opener', 'water', 'cash', 'heat-fan', 'winter-blankets'],
  },
];

// The emergency an active NWS alert points to, and that alert; null when nothing active matches.
export function pickFromAlerts(alerts: Alert[], now = new Date()): { emergency: Emergency; alert: Alert } | null {
  const live = activeOnly(alerts, now);
  for (const e of EMERGENCIES) {
    const alert = e.nws && live.find((a) => e.nws!.test(a.event));
    if (alert) return { emergency: e, alert };
  }
  return null;
}
