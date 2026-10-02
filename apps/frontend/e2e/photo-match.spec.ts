import type { Page } from '@playwright/test';
import { API_URL, expect, test, type SignedInUser } from './fixtures';

// These tests answer POST /books/identify themselves, so Gemini is never called.
// The photo-matching logic on the server is unit-tested in apps/backend.

// A real 1x1 PNG: the page decodes and re-encodes the photo before sending it
const PHOTO = {
	name: 'pile.png',
	mimeType: 'image/png',
	buffer: Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	)
};

async function stillOutIds(page: Page, user: SignedInUser): Promise<Record<string, string>> {
	const response = await page.request.get(`${API_URL}/books?states=checked_out`, {
		headers: { Authorization: `Bearer ${user.token}` }
	});
	const books: { id: string; title: string }[] = await response.json();
	return Object.fromEntries(books.map((book) => [book.title, book.id]));
}

test('suggested books are reviewed, then only the ticked ones are marked found', async ({
	page,
	seededUser
}) => {
	const ids = await stillOutIds(page, seededUser);
	let sent: { image?: string; mimeType?: string } = {};
	await page.route('**/books/identify', async (route) => {
		sent = route.request().postDataJSON();
		await route.fulfill({
			json: {
				sure: [ids['The Gruffalo'], ids['Corduroy']],
				maybe: [ids['Goodnight Moon']]
			}
		});
	});

	await page.goto('/books');
	await expect(page.locator('li')).toHaveCount(11);
	await page.locator('input[type=file]').setInputFiles(PHOTO);

	await expect(page.getByText('Found in your photo')).toBeVisible();
	expect(sent.mimeType).toBe('image/jpeg');
	expect(sent.image?.length).toBeGreaterThan(0);

	const box = (title: string) => page.locator('label', { hasText: title }).getByRole('checkbox');
	await expect(box('The Gruffalo')).toBeChecked();
	await expect(box('Corduroy')).toBeChecked();
	await expect(box('Goodnight Moon')).not.toBeChecked();

	// Corduroy isn't really there; Goodnight Moon is
	await box('Corduroy').uncheck();
	await box('Goodnight Moon').check();
	await page.getByRole('button', { name: 'Mark 2 found' }).click();

	await expect(page.getByText('Marked 2 found.')).toBeVisible();
	await expect(page.locator('li')).toHaveCount(9);
	await expect(page.getByText('Corduroy', { exact: true })).toBeVisible();
	await expect(page.getByText('The Gruffalo', { exact: true })).toHaveCount(0);

	// Saved: both are on the Found list now
	await page.getByRole('combobox').first().selectOption('found');
	await expect(page.getByText('The Gruffalo', { exact: true })).toBeVisible();
	await expect(page.getByText('Goodnight Moon', { exact: true })).toBeVisible();
});

test('cancelling the review marks nothing', async ({ page, seededUser }) => {
	const ids = await stillOutIds(page, seededUser);
	await page.route('**/books/identify', (route) =>
		route.fulfill({ json: { sure: [ids['The Gruffalo']], maybe: [] } })
	);

	await page.goto('/books');
	await page.locator('input[type=file]').setInputFiles(PHOTO);
	await page.getByRole('button', { name: 'Cancel' }).click();

	await expect(page.locator('li')).toHaveCount(11);
	await page.reload();
	await expect(page.locator('li')).toHaveCount(11);
});

test('a photo with none of the books says so', async ({ page, seededUser: _ }) => {
	await page.route('**/books/identify', (route) =>
		route.fulfill({ json: { sure: [], maybe: [] } })
	);

	await page.goto('/books');
	await page.locator('input[type=file]').setInputFiles(PHOTO);

	await expect(page.getByText('None of your still-out books were spotted')).toBeVisible();
	await page.getByRole('button', { name: 'Back to the list' }).click();
	await expect(page.locator('li')).toHaveCount(11);
});

test('a failed photo check shows the error and leaves the list alone', async ({
	page,
	seededUser: _
}) => {
	await page.route('**/books/identify', (route) =>
		route.fulfill({
			status: 429,
			json: { error: 'Photo matching is busy. Try again in a minute.' }
		})
	);

	await page.goto('/books');
	await page.locator('input[type=file]').setInputFiles(PHOTO);

	await expect(page.getByText('Photo matching is busy. Try again in a minute.')).toBeVisible();
	await expect(page.locator('li')).toHaveCount(11);
});
