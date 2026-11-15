import { createClient } from './supabaseRest';

// protects=the fetch client sends the anon key, hits the right Supabase paths, and turns HTTP and network errors into { error } like supabase-js; fails_when=a 4xx/5xx or a thrown fetch reads as success, the key or path is wrong, or a 201 with no body fails to parse; no_claim=the live project accepts these requests (checked in the browser)
test('supabaseRest: paths, key headers, and errors as { error }', async () => {
  const f = jest.fn();
  globalThis.fetch = f as unknown as typeof fetch;
  const db = createClient('https://x.supabase.co', 'anon');

  f.mockResolvedValueOnce(new Response('{"in_us":true}', { status: 200 }));
  expect(await db.functions.invoke('lookup?kind=area&lat=1&lon=2', { method: 'GET' })).toEqual({ data: { in_us: true }, error: null });
  expect(f.mock.calls[0][0]).toBe('https://x.supabase.co/functions/v1/lookup?kind=area&lat=1&lon=2');
  expect(f.mock.calls[0][1].headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon' });

  f.mockResolvedValueOnce(new Response(null, { status: 201 }));
  expect(await db.from('kit_plans').insert({})).toEqual({ data: null, error: null });
  expect(f.mock.calls[1][0]).toBe('https://x.supabase.co/rest/v1/kit_plans');
  expect(f.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{}' });

  f.mockResolvedValueOnce(new Response('42', { status: 200 }));
  expect((await db.rpc('prepared_count')).data).toBe(42);
  expect(f.mock.calls[2][0]).toBe('https://x.supabase.co/rest/v1/rpc/prepared_count');

  f.mockResolvedValueOnce(new Response('{"message":"denied"}', { status: 401 }));
  expect((await db.rpc('prepared_count')).error?.message).toMatch(/HTTP 401/);
  f.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  expect(await db.from('kit_plans').insert({})).toEqual({ data: null, error: { message: 'Failed to fetch' } });
});
