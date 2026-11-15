import { render, screen } from '@testing-library/react-native';

import { contaminantNames, fetchWaterSystem, pickSystem } from '../data/waterSystem';
import { WaterSystem } from './WaterSystem';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const AsyncStorage = require('@react-native-async-storage/async-storage');

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const boundary = (...features: [string, string, number][]) =>
  json({ features: features.map(([PWSID, Service_Area_Type, Population_Served_Count]) => ({ attributes: { PWSID, Service_Area_Type, Population_Served_Count } })) });
const echoRow = (row: Record<string, string | null>) => json({ Results: { WaterSystems: [row] } });
// Boundary, then ECHO get_systems (QueryID), then ECHO get_qid (the row), as in fetchWaterSystem.
const mockFetch = (...responses: unknown[]) => {
  const f = jest.fn();
  responses.forEach((r) => f.mockResolvedValueOnce(r));
  globalThis.fetch = f as unknown as typeof fetch;
  return f;
};
const NITRATE = {
  PWSId: 'CA3910027', PWSName: 'CITY OF MOUNTAIN HOUSE', PopulationServedCount: '26400', QtrsWithVio: '2',
  HealthFlag: 'Yes', CurrVioFlag: '1', SDWAContaminantsInViol3yr: '1040=Nitrate; 5200=LEAD AND COPPER RULE REVISIONS',
  DfrUrl: 'https://echo.epa.gov/detailed-facility-report?fid=110013165751',
};

// protects=the water system shown is the user's residential system, with its EPA violations read from ECHO's real field names; fails_when=a wholesaler or school polygon wins, the exact location is sent, contaminants are misparsed, a failed call reads as "no violations", or an empty map hit isn't reported as no public system; no_claim=EPA's layer and ECHO still use these URLs and field names today
test('waterSystem: picks the residential system, parses violations, null on failure', async () => {
  expect(pickSystem([
    { attributes: { PWSID: 'WHOLESALE', Service_Area_Type: 'Wholesaler', Population_Served_Count: 900000 } },
    { attributes: { PWSID: 'HOME', Service_Area_Type: 'Residential Area', Population_Served_Count: 26400 } },
    { attributes: { PWSID: 'SCHOOL', Service_Area_Type: 'School', Population_Served_Count: 800 } },
  ])).toBe('HOME');
  expect(contaminantNames('1040=Nitrate; 5200=LEAD AND COPPER RULE REVISIONS')).toEqual(['Nitrate', 'Lead and copper rule revisions']);
  expect(contaminantNames(null)).toEqual([]);

  const f = mockFetch(boundary(['CA3910027', 'Residential Area', 24948]), json({ Results: { QueryID: '417' } }), echoRow(NITRATE));
  expect(await fetchWaterSystem(37.7812, -121.5436)).toMatchObject({
    pwsid: 'CA3910027', population: 26400, quartersWithViolations: 2, healthBased: true, current: true,
    contaminants: ['Nitrate', 'Lead and copper rule revisions'],
  });
  expect(decodeURIComponent(f.mock.calls[0][0])).toContain('geometry=-121.54,37.78&');
  expect(f.mock.calls[1][0]).toContain('p_pid=CA3910027');
  expect(f.mock.calls[2][0]).toContain('qid=417');

  mockFetch(boundary());
  expect(await fetchWaterSystem(37.78, -121.54)).toBe('none');
  mockFetch(boundary(['CA3910027', 'Residential Area', 1]), json({ Results: { Error: { ErrorMessage: 'x' } } }));
  expect(await fetchWaterSystem(37.78, -121.54)).toBeNull();
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  expect(await fetchWaterSystem(37.78, -121.54)).toBeNull();
});

// protects=the section is US-only, labels its source with a date, and offline falls back to the saved copy for the same point instead of claiming "no violations"; fails_when=it renders outside the US, drops the source/date, hides a health violation, or shows nothing useful offline; no_claim=the wording is the right advice for every violation type
test('WaterSystem: US only, shows violations with a dated source, falls back to the saved copy', async () => {
  await AsyncStorage.clear();
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
  await render(<WaterSystem lat={-1.29} lon={36.82} inUs={false} />);
  expect(screen.queryByText('Your water system')).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  await screen.unmount();

  mockFetch(boundary(['CA3910027', 'Residential Area', 24948]), json({ Results: { QueryID: '417' } }), echoRow(NITRATE));
  await render(<WaterSystem lat={37.78} lon={-121.54} inUs />);
  expect(await screen.findByText(/Health-based violation in 2 of the last 12 quarters, one still open: Nitrate/)).toBeTruthy();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByText(/Source: EPA ECHO drinking water records .* fetched \d{4}-\d{2}-\d{2}/)).toBeTruthy();
  await screen.unmount();

  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
  await render(<WaterSystem lat={37.78} lon={-121.54} inUs />);
  expect(await screen.findByText(/saved \d{4}-\d{2}-\d{2}\. Showing the saved copy\./)).toBeTruthy();
  expect(screen.getByText('CITY OF MOUNTAIN HOUSE')).toBeTruthy();
  await screen.unmount();

  // A saved copy for another point is not shown as this one's.
  await render(<WaterSystem lat={40.71} lon={-74.01} inUs />);
  expect(await screen.findByText("Couldn't reach EPA drinking water records right now.")).toBeTruthy();
  expect(screen.queryByText('CITY OF MOUNTAIN HOUSE')).toBeNull();
});
