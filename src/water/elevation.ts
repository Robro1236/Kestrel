import { fetchJson } from '../data/airQuality';

const inFlight = new Map<string, Promise<number | null>>();

// Metres above sea level from Open-Meteo, or null if the call fails (the boil step then names both times).
// Cards that mount together share one in-flight request per point.
export function fetchElevation(lat: number, lon: number): Promise<number | null> {
  const key = `${lat},${lon}`;
  if (!inFlight.has(key)) inFlight.set(key, elevation(lat, lon).finally(() => inFlight.delete(key)));
  return inFlight.get(key)!;
}

async function elevation(lat: number, lon: number): Promise<number | null> {
  try {
    const body = await fetchJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, 10_000);
    const m = body?.elevation?.[0];
    return typeof m === 'number' && Number.isFinite(m) ? m : null;
  } catch {
    return null;
  }
}
