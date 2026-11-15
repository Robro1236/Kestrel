import { parseDeclarations } from './fema';

test('parseDeclarations: newest first, deduped, UTC day kept, title in title case', () => {
  const row = (disasterNumber: number, declarationDate: string, declarationTitle = 'SEVERE STORMS') => ({
    disasterNumber, declarationDate, incidentType: 'Flood', declarationTitle, declarationType: 'DR',
    femaDeclarationString: `DR-${disasterNumber}-CA`, incidentBeginDate: '2023-02-21T00:00:00.000Z', incidentEndDate: null,
    iaProgramDeclared: true, paProgramDeclared: false, hmProgramDeclared: true,
  });
  const out = parseDeclarations({
    DisasterDeclarationsSummaries: [row(1, '2006-02-03T00:00:00.000Z'), row(2, '2023-04-03T00:00:00.000Z', 'FLOODING AS A RESULT OF A LEVEE BREAK'), row(2, '2023-04-03T00:00:00.000Z'), { bad: true }],
  });
  expect(out).toMatchObject([
    {
      id: 2, date: '2023-04-03', type: 'Flood', name: 'Flooding as a Result of a Levee Break',
      kind: 'Major disaster', code: 'DR-2-CA', start: '2023-02-21', end: null,
      help: ['Aid to individuals and households', 'Hazard mitigation grants to reduce future damage'],
    },
    { id: 1, date: '2006-02-03', type: 'Flood', name: 'Severe Storms' },
  ]);
  expect(() => parseDeclarations({})).toThrow();
});
