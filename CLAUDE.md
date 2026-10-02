# LibTrack

Tracks library books checked out across several library cards in one household ("have we found this book in the house yet?") and shows card barcodes at the library. Two apps in one repo, each with its own `package.json` and lockfile (Vercel builds each from its own directory). The root `package.json` only holds dev scripts that drive both.

## How it's used (drives the UI)

The main job is matching a physical pile of books against the "Still out" list on a phone, one book at a time: find the title in the pile, tap Found, move to the next. Whatever stays on the list is still somewhere in the house. So on the books page:

- One book at a time matters more than density. Don't optimize for more books per screen. Each card is large on purpose: big cover to match against the physical book, then title and author, then a large Found button. The user prefers this layout over more compact ones (compared in screenshots, 2026-10).
- Each book's Found button must be clearly part of that book's card.
- Marking a book found must not reload the list or move the scroll position (a Playwright test covers this).
- To mark many at once there's photo matching: on "Still out", the user photographs the pile, the server asks Gemini which still-out books are in it, and the user confirms a ticked list before anything is marked found. Never mark books found from a model's answer without that confirmation.

## Layout

- `apps/backend` — Vercel serverless functions (`@vercel/node`), TypeORM + Postgres (Neon). Every `.ts` file under `api/` (subfolders included) becomes its own serverless function, and the Hobby plan allows at most 12 per deployment. So `api/` holds only endpoints; entities, helpers and the data source live in `lib/`, and Vercel bundles whatever an endpoint imports. Sub-paths are routed to an endpoint by `vercel.json` `routes`, and the handler switches on `req.method` and the URL path.
  - `api/auth.ts` — passkey (WebAuthn) sign-up, sign-in, and listing/adding/removing passkeys (the frontend's Account page) via `@simplewebauthn/server`; challenges are stored in the `web_authn_challenge` table and deleted on use. Issues a JWT (72h) that the frontend keeps in `localStorage` and sends as `Authorization: Bearer`. The RP ID and expected origin come from `WEBAUTHN_RP_ID` and `ALLOWED_ORIGIN` (default `localhost` / `http://localhost:5173`). `JWT_SECRET` is required, including locally.
  - `api/books.ts`, `api/library-cards.ts` — CRUD, scoped to the JWT user via `requireAuth` in `lib/utils/auth.ts`.
  - `api/sync-books.ts` — daily Vercel cron (`0 0 * * *`, requires `CRON_SECRET`) that syncs every card in parallel via `lib/utils/book-sync.ts`. Books are matched to loans by BiblioCommons `checkoutId`; books the library no longer lists become `returned`. The matching rules live in `reconcileCheckouts` and are unit-tested.
  - `lib/utils/library-sync.ts` — BiblioCommons login + checkouts client (New Westminster only; `LibrarySystem` enum). It throws on an unexpected response, because an empty list would mark every book returned.
  - Book `state` is where the book is: `checked_out` (still out, not found), `found`, `returned`. Overdue is not a state; it's `dueDate` (a Postgres `date`, `'YYYY-MM-DD'`) before today in Vancouver (`lib/utils/dates.ts`). Never parse due dates with `new Date('YYYY-MM-DD')`: that's UTC midnight, the previous day locally.
  - `lib/utils/photo-match.ts` — photo matching for `POST /books/identify`: sends the photo plus a numbered list of the user's still-out books to Gemini (`@google/genai`) and maps the answer (list numbers, "sure"/"maybe") back to book ids. Default model `gemini-3.5-flash-lite`, falling back to `gemini-3.8-flash` when busy (429/503); `GEMINI_MODEL` overrides. Uses the Gemini free tier, where Google may use uploads for training, so the UI never needs photos of people. `scripts/try-photo-match.ts` runs a real photo against a book list from the command line.
  - `lib/entities/` — TypeORM entities; `lib/ormconfig.ts` — the data source (also used by the migration scripts).
  - `scripts/sync-books-cli.ts` — fetch one card's checkouts from the real library: `npx ts-node scripts/sync-books-cli.ts <card> <pin> nwpl`.
  - `scripts/seed.ts` — sample cards and books for local users (`npm run seed`).
  - `openapi.yaml` — API spec the project started from; not generated, may drift from the handlers.
  - `examples/nwpl/` (gitignored) — captured BiblioCommons responses; contains real account data, never commit.
- `apps/frontend` — SvelteKit (Svelte 5 runtime, but components are written in Svelte 4 syntax: `$:`, `on:click`, stores), Tailwind 3. All API calls go through `src/lib/api.ts`; shared types in `src/lib/types.ts`; due-date helpers in `src/lib/dates.ts`.
  - `e2e/` — Playwright tests (desktop + Pixel 7). `e2e/fixtures.ts` signs in through Chrome's virtual authenticator and seeds data. Tests must never call Gemini: `e2e/photo-match.spec.ts` answers `/books/identify` itself with `page.route`.

## Deploy

- Two Vercel projects in team `bmonkmans-projects`, both Git-connected to `bmonkman/libtrack`, production branch `main`:
  - `libtrack-api` (root `apps/backend`) → https://libtrack-api.vercel.app — also owns the cron.
  - `libtrack` (root `apps/frontend`) → https://libtrack.vercel.app
- Pushing to `main` deploys both to production. Other branches get preview deployments. No CI/tests gate the deploy.
- Backend env vars are managed in Vercel: `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `ALLOWED_ORIGIN`, `WEBAUTHN_RP_ID`, `NODE_ENV`, `GEMINI_API_KEY` (production only, from Google AI Studio; without it photo matching returns 503). The frontend's `PUBLIC_API_BASE_URL` is set per environment and read via `$env/static/public`.
- Both apps are linked through the root `.vercel/repo.json`; run `vercel` commands from the app directory.

## Database

- Schema changes go through migrations only; TypeORM `synchronize` is off. Columns are camelCase (no naming strategy). `migrations/InitialSchema.ts` is a baseline that mirrors the production schema.
- New migration: change the entities, then `npm run migration:generate -- migrations/<Name>` against a database that is already at the latest migration, and review the output (add any data changes by hand).
- Local dev uses Postgres from `docker-compose.yml` (port 54329). `apps/backend/.env` must point there (see `.env.example`); `vercel dev` reads that file. Don't `vercel env pull` into it: Vercel's production `DATABASE_URL` is the real database.
- Migrations are not run on deploy. The user runs `npm run migration:run` against production before merging a change that needs them. Write migrations so the old code keeps working against the new schema in between where possible, and test `up`, `down`, `up` locally with data shaped like production's.

## Releasing

Pushing to `main` deploys to production, and nothing runs tests first, so:

1. Open a PR. Wait for both Vercel preview deploys and CodeQL to pass, and read the Copilot review.
2. If the PR adds a migration, the user runs it against production **before** merging. Agents don't run production migrations themselves (Claude Code's safety check blocks it, and it should). The command, from `apps/backend`:
   ```bash
   npx vercel env pull --environment=production /tmp/libtrack-prod.env
   DATABASE_URL="$(grep '^DATABASE_URL=' /tmp/libtrack-prod.env | cut -d= -f2- | tr -d '"')" npm run migration:run
   rm /tmp/libtrack-prod.env
   ```
   A `DATABASE_URL` set in the shell takes precedence over `.env`. Between this step and the deploy, production runs old code against the new schema.
3. Squash-merge. Then check that both production deploys are `READY` on the merge commit (`vercel ls libtrack-api` / `vercel ls libtrack`, or the Vercel API) and smoke-test the live API.
4. Sync changes show up at the next cron run (00:00 UTC). Check its result in the `libtrack-api` logs.

## Locked out of an account

Passkeys are the only way in. If a user has lost every passkey for their account:

1. They register a new account on the site, which creates a second, empty user with a working passkey.
2. In the Neon SQL editor, move that passkey to the original user and delete the empty one:
   ```sql
   UPDATE passkey_credential SET "userId" = '<original user id>' WHERE "userId" = '<new user id>';
   DELETE FROM app_user WHERE id = '<new user id>';
   ```
3. They sign in with the new passkey and get their original cards and books.

## Commands

Running, seeding, testing and screenshotting the app: see the `libtrack-dev` skill (`.claude/skills/libtrack-dev/SKILL.md`). In short, from the root: `npm run setup` once, `npm run dev` (`API_PORT=3100` if 3000 is taken), `npm run check`, `npm run test:e2e`.

- Backend: `npm run vercel:dev`, `npm run build` (tsc), `npm test` (node:test unit tests), `npm run seed`, `npm run format`.
- Frontend: `npm run dev`, `npm run check`, `npm run lint`, `npm run test:e2e`, `npm run screenshots` (writes `screenshots/*.png`).
- Formatting: Prettier in both apps; backend uses 2-space/single quotes, frontend uses tabs (see each `.prettierrc`).
