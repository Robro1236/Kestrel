/** @jest-environment node */
import { fetchArea, HAZARD_FIELDS } from './area';
import { fetchPlaces, sameHospital } from './places';
import { makeHandler, type Cache, type CacheRow } from './handler';
import { buildKit } from '../../../src/kit/rules';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

// Responses shaped like the real ones recorded in docs/data-sources.md.
function fakeUpstream(fccResults: unknown[], nri: unknown = {}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('geo.fcc.gov')) return ok({ results: fccResults });
    if (url.includes('arcgis.com')) return ok(nri);
    if (url.includes('photon.komoot.io')) return ok({ features: [{ properties: { countrycode: 'ke' } }] });
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
}

function memoryCache(rows: Record<string, CacheRow> = {}): Cache & { rows: typeof rows } {
  return {
    rows,
    async get(key) {
      return rows[key] ?? null;
    },
    async put(key, payload) {
      rows[key] = { payload, fetched_at: '2026-11-14T00:00:00.000Z' };
      return rows[key].fetched_at;
    },
  };
}

const NOW = Date.parse('2026-11-14T12:00:00Z');
const get = (qs: string) => new Request(`http://x/lookup?${qs}`);

// protects=hazard names sent to buildKit; fails_when=a name differs from rules.ts or a rating is dropped; no_claim=live NRI still uses these field names
test('area: US county maps NRI ratings to buildKit hazard names', async () => {
  const area = await fetchArea(
    37.78,
    -121.54,
    fakeUpstream([{ county_fips: '06077', county_name: 'San Joaquin County', state_code: 'CA' }], {
      features: [{ attributes: { NRI_VER: 'December 2025', ERQK_RISKR: 'Relatively High', IFLD_RISKR: 'Relatively High', CWAV_RISKR: 'No Rating' } }],
    }),
  );
  expect(area).toMatchObject({ in_us: true, country_code: 'US', county: 'San Joaquin County', state: 'CA', county_fips: '06077' });
  expect(area.hazards).toEqual([
    { type: 'earthquake', rating: 'Relatively High' },
    { type: 'inland_flood', rating: 'Relatively High' },
    { type: 'cold_wave', rating: 'No Rating' },
  ]);
  expect(Object.keys(HAZARD_FIELDS)).toEqual([
    'earthquake', 'inland_flood', 'coastal_flood', 'heat_wave', 'wildfire', 'hurricane',
    'tornado', 'winter_weather', 'cold_wave', 'ice_storm', 'drought',
  ]);
});

// protects=non-US places get a country and no hazards; fails_when=empty FCC result throws or claims in_us; no_claim=FCC really returns empty results abroad
test('area: no FCC county falls back to Photon country', async () => {
  const area = await fetchArea(-1.29, 36.82, fakeUpstream([]));
  expect(area).toMatchObject({ in_us: false, country_code: 'KE', hazards: [] });
});

// protects=NRI query errors surface as failures; fails_when=an HTTP-200 error body is returned as "no hazards"; no_claim=other ArcGIS error shapes
test('area: NRI error body throws', async () => {
  const f = fakeUpstream([{ county_fips: '06077' }], { error: { code: 400 } });
  await expect(fetchArea(37.78, -121.54, f)).rejects.toThrow('FEMA NRI');
});

// protects=acceptance criterion 10 (400 on bad coords); fails_when=lat=200, missing lon or unknown kind reach upstream; no_claim=Supabase gateway passes the request through
test('handler: rejects bad coordinates and kinds with 400', async () => {
  const fetchSpy = jest.fn();
  const h = makeHandler(memoryCache(), { area: { ttlDays: 30, fetch: fetchSpy } }, () => NOW);
  for (const qs of ['kind=area&lat=200&lon=0', 'kind=area&lat=10', 'kind=area&lat=&lon=0', 'kind=nope&lat=1&lon=1', 'kind=toString&lat=1&lon=1']) {
    expect((await h(get(qs))).status).toBe(400);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});

// protects=acceptance criterion 11 (keys at 2 decimals) and caching; fails_when=exact coords reach the key or upstream, or a fresh row is refetched; no_claim=Postgres upsert works
test('handler: rounds to 2 decimals, caches, then serves the fresh row', async () => {
  const cache = memoryCache();
  const fetchSpy = jest.fn(async () => ({ in_us: true }));
  const h = makeHandler(cache, { area: { ttlDays: 30, fetch: fetchSpy } }, () => NOW);

  const first = await (await h(get('kind=area&lat=37.78123&lon=-121.53877'))).json();
  expect(fetchSpy).toHaveBeenCalledWith(37.78, -121.54);
  expect(Object.keys(cache.rows)).toEqual(['area:37.78:-121.54']);
  expect(first).toEqual({ in_us: true, fetched_at: '2026-11-14T00:00:00.000Z', stale: false });

  await h(get('kind=area&lat=37.7801&lon=-121.5399'));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

// protects=acceptance criterion 10 (stale fallback) and 502; fails_when=an expired row is dropped when upstream fails; no_claim=real upstream timeouts trigger the catch
test('handler: upstream failure returns stale row, or 502 without one', async () => {
  const failing = { area: { ttlDays: 30, fetch: async () => Promise.reject(new Error('down')) } };
  const old = { 'area:37.78:-121.54': { payload: { in_us: true }, fetched_at: '2026-01-01T00:00:00.000Z' } };
  const h = makeHandler(memoryCache(old), failing, () => NOW);

  const res = await h(get('kind=area&lat=37.78&lon=-121.54'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ in_us: true, fetched_at: '2026-01-01T00:00:00.000Z', stale: true });

  const miss = await h(get('kind=area&lat=1&lon=1'));
  expect(miss.status).toBe(502);
  expect(await miss.json()).toEqual({ error: 'upstream_unavailable' });
});

// protects=every hazard name the function sends changes the kit; fails_when=a name is renamed on one side only; no_claim=the items added are the right ones (rules.test.ts covers that)
test('contract: buildKit recognises every hazard name the function sends', () => {
  const home = { adults: 2, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false };
  const base = buildKit(home, []).length;
  for (const type of Object.keys(HAZARD_FIELDS)) {
    if (type === 'drought') continue; // adds no items by design; the water section covers it
    expect([type, buildKit(home, [{ type, rating: 'Very High' }]).length > base]).toEqual([type, true]);
  }
});

// protects=boundary coordinates; fails_when=valid edges are rejected or values just outside are accepted; no_claim=upstreams have data at the poles
test('handler: coordinate boundaries', async () => {
  const h = makeHandler(memoryCache(), { area: { ttlDays: 30, fetch: async () => ({}) } }, () => NOW);
  for (const qs of ['lat=90&lon=180', 'lat=-90&lon=-180', 'lat=0&lon=0']) {
    expect([qs, (await h(get(`kind=area&${qs}`))).status]).toEqual([qs, 200]);
  }
  for (const qs of ['lat=90.01&lon=0', 'lat=0&lon=-180.01', 'lat=abc&lon=0', 'lat=NaN&lon=0', 'lat=Infinity&lon=0', 'lon=5']) {
    expect([qs, (await h(get(`kind=area&${qs}`))).status]).toEqual([qs, 400]);
  }
});

// protects=one cache key per grid cell near zero; fails_when=-0.001 and 0.001 produce different keys ("-0.00" vs "0.00"); no_claim=nothing beyond key formatting
test('handler: tiny negative coordinates share the zero cell', async () => {
  const cache = memoryCache();
  const h = makeHandler(cache, { area: { ttlDays: 30, fetch: async () => ({}) } }, () => NOW);
  await h(get('kind=area&lat=-0.001&lon=-0.004'));
  await h(get('kind=area&lat=0.001&lon=0.004'));
  expect(Object.keys(cache.rows)).toEqual(['area:0.00:0.00']);
});

// protects=expired rows are refreshed; fails_when=a 31-day-old area row is served as fresh, or a 29-day-old one is refetched; no_claim=Postgres timestamps parse the same way
test('handler: 30-day freshness boundary', async () => {
  const day = 86_400_000;
  const row = (ageDays: number) => ({
    'area:1.00:1.00': { payload: { v: 'old' }, fetched_at: new Date(NOW - ageDays * day).toISOString() },
  });
  const fetchSpy = jest.fn(async () => ({ v: 'new' }));
  const kinds = { area: { ttlDays: 30, fetch: fetchSpy } };

  const fresh = await (await makeHandler(memoryCache(row(29)), kinds, () => NOW)(get('kind=area&lat=1&lon=1'))).json();
  expect(fresh.v).toBe('old');
  expect(fetchSpy).not.toHaveBeenCalled();

  const cache = memoryCache(row(31));
  const expired = await (await makeHandler(cache, kinds, () => NOW)(get('kind=area&lat=1&lon=1'))).json();
  expect(expired).toMatchObject({ v: 'new', stale: false });
  expect(cache.rows['area:1.00:1.00'].payload).toEqual({ v: 'new' });
});

// protects=the plan still loads when the database is down; fails_when=a cache read or write error becomes a 500; no_claim=supabase-js surfaces errors as throws (index.ts does that)
test('handler: a broken cache does not break the lookup', async () => {
  const broken: Cache = {
    get: async () => Promise.reject(new Error('db down')),
    put: async () => Promise.reject(new Error('db down')),
  };
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await makeHandler(broken, { area: { ttlDays: 30, fetch: async () => ({ in_us: true }) } }, () => NOW)(
    get('kind=area&lat=1&lon=1'),
  );
  errors.mockRestore();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ in_us: true, fetched_at: new Date(NOW).toISOString(), stale: false });
});

// protects=browsers on the Vercel domain can call the function; fails_when=the preflight or a response lacks CORS headers; no_claim=the Supabase gateway forwards OPTIONS (the smoke script checks that live)
test('handler: CORS on preflight, success and error responses', async () => {
  const h = makeHandler(memoryCache(), { area: { ttlDays: 30, fetch: async () => ({}) } }, () => NOW);
  const pre = await h(new Request('http://x/lookup', { method: 'OPTIONS' }));
  expect(pre.status).toBe(200);
  expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('apikey');
  for (const qs of ['kind=area&lat=1&lon=1', 'kind=area&lat=200&lon=1']) {
    expect((await h(get(qs))).headers.get('Access-Control-Allow-Origin')).toBe('*');
  }
});

// protects=upstream oddities fail loudly or degrade honestly; fails_when=an FCC 500 looks like "not in the US", or a county missing from NRI throws; no_claim=these are the only odd responses upstreams send
test('area: upstream edge cases', async () => {
  const fcc500 = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
  await expect(fetchArea(1, 1, fcc500)).rejects.toThrow('geo.fcc.gov returned HTTP 500');

  const noNri = await fetchArea(18.2, -66.5, fakeUpstream([{ county_fips: '72001', county_name: 'Adjuntas', state_code: 'PR' }], { features: [] }));
  expect(noNri).toMatchObject({ in_us: true, country_code: 'PR', county: 'Adjuntas', county_fips: '72001', hazards: [] });

  // FCC's real answer for Saipan: the water table has its own row for MP (81.5%, below the 90% line).
  const saipan = await fetchArea(15.19, 145.75, fakeUpstream([{ county_fips: '69110', county_name: 'data unavailable', state_code: 'MP' }], { features: [] }));
  expect(saipan).toMatchObject({ in_us: true, country_code: 'MP', county: null, state: 'MP' });

  const ocean = (async (input: string | URL | Request) =>
    ok(String(input).includes('fcc') ? { results: [] } : { features: [] })) as typeof fetch;
  expect(await fetchArea(0, -30, ocean)).toMatchObject({ in_us: false, country_code: null });

  const oddFips = await fetchArea(1, 1, fakeUpstream([{ county_fips: "06077' OR 1=1" }]));
  expect(oddFips.in_us).toBe(false);
});

// Overpass and FEMA shelter responses shaped like the ones in docs/data-sources.md.
function fakePlaces(overpass: unknown, shelters: unknown = { features: [] }): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('overpass-api.de')) return ok(overpass);
    if (url.includes('gis.fema.gov')) return ok(shelters);
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
}

// protects=Nearby help shows the 3 nearest per category with names, distances and way centers; fails_when=a 4th place, an unknown amenity, a place over 10 km or a shelter without coordinates gets through, or ways lose their center; no_claim=live Overpass returns these tags for real places
test('places: nearest 3 per category, ways use center, shelters need coordinates', async () => {
  const hospital = (lat: number, name?: string) => ({ type: 'node', lat, lon: -121.54, tags: { amenity: 'hospital', ...(name ? { name } : {}) } });
  const result = await fetchPlaces(
    37.78,
    -121.54,
    fakePlaces(
      {
        elements: [
          hospital(37.84, 'Far'),
          hospital(37.79, 'Near'),
          hospital(37.81),
          hospital(37.8, 'Mid'),
          hospital(37.9, 'Out of range'), // ~13 km north
          { type: 'way', center: { lat: 37.785, lon: -121.54 }, tags: { amenity: 'social_facility', social_facility: 'food_bank', name: 'Pantry' } },
          { type: 'node', lat: 37.78, lon: -121.54, tags: { amenity: 'bench' } },
        ],
      },
      {
        features: [
          { attributes: { shelter_name: 'No coords', latitude: null, longitude: null } },
          { attributes: { shelter_name: 'High School', address: '1 Main St', city: 'Tracy', state: 'CA', latitude: 37.79, longitude: -121.54 } },
        ],
      },
    ),
  );
  expect(result.places.map((p) => [p.category, p.name, p.distance_km])).toEqual([
    ['hospital', 'Near', 1.1],
    ['hospital', 'Mid', 2.2],
    ['hospital', null, 3.3],
    ['food_bank', 'Pantry', 0.6],
  ]);
  expect(result.shelters).toEqual([
    { name: 'High School', address: '1 Main St, Tracy, CA', lat: 37.79, lon: -121.54, distance_km: 1.1 },
  ]);
});

// protects=neither an Overpass nor a FEMA failure is cached as "nothing nearby" / "no shelters" for 7 days; fails_when=an Overpass timeout remark or a FEMA HTTP-200 error body resolves instead of throwing; no_claim=other Overpass error remarks are worded this way
test('places: Overpass timeout remark and FEMA error both throw', async () => {
  await expect(
    fetchPlaces(37.78, -121.54, fakePlaces({ elements: [], remark: 'runtime error: Query timed out in "query" at line 2 after 41 seconds.' })),
  ).rejects.toThrow('Overpass');
  const pharmacy = { type: 'node', lat: 37.79, lon: -121.54, tags: { amenity: 'pharmacy', name: 'Walgreens' } };
  await expect(
    fetchPlaces(37.78, -121.54, fakePlaces({ elements: [pharmacy] }, { error: { code: 400, message: 'Invalid query' } })),
  ).rejects.toThrow('FEMA');
});

// protects=a FEMA outage never breaks Nearby help outside the US, where shelters aren't shown; fails_when=a non-US point still calls FEMA; no_claim=the US box matches every FEMA-covered place
test('places: points outside the US skip FEMA', async () => {
  const chemist = { type: 'node', lat: -1.28, lon: 36.82, tags: { amenity: 'pharmacy', name: 'Nairobi Chemist' } };
  const result = await fetchPlaces(-1.29, 36.82, fakePlaces({ elements: [chemist] }, { error: { code: 500, message: 'down' } }));
  expect(result.places.map((p) => p.name)).toEqual(['Nairobi Chemist']);
  expect(result.shelters).toEqual([]);
});

// protects=Nearby help still works when the main Overpass server refuses us (it sent Supabase HTTP 406); fails_when=a main-server error is not retried on the mirror, or both failing hides either server's reason; no_claim=the mirror answers Supabase's servers live
test('places: falls back to the Overpass mirror, and names both servers when both fail', async () => {
  const pharmacy = { type: 'node', lat: 37.79, lon: -121.54, tags: { amenity: 'pharmacy', name: 'Walgreens' } };
  const calls: string[] = [];
  const mirrorUp = (async (input: string | URL | Request) => {
    const url = String(input);
    if (!url.includes('geo.fcc.gov')) calls.push(new URL(url).host); // the CMS hospital lookup, not part of the Overpass order
    if (url.includes('overpass-api.de')) return new Response('Not Acceptable', { status: 406 });
    if (url.includes('maps.mail.ru')) return ok({ elements: [pharmacy] });
    return ok({ features: [] });
  }) as typeof fetch;
  const result = await fetchPlaces(37.78, -121.54, mirrorUp);
  expect(result.places.map((p) => p.name)).toEqual(['Walgreens']);
  expect(calls.filter((h) => h !== 'gis.fema.gov')).toEqual(['overpass-api.de', 'maps.mail.ru']);

  const bothDown = (async (input: string | URL | Request) =>
    String(input).includes('gis.fema.gov') ? ok({ features: [] }) : new Response('x', { status: 406 })) as typeof fetch;
  await expect(fetchPlaces(37.78, -121.54, bothDown)).rejects.toThrow(/overpass-api\.de: .*406.*maps\.mail\.ru: .*406/);
});

// protects=Nearby help still lists places while every Overpass server is down, and says where they came from; fails_when=an Overpass outage skips Photon, Photon results bypass the 10 km / 3-per-category rules, or the source is not reported; no_claim=Photon's name search finds every real place
test('places: Photon fills in when every Overpass server fails', async () => {
  const feature = (lon: number, lat: number, name: string) => ({ geometry: { coordinates: [lon, lat] }, properties: { name } });
  const photonUp = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.host === 'gis.fema.gov') return ok({ features: [] });
    if (url.host !== 'photon.komoot.io') return new Response('x', { status: 406 });
    const tag = url.searchParams.get('osm_tag');
    if (tag === 'amenity:hospital') return ok({ features: [feature(-121.54, 37.8, 'Sutter Tracy'), feature(-121.54, 37.9, 'Too far')] });
    if (tag === 'amenity:pharmacy') return ok({ features: [feature(-121.54, 37.79, 'Grant Line Pharmacy'), { properties: { name: 'No point' } }] });
    return ok({ features: [] });
  }) as typeof fetch;
  const result = await fetchPlaces(37.78, -121.54, photonUp);
  expect(result.source).toBe('photon');
  expect(result.places.map((p) => [p.category, p.name, p.distance_km])).toEqual([
    ['hospital', 'Sutter Tracy', 2.2],
    ['pharmacy', 'Grant Line Pharmacy', 1.1],
  ]);
});

// protects=a Photon fallback list is retried after a day, an Overpass list kept for a week; fails_when=a function ttlDays is ignored or read from the wrong row; no_claim=index.ts uses these numbers (it does: photon 1, otherwise 7)
test('handler: a kind can set freshness from the cached payload', async () => {
  const day = 86_400_000;
  const kinds = { places: { ttlDays: (p: Record<string, unknown>) => (p.source === 'photon' ? 1 : 7), fetch: jest.fn(async () => ({ source: 'overpass' })) } };
  const aged = (source: string) => ({ 'places:1.00:1.00': { payload: { source }, fetched_at: new Date(NOW - 2 * day).toISOString() } });

  const kept = await (await makeHandler(memoryCache(aged('overpass')), kinds, () => NOW)(get('kind=places&lat=1&lon=1'))).json();
  expect(kept.fetched_at).toBe(new Date(NOW - 2 * day).toISOString());
  expect(kinds.places.fetch).not.toHaveBeenCalled();

  const retried = await (await makeHandler(memoryCache(aged('photon')), kinds, () => NOW)(get('kind=places&lat=1&lon=1'))).json();
  expect(retried).toMatchObject({ source: 'overpass', stale: false });
  expect(kinds.places.fetch).toHaveBeenCalledTimes(1);
});

// protects=Nearby help gets each place's phone number from its OpenStreetMap tags; fails_when=the phone tag is dropped, contact:phone is ignored, a ';' list is shown as one number, or an untagged place gets a made-up number; no_claim=the numbers mappers entered are current
test('places: keeps the first OpenStreetMap phone number, null when untagged', async () => {
  const place = (lat: number, tags: Record<string, string>) => ({ type: 'node', lat, lon: -121.54, tags: { amenity: 'hospital', ...tags } });
  const result = await fetchPlaces(
    37.78,
    -121.54,
    fakePlaces({
      elements: [
        place(37.79, { name: 'A', phone: '+1 209-555-0100' }),
        place(37.8, { name: 'B', 'contact:phone': '(209) 555-0101' }),
        place(37.81, { name: 'C', phone: '+1 209 555 0102; +1 209 555 0199' }),
      ],
    }),
  );
  expect(result.places.map((p) => p.phone)).toEqual(['+1 209-555-0100', '(209) 555-0101', '+1 209 555 0102']);
  const none = await fetchPlaces(37.78, -121.54, fakePlaces({ elements: [place(37.79, { name: 'D' })] }));
  expect(none.places[0]).toHaveProperty('phone', null);
});

// protects=US hospitals get the official CMS phone number and the county's ER list rides along, and a CMS outage never breaks places; fails_when=a non-ER hospital is listed, an OSM hospital keeps no number though CMS has it, the wrong hospital's number is attached, or a CMS failure throws or reads as "no hospitals"; no_claim=CMS numbers are current or every OSM name matches its CMS name
test('places: CMS emergency-room hospitals fill in hospital numbers', async () => {
  expect(sameHospital("St. Joseph's Medical Center", "ST JOSEPH'S MEDICAL CENTER OF STOCKTON")).toBe(true);
  expect(sameHospital('Sutter Tracy Community Hospital', 'SUTTER TRACY COMMUNITY HOSPITAL')).toBe(true);
  expect(sameHospital('Doctors Hospital of Manteca', 'DAMERON HOSPITAL')).toBe(false);
  expect(sameHospital('Hospital', 'DAMERON HOSPITAL')).toBe(false);

  const cms = { results: [
    { facility_name: 'SUTTER TRACY COMMUNITY HOSPITAL', citytown: 'TRACY', telephone_number: '(209) 835-1500', emergency_services: 'Yes', address: '1420 N TRACY BLVD' },
    { facility_name: "ST JOSEPH'S BEHAVIORAL HEALTH CENTER", citytown: 'STOCKTON', telephone_number: '(209) 461-2000', emergency_services: 'No' },
  ] };
  const overpass = { elements: [{ type: 'node', lat: 37.79, lon: -121.54, tags: { amenity: 'hospital', name: 'Sutter Tracy Community Hospital' } }] };
  const seen: string[] = [];
  const up = (async (input: string | URL | Request) => {
    const url = String(input);
    seen.push(url);
    if (url.includes('geo.fcc.gov')) return ok({ results: [{ county_name: 'San Joaquin County', state_code: 'CA' }] });
    if (url.includes('data.cms.gov')) return ok(cms);
    return fakePlaces(overpass)(input);
  }) as typeof fetch;
  const r = await fetchPlaces(37.78, -121.54, up);
  expect(seen.find((u) => u.includes('data.cms.gov'))).toContain('SAN+JOAQUIN');
  expect(r.er_hospitals).toEqual([{ name: 'SUTTER TRACY COMMUNITY HOSPITAL', address: '1420 N TRACY BLVD', city: 'TRACY', phone: '(209) 835-1500' }]);
  expect(r.places[0]).toMatchObject({ phone: '(209) 835-1500', phone_source: 'cms' });

  // fakePlaces has no FCC or CMS: places still load, and er_hospitals is null so the cache retries.
  const down = await fetchPlaces(37.78, -121.54, fakePlaces(overpass));
  expect(down.places[0]).toMatchObject({ phone: null });
  expect(down.er_hospitals).toBeNull();
});

// protects=a town whose own county has no ER (Yuba City, Sutter County) still gets the ER over the county line, nearest first, and a failing neighbor lookup is skipped; fails_when=only the own county is searched, a county is queried twice, a far ER is listed before a near one, or one neighbor's outage drops the whole list; no_claim=four points ~25 km out catch every neighboring county
test('places: ERs in neighboring counties are included', async () => {
  const er = (name: string, city: string) => ({ facility_name: name, citytown: city, telephone_number: '(530) 555-0100', emergency_services: 'Yes' });
  const cms: Record<string, object[]> = { SUTTER: [{ ...er('SUTTER SURGICAL HOSPITAL', 'YUBA CITY'), emergency_services: 'No' }], YUBA: [er('ADVENTIST RIDEOUT', 'MARYSVILLE')], BUTTE: [er('OROVILLE HOSPITAL', 'OROVILLE')] };
  const cmsCalls: string[] = [];
  const up = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.host === 'geo.fcc.gov') {
      const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
      if (lat > 39.3) throw new Error('down');
      return ok({ results: [{ county_name: lon > -121.6 ? 'Yuba County' : lat < 39 ? 'Butte County' : 'Sutter County', state_code: 'CA' }] });
    }
    if (url.host === 'data.cms.gov') {
      const county = url.searchParams.get('conditions[0][value]')!;
      cmsCalls.push(county);
      return ok({ results: cms[county] ?? [] });
    }
    // Census geocoder: Marysville is ~3 km away, Oroville ~40 km.
    if (url.host === 'geocoding.geo.census.gov') {
      const x = url.searchParams.get('address')!.includes('MARYSVILLE') ? { x: -121.595, y: 39.139 } : { x: -121.55, y: 39.5 };
      return ok({ result: { addressMatches: [{ coordinates: x }] } });
    }
    return fakePlaces({ elements: [] })(input);
  }) as typeof fetch;
  const r = await fetchPlaces(39.14, -121.62, up);
  expect(cmsCalls.sort()).toEqual(['BUTTE', 'SUTTER', 'YUBA']);
  expect(r.er_counties[0]).toBe('SUTTER, CA');
  // Butte's point is sampled before Yuba's, so without sorting Oroville would come first.
  expect(r.er_hospitals?.map((h) => h.city)).toEqual(['MARYSVILLE', 'OROVILLE']);
  expect(r.er_hospitals?.map((h) => h.city).sort()).toEqual(['MARYSVILLE', 'OROVILLE']);
});
