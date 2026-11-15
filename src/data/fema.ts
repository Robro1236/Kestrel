// OpenFEMA disaster declarations, called straight from the app (CORS-friendly, no key).
import { fetchJson } from './airQuality';

// date: when it was declared. start/end: the incident period, as ISO days. help: the federal programs approved.
export type Declaration = {
  id: number; date: string; type: string; name: string;
  kind: string; code: string; start: string | null; end: string | null; help: string[];
};

const KINDS: Record<string, string> = { DR: 'Major disaster', EM: 'Emergency', FM: 'Fire management' };
const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : null);

// FEMA titles are all caps. Title case reads calmer and keeps names right (Loma Prieta, Katrina).
const SMALL = new Set(['a', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to']);
const titleCase = (s: string) =>
  s.toLowerCase().replace(/[a-z][a-z']*/g, (w, at: number) => (at && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)));

// Newest first, one row per disaster. date stays the ISO day (FEMA stores midnight UTC, so local time would shift it).
export function parseDeclarations(body: unknown): Declaration[] {
  const rows = (body as { DisasterDeclarationsSummaries?: unknown })?.DisasterDeclarationsSummaries;
  if (!Array.isArray(rows)) throw new Error('FEMA response has no declarations');
  const seen = new Set<number>();
  return rows
    .flatMap((r): Declaration[] => {
      const { disasterNumber: id, declarationDate: date, incidentType: type, declarationTitle: name, declarationType: kind } = r ?? {};
      if (typeof id !== 'number' || typeof date !== 'string' || seen.has(id)) return [];
      seen.add(id);
      // ia is the older name for ih (help to individuals), so either one means households could apply.
      const help = [
        (r.ihProgramDeclared || r.iaProgramDeclared) && 'Aid to individuals and households',
        r.paProgramDeclared && 'Public assistance for debris removal and repairs',
        r.hmProgramDeclared && 'Hazard mitigation grants to reduce future damage',
      ].filter((h): h is string => typeof h === 'string');
      return [{
        id, date: date.slice(0, 10), type: typeof type === 'string' ? type : 'Other', name: typeof name === 'string' ? titleCase(name) : '',
        kind: KINDS[kind] ?? 'Declaration', code: typeof r.femaDeclarationString === 'string' ? r.femaDeclarationString : '',
        start: day(r.incidentBeginDate), end: day(r.incidentEndDate), help,
      }];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// FEMA has a page for every disaster number, back to the 1960s.
export const declarationPage = (id: number) => `https://www.fema.gov/disaster/${id}`;

// countyFips: 5 digits, e.g. '06077'. Throws on failure; the screen says it couldn't load.
// shortcut: skips statewide declarations (county code 000), add them if users ask why one is missing.
export async function fetchDeclarations(countyFips: string): Promise<Declaration[]> {
  const filter = encodeURIComponent(`fipsStateCode eq '${countyFips.slice(0, 2)}' and fipsCountyCode eq '${countyFips.slice(2)}'`);
  const body = await fetchJson(
    `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=${filter}&$select=disasterNumber,declarationDate,incidentType,declarationTitle,declarationType,femaDeclarationString,incidentBeginDate,incidentEndDate,ihProgramDeclared,iaProgramDeclared,paProgramDeclared,hmProgramDeclared&$orderby=declarationDate%20desc&$top=1000`,
    10_000,
  );
  return parseDeclarations(body);
}
