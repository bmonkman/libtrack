# LibTrack Backend

The LibTrack API: Vercel serverless functions in TypeScript, with TypeORM on Postgres (Neon in
production). Deployed as the `libtrack-api` Vercel project at https://libtrack-api.vercel.app.

## Layout

- `api/` — one file per endpoint. Every `.ts` file here becomes a serverless function, and the
  Hobby plan allows 12, so put anything that isn't an endpoint in `lib/`.
  - `auth.ts` — passkey sign-up, sign-in and passkey management (`@simplewebauthn/server`)
  - `books.ts`, `library-cards.ts` — the signed-in user's books and cards
  - `sync-books.ts` — the daily cron that pulls checkouts from BiblioCommons
- `lib/` — entities, the TypeORM data source (`ormconfig.ts`) and helpers. The book-sync rules are
  in `lib/utils/book-sync.ts`, with unit tests beside them.
- `migrations/` — schema changes (TypeORM `synchronize` is off)
- `scripts/` — `seed.ts` (sample data for local dev) and `sync-books-cli.ts` (fetch one real
  card's checkouts)
- `openapi.yaml` — the API reference. Hand-maintained: update it with any handler change.

## Local setup

The repo root has one-command setup (`npm run setup`, then `npm run dev`); see the root README.
To work on the backend alone:

```bash
cp .env.example .env        # set JWT_SECRET; DATABASE_URL points at the local Docker Postgres
npm install
docker compose up -d --wait db    # from the repo root
npm run migration:run
npm run vercel:dev                # API on http://localhost:3000 (API_PORT=3100 to move it)
```

Never point `.env` at the production database, and don't `vercel env pull` over it.

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. TLS comes from the URL (`sslmode=require` on Neon). |
| `JWT_SECRET` | Signs sign-in tokens. Required; there is no default. |
| `CRON_SECRET` | Bearer token the sync cron must send. Vercel Cron sends it automatically. |
| `ALLOWED_ORIGIN` | The frontend's URL. Used for CORS and as the passkey's expected origin. |
| `WEBAUTHN_RP_ID` | The frontend's domain (the passkey "relying party"). Defaults to `localhost`. |
| `NODE_ENV` | `development` locally. |

## Commands

| Command | What it does |
| --- | --- |
| `npm run vercel:dev` | Run the API locally with `vercel dev` |
| `npm run build` | Type-check (`tsc`) |
| `npm test` | Unit tests (`node:test`) |
| `npm run seed` | Sample cards and books for local users without any (`-- --user <id>` for one) |
| `npm run migration:generate -- migrations/<Name>` | Generate a migration from entity changes |
| `npm run migration:run` / `migration:revert` | Apply / undo migrations on `DATABASE_URL` |
| `npm run format` | Prettier |

## Migrations and releases

Migrations don't run on deploy. For a change that needs one, run it against production before
merging; the release steps are in the root `CLAUDE.md` under "Releasing".

## API

See `openapi.yaml`. In short:

- `POST /api/auth/registration-options`, `POST /api/auth/register` — create an account
- `POST /api/auth/login-options`, `POST /api/auth/login` — sign in
- `GET /api/auth/me` — the signed-in user
- `GET|POST /api/auth/passkeys`, `POST /api/auth/passkey-options`, `DELETE /api/auth/passkeys/{id}` — manage passkeys
- `GET /api/books?states=…&overdue=true`, `POST /api/books`, `PUT /api/books/states`, `DELETE /api/books/{id}`
- `GET|POST /api/library-cards`, `PUT|DELETE /api/library-cards/{id}`
- `GET /api/sync-books` — cron only
