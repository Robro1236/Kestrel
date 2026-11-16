# Demo script (about 3 minutes)

Before judging: open the plan for `95391` once, so the slow nearby-places lookup is already cached (see SPEC.md, "Overpass is slow").

## The problem (20 s)

Most households aren't ready for an emergency. The FEMA and Red Cross apps give the same checklist to everyone: no quantities, nothing about where you live, nothing about water. Clean water is one of Rotary's focus areas, and it's the first thing people run out of.

## The flow (2 min)

Local hazards, Water, Nearby help and County alerts are in the menu (☰, top right). If there's time, the menu also has After a disaster and Disaster history (the county's 25 federal declarations).

1. Open https://kestrel-tan.vercel.app on a phone. No account, no install.
2. Type `95391` (Mountain House / Tracy, CA). Add 2 adults, 1 infant, 1 dog.
3. **Supply kit:** the water line says the exact gallons for this household, and infant and dog items appear only because we added them. Check off a few items and the progress bar moves.
4. **Something happening now?** (card near the top): tap Earthquake. Three things on one screen: what to do now (Ready.gov steps, with source), what to grab from *your* kit (and what isn't packed yet), and who to call: 911, then the nearest ER from the official hospital list. If the Weather Service has an active warning here, the right emergency is already picked.
5. **Local hazards:** the county's FEMA risk ratings add items (e.g. heat wave adds water). Each one shows "Source: FEMA National Risk Index" and a date.
6. **Warnings:** live National Weather Service alerts for this point, or "No active warnings".
7. **Water safety:** gallons to store, boil and bleach steps, and whether tap water is safe in this country.
8. **Your water system:** the EPA record for the system that serves this address, with any violations in the last 3 years.
9. **Nearby help:** the nearest hospitals and pharmacies, with distance and a Directions button, plus the county's emergency rooms with their main phone lines (official CMS hospital list).
10. **San Joaquin County:** sign up for county alerts and look up your evacuation zone.
11. **Family plan card** (link under the title): it says "Made for your household: 2 adults, 1 infant, 1 dog", so it only asks about who lives there.
    - Under Each person, name the first adult "Dad". Add a phone and "Insulin" under Medical needs. Tap Next: the second adult gets their own blank page, and the infant's page asks about Childcare, not work.
    - The Pets card has a photo slot for the dog, in case it gets lost.
    - Fill in a meeting place and an out-of-area contact, then Print: the shared plan, then one section per person, all on one card.
12. Back on the home screen, "N households prepared" counts every device that has built a kit (each device counts once).
13. Turn on airplane mode and reload. The plan and the checkmarks are still there, labelled with when they were saved.

## Show it isn't US-only (20 s)

Edit household, type `Nairobi`. The kit, water section and nearby places still work; hazards and warnings say they're US-only instead of failing.

## Why it lasts (20 s)

- Every fact names its source and date, so people can trust it and check it.
- Free public data (FEMA, NWS, OpenStreetMap, Open-Meteo), cached so it stays inside free tiers.
- One codebase: the web app judges see today, and the same app ships to iOS and Android when Rotary publishes it.
