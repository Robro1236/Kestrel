# Data sources (T0 spike)

Probed 2026-11-14 with `curl` from a home connection, test point `37.78,-121.54` (ZIP 95391, San Joaquin County, CA). "CORS" means the response carried `Access-Control-Allow-Origin: *` when sent an `Origin` header. None of these need a key.

The findings below were folded into `docs/SPEC.md` on 2026-11-14. Where the two disagree, the spec wins.

## Summary

| Source | Used for | Status | CORS | Time | Spec changed |
|---|---|---|---|---|---|
| Zippopotam.us | ZIP → lat/lon | works | yes | 0.7 s | none |
| Open-Meteo geocoding | city → lat/lon, country | works | yes | 1.0 s | none |
| Open-Meteo air quality | US AQI | works | yes | 0.8 s | none |
| Open-Meteo elevation | boil time | works | yes | 0.4 s | none |
| NWS alerts | warnings | works | yes | 0.4 s | none |
| FCC Area API | county FIPS | works | yes | 1.0 s | none |
| FEMA NRI (ArcGIS) | hazard ratings | works | yes | 0.2 s | **yes: no riverine-flood field** |
| Nominatim reverse | country outside US | works from a laptop, **fails from Supabase** | yes | 0.7 s | **yes: replaced by Photon in T3** |
| Overpass | nearby places | works, **slow** | yes | 25–34 s | **yes: timeout and caching matter** |
| FEMA open shelters | shelters | works | yes | 1.2 s | **yes: some rows have no coordinates** |
| World Bank API (JMP data) | `jmp.json` | works | n/a (build time) | – | **yes: 66 countries missing** |
| CDC water page | boil and bleach numbers | confirmed | n/a | – | **yes: bleach wording** |

## What the spike changed in the spec

1. **FEMA NRI has no riverine flood field.** The current release (`NRI_VER` = "December 2025") has `IFLD_RISKR` (inland flooding) and `CFLD_RISKR` (coastal flooding). There is no `RFLD_*`. The spec now uses `inland_flood` instead of `riverine_flood`.
2. **NRI ratings have more values than the spec lists.** Seen: `Very High`, `Relatively High`, `Relatively Moderate`, `Relatively Low`, `Very Low`, `No Rating`, `Not Applicable`, `Insufficient Data`. Only the first three count as "≥ RM"; the spec now says everything else counts as below.
3. **Overpass is slow.** The 10 km five-category query took 25 s, 34 s and 29 s on `overpass-api.de`. The `overpass.kumi.systems` mirror timed out at 60 s, and `overpass-api.de/api/status` timed out at 20 s. The spec now gives the `lookup` function a 45 s fetch timeout and has Nearby help load on its own, so the rest of the plan never waits for it. The 7-day cache makes repeat lookups fast; warm the cache for the demo ZIP before judging.
4. **Few places near the test point, and no food banks or police.** 8 results in 10 km: 3 fire stations, 3 pharmacies, 2 hospitals, 0 police, 0 food banks. One result has no `name`. Decided: an empty category shows "None found within 10 km." and the radius is not widened. A place with no name shows its category name. DoD item 6 now promises hospitals and pharmacies.
5. **FEMA open shelters: 2 of 3 open rows had null `latitude`/`longitude`.** Rows without coordinates can't be distance-sorted; the spec now skips them. Only 3 shelters were open nationwide at probe time, so this list is usually empty.
6. **JMP table is missing 66 countries**, including Australia, China and Kenya (no "safely managed" estimate published). Decided: a missing country shows "We don't have tap water data for this country. If you're unsure, boil or filter before drinking." instead of "may not be safe". Acceptance criterion 6 was updated to match.
7. **CDC bleach wording differed from the spec.** The spec now follows CDC. See "CDC water numbers" below.
8. **NWS `limit` parameter is rejected** (HTTP 400) on `/alerts/active`. Not needed for `?point=`.

## Endpoints

### Zippopotam.us
`GET https://api.zippopotam.us/us/95391`

```json
{"country abbreviation": "US", "post code": "95391",
 "places": [{"place name": "Tracy", "longitude": "-121.5397", "latitude": "37.7695", "state abbreviation": "CA"}]}
```
Keys contain spaces; lat/lon are **strings**. Not-found behaviour was not probed (expected: HTTP 404 with `{}`).

### Open-Meteo geocoding
`GET https://geocoding-api.open-meteo.com/v1/search?name=Nairobi&count=1`

```json
{"results": [{"name": "Nairobi", "latitude": -1.28333, "longitude": 36.81667, "country_code": "KE", "country": "Kenya", "admin1": "Nairobi County"}]}
```
Not-found behaviour was not probed (expected: no `results` key).

### Open-Meteo air quality
`GET https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.78&longitude=-121.54&current=us_aqi,pm2_5`

```json
{"current": {"time": "2026-11-14T07:00", "us_aqi": 28, "pm2_5": 6.1}}
```
`time` is GMT with no zone suffix.

### Open-Meteo elevation
`GET https://api.open-meteo.com/v1/elevation?latitude=37.78&longitude=-121.54` → `{"elevation": [18.0]}` (metres, an array).
Rate limit headers: 600 requests per 60 s.

### NWS alerts
`GET https://api.weather.gov/alerts/active?point=37.7800,-121.5400`

GeoJSON `FeatureCollection`; `features` is `[]` when there are no alerts. Per alert, under `features[i].properties`:

```json
{"event": "Freeze Warning",
 "headline": "Freeze Warning issued November 14 at 2:44AM EST until November 14 at 9:00AM EST by NWS Peachtree City GA",
 "severity": "Severe", "ends": "2026-11-14T09:00:00-05:00", "expires": "2026-11-14T15:00:00-05:00",
 "@id": "https://api.weather.gov/alerts/urn:oid:..."}
```
`@id` is the API URL (JSON), not a human page. NWS asks for a `User-Agent`; browsers send their own, which is accepted. Behaviour for a non-US point was not probed.

### FCC Area API
`GET https://geo.fcc.gov/api/census/area?lat=37.78&lon=-121.54&format=json`

```json
{"results": [{"county_fips": "06077", "county_name": "San Joaquin County", "state_code": "CA", "state_name": "California"}]}
```
Behaviour for a non-US point was not probed (expected: empty `results`, which gives `in_us: false`).

### FEMA National Risk Index
`GET https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query?where=STCOFIPS='06077'&outFields=COUNTY,STATEABBRV,STCOFIPS,NRI_VER,ERQK_RISKR,IFLD_RISKR,CFLD_RISKR,HWAV_RISKR,WFIR_RISKR,HRCN_RISKR,TRND_RISKR,WNTW_RISKR,CWAV_RISKR,ISTM_RISKR,DRGT_RISKR&returnGeometry=false&f=json`

Result under `features[0].attributes`:

```json
{"COUNTY": "San Joaquin", "STATEABBRV": "CA", "STCOFIPS": "06077", "NRI_VER": "December 2025",
 "ERQK_RISKR": "Relatively High", "IFLD_RISKR": "Relatively High", "CFLD_RISKR": "Not Applicable",
 "HWAV_RISKR": "Relatively High", "WFIR_RISKR": "Relatively Moderate", "HRCN_RISKR": "Not Applicable",
 "TRND_RISKR": "Relatively Low", "WNTW_RISKR": "Relatively Low", "CWAV_RISKR": "No Rating",
 "ISTM_RISKR": "Not Applicable", "DRGT_RISKR": "Very High"}
```

| Spec hazard | Field |
|---|---|
| earthquake | `ERQK_RISKR` |
| riverine flood → **inland flood** | `IFLD_RISKR` |
| coastal flood | `CFLD_RISKR` |
| heat wave | `HWAV_RISKR` |
| wildfire | `WFIR_RISKR` |
| hurricane | `HRCN_RISKR` |
| tornado | `TRND_RISKR` |
| winter weather | `WNTW_RISKR` |
| cold wave | `CWAV_RISKR` |
| ice storm | `ISTM_RISKR` |
| drought | `DRGT_RISKR` |

An unknown field name in `outFields` fails the whole query with HTTP 200 and `{"error": {"code": 400}}`, so check for `error` in the body. A queryable service exists, so no bundled county JSON is needed. `COUNTY` has no " County" suffix; take the display name from FCC.

### Nominatim reverse
`GET https://nominatim.openstreetmap.org/reverse?lat=-1.29&lon=36.82&format=jsonv2&zoom=8` → `address.country_code` is lower case (`"ke"`).

**Not used.** On 2026-11-14 the deployed `lookup` function got an error from Nominatim on every call (502 in under 3 s for Nairobi and Paris), while the same request worked from a laptop. The exact status code was not captured.

### Photon reverse (replaces Nominatim)
`GET https://photon.komoot.io/reverse?lat=-1.29&lon=36.82&limit=1&radius=100` → `features[0].properties.countrycode` (`"KE"`, upper case). `features` is `[]` when nothing is within the radius (open ocean), which gives `country_code: null`. No key. Confirmed from the deployed function on 2026-11-14 (Nairobi → `KE`, Paris → `FR`).
Usage policy: max 1 request per second and an identifying `User-Agent`. Call it only from the Edge Function, cached.

### Overpass
`POST https://overpass-api.de/api/interpreter` with form field `data`:

```
[out:json][timeout:25];
(nwr["amenity"~"^(hospital|fire_station|police|pharmacy)$"](around:10000,37.78,-121.54);
 nwr["social_facility"="food_bank"](around:10000,37.78,-121.54););
out center tags;
```

Elements are `node` (with `lat`/`lon`) or `way`/`relation` (with `center.lat`/`center.lon`). Category comes from `tags.amenity`, or `tags.social_facility` for food banks. `tags.name` can be missing. Distance is not returned; compute it in the function.

### FEMA open shelters
`GET https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query?geometry=-121.54,37.78&geometryType=esriGeometryPoint&inSR=4326&distance=10&units=esriSRUnit_Kilometer&spatialRel=esriSpatialRelIntersects&outFields=shelter_name,address,city,state,shelter_status,latitude,longitude,org_name&returnGeometry=false&f=json`

The radius query returned HTTP 200 with `features: []` for the test point. Whether it finds a shelter that is in range was not tested (none was open nearby). Fields are lower case: `shelter_name`, `address`, `city`, `state`, `zip`, `shelter_status` (`"OPEN"`), `latitude`, `longitude`, `org_name`, `pet_accommodations_code`, `wheelchair_accessible`.

## `src/data/jmp.json`

Built from the World Bank API, indicator `SH.H2O.SMDW.ZS` ("People using safely managed drinking water services, % of population", source WHO/UNICEF JMP), most recent non-empty value per country, aggregates removed:

- `https://api.worldbank.org/v2/country/all/indicator/SH.H2O.SMDW.ZS?format=json&mrnev=1&per_page=400`
- `https://api.worldbank.org/v2/country?format=json&per_page=400` (to drop rows whose region is "Aggregates")

Shape: `{ source, retrieved, countries: { "US": { "pct": 97.6, "year": 2024 } } }`. 151 of 217 countries; data years 2017–2024 (most are 2024); 89 are below 90%. The World Bank API returned 502 when the request carried an `Origin` header, so it is build-time only.

## CDC water numbers

Page: "How to Make Water Safe in an Emergency", https://www.cdc.gov/water-emergency/about/index.html, page dated Sept. 19, 2024, read 2026-11-14.

- **Boil: confirmed.** Rolling boil for 1 minute; 3 minutes at elevations above 6,500 feet.
- **Bleach: three corrections, now in the spec.**
  - CDC gives the amounts for bleach of **5% to 9%** sodium hypochlorite, not "6%".
  - Per gallon: **8 drops**, or ½ mL, or "a little less than ⅛ teaspoon". The old spec text "8 drops = 1/8 tsp" overstated it slightly. 5 gallons: 40 drops, 2½ mL or ½ teaspoon.
  - If the water is cloudy, murky, colored or very cold, **double** the amount.
  - Confirmed: unscented bleach, stir, wait at least 30 minutes.
- CDC says to follow the bleach label's own instructions first, and that boiling is the better method (bleach is weaker against *Cryptosporidium* and *Giardia*).
- For the kit total, compute in drops (8 per gallon) and convert at CDC's 5-gallon figure (40 drops = ½ tsp), so 12 gallons = 96 drops ≈ 1¼ tsp.
