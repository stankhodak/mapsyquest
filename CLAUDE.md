# MapsyQuest

Geography quiz game: Vite + React 19 + TypeScript + MapLibre, Tailwind 4. Serverless endpoints in `api/` (Vercel), Supabase for leaderboards, PostHog/Vercel Analytics for telemetry. Game logic lives in `src/lib`, UI in `src/components`, static data in `src/data`.

## Commands

- `npm test` — Vitest, single run (`npm run test:watch` while iterating)
- `npm run lint` — Oxlint
- `npm run build` — `tsc -b` + Vite build; this is the typecheck
- `npm run dev` — dev server

## Working style

Keep the process proportional to the change.

**Small changes** (copy, styling, a tweak to one component): just make the change. No plan, no ceremony.

**Feature-sized changes** (new game mode, new achievement type, leaderboard or scoring rule changes, anything touching several files): before writing code, state the approach in a few sentences and call out anything ambiguous. Ask only if the answer changes what you build. Then implement in small steps.

## Tests

- Logic in `src/lib` (scoring, points, achievements, challenges, daily, leaderboard rules) gets a test in `src/lib/__tests__/` when you add or change behavior. Prefer writing the test first for bug fixes so it fails for the right reason.
- Don't write tests for UI layout, styling, or MapLibre rendering. Verify those in the browser preview instead.
- Don't mock Supabase or PostHog just to test glue code; test the pure logic underneath.

## Before calling something done

- Run `npm test`, `npm run lint`, and `npm run build`, and report any failure honestly rather than working around it.
- For UI changes, check the result in the browser preview (including a phone-width viewport if layout changed) and look at the console for errors.
- If you couldn't verify something, say so instead of claiming it works.

## Debugging

Find the cause before changing code. Reproduce the bug, read the relevant code, form a hypothesis, and confirm it. Don't stack speculative fixes.

## Conventions

- Match the surrounding code's style, naming, and comment density.
- Prefer editing existing modules over adding new files or abstractions. Don't refactor unrelated code in the same change.
- Generated files (`src/data/countries.ts`, `countryShapes.generated.ts`, `worldMap.ts`, `public/flags/`) come from the `build:*` scripts in `scripts/`; change the script and regenerate rather than hand-editing output.
- Secrets live in `.env` (see `.env.example`); never commit them or paste them into code.
