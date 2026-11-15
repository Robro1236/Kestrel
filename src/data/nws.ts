// National Weather Service active alerts, called straight from the app (CORS-friendly, no key).
import { fetchJson } from './airQuality';

export type Alert = { id: string; event: string; headline: string; severity: string; ends: string | null };
// lat/lon: the point checked, so a saved copy from another place is never shown here.
export type Warnings = { lat: number; lon: number; alerts: Alert[]; fetched_at: string };

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

// Keeps alerts with an event name; drops ones whose end time has passed.
export function parseAlerts(body: unknown, now = new Date()): Alert[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) throw new Error('NWS response has no features');
  return features.flatMap((f): Alert[] => {
    const p = f?.properties ?? {};
    const event = str(p.event);
    const ends = str(p.ends) ?? str(p.expires);
    if (!event || (ends && new Date(ends) < now)) return [];
    return [{ id: str(p['@id']) ?? str(p.id) ?? event, event, headline: str(p.headline) ?? event, severity: str(p.severity) ?? 'Unknown', ends }];
  });
}

// Throws on failure; the caller shows "Couldn't check warnings right now." with the saved copy.
export async function fetchWarnings(lat: number, lon: number): Promise<Warnings> {
  const body = await fetchJson(
    `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
    10_000,
    { Accept: 'application/geo+json' },
  );
  return { lat, lon, alerts: parseAlerts(body), fetched_at: new Date().toISOString() };
}

// The NWS forecast page for the point lists the same active hazards in plain language; `@id` is raw JSON.
export const alertsPage = (lat: number, lon: number) =>
  `https://forecast.weather.gov/MapClick.php?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

// A saved list can outlive its alerts; every section filters through this so they agree.
export const activeOnly = (alerts: Alert[], now = new Date()) => alerts.filter((a) => !a.ends || new Date(a.ends) > now);
