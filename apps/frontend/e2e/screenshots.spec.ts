import { expect, test } from './fixtures';

// Not part of the normal test run. `npm run screenshots` saves each signed-in page, at desktop
// and phone size, to screenshots/ for a person (or Claude) to look at.
const PAGES = [
	{ path: '/books', ready: 'li' },
	{ path: '/library-cards', ready: 'canvas' },
	{ path: '/account', ready: 'li' }
];

test('@screenshots signed-in pages', async ({ page, seededUser: _ }, testInfo) => {
	for (const { path, ready } of PAGES) {
		await page.goto(path);
		await expect(page.locator(ready).first()).toBeVisible();
		// Let cover images finish loading. Not 'networkidle': a slow third-party cover server can
		// hold that off past the test timeout. A cover that's still loading after 15s is shot as is.
		await page
			.waitForFunction(() => [...document.images].every((img) => img.complete), null, {
				timeout: 15_000
			})
			.catch(() => {});
		await page.screenshot({
			path: `screenshots/${testInfo.project.name}${path.replace(/\//g, '-')}.png`,
			fullPage: true
		});
	}
});

test('@screenshots sign-in page', async ({ page }, testInfo) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Sign in with passkey' })).toBeVisible();
	await page.screenshot({
		path: `screenshots/${testInfo.project.name}-signin.png`,
		fullPage: true
	});
});

test('@screenshots server unreachable while signed in', async ({
	page,
	signedInUser: _
}, testInfo) => {
	await page.route('**/auth/me', (route) => route.abort('internetdisconnected'));
	await page.reload();
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
	await page.screenshot({
		path: `screenshots/${testInfo.project.name}-unreachable.png`,
		fullPage: true
	});
});
