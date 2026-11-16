// Run daily by Vercel Cron (vercel.json). One call does both jobs: it is real API traffic, so the free
// Supabase project never pauses, and maintain() deletes cache rows older than 30 days so the DB can't fill.
// If CRON_SECRET is set in Vercel, Vercel sends it as a bearer token and anyone else gets 401.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response('Supabase env vars missing', { status: 500 });

  try {
    const res = await fetch(`${url}/rest/v1/rpc/maintain`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.text();
    // A non-2xx status shows up as a failed run in Vercel's cron log.
    return new Response(res.ok ? `ok, ${body} stale cache rows deleted` : `Supabase ${res.status}: ${body}`, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return new Response(`Supabase unreachable: ${e}`, { status: 502 });
  }
}
