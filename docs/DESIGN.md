# Kestrel design principles

Read this before you change anything on screen. The tokens live in `src/theme.ts`, the shared pieces in `src/components/` (`Tap`, `Icon`, `ScreenFade`) and `src/motion.ts`. Reuse them; don't restyle per screen.

## The idea

Kestrel is used by people preparing for, or in the middle of, an emergency. It should feel like a **calm, trustworthy field guide** (think Stripe Press or a well-made printed handbook), not a generic app template. Every choice serves three things: **calm, clarity, trust.**

## 1. Look: a warm field guide

- **Type.** Headings use the serif (`fonts.display`, Instrument Serif) at a regular weight, never bold. Body text uses Plus Jakarta Sans and picks its weight by family (`fonts.body / semi / bold`), never `fontWeight` (each weight is its own font on phones).
- **Palette.** Warm paper background, near-black ink, one teal accent (`colors.primary`). The accent is only for actions, progress and active states.
- **Colour means something.** Red and amber appear only where there's a safety meaning: weather warnings, bad air, water violations. No decorative red.
- **Depth.** Soft layered shadows plus a 1px top highlight (`ui.card`). Avoid heavy borders and flat grey boxes.
- **Numbers that change** (counts, %, AQI) use `fontVariant: ['tabular-nums']` so they don't jitter.
- **No cool greys or default blues.** If a colour isn't in `theme.ts`, it doesn't belong.

## 2. Icons

- Every icon is an SVG from `Icon` (`src/components/Icon.tsx`): a 24px grid, round 2px strokes, centred by construction.
- **Never** use text glyphs as icons (`× › ✓ ▸ + −`). Fonts place them off-centre and differently on each platform.
- Need a new icon? Add one path to `PATHS` in the same style. Icons are decorative; the button around them carries the accessible label.

## 3. Motion: physical, quick, never in the way

- **Everything that can be pressed reacts.** Use `Tap` for buttons and links: it dips to 93% and springs back with a small overshoot. Small controls such as checkboxes animate just the control (see `Check` in `app/plan.tsx`).
- **One spring for the whole app** (`spring` in `src/motion.ts`). Use the plain spring for settling and `{ bouncy: true }` for releases and things popping out. Don't hand-tune durations per screen. The one exception is `glide`, a steady timed run for the plan's check sparks: they fan out, hang a beat, then curve faster into the progress bar like game XP (path keyframes in `SparkDot`).
- **Things come from where they belong.** The menu drops from the top centre, just under the status bar; the progress strip slides out from under the header.
- **Motion never costs loading time.** Content renders on the first frame and only eases in (`ScreenFade`). Never delay navigation or data to let an animation finish.
- **Respect reduced motion.** `spring` and `glide` jump straight to the end value when the device asks for it. Keep all motion going through it.
- **Cross-platform only.** Use React Native `Animated`, never web-only libraries (framer-motion and similar), so the app still builds for iOS and Android.

## 4. Layout and feedback

- **Errors sit next to what caused them**: under the button or field, not at the bottom of the screen. If the error comes from a button far away, scroll it into view.
- **Important state stays visible.** The kit progress pins under the header once its bar scrolls away.
- **Home is for the plan and for danger.** Routine detail (hazards, water, nearby help, county links) lives on its own screen in the menu. Home shows it only when something is wrong: active warnings, bad air, unsafe water, in the danger colours, above the kit.
- **Detail screens open with a page header**: a small "For [place]" eyebrow above the serif page title (`PageHeader`). Cards below it don't repeat the page's name.
- **One card per topic.** Each place type, shelter list or county task gets its own card with a `ui.cardTitle` heading, not one long card with subheadings. A group of cards that share a context (like one county) gets an eyebrow label above them.
- **What wasn't found sinks to the bottom.** Results come first. Empty results ("none within 10 km", no water system found, no hazards rated) move below them; several empty ones share one card. Reorder keyed cards so state survives the move. On Water, the "make water safe" steps sit last, above only what wasn't found.
- **Opening detail never moves what you tapped.** Expanding one row never collapses another.
- **Touch targets are at least 44×44.**
- **Be honest about data.** Show the source and the date, and say plainly when something couldn't load instead of hiding it.

## 5. Before you call a UI change done

1. Look at it in the browser at phone width, and check that the motion actually plays (a hidden browser pane pauses animations).
2. Check the stress cases: bad air, water violations, location denied, a non-US place.
3. Run `npm run check:task`, and keep the bundle under the budget in CONSTRAINTS.md.
