import { defineConfig, devices } from '@playwright/test';

// Runs against the local dev stack (Docker Postgres + vercel dev + vite), starting whichever of
// the two servers isn't already running. The backend reads apps/backend/.env, which must point
// at the local database (see .env.example). API_PORT moves the API off 3000 if that's taken.
const API_PORT = process.env.API_PORT ?? '3000';
const API_URL = `http://localhost:${API_PORT}/api`;

export default defineConfig({
	testDir: 'e2e',
	// vercel dev runs each API request as a fresh function invocation, which is slow under load
	expect: { timeout: 10_000 },
	timeout: 60_000,
	// WebAuthn's expected origin is ALLOWED_ORIGIN in apps/backend/.env, so the frontend must be
	// served on exactly this origin.
	use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: [
		{
			command: 'npm --prefix ../backend run vercel:dev',
			env: { API_PORT },
			// Unauthenticated /auth/me answers 401 once the API is up
			url: `${API_URL}/auth/me`,
			reuseExistingServer: true,
			timeout: 120_000
		},
		{
			command: 'npm run dev -- --port 5173 --strictPort',
			env: { PUBLIC_API_BASE_URL: API_URL },
			url: 'http://localhost:5173',
			reuseExistingServer: true
		}
	]
});
