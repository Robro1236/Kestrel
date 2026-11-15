# Kestrel

**Try it: https://kestrel-tan.vercel.app** (no account, no install)

An emergency plan sized to your household and your area. Enter a ZIP code or city and who lives with you, and in under a minute Kestrel shows:

- a **supply checklist** with real quantities, plus items for your county's FEMA hazards
- **active weather warnings** (National Weather Service, US)
- **water safety**: gallons to store, how to purify, and whether tap water is safe where you are
- **nearby help**: hospitals, pharmacies, fire, police, food banks and open shelters, with directions
- an **air quality warning** that appears only when the air is unhealthy

Everything is saved on your device, so the plan still opens offline. Every fact shows its source and date. Kit, water and nearby help work worldwide; hazards and warnings are US-only.

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
