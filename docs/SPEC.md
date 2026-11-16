# Kestrel: spec

Working name: **Kestrel**. Hackathon theme: "Create Lasting Impact". Deadline: end of day 3. This spec covers days 2 and 3.

## Context

Most households are not ready for an emergency. Generic tools (FEMA app, Red Cross apps, Ready.gov "Make a Plan") give one-size checklists with no quantities, no local hazards and no water-safety guidance. Kestrel takes a location and a few household answers and returns, in under a minute:

1. a **supply kit** sized to the household and the area's hazards,
2. **water safety guidance** for the area (Rotary names clean water as a focus area),
3. **active warnings** for the location,
4. **nearby help**: hospitals, emergency services, food banks, shelters, plus official links for cooling centers, water distribution and evacuation,
5. an **air quality warning** that appears only when air is unhealthy.

Every external fact shown carries its **source and a date** (fetched or last checked).

Coverage: **US-first.** Hazards and warnings are US-only. Kit, water baseline, air quality and nearby places work worldwide.

## Current State (verified 2026-11-13)

Greenfield. The repo holds only `README.md`, `CLAUDE.md`, `CLAUDE_SETUP.md`, `.mcp.json`, `.gitignore`, `.gitattributes`. No `package.json`, no app code, no Supabase project, no hosting.

Update 2026-11-14: T0 and T1 are done. The Expo SDK 58 scaffold, `src/data/jmp.json` and `docs/data-sources.md` exist. The spike's corrections are folded into this spec.

Update 2026-11-14 (later): T0–T8 are done, and stretches 1 (EPA water system), 2 (family plan card) and 5 (San Joaquin County) are merged. The live link needs a redeploy to show them.

## Definition of Done (the judge test)

A judge opens the public Vercel link on a phone or computer and, **in under 60 seconds with no account**:

1. allows location, or types `95391` / a US city,
2. enters household members and pets,
3. sees a supply list with **computed quantities** they can check off, with a progress bar,
4. sees a water safety section with gallons needed and purification steps,
5. sees active NWS warnings for that place (or "No active warnings"),
6. sees nearby hospitals and pharmacies with source and fetch date (food banks and police only where OpenStreetMap has them; 95391 has none within 10 km),
7. reloads the page, or goes offline and reloads, and still sees their plan and checkmarks.

## Proposed Change

### Architecture

```
Phone/browser (Expo app, web + native from one codebase)
  ├─ direct calls (CORS-friendly, no key):
  │    Open-Meteo air quality, Open-Meteo elevation, Open-Meteo geocoding,
  │    Zippopotam.us (US ZIP → lat/lon), NWS alerts
  ├─ Supabase Edge Function `lookup` (cached in Postgres):
  │    kind=area   → country, in_us, county, FEMA NRI hazard ratings
  │    kind=places → OpenStreetMap places (Overpass, Photon fallback), FEMA open shelters
  ├─ Supabase RPC: record_plan(), prepared_count()
  └─ AsyncStorage (localStorage on web): household, location, checkmarks, last results
```

Why the split: Open-Meteo and NWS are fast and allow browser calls. Overpass, Photon and FEMA have strict usage limits, so the Edge Function caches them per ~1 km grid cell. Coordinates are rounded to 2 decimals before caching, so no exact location is stored.

### Stack and dependencies

- Expo SDK (latest), TypeScript, **Expo Router**, web output `single`.
- `expo-location`, `@react-native-async-storage/async-storage`, `@supabase/supabase-js`.
- Tests: `jest-expo`.
- Hosting: **Vercel**, live at https://kestrel-tan.vercel.app. Build `npx expo export -p web`, output `dist`, rewrite all routes to `/index.html`.
- Env (`.env`, gitignored, also set in Vercel): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key is public by design. The service-role key lives only in Supabase function secrets.

### Screens

| Route | Content |
|---|---|
| `app/index.tsx` | Title, one-line pitch, **Start** button. If a saved plan exists: **View my plan**. "N households prepared" ("1 household prepared") from `prepared_count()`, refreshed on focus; hidden if it fails to load. |
| `app/setup.tsx` | One scrolling form. **Location:** "Use my location" button or a text box (US ZIP or city). **Household:** adults (18–64), seniors (65+), children (2–17), infants (<2), dogs, cats, "someone takes daily medication" (yes/no), "someone uses a mobility aid or powered medical device" (yes/no). **Build my kit** button. |
| `app/plan.tsx` | Sections in this order: Warnings banner (only if active) → Air quality banner (only if US AQI > 100) → Supply kit (checklist + progress) → Water safety → Local hazards → Nearby help. "Edit household" link. Each section shows its source and date in small text. |

### Location resolution (`src/data/location.ts`)

- GPS: `expo-location` `getCurrentPositionAsync`. On denial: show the text box, no error page.
- Text matching `^\d{5}$`: `https://api.zippopotam.us/us/{zip}` → lat/lon, country `US`.
- Other text: `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=1` → lat/lon, `country_code`.
- Not found: inline message "We couldn't find that place. Try a ZIP code or a city name."
- Country and county for GPS come from `lookup?kind=area`.

### Supply kit rules (`src/kit/rules.ts`, pure function)

`buildKit(household, hazards): KitItem[]`, where `KitItem = { id, label, qty?: string, reason: string, source: 'Ready.gov' | 'Red Cross' | 'CDC', tip?: true, details?: string }`. `tip` items are nice-to-have advice: the plan screen shows them under "Extra advice", with no checkbox and no amount, and they do not count toward progress. `details` is the longer text behind an item's info button.

Kit length is fixed at **3 days** (Ready.gov minimum). `people = adults + seniors + children + infants`. `wearers = people − infants`: masks and helmets are not made for children under 2.

| Trigger | Items (qty) |
|---|---|
| always | Water: `people × 3` gal (+ `dogs × 3 + cats × 1` gal for pets, rounded up) · Non-perishable food: `people × 3` days · Manual can opener · Flashlight + spare batteries · Battery or hand-crank radio (NOAA weather) · First aid kit · Whistle · Dust masks: `wearers` · Phone charger + power bank · Copies of IDs and insurance in a waterproof bag · Cash · Local paper map · Moist towelettes, garbage bags · Wrench or pliers to turn off utilities |
| infants > 0 | Formula and bottles (3 days) · Diapers: `infants × 24` · Wipes · Diaper rash cream (tip) |
| children > 0 | Comfort item or game (tip) · Child ID cards (tip) with a contact number |
| seniors > 0 or mobility = yes | Spare glasses or hearing-aid batteries · Mobility aid spare parts · Backup power for medical devices |
| medication = yes | 7-day supply of medications · List of medications and doses |
| dogs + cats > 0 | Pet food (3 days) · Leash or carrier · Pet medications and vet records · Recent pet photo (tip) |
| hazard earthquake ≥ Relatively Moderate | Sturdy shoes and gloves by each bed · Strap heavy furniture and water heater (tip) · Know your gas shutoff (tip) |
| hazard inland/coastal flood ≥ RM | Rubber boots · Know your evacuation route (tip) · Flood insurance check (tip). No separate document bag: the always-row one covers it |
| hazard heat wave ≥ RM | Extra water: `+people × 1` gal · Battery fan · Cooling towels (tip) · Plan to check on seniors (tip) |
| hazard wildfire ≥ RM | N95 masks: `wearers × 2` · Go-bag by the door (tip) · Air purifier or DIY box-fan filter (tip) |
| hazard hurricane ≥ RM | Plywood or shutters plan (tip) · Extra batteries · Fuel up the car (tip) |
| hazard tornado ≥ RM | Helmets: `wearers` · Know your safe room (tip) |
| hazard winter weather / cold wave / ice storm ≥ RM | Blankets: `people` · Hand warmers (tip) · Rock salt or sand (tip) |
| hazard drought ≥ RM | (no items; covered by the water section) |

"≥ RM" means FEMA NRI rating `Relatively Moderate`, `Relatively High` or `Very High`. Every other value (`Relatively Low`, `Very Low`, `No Rating`, `Not Applicable`, `Insufficient Data`) counts as below. The NRI has no riverine-flood rating; flood hazards are `inland_flood` (`IFLD_RISKR`) and `coastal_flood` (`CFLD_RISKR`). Field names for every hazard are in `docs/data-sources.md`.

Checkmarks are stored per item `id`. Progress = checked / checklist items (tips excluded). When the household changes, existing `id` checkmarks are kept and removed items drop out.

### Water safety (`src/water/guidance.ts`, pure function)

`waterGuidance({ gallons, countryCode, hazards, activeAlerts, elevationM }): WaterGuidance` (built in T5: it looks up `jmpPct` from `jmp.json` by `countryCode` itself; `elevationM` is `null` when the Open-Meteo elevation call fails, and the boil step then says "1 minute (3 minutes above 6,500 feet)". The elevation fetch is `src/water/elevation.ts`, called once per location by `WaterSafety`.)

- **Gallons needed:** taken from the kit.
- **Baseline label:** if `jmpPct < 90`: "Tap water here may not be safe. Boil or filter before drinking." Source: WHO/UNICEF JMP, with the data year. If the country is missing from the table (66 countries are, including Australia, China and Kenya): "We don't have tap water data for this country. If you're unsure, boil or filter before drinking." `jmpPct` comes from the static `src/data/jmp.json`, shaped `{ countries: { "US": { "pct": 97.6, "year": 2024 } } }` (% population using safely managed drinking water), generated in Task 0.
- **Disaster warning:** if flood, hurricane or earthquake is ≥ RM: "After a flood, hurricane or earthquake, your tap water may not be safe. Follow your health department's advice on boiling or treating it." (T5 changed the wording to match CDC, which says tap water "may not be" safe and to follow the health department; it does not say "until officials say it's clear".)
- **Also shown (T5, from the same CDC page):** if cloudy, let it settle and filter through a clean cloth, paper towel or coffee filter first; "Boiling is the best way to kill germs"; let boiled water cool and store it in clean, covered containers; boiling and bleach do not remove fuel or chemicals, so use bottled water if those may be present.
- **Active alert:** if an NWS alert's `event` contains `Flood` or `Hurricane`, the disaster warning moves to the top of the section, highlighted.
- **Boil:** rolling boil 1 minute; **3 minutes if `elevationM > 1981`** (6,500 ft). Source: CDC.
- **Bleach:** for clear water, 8 drops (a little less than 1/8 teaspoon) of unscented household bleach (5% to 9% sodium hypochlorite) per gallon; stir and wait at least 30 minutes. "If the water is cloudy, colored or very cold, use double." "Follow the bleach label's own instructions if it has them." Show the per-gallon amount and the total for the kit's gallons: compute in drops (8 per gallon) and convert to teaspoons at CDC's 5-gallon figure (40 drops = 1/2 tsp), so 12 gallons = 96 drops ≈ 1 1/4 tsp. Source: CDC, "How to Make Water Safe in an Emergency" (page dated Sept. 19, 2024, confirmed 2026-11-14).

### Air quality (`src/data/airQuality.ts` + `src/components/AirBanner.tsx`)

- `https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi,pm2_5`
- `showAirBanner(aqi) = aqi > 100`. Hidden at 100 or below.
- Tiers: 101–150 "Unhealthy for sensitive groups", 151–200 "Unhealthy", 201–300 "Very unhealthy", 301+ "Hazardous". Each tier has one tip line (e.g. "Keep windows closed; wear an N95 outside").
- If the call fails: no banner. Never show "air is fine" without data.

### Warnings (`src/data/nws.ts`)

- `https://api.weather.gov/alerts/active?point={lat},{lon}` (lat/lon at 4 decimals).
- Show `event`, `headline`, `severity` and `ends` (or `expires`), plus a link to the alert.
- No alerts: "No active warnings from the National Weather Service." Not in the US: "Live warnings are only available in the US for now."
- Failure: "Couldn't check warnings right now." and the last saved result with its date.
- As built (T5): `Warnings` shows a red banner only when an alert is active; otherwise the no-alerts, not-US or failure text is one plain line. Alerts whose `ends` (or `expires`) has passed are dropped, both when fetched and when a saved copy is shown (`activeOnly`, used by `Warnings` and `WaterSafety`). The NWS call is skipped when the saved location's country is known and not the US. The link goes to `https://forecast.weather.gov/MapClick.php?lat=..&lon=..` (the human page for the point, which lists the same alerts), because `@id` is raw JSON. The saved copy (`results.warnings`) carries its lat/lon and is only shown for the same point. `app/plan.tsx` fetches once per screen load and passes the result to both `Warnings` and `WaterSafety`.

### Local hazards (from `lookup?kind=area`)

List hazards rated ≥ RM with their FEMA NRI rating, plus the text "Source: FEMA National Risk Index (county level)". Outside the US: "Hazard data is only available in the US for now." As built (T5): sorted worst first; with none ≥ RM it says "No hazards rated Relatively Moderate or higher for {county}." Each hazard row is a 44px button that opens three "what to do" steps from that hazard's Ready.gov page (`src/kit/hazardAdvice.ts`), a "Read more on Ready.gov" link and the page's source line; one open at a time.

### Nearby help (from `lookup?kind=places`, plus static links)

- **From OpenStreetMap via Overpass**, 10 km radius, the 3 nearest of each: hospital (`amenity=hospital`), fire station, police, pharmacy, food bank (`social_facility=food_bank`). Show name, distance, and a "Directions" link (`https://www.google.com/maps/dir/?api=1&destination={lat},{lon}`). Footer: "Data © OpenStreetMap contributors, fetched {date}." A category with no results shows "None found within 10 km." A place with no `name` tag shows its category name (e.g. "Pharmacy").
- **Overpass is slow (25–34 s uncached).** This section loads on its own with a "Finding nearby help…" state; the rest of the plan never waits for it. Warm the cache for the demo ZIP before judging.
- **If every Overpass server fails within 35 s, Photon fills in.** Photon is a name search, so it can miss places (e.g. a "Walgreens" pharmacy). The section says so, and that answer is cached for 1 day instead of 7.
- **Shelters:** FEMA open-shelter data (endpoint in `docs/data-sources.md`), labelled "Open during active disasters only." Rows with no latitude/longitude are skipped. Always also show a link to the Red Cross "Find an open shelter" page.
- **Official links (US), each with a "link checked {date}" constant:**
  - Cooling centers and water distribution: "Call or text **2-1-1**" (United Way 211) and "Check {county name} emergency services."
  - Evacuation: Ready.gov evacuation page and "Check {county name} emergency services."
- Outside the US: only the OpenStreetMap results plus "Check your local emergency services."

### Supabase

`supabase/migrations/0001_init.sql`:

```sql
create table public.kit_plans (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
alter table public.kit_plans enable row level security;
create policy "anon can insert" on public.kit_plans for insert to anon with check (true);
-- shortcut: anyone can inflate the counter by spamming inserts; add rate limiting if it gets abused.

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
```

The app calls `record_plan()` the **first** time a device builds a kit (an AsyncStorage flag prevents repeats). It adds 1 to the single `plan_counter` row (migration 0002) and sends nothing about the household. The plan screen calls `recordPlanOnce(recordPlan)` (`src/storage.ts`, `src/supabase.ts`) without waiting on it, once the saved household and location load. A failed call clears the flag, so the next visit retries. `kit_plans` from 0001 is kept as a record of earlier plans but takes no new rows.

`supabase/functions/lookup/index.ts`: `GET /lookup?kind=area|places&lat=..&lon=..`

- Round lat/lon to 2 decimals. Look up `lookup_cache`. Fresh if `area` is under 30 days old and `places` under 7 days. Otherwise fetch upstream, upsert, return.
- If upstream fails and a stale cache row exists, return it with `"stale": true`. Otherwise return HTTP 502 with `{ "error": "upstream_unavailable" }`.
- Reject lat outside [-90, 90] or lon outside [-180, 180] with HTTP 400.
- Response `area`: `{ "country_code": "US", "in_us": true, "county": "San Joaquin County", "state": "CA", "county_fips": "06077", "hazards": [{ "type": "inland_flood", "rating": "Relatively High" }], "fetched_at": "...", "stale": false }`
- Response `places`: `{ "places": [{ "category": "hospital", "name": "...", "lat": 0, "lon": 0, "distance_km": 3.2 }], "shelters": [], "fetched_at": "...", "stale": false }`
- Upstreams (all confirmed in Task 0, see `docs/data-sources.md`): FCC Area API for county FIPS; FEMA NRI ArcGIS feature service (it returns HTTP 200 with an `error` body on a bad query, so check the body); Photon reverse (`photon.komoot.io`, OpenStreetMap data) for country outside the US, replacing Nominatim, which failed every call from the deployed function (T3); Overpass `https://overpass-api.de/api/interpreter`, then the `maps.mail.ru` mirror, sharing a 35 s budget (overpass-api.de returned HTTP 406 to Supabase in Nov 2026); Photon search as the places fallback; FEMA open shelters.

### Offline and persistence (`src/storage.ts`)

AsyncStorage keys: `household`, `location`, `checked`, `results` (the last successful result of each source, with its date), `planRecorded`. The plan screen renders from `results` first, then refreshes in the background. Every storage call is wrapped in try/catch; if storage fails, the app still works for that session.

## Work Plan and Split

```
T0 Data spike ──> T1 Scaffold ──┬─> T2 Kit rules + setup screen ──> T4 Plan screen ──> T8 Integrate + QA + submit
                                ├─> T3 Supabase + lookup(area) ──> T5 Hazards + warnings + water ─┘ 
T6 Vercel deploy + README (after T1)
T7 lookup(places) + Nearby help + Air banner (after T3 skeleton)
```

Order rationale: T0 first because every data section depends on which endpoints actually work. T1 before everything else so the project is set up once. Tasks within the same step can run in parallel. T8 is last because it needs every piece.

| Step | # | Task | Effort (human / Claude Code) | Files |
|---|---|---|---|---|
| 1 | T0 | Data spike: curl each endpoint, record shape, CORS, limits; build `jmp.json`; confirm CDC water numbers | 2h / 45m | `docs/data-sources.md`, `src/data/jmp.json` |
| 1 | T1 | Expo + Router + TS scaffold, jest-expo, folder layout, `.env.example` | 1.5h / 20m | root config, `app/_layout.tsx` |
| 2 | T2 | `buildKit` + tests; setup screen; location resolution | 4h / 1h | `src/kit/*`, `app/setup.tsx`, `src/data/location.ts` |
| 2 | T3 | Supabase project, migration, `lookup` skeleton + `kind=area` | 3h / 1h | `supabase/migrations/*`, `supabase/functions/lookup/index.ts`, `.../area.ts` |
| 2 | T6 | Vercel project, `vercel.json`, env vars, README "How to run" for judges | 1.5h / 30m | `vercel.json`, `README.md` |
| 3 | T4 | Plan screen shell: sections, checklist, progress, storage (counter deferred to T8) | 3h / 1h | `app/plan.tsx`, `app/index.tsx`, `src/storage.ts`; also touched `src/kit/rules.ts` + test (tips, info text, infant counts), `app/setup.tsx` (replace, not push), `src/supabase.ts` (lookup client) |
| 3 | T5 | NWS warnings, hazards section, `waterGuidance` + tests | 3h / 1h | `src/data/nws.ts`, `src/water/*`, `src/components/Hazards.tsx`, `Warnings.tsx`, `WaterSafety.tsx`; also placed them in `app/plan.tsx` (asked for by the task owner) |
| 3 | T7 | `lookup?kind=places` (Overpass + shelters), Nearby help section, air quality banner + tests | 4h / 1.5h | `supabase/functions/lookup/places.ts`, `src/data/airQuality.ts`, `src/components/NearbyHelp.tsx`, `AirBanner.tsx` |
| 4 | T8 | Integrate, turn on the "Households prepared" counter (home `prepared_count()` + `recordPlanOnce` on the plan screen), `/qa` on the Vercel link, test on real phones, fix, submit | 3h / 1h | any |

Total: ~25h human / ~8h with Claude Code. If T7 slips, the plan screen hides Nearby help and the air banner, so nothing else waits on it.

## Stretch (in order, only after T8 passes)

1. **EPA local water-system data** (US): violations for the user's water system, with the data date.
2. **Family plan card:** meeting place, contacts, out-of-area contact, printable.
3. **Native push:** seasonal kit reminders (heat season, fire season).
4. **Android APK** via EAS Build.
5. **Mountain House specifics:** cooling centers, evacuation zones, county alert sign-up.

## Acceptance Criteria

1. The Vercel URL loads on a mobile browser and on desktop Chrome with no console errors.
2. From a fresh browser, `95391` plus 2 adults, 1 infant and 1 dog shows a plan in ≤ 60 s. With no hazards, `buildKit` gives "Water: 12 gallons" for that household (3 people × 3 days + 3 for the dog); a heat-wave rating adds 3 more.
3. `buildKit` returns the infant, pet and medication items exactly when those inputs are > 0 / yes, and no others.
4. With US AQI 100 the air banner is hidden; with 101 it shows "Unhealthy for sensitive groups".
5. With `elevationM = 2000` the boil step says 3 minutes; with `1981` it says 1 minute.
6. With a country whose `jmpPct` is < 90 the "may not be safe" label shows; with a country missing from the table the "we don't have tap water data" label shows; with `US` neither shows.
7. A non-US city (e.g. "Nairobi") shows the kit, water section and nearby places, and the hazard and warning sections show their "only in the US" text instead of an error.
8. With network disabled after one successful load, reloading shows the saved plan and checkmarks, each source labelled with its saved date.
9. Denying location shows the text box and no error screen.
10. The `lookup` function returns HTTP 400 for `lat=200`, and returns a cached row (`stale: true`) when its upstream is unreachable.
11. `lookup_cache` stores keys with at most 2 decimal places; no table stores exact coordinates.
12. (T8) The home counter increases by exactly 1 the first time a device builds a kit, and not again on later builds.
13. Every place, hazard, warning and water fact on screen shows a source name and a date.
14. Each test in the Testing Plan states its card: `protects=<observable it protects>; fails_when=<wrong result it rejects>; no_claim=<what green does not prove>`.
15. No secrets are committed: `git grep -n "service_role"` finds nothing outside docs.

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | `buildKit`: base quantities, infants, kids, seniors/mobility, meds, pets, each hazard trigger, rating threshold | +8 |
| Unit | `waterGuidance`: JMP threshold, missing country, disaster trigger, active alert, boil altitude boundary, bleach totals | +6 |
| Unit | `showAirBanner` boundary and tiers; ZIP vs city detection in `location.ts` | +3 |
| Integration | `lookup` function: 400 on bad coords, cache hit, stale fallback (jest with a fake cache, since `supabase functions serve` needs Docker; `npm run smoke` checks the deployed function) | +3 |
| Load | 50 concurrent users for 20 s on a cached cell: p95 ≤ 1500 ms, 0 failures (`npm run load`, see `CONSTRAINTS.md`) | script |
| E2E (manual, `/qa`) | Judge flow on the Vercel URL: ZIP path, GPS path, non-US city, offline reload | +4 |

## Rules for the implementing agent

Read `CONSTRAINTS.md` first, and run `npm run check:task` before calling a task done.

1. Acceptance criteria are the `protects / fails_when / no_claim` profile of each test: the observable it protects, the wrong result it rejects, and what green does not prove. Never "make the tests pass".
2. Real code and real tests land in the same change; a placeholder, a stub assertion or a test deferred to a follow-up is not done.
3. Any change to a test, validator, CI step, timeout, tolerance, threshold, snapshot or suppression pragma is reported on its own line in your summary with its justification, before any other result.
4. A reported command names the command and its observed result (exit status, counts, the failing line); a command you did not run is not reported, and stderr is never silenced in a command you cite.
5. Your report is a claim until the parent re-executes it: say what you verified, what you reused, and what you could not check.
6. Only edit the files listed for your task in the Work Plan table. Components from T5 and T7 are exported for T4's `app/plan.tsx` to place; they don't edit `app/plan.tsx` themselves.

## Rollback Plan

- App: Vercel keeps every deployment; promote the previous one in the dashboard.
- Database: the migration only adds tables; roll back with `drop table public.kit_plans, public.lookup_cache; drop function public.prepared_count;`.
- A failing data source: its section shows its "couldn't check" state; no other section depends on it.

## Out of Scope

- Accounts and login
- AI features
- Multiple languages
- Mountain House-specific data (stretch 5)
- Non-US hazards and warnings (ThinkHazard, GDACS)
- Kits longer than 3 days
- App Store / Play Store submission (Rotary handles it later)
