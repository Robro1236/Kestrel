import { resolveText, searchPlaces } from './location';

const mockFetch = (status: number, body: unknown) => {
  const fn = jest.fn().mockResolvedValue({ status, ok: status < 400, json: async () => body });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};

// protects=a 5-digit entry goes to the ZIP service and anything else to the city geocoder, each parsed to lat/lon + country
// fails_when=ZIP detection is wrong ("95391 " or "9539" misrouted), or string lat/lon are not converted to numbers
// no_claim=does not prove the live services still return these shapes
test('ZIP goes to Zippopotam, other text to Open-Meteo geocoding', async () => {
  let fetchMock = mockFetch(200, {
    places: [{ 'place name': 'Tracy', longitude: '-121.5397', latitude: '37.7695', 'state abbreviation': 'CA' }],
  });
  expect(await resolveText(' 95391 ')).toEqual({ lat: 37.7695, lon: -121.5397, label: 'Tracy, CA 95391', countryCode: 'US' });
  expect(fetchMock).toHaveBeenCalledWith('https://api.zippopotam.us/us/95391');

  for (const [q, encoded] of [['Nairobi', 'Nairobi'], ['9539', '9539'], ['New York', 'New%20York']]) {
    fetchMock = mockFetch(200, {
      results: [{ name: 'Nairobi', latitude: -1.28333, longitude: 36.81667, country_code: 'KE', country: 'Kenya', admin1: 'Nairobi County' }],
    });
    expect(await resolveText(q)).toEqual({ lat: -1.28333, lon: 36.81667, label: 'Nairobi, Nairobi County, Kenya', countryCode: 'KE' });
    expect(fetchMock).toHaveBeenCalledWith(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1`);
  }
});

// protects=an unknown place gives null (the inline "couldn't find that place" message), a broken service throws
// fails_when=a 404 or empty result crashes the form, or a 500 is reported as "not found"
// no_claim=Zippopotam's real not-found response was not probed; 404 is the expected one
test('not found is null, a server error throws', async () => {
  mockFetch(404, {});
  expect(await resolveText('00000')).toBeNull();
  mockFetch(200, {});
  expect(await resolveText('Zzzzqqq')).toBeNull();
  mockFetch(500, {});
  await expect(resolveText('Tracy')).rejects.toThrow('500');
});

// protects=the autocomplete list maps every Open-Meteo match, asks for the requested count, and is empty when nothing matches
// fails_when=only the first hit is returned, the count is ignored, or a no-results reply crashes the list
// no_claim=does not prove Open-Meteo's live ranking or prefix matching
test('searchPlaces returns every match, or none', async () => {
  const fetchMock = mockFetch(200, {
    results: [
      { name: 'Springfield', latitude: 39.8, longitude: -89.64, country_code: 'US', country: 'United States', admin1: 'Illinois' },
      { name: 'Springfield', latitude: 37.21, longitude: -93.29, country_code: 'US', country: 'United States' },
    ],
  });
  expect((await searchPlaces('Spring', 5)).map((p) => p.label)).toEqual([
    'Springfield, Illinois, United States',
    'Springfield, United States',
  ]);
  expect(fetchMock).toHaveBeenCalledWith('https://geocoding-api.open-meteo.com/v1/search?name=Spring&count=5');
  mockFetch(200, {});
  expect(await searchPlaces('Zzzzqqq')).toEqual([]);
});
