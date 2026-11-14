// Load test against the deployed Supabase project: many people opening the app at once.
// Run: npm run load            (defaults: 50 concurrent users for 20 s)
//      npm run load -- 100 30  (100 concurrent for 30 s)
// Each simulated user loops: home counter (prepared_count) then an area lookup for a cell that
// is already cached, so this measures our stack, not the free upstream APIs (which we must not load-test).
// Costs roughly concurrency x duration x 2 requests of the free-tier quota; don't run it in a loop.
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');

const [users = 50, seconds = 20] = process.argv.slice(2).map(Number);
const P95_MS = 1500; // budget from CONSTRAINTS.md
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const calls = {
  counter: () => fetch(`${URL_}/rest/v1/rpc/prepared_count`, { method: 'POST', headers, body: '{}' }),
  lookup: () => fetch(`${URL_}/functions/v1/lookup?kind=area&lat=37.78&lon=-121.54`, { headers }),
};

const results = { counter: [], lookup: [] };
let failures = 0;
const end = Date.now() + seconds * 1000;
async function user() {
  while (Date.now() < end) {
    for (const [name, call] of Object.entries(calls)) {
      const t = performance.now();
      try {
        const res = await call();
        await res.arrayBuffer();
        if (!res.ok) failures++;
      } catch {
        failures++; // network error counts as a failure, never as a fast success
        continue;
      }
      results[name].push(performance.now() - t);
    }
  }
}

await calls.lookup(); // warm the cache cell so the run measures cache hits
await Promise.all(Array.from({ length: users }, user));

const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? Infinity;
let ok = failures === 0;
for (const [name, xs] of Object.entries(results)) {
  const v = p95(xs);
  if (v > P95_MS) ok = false;
  console.log(`${name}: ${xs.length} ok, p95 ${v.toFixed(0)} ms`);
}
console.log(`${users} users x ${seconds}s: ${failures} failed requests; budget p95 <= ${P95_MS} ms, 0 failures`);
process.exit(ok ? 0 : 1);
