import { AppDataSource } from '../ormconfig';
import { Book, BookState } from '../entities/Book';
import { LibraryCard } from '../entities/LibraryCard';
import { BookData, getCheckedOutBooks } from './library-sync';

export interface ReconcileResult {
  // Every book whose row needs saving: new loans, updated loans, and newly returned books
  changed: Book[];
  created: number;
  returned: number;
}

// Matches the library's current checkouts for one card against that card's books.
//
// - A loan is matched by its BiblioCommons checkoutId.
// - Books saved before checkoutId existed are matched once by ISBN, then carry the checkoutId.
// - A returned book that is borrowed again is reused (by ISBN) instead of duplicated.
// - A book still marked checked_out or found that the library no longer lists is returned.
//
// The user's checked_out/found choice is never changed for a loan that is still out.
export function reconcileCheckouts(
  card: Pick<LibraryCard, 'id' | 'userId'>,
  existing: Book[],
  checkouts: BookData[]
): ReconcileResult {
  const byCheckoutId = new Map<string, Book>();
  const legacyByIsbn = new Map<string, Book[]>();
  const returnedByIsbn = new Map<string, Book[]>();
  for (const book of existing) {
    if (book.checkoutId) {
      byCheckoutId.set(book.checkoutId, book);
    }
    if (!book.checkoutId && book.state !== BookState.RETURNED) {
      legacyByIsbn.set(book.isbn, [...(legacyByIsbn.get(book.isbn) ?? []), book]);
    } else if (book.state === BookState.RETURNED) {
      returnedByIsbn.set(book.isbn, [...(returnedByIsbn.get(book.isbn) ?? []), book]);
    }
  }

  const stillOut = new Set<Book>();
  const changed: Book[] = [];
  let created = 0;

  // First book in the pool for this ISBN that hasn't already been matched to a checkout
  const take = (pool: Map<string, Book[]>, isbn?: string) =>
    isbn ? pool.get(isbn)?.find((book) => !stillOut.has(book)) : undefined;

  for (const checkout of checkouts) {
    let book =
      byCheckoutId.get(checkout.checkoutId) ??
      take(legacyByIsbn, checkout.isbn) ??
      take(returnedByIsbn, checkout.isbn);

    if (book?.state === BookState.RETURNED) {
      book.state = BookState.CHECKED_OUT;
    }
    if (!book) {
      book = new Book(
        checkout.isbn ?? `checkout-${checkout.checkoutId}`,
        checkout.title,
        checkout.coverImage
      );
      book.state = BookState.CHECKED_OUT;
      book.libraryCardId = card.id;
      book.userId = card.userId;
      created++;
    }

    book.checkoutId = checkout.checkoutId;
    book.dueDate = checkout.dueDate;
    book.pictureUrl = book.pictureUrl || checkout.coverImage;
    book.author = checkout.author ?? book.author;
    stillOut.add(book);
    changed.push(book);
  }

  let returned = 0;
  for (const book of existing) {
    if (
      !stillOut.has(book) &&
      (book.state === BookState.CHECKED_OUT || book.state === BookState.FOUND)
    ) {
      book.state = BookState.RETURNED;
      changed.push(book);
      returned++;
    }
  }

  return { changed, created, returned };
}

// Fetches one card's checkouts and applies them. Throws (changing nothing) if the library
// can't be read, so a failed login never marks books returned.
export async function syncLibraryCard(
  card: LibraryCard
): Promise<Omit<ReconcileResult, 'changed'> & { checkedOut: number }> {
  const checkouts = await getCheckedOutBooks(card.number, card.pin, card.system);

  return AppDataSource.transaction(async (manager) => {
    const existing = await manager.getRepository(Book).findBy({ libraryCardId: card.id });
    const { changed, created, returned } = reconcileCheckouts(card, existing, checkouts);
    await manager.getRepository(Book).save(changed);
    return { checkedOut: checkouts.length, created, returned };
  });
}
