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
