// One date format for every "fetched"/"saved"/"checked" label: the phone's local day as YYYY-MM-DD.
// Built by hand because toISOString() is the UTC day, and locale formats differ (11/14 vs 14/11).
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Alert times with the zone named, since a user may look up a place in another time zone.
export const localTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
