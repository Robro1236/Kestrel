import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import History from '../app/history';
import { useLocalArea } from './useLocalArea';

jest.mock('./useLocalArea', () => ({ useLocalArea: jest.fn() }));
const area = { place: { lat: 0, lon: 0, label: 'Kalaupapa, HI' }, inUs: true, area: { county: 'Kalawao County', county_fips: '15005' } } as never;
const row = (disasterNumber: number, declarationDate: string, incidentType: string, declarationTitle: string) => ({
  disasterNumber, declarationDate, incidentType, declarationTitle, declarationType: 'DR', femaDeclarationString: `DR-${disasterNumber}-HI`,
  incidentBeginDate: declarationDate, incidentEndDate: null, ihProgramDeclared: true,
});

// protects=the timeline lists the county's FEMA declarations, ends with a marker, opens details, full screen and the FEMA source; fails_when=the count or an event is missing, the details or full screen won't open or close, Source goes to the wrong page, or a failed FEMA call shows nothing; no_claim=where the card is drawn (above or below the dot) or how it animates
test('History: timeline, details card, full screen and FEMA source', async () => {
  jest.mocked(useLocalArea).mockReturnValue(area);
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    DisasterDeclarationsSummaries: [row(961, '1992-09-12T00:00:00.000Z', 'Hurricane', 'HURRICANE INIKI'), row(4510, '2020-04-01T00:00:00.000Z', 'Biological', 'COVID-19 PANDEMIC')],
  }) });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await render(<History />);

  expect(await screen.findByText(/has had/)).toHaveTextContent('Kalawao County has had 2 federal disasters declared. The most recent was 2020-04-01.');
  expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent("fipsStateCode eq '15' and fipsCountyCode eq '005'"));
  expect(screen.getByText('Hurricane Iniki')).toBeTruthy();
  expect(screen.getByText('The data ends here')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Details: Hurricane, 1992-09-12'));
  expect(screen.getByText('DR-961-HI')).toBeTruthy();
  expect(screen.getByText('1992-09-12 onward')).toBeTruthy();
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await fireEvent.press(screen.getByRole('link', { name: 'Source: FEMA page for DR-961-HI' }));
  expect(open).toHaveBeenCalledWith('https://www.fema.gov/disaster/961');

  await fireEvent.press(screen.getByLabelText('Full screen'));
  expect(screen.getByRole('header', { name: 'Hurricane' })).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Exit full screen'));
  expect(screen.queryByRole('header', { name: 'Hurricane' })).toBeNull();
  await screen.unmount();

  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
  await render(<History />);
  expect(await screen.findByText(/Couldn't load FEMA's disaster history/)).toBeTruthy();
});
