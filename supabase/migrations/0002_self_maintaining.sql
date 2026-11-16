-- Keeps the database a fixed size with nobody looking after it.
-- Roll back: drop function public.record_plan, public.maintain; drop table public.plan_counter;
-- then rerun prepared_count() and the kit_plans grant from 0001.

-- 1. The counter is one row, not one row per plan, so spam can inflate it but never fill the database.
create table public.plan_counter (
  id int primary key default 1 check (id = 1),
  n bigint not null default 0
);
alter table public.plan_counter enable row level security;  -- no policies: only the functions below touch it
insert into public.plan_counter (n) select count(*) from public.kit_plans;  -- carry the existing total over

-- shortcut: anyone with the anon key can call this in a loop and inflate the number; add rate limiting if it gets abused.
create function public.record_plan() returns void
  language sql security definer set search_path = public
  as $$ update public.plan_counter set n = n + 1 where id = 1 $$;
grant execute on function public.record_plan() to anon;

create or replace function public.prepared_count() returns bigint
  language sql security definer set search_path = public
  as $$ select n from public.plan_counter where id = 1 $$;

-- kit_plans stays as a record of past plans but takes no new rows.
revoke insert on public.kit_plans from anon;
drop policy "anon can insert" on public.kit_plans;

-- 2. Cache rows older than 30 days are stale for every kind (area 30 d, places at most 7 d), so deleting them
-- loses nothing: the next lookup refetches. Called daily by the Vercel cron (api/keepalive.ts), and that same
-- call is what stops the free project pausing.
-- shortcut: anon can call this in a loop; each call is one delete over a small table, so the cost is DB CPU only.
create function public.maintain() returns bigint
  language sql security definer set search_path = public
  as $$
    with gone as (delete from public.lookup_cache where fetched_at < now() - interval '30 days' returning 1)
    select count(*) from gone
  $$;
grant execute on function public.maintain() to anon;
