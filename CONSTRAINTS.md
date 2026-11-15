# Constraints

Last reviewed: 2026-11-14. Both of us (and both Claudes) read this before writing code.
Tightening a rule needs no discussion. Loosening one needs both of us to agree, in its own commit, never in the commit that was failing.

## Floor (always enforced)

Checked by `node scripts/floor-guard.mjs` (diff against `origin/main`, including untracked files). Exit 1 blocks.

- No new suppressions: `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `istanbul ignore`
- No unfinished work: `throw new Error("Not implemented")`, empty `catch {}`, `TODO` standing in for code. Known limits use a `// shortcut: <limit>, <when to upgrade>` comment instead
- No skipped tests (`.skip`, `.todo`, `xit`), no deleted test files, no assertions removed from tests that stayed
- No secrets in source: Supabase JWTs (`eyJ…`) and `sb_secret_` keys stay in `.env`. The guard prints the file, never the value
- This file does not get weakened to make a change pass

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at | Blocks? |
|-----------|------|-----------|---------|---------|
| Types | Zero type errors | `tsc --noEmit` | every edit (`check:fast`) | yes |
| Floor | Zero findings | `node scripts/floor-guard.mjs` | every edit (`check:fast`) | yes |
| Tests | All pass, count must not fall (28 today) | `jest` | task end (`check:task`) | yes |
| Dependency vulns | Nothing at high or above in shipped deps | `npm audit --omit=dev --audit-level=high` | before deploy (`check:full`) | warn during the hackathon |
| Web bundle | Gzipped JS ≤ 450 kB | `node scripts/bundle-size.mjs dist 450` | before deploy (`check:full`) | yes |
| Load | 50 concurrent users for 20 s: p95 ≤ 1500 ms, 0 failed requests | `npm run load` | before the demo, and after any change to `supabase/` | yes |

Why these numbers:
- **Bundle 450 kB**: we're at 375 kB today. On a slow phone connection (~1.6 Mbps, Lighthouse's "slow 4G") 450 kB is about 2–3 s of download, which is the most a judge clicking a link will sit through. It also sets the hosting cost: every visit pulls this.
- **Load 50 users / p95 1500 ms**: a Rotary demo or a club sharing the link in a group chat means dozens of people opening it in the same minute, not thousands. 50 concurrent loops ≈ a few hundred requests a second, well past that. 1500 ms because the area lookup is one tap behind a loading state; past that it feels broken.
- **Tests must not fall**: a lower count means a test was deleted, which the floor also catches.

`npm run load` hits the deployed project and spends free-tier quota (~2 requests per user per loop). It only loads a cached cell; never point it at uncached cells, which would hammer FCC, ArcGIS and Photon (free public APIs we don't own).

## Load rules (checked in review)

These have no automated check; the reviewer (`/review`) confirms them on any diff touching network code.

1. **Cache before upstream.** A cache hit never calls FCC, ArcGIS or Photon. Guarded by the test `handler: rounds to 2 decimals, caches, then serves the fresh row`, which must keep `toHaveBeenCalledTimes(1)`.
2. **Every outbound call has a timeout.** Upstream fetches use `AbortSignal.timeout` (10 s today in `area.ts`). Check: `grep -n "fetch(" supabase/functions` shows each one going through `getJson` or carrying a signal.
3. **The app still works when Supabase is down.** Lookup failure falls back to the saved result; the counter hides itself. No screen may block on a network call to render the kit.
4. **No polling.** Network calls happen on screen focus or a user action, never in `setInterval`. One lookup per location change, not per render.
5. **New public endpoints or tables state their abuse limit.** Anything the anon key can write gets a `// shortcut:` comment naming what happens if it's spammed (see `kit_plans` and the lookup cache).

## Capacity on free tiers (measured, not enforced)

| Resource | Free limit | One visit costs | Visits before we hit it |
|----------|-----------|-----------------|-------------------------|
| Vercel bandwidth | 100 GB/month | ~0.45 MB (375 kB JS + ~55 kB assets) | ~200,000/month |
| Supabase edge function calls | 500,000/month | 1 lookup per kit built | ~500,000 kits/month |
| Supabase DB | 500 MB | 1 `kit_plans` row (~40 bytes) + 1 cache row per new ~1 km cell | not a concern at hackathon scale |

Watch items:
- `prepared_count()` is `count(*)` over `kit_plans` on every home-screen focus. Fine to roughly a million rows; past that, keep a counter row instead.
- Cold cells: if many people in a new area open the app at the same second, each one calls the upstreams before the first result is cached. Fine for a demo; add request coalescing if a real launch targets one town.

## Measured, not yet enforced

| Metric | Today (2026-11-14) | Direction |
|--------|-------|-----------|
| Test count | 30 | must not fall |
| Gzipped JS | 375 kB | should not grow faster than features |
| Moderate/low audit findings | 22 moderate, 1 low (dev tooling) | must not grow |
| Load p95 (50 users, from a home connection) | lookup 1164 ms, counter 700 ms, 0 failures | must not exceed 1500 ms |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|

## Commands

- `npm run check:fast`: after every edit (~6 s)
- `npm run check:task`: before saying a task is done (~10 s)
- `npm run check:full`: before deploying to Vercel (~1 min, includes a web build)
- `npm run load`: before the demo and after backend changes
