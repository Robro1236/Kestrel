# QA report: kestrel-tan.vercel.app (2026-11-15)

- Target: https://kestrel-tan.vercel.app (production), fix verified on local `expo start --web`
- Mode: Full, Standard tier. Driver: Claude desktop built-in browser (Aside is macOS-only).
- Framework: Expo Router SPA (react-native-web 0.21.4)
- Prod writes (approved by user): ZIP lookup and "households prepared" counter, ~2 runs.
- Pages covered: / (landing), menu, /setup, /plan, /now, /hazards, /water, /help, /after, /history, /family, /county, unmatched route. Mobile 375x812 on /now.

## Health score: 93 → 95

| Category | Before | After |
|---|---|---|
| Console (1 error source: expected zippopotam 404 on invalid ZIP, fired twice) | 70 | 70 |
| Links | 100 | 100 |
| Visual | 100 | 100 |
| Functional | 100 | 100 |
| UX | 97 | 97 |
| Content | 100 | 100 |
| Accessibility | 92 | 100 |
| Performance | not scored | not scored |

## Issues

### ISSUE-001: State of toggles, chips and menu items is invisible to screen readers on web (Medium, Accessibility)
- Repro: /now, pick "Wildfire or smoke". The selected chip has no aria-selected/aria-pressed/aria-checked. Same for /plan kit checkboxes (no aria-checked), kit reminder switch, family person tabs, history expand dots, menu current page.
- Root cause: react-native-web 0.21 no longer maps `accessibilityState`; only `aria-*` props reach the DOM. 6 call sites used `accessibilityState`.
- Fix: replaced with `aria-checked` / `aria-selected` / `aria-expanded` / `aria-disabled` (supported natively by React Native too). Hazard chips are now role `radio` + `aria-checked` (single choice; aria-selected is ignored on buttons).
- Files: app/now.tsx, app/plan.tsx, app/family.tsx, app/history.tsx, src/components/KitReminders.tsx, src/components/Menu.tsx, src/now.test.tsx (queries `radio`, plus two new `checked: true` assertions).
- Fix status: **verified** in browser (DOM shows `aria-checked` on chips and plan checkboxes toggling true, menu `aria-selected/aria-disabled` on current page, no console errors). `npm run check:task`: 105/105 pass.
- Regression coverage: **debt**. Jest renders with the native renderer, where both prop forms become the same `accessibilityState`, so a unit test cannot catch this web-only bug. Suggested guard: a floor-guard rule rejecting new `accessibilityState` in app/ and src/ (needs a CONSTRAINTS.md decision).
- Commit: none (user commits).

### ISSUE-002: Unknown URL shows Expo's developer "Unmatched Route / Sitemap" screen (Low, UX) — fixed
- Repro: open /nope-404.
- Fix: `app/+not-found.tsx`, a branded "Page not found" card with a "Go to Kestrel" button. Verified locally: renders, no console errors, button goes home. Status: **verified**, not deployed.

### ISSUE-003: Invalid ZIP triggers the ZIP lookup twice (Low, Performance/Console) — deferred
- Repro: /setup, type 00000, Enter. Two identical requests to api.zippopotam.us, both 404. The user sees a correct "We couldn't find that place" message.

## Not confirmed
- One click on the first kit checkbox right after the setup → plan transition did not register; a retry worked and it did not reproduce on production. Not counted.

## Top things to fix
1. ISSUE-001 (fixed, needs deploy)
2. ISSUE-002 (optional polish)
3. ISSUE-003 (optional)

PR summary: QA found 3 issues, fixed 2, health score 93 → 95 (UX 97 → 100 after deploy).
