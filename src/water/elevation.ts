import { fetchJson } from '../data/airQuality';

// Metres above sea level from Open-Meteo, or null if the call fails (the boil step then names both times).
export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const body = await fetchJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, 10_000);
    const m = body?.elevation?.[0];
    return typeof m === 'number' && Number.isFinite(m) ? m : null;
  } catch {
    return null;
  }
}
