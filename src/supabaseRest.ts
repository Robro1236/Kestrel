// The three Supabase calls the app makes, over plain fetch. supabase-js also ships auth, realtime and storage,
// which pushed the web bundle past its 450 kB budget (CONSTRAINTS.md). Same { data, error } results as supabase-js.
type Result = { data: unknown; error: { message: string } | null };

export function createClient(url: string, key: string) {
  const call = async (path: string, init: RequestInit = {}): Promise<Result> => {
    try {
      const res = await fetch(`${url}${path}`, {
        ...init,
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
      });
      const text = await res.text();
      if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}: ${text.slice(0, 200)}` } };
      return { data: text ? JSON.parse(text) : null, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  };
  return {
    functions: { invoke: (path: string, init: { method: 'GET' }) => call(`/functions/v1/${path}`, init) },
    from: (table: string) => ({
      insert: (row: object) => call(`/rest/v1/${table}`, { method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=minimal' } }),
    }),
    rpc: (fn: string) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: '{}' }),
  };
}
