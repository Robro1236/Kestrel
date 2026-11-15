// Request handling for the lookup function, kept free of Deno and Supabase
// imports so jest can test it with a fake cache.

export type CacheRow = { payload: Record<string, unknown>; fetched_at: string };
export type Cache = {
  get(key: string): Promise<CacheRow | null>;
  put(key: string, payload: Record<string, unknown>): Promise<string>; // returns fetched_at
};
export type Kind = {
  // A function when how long a row stays fresh depends on what was fetched.
  ttlDays: number | ((payload: Record<string, unknown>) => number);
  fetch(lat: number, lon: number): Promise<Record<string, unknown>>;
};

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function coord(value: string | null, max: number): number | null {
  const n = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 100) / 100 : null;
}

export function makeHandler(cache: Cache, kinds: Record<string, Kind>, now = () => Date.now()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const url = new URL(req.url);
    const kindName = url.searchParams.get('kind') ?? '';
    const kind = Object.hasOwn(kinds, kindName) ? kinds[kindName] : undefined;
    if (!kind) return json({ error: 'bad_kind' }, 400);
    // Rounded to 2 decimals (~1 km) before anything is cached or sent upstream.
    const lat = coord(url.searchParams.get('lat'), 90);
    const lon = coord(url.searchParams.get('lon'), 180);
    if (lat === null || lon === null) return json({ error: 'bad_coordinates' }, 400);

    const key = `${kindName}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    let row: CacheRow | null = null;
    try {
      row = await cache.get(key);
    } catch (e) {
      console.error('cache read failed', e);
    }
    const ttlDays = row ? (typeof kind.ttlDays === 'function' ? kind.ttlDays(row.payload) : kind.ttlDays) : 0;
    if (row && now() - Date.parse(row.fetched_at) < ttlDays * 86_400_000) {
      return json({ ...row.payload, fetched_at: row.fetched_at, stale: false });
    }

    let payload: Record<string, unknown>;
    try {
      payload = await kind.fetch(lat, lon);
    } catch (e) {
      console.error(`${kindName} upstream failed`, e);
      if (row) return json({ ...row.payload, fetched_at: row.fetched_at, stale: true });
      return json({ error: 'upstream_unavailable' }, 502);
    }

    // shortcut: anyone with the public key can add a cache row per ~1 km cell and make us call the upstreams; add rate limiting or a row cap if it gets abused.
    let fetchedAt = new Date(now()).toISOString();
    try {
      fetchedAt = await cache.put(key, payload);
    } catch (e) {
      console.error('cache write failed', e);
    }
    return json({ ...payload, fetched_at: fetchedAt, stale: false });
  };
}
