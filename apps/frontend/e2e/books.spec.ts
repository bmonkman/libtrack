import { expect, test } from './fixtures';

// Sample data from apps/backend/scripts/seed.ts: 11 books still out, 5 found, 4 returned.
// Due dates are relative to today.

const bookRow = (page: import('@playwright/test').Page, title: string) =>
	page.locator('li', { has: page.getByText(title, { exact: true }) });

test('shows books still out by default, with due dates on the right day', async ({
	page,
	seededUser: _
}) => {
	await page.goto('/books');
	await expect(page.locator('li')).toHaveCount(11);

	const today = new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(new Date());
	const dueToday = bookRow(page, 'Goodnight Moon');
	await expect(dueToday).toContainText(`Due: ${today}`);
	await expect(dueToday).toContainText('(today)');
	await expect(dueToday).toContainText(/Card: Sample Card [AB]/);
	await expect(dueToday).toContainText('Margaret Wise Brown');
	await expect(dueToday.getByText('Overdue', { exact: true })).toHaveCount(0);

	const late = bookRow(page, 'The Very Hungry Caterpillar');
	await expect(late.getByText('Overdue', { exact: true })).toBeVisible();
	await expect(late).toContainText('(3 days ago)');
});

test('overdue includes found books that are past due, and nothing returned', async ({
	page,
	seededUser: _
}) => {
	await page.goto('/books');
	await expect(page.locator('li')).toHaveCount(11);
	await page.getByRole('combobox').first().selectOption('overdue');

	await expect(page.locator('li')).toHaveCount(2);
	await expect(bookRow(page, 'The Very Hungry Caterpillar')).toBeVisible();
	await expect(bookRow(page, 'Where the Wild Things Are')).toBeVisible();
});

test('marking a book found removes it in place without reloading or scrolling', async ({
	page,
	seededUser: _
}) => {
	await page.goto('/books');
	await expect(page.locator('li')).toHaveCount(11);

	// A book mid-list, scrolled to the middle of the screen, so there's still page below it
	// once it's removed (at the very bottom the browser has to scroll up as the page shortens)
	const target = bookRow(page, 'Frog and Toad Are Friends');
	await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	const scrollBefore = await page.evaluate(() => window.scrollY);
	expect(scrollBefore).toBeGreaterThan(0);

	let listReloads = 0;
	page.on('request', (req) => {
		if (req.method() === 'GET' && new URL(req.url()).pathname.endsWith('/books')) listReloads++;
	});

	await target.getByRole('button', { name: 'Found' }).click();

	await expect(target).toHaveCount(0);
	await expect(page.locator('li')).toHaveCount(10);
	expect(listReloads).toBe(0);
	expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(5);

	// It was saved: the Found filter now lists it
	await page.getByRole('combobox').first().selectOption('found');
	await expect(bookRow(page, 'Frog and Toad Are Friends')).toBeVisible();
	await expect(page.locator('li')).toHaveCount(6);
});
