import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthor, parseCheckoutsPage } from './library-sync';

test('authors are shown first name first', () => {
  assert.equal(formatAuthor(['Telgemeier, Raina']), 'Raina Telgemeier');
  assert.equal(formatAuthor(['Carle, Eric, 1929-2021']), 'Eric Carle');
  assert.equal(formatAuthor(['Seuss, Dr.']), 'Dr. Seuss');
  assert.equal(formatAuthor(['Martin, Bill, Jr.']), 'Martin, Bill, Jr.');
  assert.equal(formatAuthor(['Avi']), 'Avi');
  assert.equal(formatAuthor(['Lobel, Arnold', 'Lobel, Anita']), 'Arnold Lobel and others');
  assert.equal(formatAuthor([]), undefined);
});

const checkoutsPage = (ids: string[], count = ids.length) => ({
  entities: {
    bibs: { b1: { briefInfo: { title: 'Smile', authors: ['Telgemeier, Raina'], isbns: ['111'] } } },
    checkouts: Object.fromEntries(
      ids.map((id) => [id, { checkoutId: id, metadataId: 'b1', dueDate: '2026-10-20' }])
    ),
  },
  borrowing: { checkouts: { items: ids, pagination: { count, page: 1, pages: 1 } } },
});

test('parses a checkouts page', () => {
  const { books, total } = parseCheckoutsPage(checkoutsPage(['c1']));

  assert.equal(total, 1);
  assert.deepEqual(books, [
    {
      checkoutId: 'c1',
      title: 'Smile',
      author: 'Raina Telgemeier',
      isbn: '111',
      dueDate: '2026-10-20',
      coverImage: undefined,
    },
  ]);
});

test('zero checkouts parses as an empty list', () => {
  const page = checkoutsPage([]);
  delete (page.entities as { checkouts?: unknown }).checkouts;

  assert.deepEqual(parseCheckoutsPage(page).books, []);
});

test('responses that could read as "no checkouts" by mistake throw', () => {
  // listed checkout without details (e.g. entities.checkouts missing)
  const missingDetails = checkoutsPage(['c1']);
  missingDetails.entities.checkouts = {};
  assert.throws(() => parseCheckoutsPage(missingDetails), /listed without details/);

  // no listing at all
  assert.throws(() => parseCheckoutsPage({ entities: {} }), /Unexpected checkouts response/);
  assert.throws(() => parseCheckoutsPage(undefined), /Unexpected checkouts response/);
});
