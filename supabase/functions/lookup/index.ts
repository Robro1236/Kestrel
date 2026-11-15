// GET /lookup?kind=area|places&lat=..&lon=..  (spec: docs/SPEC.md, "Supabase")
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchArea } from './area.ts';
import { makeHandler } from './handler.ts';
import { fetchPlaces } from './places.ts';

// Service role bypasses RLS on lookup_cache; both values are injected by Supabase.
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const cache = {
  async get(key: string) {
    const { data, error } = await db
      .from('lookup_cache')
      .select('payload, fetched_at')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async put(key: string, payload: Record<string, unknown>) {
    const fetched_at = new Date().toISOString();
    const { error } = await db.from('lookup_cache').upsert({ key, payload, fetched_at });
    if (error) throw error;
    return fetched_at;
  },
};

Deno.serve(
  makeHandler(cache, {
    area: { ttlDays: 30, fetch: fetchArea },
    // Photon's shorter list is the Overpass-down fallback, so retry Overpass after a day, not a week.
    // Rows cached before places carried phones or distance-sorted CMS hospitals are refetched once; a failed CMS or FEMA lookup (null) is retried after a day.
    places: {
      ttlDays: (p) =>
        p.er_order !== 'distance' || !(p.places as object[]).every((x) => 'phone' in x) ? 0 : p.source === 'photon' || p.er_hospitals === null || p.shelters === null ? 1 : 7,
      fetch: fetchPlaces,
    },
  }),
);
