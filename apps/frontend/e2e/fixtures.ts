import { test as base, expect, type CDPSession } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BACKEND_DIR = path.resolve(import.meta.dirname, '../../backend');

export const API_URL = `http://localhost:${process.env.API_PORT ?? '3000'}/api`;

export interface VirtualAuthenticator {
	cdp: CDPSession;
	authenticatorId: string;
}

export interface SignedInUser {
	id: string;
	name: string;
	token: string;
}

// Chrome's virtual authenticator stands in for Touch ID / a security key, so passkey
// registration and sign-in run without a human. Chromium only.
export async function addVirtualAuthenticator(
	cdp: CDPSession,
	transport: 'internal' | 'usb' = 'internal'
): Promise<string> {
	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport,
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});
	return authenticatorId;
}

export const test = base.extend<{
	authenticator: VirtualAuthenticator;
	signedInUser: SignedInUser;
	seededUser: SignedInUser;
}>({
	authenticator: async ({ page }, use) => {
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('WebAuthn.enable');
		await use({ cdp, authenticatorId: await addVirtualAuthenticator(cdp) });
	},

	// A brand-new account, registered through the UI with the virtual authenticator
	signedInUser: async ({ page, authenticator: _ }, use, testInfo) => {
		const name = `e2e ${testInfo.project.name} ${Date.now()}`;
		await page.goto('/');
		await page.getByText('Register new account').click();
		await page.getByPlaceholder('Enter your name').fill(name);
		await page.getByRole('button', { name: 'Register' }).click();
		// vercel dev compiles each endpoint on first use, which can take a while on a cold start
		await expect(page).toHaveURL(/\/books$/, { timeout: 30_000 });

		const token = (await page.evaluate(() => localStorage.getItem('auth_token'))) ?? '';
		const me = await page.request.get(`${API_URL}/auth/me`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		const { user } = await me.json();
		await use({ id: user.id, name, token });
	},

	// signedInUser plus the backend's sample cards and books (apps/backend/scripts/seed.ts)
	seededUser: async ({ signedInUser }, use) => {
		execFileSync('npm', ['run', 'seed', '--silent', '--', '--user', signedInUser.id], {
			cwd: BACKEND_DIR,
			stdio: 'pipe'
		});
		await use(signedInUser);
	}
});

export { expect };
