import { GET } from './keepalive';

const req = (auth?: string) => new Request('https://x/api/keepalive', auth ? { headers: { authorization: auth } } : {});
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.CRON_SECRET = 's3cret';
});

// protects=the daily cron reaches Supabase's maintain() with the anon key, so the project stays active and the cache is pruned
// fails_when=the RPC path or headers are wrong, a stranger can trigger it when CRON_SECRET is set, or a Supabase failure reports 200
// no_claim=does not prove Vercel runs the cron, or that this traffic stops Supabase pausing the project
test('keepalive: calls maintain(), rejects wrong secrets, reports failures', async () => {
  fetchMock.mockResolvedValueOnce(new Response('3'));
  const ok = await GET(req('Bearer s3cret'));
  expect(ok.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/maintain', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ apikey: 'anon' }) }));

  expect((await GET(req('Bearer nope'))).status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fetchMock.mockResolvedValueOnce(new Response('no such function', { status: 404 }));
  expect((await GET(req('Bearer s3cret'))).status).toBe(502);
  fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
  expect((await GET(req('Bearer s3cret'))).status).toBe(502);
});
