# LibTrack

Tracks library books checked out across several library cards in one household ("have we found this book in the house yet?") and shows card barcodes at the library. Two independent apps in one repo, no shared workspace tooling; run npm commands inside each app dir.

## Layout

- `apps/backend` — Vercel serverless functions (`@vercel/node`), TypeORM + Postgres (Neon). Each file in `api/*.ts` is one function; sub-paths are routed to it by `vercel.json` `routes` and the handler switches on `req.method` and the last URL segment (`req.url.split('/').pop()`).
  - `api/auth.ts` — passkey (WebAuthn) sign-up, sign-in and add-passkey via `@simplewebauthn/server`; challenges are stored in the `web_authn_challenge` table and deleted on use. Issues a JWT (72h) that the frontend keeps in `localStorage` and sends as `Authorization: Bearer`. The RP ID and expected origin come from `WEBAUTHN_RP_ID` and `ALLOWED_ORIGIN` (default `localhost` / `http://localhost:5173`). `JWT_SECRET` is required, including locally.
  - `api/books.ts`, `api/library-cards.ts` — CRUD, scoped to the JWT user via `requireAuth` in `api/utils/auth.ts`.
  - `api/sync-books.ts` — daily Vercel cron (`0 0 * * *`) that logs into BiblioCommons per card and upserts checked-out books.
  - `api/utils/library-sync.ts` — BiblioCommons scraping/gateway client (New Westminster only; `LibrarySystem` enum).
  - `api/sync-books-cli.ts` — run the sync for one card locally: `npx ts-node api/sync-books-cli.ts <card> <pin> nwpl`.
  - `openapi.yaml` — API spec the project started from; not generated, may drift from the handlers.
  - `examples/nwpl/` (gitignored) — captured BiblioCommons responses; contains real account data, never commit.
- `apps/frontend` — SvelteKit (Svelte 5, `adapter-auto`), Tailwind 3. All API calls go through `src/lib/api.ts`; shared types in `src/lib/types.ts`.

## Deploy

- Two Vercel projects in team `bmonkmans-projects`, both Git-connected to `bmonkman/libtrack`, production branch `main`:
  - `libtrack-api` (root `apps/backend`) → https://libtrack-api.vercel.app — also owns the cron.
  - `libtrack` (root `apps/frontend`) → https://libtrack.vercel.app
- Pushing to `main` deploys both to production. Other branches get preview deployments. No CI/tests gate the deploy.
- Backend env vars are managed in Vercel (`vercel env ls` from a linked dir): `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `ALLOWED_ORIGIN`, `WEBAUTHN_RP_ID`, `NODE_ENV`. Local copies live in gitignored `.env` files (`vercel env pull`).
- The frontend reads the API URL from a hardcoded fallback in `src/lib/api.ts`; `PUBLIC_API_BASE_URL` is set in Vercel but `import.meta.env` only exposes `VITE_`-prefixed vars, so it is not actually used.

## Database

- Schema changes go through migrations only; TypeORM `synchronize` is off. Columns are camelCase (no naming strategy). `migrations/InitialSchema.ts` is a baseline that mirrors the production schema.
- New migration: change the entities, then `npm run migration:generate -- migrations/<Name>` against a database that is already at the latest migration, and review the output (add any data changes by hand).
- Vercel has one `DATABASE_URL` for every environment, so `vercel env pull` gives you the production database. For local work use a throwaway Postgres, e.g. `docker run -d --name libtrack-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=libtrack -p 54329:5432 postgres:17` then `DATABASE_URL=postgres://postgres:pg@localhost:54329/libtrack npm run migration:run`.
- Migrations are not run on deploy. Run `npm run migration:run` against production before merging a change that needs them.

## Commands

- Backend: `npm run vercel:dev` (port 3000), `npm run build` (tsc type-check), `npm run format`.
- Frontend: `npm run dev` (5173, talks to `localhost:3000/api` in dev), `npm run check`, `npm run lint`, `npm test`.
- Formatting: Prettier in both apps; backend uses 2-space/single quotes, frontend uses tabs (see each `.prettierrc`).
