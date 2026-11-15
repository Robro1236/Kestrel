import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// null when the env vars are missing, so a misconfigured build still shows the kit instead of crashing.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

// GET lookup?kind=...; throws on any failure so callers can fall back to the saved result.
export async function lookup<T>(kind: 'area' | 'places', lat: number, lon: number): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke(`lookup?kind=${kind}&lat=${lat}&lon=${lon}`, { method: 'GET' });
  if (error) throw error;
  return data as T;
}

// One kit_plans row, timestamp only (the table's default). Throws on failure so recordPlanOnce retries next visit.
// shortcut: the anon key can spam this insert (see the kit_plans migration); add rate limiting if it gets abused.
export async function recordPlan(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('kit_plans').insert({});
  if (error) throw error;
}

// Number of households that built a kit, or null on any failure so the home screen just hides it.
export async function preparedCount(): Promise<number | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('prepared_count');
    return !error && data != null && Number.isFinite(Number(data)) ? Number(data) : null;
  } catch {
    return null;
  }
}
