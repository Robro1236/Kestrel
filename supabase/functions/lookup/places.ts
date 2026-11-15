// lookup?kind=places: OpenStreetMap places (Overpass, or Photon when Overpass is down) and FEMA open shelters near a point.
// No imports, so jest can test it as well as Deno running it.

export const CATEGORIES = ['hospital', 'fire_station', 'police', 'pharmacy', 'food_bank'] as const;
export type Category = (typeof CATEGORIES)[number];
// phone: as tagged in OpenStreetMap; null when untagged or found through Photon, missing on copies saved before phones were added.
// phone_source 'cms': the number came from the official CMS hospital list instead.
export type Place = { category: Category; name: string | null; phone?: string | null; phone_source?: 'cms'; lat: number; lon: number; distance_km: number };
export type Shelter = { name: string | null; address: string | null; lat: number; lon: number; distance_km: number };

const RADIUS_M = 10_000;
const PER_CATEGORY = 3;
// The main server answered Supabase's servers with HTTP 406 in Nov 2026; the mail.ru mirror is the public one that answered then.
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const PHOTON_URL = 'https://photon.komoot.io/api/';
// Photon is a name search, so each category needs words that place names contain.
const PHOTON_SEARCH: Record<Category, [q: string, osmTag: string]> = {
  hospital: ['hospital', 'amenity:hospital'],
  fire_station: ['fire station', 'amenity:fire_station'],
  police: ['police', 'amenity:police'],
  pharmacy: ['pharmacy', 'amenity:pharmacy'],
  food_bank: ['food bank', 'social_facility:food_bank'],
};
// The app gives up after 60 s: Overpass gets 35 s across both servers, leaving time for Photon.
const OVERPASS_BUDGET_MS = 35_000;
const SHELTERS_URL = 'https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query';
// Same identity area.ts sends to the free OpenStreetMap-based services.
const USER_AGENT = 'Kestrel/1.0 (Rotary hackathon emergency-kit app)';

type Fetch = typeof fetch;

async function getJson(f: Fetch, url: string, init: RequestInit, timeoutMs: number) {
  const res = await f(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} returned HTTP ${res.status}`);
  return res.json();
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return Math.round(12_742 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

type Raw = { category: Category; name: string | null; phone?: string | null; lat: number | null; lon: number | null };

// OSM allows several numbers separated by ';'; the first is the main line.
const firstPhone = (v: unknown) => (typeof v === 'string' && v.split(';')[0].trim()) || null;

// The nearest 3 per category within the radius.
function nearest(lat: number, lon: number, raw: Raw[]): Place[] {
  const places: Place[] = [];
  for (const r of raw) {
    if (!CATEGORIES.includes(r.category) || r.lat === null || r.lon === null) continue;
    const d = distanceKm(lat, lon, r.lat, r.lon);
    if (d > RADIUS_M / 1000) continue; // `around` and a bbox both reach past the circle
    places.push({ category: r.category, name: r.name, phone: r.phone ?? null, lat: r.lat, lon: r.lon, distance_km: d });
  }
  places.sort((a, b) => a.distance_km - b.distance_km);
  return CATEGORIES.flatMap((c) => places.filter((p) => p.category === c).slice(0, PER_CATEGORY));
}

async function overpass(lat: number, lon: number, f: Fetch): Promise<Place[]> {
  const around = `(around:${RADIUS_M},${lat},${lon})`;
  const query = `[out:json][timeout:30];
(nwr["amenity"~"^(hospital|fire_station|police|pharmacy)$"]${around};
 nwr["social_facility"="food_bank"]${around};);
out center tags;`;
  const deadline = Date.now() + OVERPASS_BUDGET_MS;
  const errors: string[] = [];
  let body; // getJson returns untyped JSON
  for (const url of OVERPASS_URLS) {
    const left = deadline - Date.now();
    if (left < 1_000) break;
    try {
      // Overpass takes 25-34 s uncached (docs/data-sources.md), so it gets what is left of 35 s, not 10.
      const b = await getJson(
        f,
        url,
        {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }).toString(),
        },
        left,
      );
      // A query that hits Overpass's own timeout comes back as HTTP 200 with a remark; don't cache that as "nothing nearby".
      if (typeof b.remark === 'string' && /error|timed out/i.test(b.remark)) throw new Error(b.remark);
      body = b;
      break;
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  if (!body) throw new Error(`Overpass failed on every server: ${errors.join('; ')}`);

  return nearest(
    lat,
    lon,
    (body.elements ?? []).map((el: any) => {
      const tags = el.tags ?? {};
      return {
        category: tags.social_facility === 'food_bank' ? 'food_bank' : tags.amenity,
        name: tags.name ?? null,
        phone: firstPhone(tags.phone ?? tags['contact:phone']),
        lat: num(el.lat ?? el.center?.lat),
        lon: num(el.lon ?? el.center?.lon),
      };
    }),
  );
}

// shortcut: Photon matches names, so it misses places like a "Walgreens" pharmacy; it is only the fallback while Overpass is down.
async function photon(lat: number, lon: number, f: Fetch): Promise<Place[]> {
  const dLat = RADIUS_M / 111_000;
  const dLon = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(4)).join(',');
  const lists = await Promise.all(
    CATEGORIES.map(async (category) => {
      const [q, tag] = PHOTON_SEARCH[category];
      const params = new URLSearchParams({ q, lat: String(lat), lon: String(lon), osm_tag: tag, bbox, limit: '10' });
      const body = await getJson(f, `${PHOTON_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } }, 10_000);
      return (body.features ?? []).map((ft: any) => ({
        category,
        name: ft.properties?.name ?? null,
        lat: num(ft.geometry?.coordinates?.[1]),
        lon: num(ft.geometry?.coordinates?.[0]),
      }));
    }),
  );
  return nearest(lat, lon, lists.flat());
}

// Overpass first (it finds every tagged place); Photon only when every Overpass server fails.
async function osmPlaces(lat: number, lon: number, f: Fetch): Promise<{ places: Place[]; source: 'overpass' | 'photon' }> {
  try {
    return { places: await overpass(lat, lon, f), source: 'overpass' };
  } catch (e) {
    console.error('Overpass failed, trying Photon', e);
    try {
      return { places: await photon(lat, lon, f), source: 'photon' };
    } catch (p) {
      throw new Error(`${(e as Error).message}; photon: ${(p as Error).message}`);
    }
  }
}

async function shelters(lat: number, lon: number, f: Fetch): Promise<Shelter[]> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    distance: String(RADIUS_M / 1000),
    units: 'esriSRUnit_Kilometer',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'shelter_name,address,city,state,shelter_status,latitude,longitude',
    returnGeometry: 'false',
    f: 'json',
  });
  const body = await getJson(f, `${SHELTERS_URL}?${params}`, {}, 10_000);
  // ArcGIS reports a bad query as HTTP 200 with an error body.
  if (body.error) throw new Error(`FEMA shelters error: ${JSON.stringify(body.error)}`);
  const out: Shelter[] = [];
  for (const { attributes: a = {} } of body.features ?? []) {
    const sLat = num(a.latitude);
    const sLon = num(a.longitude);
    if (sLat === null || sLon === null) continue; // 2 of 3 open rows had no coordinates in the spike
    const address = [a.address, a.city, a.state].filter(Boolean).join(', ') || null;
    out.push({ name: a.shelter_name ?? null, address, lat: sLat, lon: sLon, distance_km: distanceKm(lat, lon, sLat, sLon) });
  }
  return out.sort((x, y) => x.distance_km - y.distance_km).slice(0, PER_CATEGORY);
}

// Official hospital list: CMS Hospital General Information (Medicare-certified hospitals), filtered to ones with an emergency department.
// It has no coordinates, so it is found by county (from the FCC, as area.ts does) and by name to the OSM places.
const CMS_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0';
export type ErHospital = { name: string; address: string; city: string; phone: string };

const countyName = (s: string) => s.toUpperCase().replace(/ (COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPALITY|CITY AND BOROUGH)$/, '');

type County = { name: string; state: string };

async function countyAt(lat: number, lon: number, f: Fetch): Promise<County | null> {
  const fcc = await getJson(f, `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`, {}, 10_000);
  const c = fcc.results?.[0];
  return typeof c?.county_name === 'string' && typeof c?.state_code === 'string' ? { name: countyName(c.county_name), state: c.state_code } : null;
}

async function cmsErs(c: County, f: Fetch): Promise<(ErHospital & { zip: string; state: string })[]> {
  const params = new URLSearchParams({
    'conditions[0][property]': 'countyparish',
    'conditions[0][value]': c.name,
    'conditions[1][property]': 'state',
    'conditions[1][value]': c.state,
    limit: '100',
  });
  const body = await getJson(f, `${CMS_URL}?${params}`, {}, 10_000);
  return (body.results ?? [])
    .filter((r: any) => r.emergency_services === 'Yes' && r.telephone_number && r.facility_name)
    .map((r: any) => ({ name: r.facility_name, address: r.address ?? '', city: r.citytown ?? '', phone: r.telephone_number, zip: r.zip_code ?? '', state: c.state }));
}

// CMS has street addresses but no coordinates; the US Census geocoder places them. null when it can't, so that hospital sorts last.
async function geocode(h: { address: string; city: string; state: string; zip: string }, f: Fetch): Promise<[number, number] | null> {
  try {
    const q = new URLSearchParams({ address: `${h.address}, ${h.city}, ${h.state} ${h.zip}`, benchmark: 'Public_AR_Current', format: 'json' });
    const c = (await getJson(f, `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${q}`, {}, 10_000)).result?.addressMatches?.[0]?.coordinates;
    return typeof c?.x === 'number' && typeof c?.y === 'number' ? [c.y, c.x] : null;
  } catch {
    return null;
  }
}

// Nearest first; hospitals the geocoder can't place keep their order at the end.
async function byDistance(lat: number, lon: number, list: Awaited<ReturnType<typeof cmsErs>>, f: Fetch): Promise<ErHospital[]> {
  const at = await Promise.all(list.map((h) => geocode(h, f)));
  const d = at.map((p) => (p ? distanceKm(lat, lon, p[0], p[1]) : Infinity));
  return list
    .map((h, i) => ({ h, d: d[i], i }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ h }) => ({ name: h.name, address: h.address, city: h.city, phone: h.phone }));
}

// About 25 km out in each direction: the nearest ER can be over the county line (Yuba City's is in the next county).
const NEAR_DEG = 0.23;

// The point's own county first, then the counties ~25 km around it. null when the own county's FCC or CMS lookup fails,
// so the cache retries soon instead of keeping "no hospitals" for a week; a neighbor that fails is just left out.
async function erHospitals(lat: number, lon: number, f: Fetch): Promise<{ hospitals: ErHospital[] | null; counties: string[] }> {
  try {
    const dLon = NEAR_DEG / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const around = [[NEAR_DEG, 0], [-NEAR_DEG, 0], [0, dLon], [0, -dLon]].map(([a, b]) => countyAt(lat + a, lon + b, f).catch(() => null));
    const own = await countyAt(lat, lon, f);
    if (!own) return { hospitals: [], counties: [] };
    const counties = [own];
    for (const c of await Promise.all(around)) {
      if (c && !counties.some((x) => x.name === c.name && x.state === c.state)) counties.push(c);
    }
    const [mine, ...rest] = await Promise.all(counties.map((c, i) => (i === 0 ? cmsErs(c, f) : cmsErs(c, f).catch(() => []))));
    return { hospitals: await byDistance(lat, lon, [...mine, ...rest.flat()], f), counties: counties.map((c) => `${c.name}, ${c.state}`) };
  } catch (e) {
    console.error('CMS hospitals failed', e);
    return { hospitals: null, counties: [] };
  }
}

// Words that don't tell two hospitals apart.
const FILLER = new Set(['THE', 'OF', 'AND', 'HOSPITAL', 'MEDICAL', 'CENTER', 'CENTRE', 'COMMUNITY', 'HEALTH', 'REGIONAL']);
const words = (s: string) => new Set(s.toUpperCase().replace(/['’.]/g, '').split(/[^A-Z0-9]+/).filter((w) => w && !FILLER.has(w)));
// shortcut: name words must be a subset one way or the other, so "Kaiser Permanente Manteca" misses "KAISER FOUNDATION HOSPITAL MANTECA"; fine while the CMS list also shows on its own.
export function sameHospital(a: string, b: string) {
  const [x, y] = [words(a), words(b)];
  const sub = (p: Set<string>, q: Set<string>) => p.size > 0 && [...p].every((w) => q.has(w));
  return sub(x, y) || sub(y, x);
}

// shortcut: a box around the 50 states and Puerto Rico (it also takes in parts of Canada and Mexico, where FEMA just returns none) and leaves out Guam; use the area lookup's country if that matters.
const inUsBox = (lat: number, lon: number) => lat >= 17.5 && lat <= 72 && lon >= -180 && lon <= -64;

// shortcut: shelters are cached with the places for 7 days, but they open and close within days; split them into their own kind with a ~1 h TTL if shelters matter for a real launch.
export async function fetchPlaces(lat: number, lon: number, f: Fetch = fetch) {
  // A shelter outage fails the lookup too: caching [] would say "no shelters" for 7 days. The handler serves the last row as stale.
  // FEMA only covers the US, so other points skip it and a FEMA outage can't break them.
  const us = inUsBox(lat, lon);
  const [p, s, cms] = await Promise.all([osmPlaces(lat, lon, f), us ? shelters(lat, lon, f) : [], us ? erHospitals(lat, lon, f) : { hospitals: [], counties: [] }]);
  const er = cms.hospitals;
  // A hospital CMS lists gets CMS's phone number: official, and present even when OSM has none.
  const places = p.places.map((pl) => {
    const m = pl.category === 'hospital' && pl.name ? er?.find((h) => sameHospital(h.name, pl.name!)) : undefined;
    return m ? { ...pl, phone: m.phone, phone_source: 'cms' as const } : pl;
  });
  // lat/lon are the rounded request point, so the app can tell which location a saved copy belongs to.
  return { lat, lon, places, source: p.source, shelters: s, er_hospitals: er, er_counties: cms.counties, er_order: 'distance' };
}
