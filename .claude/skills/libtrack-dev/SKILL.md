---
name: libtrack-dev
description: Run LibTrack locally, sign in without a human, seed sample data, run the end-to-end tests, and take screenshots of pages at desktop and phone size. Use when starting the app, checking a UI change, reproducing a bug in the browser, or confirming a change works end to end.
---

# Running and checking LibTrack locally

Everything runs against a local Postgres in Docker. Never point local dev at production:
`apps/backend/.env` must have the local `DATABASE_URL` from `apps/backend/.env.example`.
Check that before starting anything, without printing the URL (it holds the password):
`grep -q '^DATABASE_URL=.*localhost:54329' apps/backend/.env && echo local || echo NOT LOCAL`.
If it says NOT LOCAL, stop and ask the user.

## One-time setup

```bash
npm install                     # root: dev scripts only
npm run setup                   # installs both apps, starts Postgres, runs migrations
npx --prefix apps/frontend playwright install chromium
```

Env files: copy `apps/backend/.env.example` to `apps/backend/.env` and
`apps/frontend/.env.example` to `apps/frontend/.env.local` if they don't exist.

## Run the app

`npm run dev` from the repo root starts Postgres, the API (`vercel dev`) and the frontend (Vite)
on http://localhost:5173. Set `API_PORT` if port 3000 is taken (the user often has another app
there): `API_PORT=3100 npm run dev`.

The frontend must be served on http://localhost:5173: the backend checks passkeys against
`ALLOWED_ORIGIN` in `apps/backend/.env`.

## Signing in

Sign-in is passkey-only, so a browser needs an authenticator. Playwright tests get one from
Chrome's virtual authenticator: use the `signedInUser` / `seededUser` fixtures in
`apps/frontend/e2e/fixtures.ts` rather than writing your own sign-in steps. `seededUser` also
gives the account sample cards and books (`apps/backend/scripts/seed.ts`): 11 still out (one
overdue, one due today), 5 found (one overdue) and 4 returned, with due dates relative to today.

## Tests

Run from `apps/frontend` (Playwright starts any server that isn't already running):

```bash
API_PORT=3100 npm run test:e2e        # desktop + phone (Pixel 7), ~1 min
API_PORT=3100 npx playwright test e2e/books.spec.ts --project desktop   # narrower
```

Backend unit tests: `npm --prefix apps/backend test`. Type checks for both apps: `npm run check`
from the root.

`vercel dev` builds each API function the first time it's called and is slow under parallel load;
the Playwright config allows for that (10 s expect, 60 s per test). A timeout on the first run
after starting the API is usually that, not a bug: rerun before digging in.

## Screenshots: look at a UI change before calling it done

```bash
cd apps/frontend && API_PORT=3100 npm run screenshots
```

This signs in a fresh seeded user and saves full-page shots of the sign-in, books, library cards
and account pages to `apps/frontend/screenshots/{desktop,mobile}-<page>.png`. Read the PNGs and
check the change, including at phone width. To capture a new page or state, add it to
`e2e/screenshots.spec.ts`.
