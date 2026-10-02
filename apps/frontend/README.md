# LibTrack Frontend

SvelteKit app (Tailwind 3) deployed as the `libtrack` Vercel project at
https://libtrack.vercel.app. Components use Svelte 4 syntax (`$:`, `on:click`, stores) on the
Svelte 5 runtime.

## Layout

- `src/routes/` — pages: sign-in (`+page.svelte`), `books`, `library-cards`, `account`
  (passkeys and log out). `+layout.svelte` holds the nav and redirects signed-out users.
- `src/lib/api.ts` — every API call. `src/lib/types.ts` — shared types. `src/lib/dates.ts` —
  due-date helpers (due dates are `'YYYY-MM-DD'` calendar dates; don't parse them with
  `new Date(...)`).
- `e2e/` — Playwright tests, desktop and phone (Pixel 7).

## Local development

From the repo root, `npm run dev` starts Postgres, the API and this app together (see the root
README). To run only this app:

```bash
cp .env.example .env.local   # PUBLIC_API_BASE_URL=http://localhost:3000/api
npm install
npm run dev                  # http://localhost:5173
```

It must run on port 5173: the API checks passkeys against `ALLOWED_ORIGIN` in
`apps/backend/.env`.

`PUBLIC_API_BASE_URL` is read via `$env/static/public`. In Vercel it is set separately for
production, preview and development.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on 5173 |
| `npm run check` | `svelte-check` type checking |
| `npm run lint` | Prettier check and ESLint |
| `npm run test:e2e` | Playwright tests; starts the API and this app if they aren't running (`API_PORT=3100` to move the API) |
| `npm run screenshots` | Saves every page at desktop and phone size to `screenshots/` |

The tests sign in with Chrome's virtual authenticator and seed sample data for each new user;
see `e2e/fixtures.ts`. Install the browser once with `npx playwright install chromium`.
