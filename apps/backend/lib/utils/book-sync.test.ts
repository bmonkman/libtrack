import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Book, BookState } from '../entities/Book';
import { BookData, LibraryFine } from './library-sync';
import { reconcileCheckouts } from './book-sync';

const card = { id: 'card-1', userId: 'user-1' };

function book(fields: Partial<Book> & { isbn: string }): Book {
  return Object.assign(new Book(fields.isbn, fields.title ?? fields.isbn), {
    libraryCardId: card.id,
    userId: card.userId,
    ...fields,
  });
}

function checkout(fields: Partial<BookData> & { checkoutId: string }): BookData {
  return { title: 'A book', dueDate: '2026-10-20', ...fields };
}

test('a new loan creates a checked_out book on the card', () => {
  const { changed, created } = reconcileCheckouts(
    card,
    [],
    [checkout({ checkoutId: 'c1', isbn: '111', title: 'New', coverImage: 'cover.jpg' })]
  );

  assert.equal(created, 1);
  assert.equal(changed.length, 1);
  assert.deepEqual(
    {
      isbn: changed[0].isbn,
      state: changed[0].state,
      checkoutId: changed[0].checkoutId,
      dueDate: changed[0].dueDate,
      libraryCardId: changed[0].libraryCardId,
      userId: changed[0].userId,
      pictureUrl: changed[0].pictureUrl,
    },
    {
      isbn: '111',
      state: BookState.CHECKED_OUT,
      checkoutId: 'c1',
      dueDate: '2026-10-20',
      libraryCardId: 'card-1',
      userId: 'user-1',
      pictureUrl: 'cover.jpg',
    }
  );
});

test('a known loan keeps the state the user chose and picks up a renewed due date', () => {
  const found = book({
    isbn: '111',
    checkoutId: 'c1',
    state: BookState.FOUND,
    dueDate: '2026-10-01',
  });

  const { created, returned } = reconcileCheckouts(
    card,
    [found],
    [checkout({ checkoutId: 'c1', isbn: '111', dueDate: '2026-10-22' })]
  );

  assert.equal(created, 0);
  assert.equal(returned, 0);
  assert.equal(found.state, BookState.FOUND);
  assert.equal(found.dueDate, '2026-10-22');
});

test('books the library no longer lists are returned, whether found or not', () => {
  const found = book({ isbn: '111', checkoutId: 'c1', state: BookState.FOUND });
  const missing = book({ isbn: '222', checkoutId: 'c2', state: BookState.CHECKED_OUT });
  const alreadyReturned = book({ isbn: '333', checkoutId: 'c3', state: BookState.RETURNED });

  const { changed, returned } = reconcileCheckouts(card, [found, missing, alreadyReturned], []);

  assert.equal(returned, 2);
  assert.equal(found.state, BookState.RETURNED);
  assert.equal(missing.state, BookState.RETURNED);
  assert.ok(!changed.includes(alreadyReturned), 'already-returned books are not re-saved');
});

test('books saved before checkoutId existed are matched once by ISBN', () => {
  const legacy = book({ isbn: '111', state: BookState.FOUND });

  const { created, returned } = reconcileCheckouts(
    card,
    [legacy],
    [checkout({ checkoutId: 'c1', isbn: '111' })]
  );

  assert.equal(created, 0);
  assert.equal(returned, 0);
  assert.equal(legacy.checkoutId, 'c1');
  assert.equal(legacy.state, BookState.FOUND);
});

test('two copies of the same ISBN on one card stay two rows', () => {
  const { created, changed } = reconcileCheckouts(
    card,
    [],
    [checkout({ checkoutId: 'c1', isbn: '111' }), checkout({ checkoutId: 'c2', isbn: '111' })]
  );

  assert.equal(created, 2);
  assert.deepEqual(changed.map((b) => b.checkoutId).sort(), ['c1', 'c2']);
});

test('borrowing a returned book again reuses its row as checked_out', () => {
  const returnedBook = book({ isbn: '111', checkoutId: 'old', state: BookState.RETURNED });

  const { created } = reconcileCheckouts(
    card,
    [returnedBook],
    [checkout({ checkoutId: 'new', isbn: '111' })]
  );

  assert.equal(created, 0);
  assert.equal(returnedBook.state, BookState.CHECKED_OUT);
  assert.equal(returnedBook.checkoutId, 'new');
});

test('a loan that reappears after being marked returned goes back to checked_out', () => {
  const returnedBook = book({ isbn: '111', checkoutId: 'c1', state: BookState.RETURNED });

  reconcileCheckouts(card, [returnedBook], [checkout({ checkoutId: 'c1', isbn: '111' })]);

  assert.equal(returnedBook.state, BookState.CHECKED_OUT);
});

test('a loan without an ISBN gets a stable placeholder from its checkoutId', () => {
  const { changed } = reconcileCheckouts(card, [], [checkout({ checkoutId: 'c9' })]);

  assert.equal(changed[0].isbn, 'checkout-c9');
});

test('a known loan picks up its author', () => {
  const legacy = book({ isbn: '111', checkoutId: 'c1', state: BookState.FOUND });

  reconcileCheckouts(
    card,
    [legacy],
    [checkout({ checkoutId: 'c1', isbn: '111', author: 'Raina Telgemeier' })]
  );

  assert.equal(legacy.author, 'Raina Telgemeier');
});

const lostFine = (fields: Partial<LibraryFine>): LibraryFine => ({
  fineId: 'f',
  amountCents: 700,
  status: 'UNPAID',
  description: 'Lost',
  ...fields,
});

test('a book billed as lost stays where it is, with its charge', () => {
  const stillOut = book({ isbn: '111', title: 'Pancake Pirates', state: BookState.CHECKED_OUT });
  const found = book({
    isbn: '222',
    metadataId: 'S33C1',
    title: 'Other title',
    state: BookState.FOUND,
  });

  const { returned, lost } = reconcileCheckouts(
    card,
    [stillOut, found],
    [],
    [
      lostFine({ title: 'Pancake Pirates', amountCents: 700 }),
      lostFine({ metadataId: 'S33C1', title: 'Different title', amountCents: 1800 }),
    ]
  );

  assert.equal(returned, 0);
  assert.equal(lost, 2);
  assert.equal(stillOut.state, BookState.CHECKED_OUT);
  assert.equal(stillOut.lostChargeCents, 700);
  assert.equal(found.state, BookState.FOUND);
  assert.equal(found.lostChargeCents, 1800);
});

test('titles match ignoring case and punctuation; credits and paid fines are not lost charges', () => {
  const a = book({ isbn: '1', title: 'Moon Rangers: 2, The Lost Comet', state: BookState.FOUND });
  const b = book({ isbn: '2', title: 'Credit Book', state: BookState.FOUND });
  const c = book({ isbn: '3', title: 'Paid Book', state: BookState.FOUND });

  reconcileCheckouts(
    card,
    [a, b, c],
    [],
    [
      lostFine({ title: 'moon rangers 2 the lost comet' }),
      lostFine({
        title: 'Credit Book',
        status: 'CREDIT',
        description: 'Credit',
        amountCents: -325,
      }),
      lostFine({ title: 'Paid Book', status: 'PAID' }),
    ]
  );

  assert.equal(a.lostChargeCents, 700);
  assert.equal(b.state, BookState.RETURNED);
  assert.equal(c.state, BookState.RETURNED);
});

test('each lost charge goes to one book, preferring one not already returned', () => {
  const returnedCopy = book({ isbn: '1', title: 'Smile', state: BookState.RETURNED });
  const foundCopy = book({ isbn: '2', title: 'Smile', state: BookState.FOUND });

  reconcileCheckouts(card, [returnedCopy, foundCopy], [], [lostFine({ title: 'Smile' })]);

  assert.equal(foundCopy.lostChargeCents, 700);
  assert.equal(returnedCopy.lostChargeCents ?? null, null);
  assert.equal(returnedCopy.state, BookState.RETURNED);
});

test('a returned book that gets billed as lost comes back as still out', () => {
  const returnedBook = book({ isbn: '1', title: 'Smile', state: BookState.RETURNED });

  reconcileCheckouts(card, [returnedBook], [], [lostFine({ title: 'Smile' })]);

  assert.equal(returnedBook.state, BookState.CHECKED_OUT);
  assert.equal(returnedBook.lostChargeCents, 700);
});

test('once the lost charge is gone, the book is returned like any other', () => {
  const wasLost = book({ isbn: '1', title: 'Smile', state: BookState.FOUND, lostChargeCents: 700 });

  const { changed, returned } = reconcileCheckouts(card, [wasLost], [], []);

  assert.equal(wasLost.state, BookState.RETURNED);
  assert.equal(wasLost.lostChargeCents, null);
  assert.equal(returned, 1);
  assert.ok(changed.includes(wasLost));
});

test('a loan that is still out clears any lost charge and records its title id', () => {
  const loan = book({
    isbn: '1',
    checkoutId: 'c1',
    state: BookState.CHECKED_OUT,
    lostChargeCents: 700,
  });

  reconcileCheckouts(
    card,
    [loan],
    [checkout({ checkoutId: 'c1', isbn: '1', metadataId: 'S33C9' })]
  );

  assert.equal(loan.lostChargeCents, null);
  assert.equal(loan.metadataId, 'S33C9');
});
