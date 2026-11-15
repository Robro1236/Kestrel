// lookup?kind=places: OpenStreetMap places (Overpass) and FEMA open shelters near a point.
// No imports, so jest can test it as well as Deno running it.

export const CATEGORIES = ['hospital', 'fire_station', 'police', 'pharmacy', 'food_bank'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Place = { category: Category; name: string | null; lat: number; lon: number; distance_km: number };
export type Shelter = { name: string | null; address: string | null; lat: number; lon: number; distance_km: number };

const RADIUS_M = 10_000;
const PER_CATEGORY = 3;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
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

async function overpass(lat: number, lon: number, f: Fetch): Promise<Place[]> {
  const around = `(around:${RADIUS_M},${lat},${lon})`;
  const query = `[out:json][timeout:40];
(nwr["amenity"~"^(hospital|fire_station|police|pharmacy)$"]${around};
 nwr["social_facility"="food_bank"]${around};);
out center tags;`;
  // Overpass takes 25-34 s uncached (docs/data-sources.md), so this one gets 45 s, not 10.
  const body = await getJson(
    f,
    OVERPASS_URL,
    {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }).toString(),
    },
    45_000,
  );
  // A query that hits Overpass's own timeout comes back as HTTP 200 with a remark; don't cache that as "nothing nearby".
  if (typeof body.remark === 'string' && /error|timed out/i.test(body.remark)) {
    throw new Error(`Overpass: ${body.remark}`);
  }

  const places: Place[] = [];
  for (const el of body.elements ?? []) {
    const tags = el.tags ?? {};
    const category = tags.social_facility === 'food_bank' ? 'food_bank' : tags.amenity;
    const pLat = num(el.lat ?? el.center?.lat);
    const pLon = num(el.lon ?? el.center?.lon);
    if (!CATEGORIES.includes(category) || pLat === null || pLon === null) continue;
    const d = distanceKm(lat, lon, pLat, pLon);
    if (d > RADIUS_M / 1000) continue; // `around` matches a way by any part of it; its center can sit outside
    places.push({ category, name: tags.name ?? null, lat: pLat, lon: pLon, distance_km: d });
  }
  places.sort((a, b) => a.distance_km - b.distance_km);
  return CATEGORIES.flatMap((c) => places.filter((p) => p.category === c).slice(0, PER_CATEGORY));
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

// shortcut: a box around the 50 states and Puerto Rico (it also takes in parts of Canada and Mexico, where FEMA just returns none) and leaves out Guam; use the area lookup's country if that matters.
const inUsBox = (lat: number, lon: number) => lat >= 17.5 && lat <= 72 && lon >= -180 && lon <= -64;

// shortcut: shelters are cached with the places for 7 days, but they open and close within days; split them into their own kind with a ~1 h TTL if shelters matter for a real launch.
export async function fetchPlaces(lat: number, lon: number, f: Fetch = fetch) {
  // A shelter outage fails the lookup too: caching [] would say "no shelters" for 7 days. The handler serves the last row as stale.
  // FEMA only covers the US, so other points skip it and a FEMA outage can't break them.
  const [p, s] = await Promise.all([overpass(lat, lon, f), inUsBox(lat, lon) ? shelters(lat, lon, f) : []]);
  // lat/lon are the rounded request point, so the app can tell which location a saved copy belongs to.
  return { lat, lon, places: p, shelters: s };
}
