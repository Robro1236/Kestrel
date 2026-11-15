// What to do for each FEMA NRI hazard type. Every step is checked against the Ready.gov page it cites.
export type HazardAdvice = { page: string; url: string; updated: string; steps: string[] };

const floods: HazardAdvice = {
  page: 'Floods',
  url: 'https://www.ready.gov/floods',
  updated: 'Oct. 20, 2026',
  steps: [
    'Evacuate immediately if you are told to.',
    "Never walk or drive through floodwater. Turn around, don't drown.",
    'Home insurance does not cover flooding, and a flood policy can take 30 days to start.',
  ],
};

const winter: HazardAdvice = {
  page: 'Winter Weather',
  url: 'https://www.ready.gov/winter-weather',
  updated: 'Nov. 3, 2026',
  steps: [
    'Stay off the roads if you can. If you are trapped in your car, stay inside it.',
    'A body temperature below 95°F is an emergency. Get the person to a warm room.',
    'If the power goes out, run generators outdoors, at least 20 feet from windows, doors and garages.',
  ],
};

export const HAZARD_ADVICE: Record<string, HazardAdvice> = {
  tornado: {
    page: 'Tornadoes',
    url: 'https://www.ready.gov/tornadoes',
    updated: 'June 2, 2026',
    steps: [
      'Pick a safe shelter now (lowest floor, no windows) and practice going there.',
      'When a warning is issued, go to your safe place immediately.',
      'Stay away from windows, doors and outside walls.',
    ],
  },
  earthquake: {
    page: 'Earthquakes',
    url: 'https://www.ready.gov/earthquakes',
    updated: 'Sept. 9, 2026',
    steps: [
      'Secure heavy items like bookcases, fridges, water heaters and TVs.',
      'When shaking starts: drop to your hands and knees, cover your head and neck, and hold on until it stops.',
      'If you are inside, stay inside. Do not run outside, and avoid doorways.',
    ],
  },
  inland_flood: floods,
  coastal_flood: floods,
  hurricane: {
    page: 'Hurricanes',
    url: 'https://www.ready.gov/hurricanes',
    updated: 'Oct. 16, 2026',
    steps: [
      'If you are in an evacuation zone and officials tell you to leave, leave immediately.',
      'For high winds, shelter in a storm shelter or an interior room.',
      'If you are trapped by flooding, go to the highest level of the building.',
    ],
  },
  heat_wave: {
    page: 'Extreme Heat',
    url: 'https://www.ready.gov/heat',
    updated: 'July 16, 2026',
    steps: [
      'Drink plenty of fluids.',
      'Never leave people or pets in a closed car on a warm day.',
      'If you think someone has heat stroke, call 911 or take them to a hospital immediately.',
    ],
  },
  wildfire: {
    page: 'Wildfires',
    url: 'https://www.ready.gov/wildfires',
    updated: 'Aug. 11, 2026',
    steps: [
      'Make sure everyone at home knows what to do if you have to leave quickly.',
      'Evacuate immediately if authorities tell you to.',
      'If you are not told to leave but it is smoky, stay inside somewhere safe.',
    ],
  },
  winter_weather: winter,
  cold_wave: winter,
  ice_storm: winter,
  drought: {
    page: 'Drought',
    url: 'https://www.ready.gov/drought',
    updated: 'May 11, 2026',
    steps: [
      'Save water every day. It is the best way to prepare.',
      'Follow your state and local limits on water use.',
      'Never leave sprinklers or hoses running unattended.',
    ],
  },
};
