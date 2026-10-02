import type { Page } from '@playwright/test';
import { addVirtualAuthenticator, API_URL, expect, test } from './fixtures';

const toBase64Url = (base64: string) =>
	base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('register, add a second passkey, sign out and back in with it', async ({
	page,
	authenticator,
	signedInUser
}) => {
	const { cdp, authenticatorId: first } = authenticator;
	await expect(page.locator('nav').getByRole('button')).toHaveCount(0);

	await page.getByRole('link', { name: 'Account' }).click();
	await expect(page.getByText(`Signed in as ${signedInUser.name}`)).toBeVisible();
	const removeButtons = page.getByRole('button', { name: 'Remove' });
	await expect(removeButtons).toHaveCount(1);
	await expect(removeButtons).toBeDisabled();

	// The second passkey lives on a second authenticator; the first stops answering
	await cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
		authenticatorId: first,
		enabled: false
	});
	const second = await addVirtualAuthenticator(cdp, 'usb');
	await page.getByRole('button', { name: 'Add passkey' }).click();
	await expect(page.getByText('Passkey added')).toBeVisible();
	await expect(removeButtons).toHaveCount(2);

	await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: first });
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/$/);
	expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();

	await page.getByRole('button', { name: 'Sign in with passkey' }).click();
	// Like registration (fixtures.ts), sign-in can be slow under parallel load on vercel dev
	await expect(page).toHaveURL(/\/books$/, { timeout: 30_000 });

	// Remove the first passkey; the one on the second authenticator remains
	await page.getByRole('link', { name: 'Account' }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await removeButtons.first().click();
	await expect(page.getByText('Passkey removed')).toBeVisible();
	await expect(removeButtons).toHaveCount(1);

	const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId: second });
	const token = await page.evaluate(() => localStorage.getItem('auth_token'));
	const passkeys = await (
		await page.request.get(`${API_URL}/auth/passkeys`, {
			headers: { Authorization: `Bearer ${token}` }
		})
	).json();
	expect(passkeys.map((p: { id: string }) => p.id)).toEqual([
		toBase64Url(credentials[0].credentialId)
	]);
	expect(passkeys[0]).not.toHaveProperty('publicKey');
});

// Asks the authenticator to sign a server challenge, outside the app's own flow
async function signChallenge(page: Page, tamper = false) {
	const options = await (await page.request.post(`${API_URL}/auth/login-options`)).json();
	expect(options.allowCredentials ?? []).toEqual([]);
	return page.evaluate(
		async ({ options, tamper }) => {
			const fromB64 = (s: string) =>
				Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
			const toB64 = (b: ArrayBuffer | Uint8Array) =>
				btoa(String.fromCharCode(...new Uint8Array(b)))
					.replace(/\+/g, '-')
					.replace(/\//g, '_')
					.replace(/=+$/, '');
			const credential = (await navigator.credentials.get({
				publicKey: {
					challenge: fromB64(options.challenge),
					rpId: options.rpId,
					userVerification: 'required'
				}
			})) as PublicKeyCredential;
			const response = credential.response as AuthenticatorAssertionResponse;
			const signature = new Uint8Array(response.signature);
			if (tamper) signature[10] ^= 0xff;
			return {
				id: credential.id,
				rawId: toB64(credential.rawId),
				type: credential.type,
				clientExtensionResults: {},
				response: {
					clientDataJSON: toB64(response.clientDataJSON),
					authenticatorData: toB64(response.authenticatorData),
					signature: toB64(signature)
				}
			};
		},
		{ options, tamper }
	);
}

const login = (page: Page, response: unknown) =>
	page.request.post(`${API_URL}/auth/login`, { data: { response } });

test('a sign-in response is accepted once and a tampered signature never', async ({
	page,
	signedInUser: _
}) => {
	const valid = await signChallenge(page);
	expect((await login(page, valid)).status()).toBe(200);
	expect((await login(page, valid)).status()).toBe(400); // challenge already used

	expect((await login(page, await signChallenge(page, true))).status()).toBe(401);
});

test('a failed sign-in check keeps you signed in', async ({ page, signedInUser }) => {
	// Like a phone that's still reconnecting when the app comes back from the background
	await page.route('**/auth/me', (route) => route.abort('internetdisconnected'), { times: 1 });
	await page.reload();
	await expect(page.getByText("Couldn't reach LibTrack. You're still signed in.")).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBe(signedInUser.token);

	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
	await expect(page).toHaveURL(/\/books$/);
});

test('signing out ends sessions on the server', async ({ page, signedInUser }) => {
	const me = (token: string) =>
		page.request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
	const otherDevice = (await (await login(page, await signChallenge(page))).json()).token;
	expect((await me(otherDevice)).status()).toBe(200);

	await page.getByRole('link', { name: 'Account' }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Sign out other devices' }).click();
	await expect(page.getByText('Signed out on other devices')).toBeVisible();
	expect((await me(otherDevice)).status()).toBe(401);
	expect((await me(signedInUser.token)).status()).toBe(200);

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/$/);
	expect((await me(signedInUser.token)).status()).toBe(401);
});

test('a session ended on another device signs this page out', async ({ page, signedInUser }) => {
	// Same as this device being signed out from another one's Account page
	await page.request.post(`${API_URL}/auth/logout`, {
		headers: { Authorization: `Bearer ${signedInUser.token}` }
	});

	await page.getByRole('link', { name: 'Library Cards' }).click();
	await expect(page.getByRole('button', { name: 'Sign in with passkey' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Account' })).toHaveCount(0);
	expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
});

test('auth endpoints refuse what they should', async ({ request }) => {
	expect((await request.post(`${API_URL}/auth/verify`)).status()).toBe(404);
	expect((await request.post(`${API_URL}/auth/passkey-options`)).status()).toBe(401);
	expect((await request.get(`${API_URL}/auth/passkeys`)).status()).toBe(401);
	expect((await request.post(`${API_URL}/auth/logout`)).status()).toBe(401);
	expect((await request.post(`${API_URL}/auth/sign-out-others`)).status()).toBe(401);
	const madeUp = { Authorization: 'Bearer not-a-real-session' };
	expect((await request.get(`${API_URL}/auth/me`, { headers: madeUp })).status()).toBe(401);
	expect((await request.get(`${API_URL}/sync-books`)).status()).toBe(401);
});
