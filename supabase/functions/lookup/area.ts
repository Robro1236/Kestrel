// lookup?kind=area: country, county and FEMA NRI hazard ratings for a point.
// No imports, so jest can test it as well as Deno running it.

// Hazard names must match what buildKit (src/kit/rules.ts) checks for.
export const HAZARD_FIELDS: Record<string, string> = {
  earthquake: 'ERQK_RISKR',
  inland_flood: 'IFLD_RISKR',
  coastal_flood: 'CFLD_RISKR',
  heat_wave: 'HWAV_RISKR',
  wildfire: 'WFIR_RISKR',
  hurricane: 'HRCN_RISKR',
  tornado: 'TRND_RISKR',
  winter_weather: 'WNTW_RISKR',
  cold_wave: 'CWAV_RISKR',
  ice_storm: 'ISTM_RISKR',
  drought: 'DRGT_RISKR',
};

const NRI_URL =
  'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query';
// Identify ourselves to the free OpenStreetMap-based services.
const USER_AGENT = 'Kestrel/1.0 (Rotary hackathon emergency-kit app)';

const TERRITORIES = new Set(['PR', 'GU', 'VI', 'AS', 'MP']);

type Fetch = typeof fetch;

async function getJson(f: Fetch, url: string, headers?: Record<string, string>) {
  const res = await f(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} returned HTTP ${res.status}`);
  return res.json();
}

export async function fetchArea(lat: number, lon: number, f: Fetch = fetch) {
  const fcc = await getJson(f, `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`);
  const county = fcc.results?.[0];
  const fips: unknown = county?.county_fips;

  if (typeof fips !== 'string' || !/^\d{5}$/.test(fips)) {
    // Not a US county: FCC has nothing, so ask Photon (OpenStreetMap data) for the country only.
    // The spec named Nominatim, but it failed every call from the deployed function.
    const photon = await getJson(
      f,
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1&radius=100`,
      { 'User-Agent': USER_AGENT },
    );
    const cc = photon.features?.[0]?.properties?.countrycode;
    return {
      country_code: typeof cc === 'string' ? cc.toUpperCase() : null,
      in_us: false,
      county: null,
      state: null,
      county_fips: null,
      hazards: [],
    };
  }

  const params = new URLSearchParams({
    where: `STCOFIPS='${fips}'`,
    outFields: ['NRI_VER', ...Object.values(HAZARD_FIELDS)].join(','),
    returnGeometry: 'false',
    f: 'json',
  });
  const nri = await getJson(f, `${NRI_URL}?${params}`);
  // ArcGIS reports a bad query as HTTP 200 with an error body.
  if (nri.error) throw new Error(`FEMA NRI error: ${JSON.stringify(nri.error)}`);
  const attrs = nri.features?.[0]?.attributes ?? {};

  return {
    // Territories have their own rows in src/data/jmp.json, so the water section needs their own code.
    country_code: TERRITORIES.has(county.state_code) ? county.state_code : 'US',
    in_us: true,
    // FCC sends this placeholder for GU, VI, AS and MP.
    county: county.county_name === 'data unavailable' ? null : (county.county_name ?? null),
    state: county.state_code ?? null,
    county_fips: fips,
    nri_version: attrs.NRI_VER ?? null,
    hazards: Object.entries(HAZARD_FIELDS)
      .filter(([, field]) => typeof attrs[field] === 'string')
      .map(([type, field]) => ({ type, rating: attrs[field] as string })),
  };
}
