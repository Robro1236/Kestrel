/** @jest-environment node */
import { fetchArea, HAZARD_FIELDS } from './area';
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
