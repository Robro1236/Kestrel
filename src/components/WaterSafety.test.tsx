import { render, screen } from '@testing-library/react-native';

import { WaterSafety } from './WaterSafety';

// protects=home shows only the urgent water card during a flood or hurricane warning, and nothing otherwise; fails_when=urgentOnly shows routine water advice on home, or hides the urgent card; no_claim=the boil advice wording
test('WaterSafety urgentOnly: urgent card during a flood warning, nothing otherwise', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
  const props = { lat: 37.78, lon: -121.54, gallons: 9, countryCode: 'US', hazards: [] };
  await render(<WaterSafety {...props} activeAlerts={['Flood Warning']} urgentOnly />);
  expect(screen.getByText(/your tap water may not be safe/)).toBeTruthy();
  expect(screen.queryByText(/Store/)).toBeNull();
  await screen.unmount();

  await render(<WaterSafety {...props} activeAlerts={[]} urgentOnly />);
  expect(screen.queryByText('Water safety')).toBeNull();
});
