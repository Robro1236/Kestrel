// Live checks against the deployed Supabase project. Run: npm run smoke
// Add --write to also insert one kit_plans row (raises the home counter by 1).
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');

const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const fn = (qs, init = {}) => fetch(`${URL_}/functions/v1/lookup?${qs}`, { headers: auth, ...init });
const rest = (path, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...auth, 'Content-Type': 'application/json', ...init.headers } });
const count = async () => Number(await (await rest('rpc/prepared_count', { method: 'POST', body: '{}' })).text());

let failed = 0;
async function check(name, run) {
  try {
    const note = await run();
    console.log(`PASS  ${name}${note ? `  (${note})` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}
const expect = (ok, message) => {
  if (!ok) throw new Error(message);
};
const rated = (area, type) => area.hazards.find((h) => h.type === type)?.rating;
const MODERATE_UP = ['Relatively Moderate', 'Relatively High', 'Very High'];
const NAMES = 'earthquake,inland_flood,coastal_flood,heat_wave,wildfire,hurricane,tornado,winter_weather,cold_wave,ice_storm,drought';

// --- lookup function ---
await check('area: 95391 returns San Joaquin County and all 11 hazard names', async () => {
  const res = await fn('kind=area&lat=37.78&lon=-121.54');
  const a = await res.json();
  expect(res.status === 200, `HTTP ${res.status} ${JSON.stringify(a)}`);
  expect(a.in_us === true && a.country_code === 'US' && a.county_fips === '06077', JSON.stringify(a));
  expect(a.county === 'San Joaquin County' && a.state === 'CA', `${a.county}, ${a.state}`);
  expect(a.hazards.map((h) => h.type).join() === NAMES, a.hazards.map((h) => h.type).join());
  expect(a.stale === false && !Number.isNaN(Date.parse(a.fetched_at)), `stale=${a.stale} fetched_at=${a.fetched_at}`);
});

await check('cache: nearby coordinates in the same ~1 km cell reuse one saved row', async () => {
  const a = await (await fn('kind=area&lat=37.78123&lon=-121.53877')).json();
  const b = await (await fn('kind=area&lat=37.7761&lon=-121.5441')).json();
  expect(a.fetched_at === b.fetched_at, `${a.fetched_at} vs ${b.fetched_at}`);
  return `saved ${a.fetched_at}`;
});

for (const [place, qs, hazard] of [
  ['Miami', 'lat=25.76&lon=-80.19', 'hurricane'],
  ['Oklahoma City', 'lat=35.47&lon=-97.52', 'tornado'],
  ['Los Angeles', 'lat=34.05&lon=-118.24', 'earthquake'],
]) {
  await check(`area: ${place} rates ${hazard} at least Relatively Moderate`, async () => {
    const a = await (await fn(`kind=area&${qs}`)).json();
    expect(MODERATE_UP.includes(rated(a, hazard)), `${hazard} = ${rated(a, hazard)} in ${a.county}`);
    return `${a.county}: ${rated(a, hazard)}`;
  });
}

for (const [place, qs, cc = 'US'] of [
  ['Honolulu', 'lat=21.31&lon=-157.86'],
  ['Anchorage', 'lat=61.22&lon=-149.9'],
  ['San Juan, Puerto Rico', 'lat=18.45&lon=-66.07', 'PR'],
  ['Saipan, Northern Mariana Islands', 'lat=15.19&lon=145.75', 'MP'],
]) {
  await check(`area: ${place} answers as a US place`, async () => {
    const res = await fn(`kind=area&${qs}`);
    const a = await res.json();
    expect(res.status === 200 && a.in_us === true && a.country_code === cc, `HTTP ${res.status} ${JSON.stringify(a)}`);
    return `${a.county}, ${a.state}, country ${a.country_code}, ${a.hazards.length} ratings`;
  });
}

for (const [place, qs, cc] of [
  ['Nairobi', 'lat=-1.29&lon=36.82', 'KE'],
  ['Paris', 'lat=48.86&lon=2.35', 'FR'],
  ['Toronto', 'lat=43.65&lon=-79.38', 'CA'],
  ['mid-Atlantic ocean', 'lat=0&lon=-30', null],
]) {
  await check(`area: ${place} is outside the US with country ${cc}`, async () => {
    const res = await fn(`kind=area&${qs}`);
    const a = await res.json();
    expect(res.status === 200, `HTTP ${res.status} ${JSON.stringify(a)}`);
    expect(a.in_us === false && a.country_code === cc && a.hazards.length === 0, JSON.stringify(a));
  });
}

for (const qs of ['kind=area&lat=200&lon=0', 'kind=area&lat=10', 'kind=area&lat=abc&lon=1', 'kind=nope&lat=1&lon=1', 'lat=1&lon=1']) {
  await check(`400 for ?${qs}`, async () => {
    const res = await fn(qs);
    expect(res.status === 400, `HTTP ${res.status} ${await res.text()}`);
  });
}

await check('a call with no key is refused', async () => {
  const res = await fetch(`${URL_}/functions/v1/lookup?kind=area&lat=37.78&lon=-121.54`);
  expect(res.status === 401, `HTTP ${res.status}`);
});

await check('CORS: browser preflight and response are allowed from another site', async () => {
  const origin = 'https://kestrel.example';
  const pre = await fetch(`${URL_}/functions/v1/lookup?kind=area&lat=1&lon=1`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,apikey,x-client-info' },
  });
  expect(pre.ok, `preflight HTTP ${pre.status}`);
  const allowed = (pre.headers.get('access-control-allow-headers') ?? '').toLowerCase();
  expect(['authorization', 'apikey', 'x-client-info'].every((h) => allowed.includes(h)), `allow-headers: ${allowed}`);
  const res = await fn('kind=area&lat=37.78&lon=-121.54', { headers: { ...auth, Origin: origin } });
  expect(res.headers.get('access-control-allow-origin') === '*', `allow-origin: ${res.headers.get('access-control-allow-origin')}`);
});

// --- the way the app will call it (supabase-js) ---
const supabase = createClient(URL_, KEY);
await check('supabase-js: functions.invoke reaches lookup with GET', async () => {
  const { data, error } = await supabase.functions.invoke('lookup?kind=area&lat=37.78&lon=-121.54', { method: 'GET' });
  expect(!error && data?.county_fips === '06077', error?.message ?? JSON.stringify(data));
});
await check('supabase-js: rpc prepared_count returns a whole number', async () => {
  const { data, error } = await supabase.rpc('prepared_count');
  expect(!error && Number.isInteger(data) && data >= 0, error?.message ?? String(data));
  return `count = ${data}`;
});

// --- database rules for anonymous visitors ---
await check('lookup_cache: anonymous read returns nothing', async () => {
  const res = await rest('lookup_cache?select=key');
  const body = await res.text();
  expect(body === '[]' || !res.ok, `HTTP ${res.status} ${body.slice(0, 200)}`);
});
await check('lookup_cache: anonymous write is refused', async () => {
  const res = await rest('lookup_cache', { method: 'POST', body: JSON.stringify({ key: 'smoke:test', payload: {} }) });
  expect(res.status === 401 || res.status === 403, `HTTP ${res.status} ${await res.text()}`);
});
await check('kit_plans: anonymous read returns nothing', async () => {
  const res = await rest('kit_plans?select=id');
  const body = await res.text();
  expect(body === '[]' || !res.ok, `HTTP ${res.status} ${body.slice(0, 200)}`);
});
await check('kit_plans: anonymous delete removes nothing', async () => {
  const before = await count();
  await rest('kit_plans?id=gt.0', { method: 'DELETE' });
  expect((await count()) === before, `count went from ${before} to ${await count()}`);
});

if (process.argv.includes('--write')) {
  await check('kit_plans: one anonymous insert raises the counter by exactly 1', async () => {
    const before = await count();
    const res = await rest('kit_plans', { method: 'POST', body: '{}', headers: { Prefer: 'return=minimal' } });
    expect(res.status === 201, `HTTP ${res.status} ${await res.text()}`);
    const after = await count();
    expect(after === before + 1, `count went from ${before} to ${after}`);
    return `count ${before} -> ${after}`;
  });
} else {
  console.log('SKIP  kit_plans insert (pass --write to run it; it raises the counter by 1)');
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
