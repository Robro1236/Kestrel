# Kestrel

**Try it: https://kestrel-tan.vercel.app** (no account, no install)

Code: https://github.com/Robro1236/Kestrel

An emergency plan sized to your household and your area. Enter a ZIP code or city and who lives with you, and in under a minute Kestrel shows:

- a **supply checklist** with real quantities, plus items for your county's FEMA hazards
- **active weather warnings** (National Weather Service, US)
- **water safety**: gallons to store, how to purify, and whether tap water is safe where you are
- **nearby help**: hospitals, pharmacies, fire, police, food banks and open shelters, with directions
- an **air quality warning** that appears only when the air is unhealthy
- **your water system** (US): EPA drinking-water violations for the system that serves you
- a **family plan card**: meeting places and contacts, printable or shareable
- **San Joaquin County** links: alert sign-up, evacuation zones, cooling centers
- a **"households prepared"** count on the home screen

Everything is saved on your device, so the plan still opens offline. Every fact shows its source and date. Kit, water and nearby help work worldwide; hazards and warnings are US-only.

## Why Kestrel

**The problem.** In FEMA's 2023 National Household Survey (over 7,600 adults), only 51% said they were prepared for a disaster. The usual apps hand everyone the same checklist: no quantities, nothing about where you live, nothing about water, which is one of Rotary's focus areas and the first thing people run out of.

**What's different.** Kestrel builds the plan from two answers, where you live and who lives with you:

- The kit has real amounts (gallons of water for *this* household), and infant, senior and pet items appear only when they apply.
- Your county's FEMA risks add items and lead with the top risk. When something is happening, one screen shows what to do, what to grab from your own kit, and the nearest emergency room.
- The family plan card gives each person their own page (phone, medical needs, doctors, insurance, school or work) and prints as one card.
- "Share with a neighbor" passes it on, and the home screen counts households prepared.

**Trust.** Kestrel writes no safety advice of its own. Every fact names its public source and date: FEMA National Risk Index, National Weather Service, EPA drinking-water records, CMS hospital list, Ready.gov, OpenStreetMap and Open-Meteo.

**How it's built.**

- One Expo (React Native + TypeScript) codebase: the web app judges open today, and the same code builds for iOS and Android when Rotary publishes it.
- A Supabase edge function caches public data so it stays inside free tiers.
- A service worker keeps the app working offline.
- 100 automated tests, a bundle-size budget, and load and smoke checks (see [CONSTRAINTS.md](CONSTRAINTS.md)).

**What's next.** Store release through Rotary, county links beyond San Joaquin, and more hazard data outside the US.

Demo walkthrough: [docs/DEMO.md](docs/DEMO.md).

Built for the Rotary Club HackAIthon ("Create Lasting Impact"). Expo (React Native + TypeScript) on the web, with a Supabase backend.

## Run it locally

```bash
npm install
cp .env.example .env   # fill in the Supabase URL and anon key
npm run web
```

## Checks

The quality bar is in [CONSTRAINTS.md](CONSTRAINTS.md).

- `npm run check:task`: typecheck, floor guard, tests
- `npm run check:full`: the above, plus dependency audit, web build and bundle-size budget
- `npm run smoke`: live checks against the deployed Supabase project
- `npm run load`: 50 concurrent users against the deployed project

## Docs

- [docs/SPEC.md](docs/SPEC.md): what we're building and the task plan
- [docs/data-sources.md](docs/data-sources.md): every public data source, tested
