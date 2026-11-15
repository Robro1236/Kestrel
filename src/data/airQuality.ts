// Open-Meteo air quality, called straight from the app (CORS-friendly, no key).

export type AirQuality = { aqi: number; pm25: number | null; fetchedAt: string };

// AbortController rather than AbortSignal.timeout, which older Hermes builds lack.
export async function fetchJson(url: string, timeoutMs: number, headers?: Record<string, string>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url.split('/')[2]} returned HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Null when the call fails or has no AQI: the banner then stays hidden, never "air is fine" without data.
export async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
  try {
    const body = await fetchJson(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=us_aqi,pm2_5`,
      10_000,
    );
    const aqi = body?.current?.us_aqi;
    if (typeof aqi !== 'number' || !Number.isFinite(aqi)) return null;
    const pm25 = body.current.pm2_5;
    return { aqi, pm25: typeof pm25 === 'number' ? pm25 : null, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

export const showAirBanner = (aqi: number) => aqi > 100;

const TIERS: { min: number; label: string; tip: string }[] = [
  { min: 301, label: 'Hazardous', tip: 'Stay indoors with windows closed. Wear an N95 if you must go outside.' },
  { min: 201, label: 'Very unhealthy', tip: 'Stay indoors with windows closed; run an air purifier or box-fan filter.' },
  { min: 151, label: 'Unhealthy', tip: 'Everyone should limit time outside. Keep windows closed; wear an N95 outside.' },
  { min: 101, label: 'Unhealthy for sensitive groups', tip: 'Children, older adults and people with heart or lung conditions should limit time outside.' },
];

// Open-Meteo sends whole numbers, but a fractional AQI like 100.4 still falls in the tier above 100.
export const airTier = (aqi: number) => (showAirBanner(aqi) ? TIERS.find((t) => aqi >= t.min) ?? TIERS[3] : null);
