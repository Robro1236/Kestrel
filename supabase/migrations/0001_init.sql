create table public.kit_plans (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
alter table public.kit_plans enable row level security;
create policy "anon can insert" on public.kit_plans for insert to anon with check (true);
-- shortcut: anyone can inflate the counter by spamming inserts; add rate limiting if it gets abused.
grant insert on public.kit_plans to anon;

create function public.prepared_count() returns bigint
  language sql security definer set search_path = public
  as $$ select count(*) from public.kit_plans $$;
grant execute on function public.prepared_count() to anon;

create table public.lookup_cache (
  key text primary key,          -- e.g. 'area:37.78:-121.54'
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.lookup_cache enable row level security;  -- no policies: service role only
