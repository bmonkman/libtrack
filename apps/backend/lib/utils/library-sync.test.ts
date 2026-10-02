import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthor, parseCheckoutsPage, parseFinesPage } from './library-sync';

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
      metadataId: 'b1',
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

// Shape copied from a real NWPL fines response (values changed)
const finesPage = (ids: string[], extra: Record<string, unknown> = {}) => ({
  entities: {
    fines: {
      f1: {
        id: 'f1',
        amount: 12.5,
        status: 'UNPAID',
        description: 'Lost',
        payable: true,
        metadataId: 'S33C0000001',
        bibTitle: 'Moon Rangers',
        bibSubtitle: '2, The Lost Comet',
      },
      f2: {
        id: 'f2',
        amount: -3.25,
        status: 'CREDIT',
        description: 'Credit',
        payable: false,
        metadataId: null,
        bibTitle: '',
        bibSubtitle: '',
      },
      ...extra,
    },
  },
  borrowing: {
    fines: {
      pagination: { size: 100, totalElements: ids.length, totalPages: 1, number: 0 },
      results: ids,
    },
  },
});

test('parses fines into cents with a full title', () => {
  const { fines, total } = parseFinesPage(finesPage(['f1', 'f2']));

  assert.equal(total, 2);
  assert.deepEqual(fines, [
    {
      fineId: 'f1',
      amountCents: 1250,
      status: 'UNPAID',
      description: 'Lost',
      metadataId: 'S33C0000001',
      title: 'Moon Rangers: 2, The Lost Comet',
    },
    {
      fineId: 'f2',
      amountCents: -325,
      status: 'CREDIT',
      description: 'Credit',
      metadataId: undefined,
      title: undefined,
    },
  ]);
});

test('fines responses that could hide a charge throw', () => {
  assert.throws(() => parseFinesPage(finesPage(['f1', 'missing'])), /listed without details/);
  for (const field of ['status', 'description', 'amount']) {
    const page = finesPage(['f1']);
    delete (page.entities.fines.f1 as Record<string, unknown>)[field];
    assert.throws(() => parseFinesPage(page), /listed without details/, field);
  }
  assert.throws(() => parseFinesPage({ entities: {} }), /Unexpected fines response/);
});
