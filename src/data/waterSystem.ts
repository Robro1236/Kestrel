// EPA drinking water records, called straight from the app (both hosts allow CORS, no key).
// 1. EPA's Water System Service Area Boundaries layer finds the public water system at a point.
// 2. ECHO's Safe Drinking Water search gives that system's 3-year violation summary.
import { fetchJson } from './airQuality';

const BOUNDARIES =
  'https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/Water_System_Boundaries/FeatureServer/0/query';
const ECHO = 'https://echodata.epa.gov/echo/sdw_rest_services';

export type WaterSystemRecord = {
  pwsid: string;
  name: string;
  population: number | null;
  // Quarters with any violation in the last 12 (ECHO QtrsWithVio).
  quartersWithViolations: number;
  healthBased: boolean;
  current: boolean;
  // Rules or contaminants named in violations over the last 3 years.
  contaminants: string[];
  reportUrl: string | null;
  fetchedAt: string;
};

// 'none' means no public system covers the point (often a private well).
export type WaterSystemResult = WaterSystemRecord | 'none';

type Feature = { attributes: { PWSID: string; Service_Area_Type: string | null; Population_Served_Count: number | null } };

// Prefer the residential area over wholesalers or schools that overlap it, then the biggest system.
export const pickSystem = (features: Feature[]) =>
  [...features].sort(
    (a, b) =>
      Number(b.attributes.Service_Area_Type === 'Residential Area') - Number(a.attributes.Service_Area_Type === 'Residential Area') ||
      (b.attributes.Population_Served_Count ?? 0) - (a.attributes.Population_Served_Count ?? 0),
  )[0]?.attributes.PWSID ?? null;

// "1040=Nitrate; 5200=LEAD AND COPPER RULE REVISIONS" -> ["Nitrate", "Lead and copper rule revisions"]
export const contaminantNames = (s: string | null | undefined) =>
  (s ?? '')
    .split(';')
    .map((part) => part.split('=').slice(1).join('=').trim())
    .filter(Boolean)
    .map((n) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n));

// Null when any call fails, so the screen never says "no violations" without data.
export async function fetchWaterSystem(lat: number, lon: number): Promise<WaterSystemResult | null> {
  try {
    // shortcut: only the ~1 km rounded point leaves the device, so a home near a system's edge can match its neighbor; send 3 decimals if users report the wrong system.
    const q = new URLSearchParams({
      geometry: `${lon.toFixed(2)},${lat.toFixed(2)}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'PWSID,Service_Area_Type,Population_Served_Count',
      returnGeometry: 'false',
      f: 'json',
    });
    const area = await fetchJson(`${BOUNDARIES}?${q}`, 10_000);
    if (!Array.isArray(area?.features)) return null;
    const pwsid = pickSystem(area.features);
    if (!pwsid) return 'none';

    const query = await fetchJson(`${ECHO}.get_systems?output=JSON&p_pid=${encodeURIComponent(pwsid)}`, 10_000);
    const qid = query?.Results?.QueryID;
    if (!qid) return null;
    const rows = await fetchJson(`${ECHO}.get_qid?output=JSON&qid=${encodeURIComponent(qid)}`, 10_000);
    const s = rows?.Results?.WaterSystems?.find((w: { PWSId?: string }) => w.PWSId === pwsid);
    if (!s) return null;
    return {
      pwsid,
      name: s.PWSName,
      population: Number(s.PopulationServedCount) || null,
      quartersWithViolations: Number(s.QtrsWithVio) || 0,
      healthBased: s.HealthFlag === 'Yes',
      current: s.CurrVioFlag === '1',
      contaminants: contaminantNames(s.SDWAContaminantsInViol3yr),
      reportUrl: s.DfrUrl ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
