# App Sidequest

A 3-day HackAIthon project for a Rotary Club hackathon. The theme is likely sustainable community apps (education, clean water, local aid, environment). Two of us work on it, each with our own Claude Code. This file is the shared context, so put anything both Claudes should know here, not in personal memory.

## Stack
- **Expo (React Native + TypeScript) + Supabase.**
- The app **must run on web**: an Expo web export hosted at a public URL, so judges can click a link without installing anything.
- Avoid native-only libraries that have no web fallback.
- Rotary handles App Store / Play Store publishing later, so keep the codebase buildable for iOS and Android. We don't need an Apple Developer account.

## Submission requirements
- GitHub repo link
- A **publicly accessible app link** (the web build): https://kestrel-tan.vercel.app

## Quality bar
Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass. Run `npm run check:task` before calling a task done.
Read docs/DESIGN.md before changing anything on screen, and keep to it.

## Working style
- Usage matters: keep token use low. Prefer the core gstack skills (`/office-hours` or `/spec`, `/autoplan`, `/review`, `/qa`, `/verify`, `/ship`) and don't turn heavy skills back on without asking.
- `graphify-out/` is gitignored. Each of us builds our own graph with `/graphify`.
- Never commit secrets. Supabase keys go in `.env` (gitignored), and MCP config uses `${ENV_VAR}` placeholders.
