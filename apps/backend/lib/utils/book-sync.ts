import { AppDataSource } from '../ormconfig';
import { Book, BookState } from '../entities/Book';
import { LibraryCard } from '../entities/LibraryCard';
import { BookData, getLibraryAccount, LibraryFine } from './library-sync';

export interface ReconcileResult {
  // Every book whose row needs saving: new loans, updated loans, newly returned books, and books
  // whose lost charge appeared, changed or cleared
  changed: Book[];
  created: number;
  returned: number;
  lost: number;
}

// Matches the library's current checkouts for one card against that card's books.
//
// - A loan is matched by its BiblioCommons checkoutId.
// - Books saved before checkoutId existed are matched once by ISBN, then carry the checkoutId.
// - A returned book that is borrowed again is reused (by ISBN) instead of duplicated.
// - A book the library has billed as lost (an unpaid "Lost" fine) keeps its state and gets
//   lostChargeCents: the library stopped listing it as a loan, but it's still in the house.
//   Matched by the library's title id (metadataId), else by exact title.
// - Any other book still marked checked_out or found that the library no longer lists is returned.
//
// The user's checked_out/found choice is never changed for a loan that is still out.
export function reconcileCheckouts(
  card: Pick<LibraryCard, 'id' | 'userId'>,
  existing: Book[],
  checkouts: BookData[],
  fines: LibraryFine[] = []
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
  const changed = new Set<Book>();
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
    book.metadataId = checkout.metadataId ?? book.metadataId;
    book.dueDate = checkout.dueDate;
    book.pictureUrl = book.pictureUrl || checkout.coverImage;
    book.author = checkout.author ?? book.author;
    book.lostChargeCents = null; // a loan that's still out isn't lost
    stillOut.add(book);
    changed.add(book);
  }

  const lostCharges = matchLostCharges(
    existing.filter((book) => !stillOut.has(book)),
    fines
  );

  let returned = 0;
  for (const book of existing.filter((book) => !stillOut.has(book))) {
    const charge = lostCharges.get(book) ?? null;
    if ((book.lostChargeCents ?? null) !== charge) {
      book.lostChargeCents = charge;
      changed.add(book);
    }
    if (charge !== null) {
      // Billed as lost means the library never got it back
      if (book.state === BookState.RETURNED) {
        book.state = BookState.CHECKED_OUT;
        changed.add(book);
      }
    } else if (book.state === BookState.CHECKED_OUT || book.state === BookState.FOUND) {
      book.state = BookState.RETURNED;
      changed.add(book);
      returned++;
    }
  }

  return { changed: [...changed], created, returned, lost: lostCharges.size };
}

const normalizeTitle = (title?: string) =>
  title
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Each unpaid "Lost" fine goes to at most one book, preferring books not already returned
function matchLostCharges(books: Book[], fines: LibraryFine[]): Map<Book, number> {
  const charges = new Map<Book, number>();
  const candidates = [...books].sort(
    (a, b) => Number(a.state === BookState.RETURNED) - Number(b.state === BookState.RETURNED)
  );
  for (const fine of fines) {
    if (fine.description !== 'Lost' || fine.status !== 'UNPAID' || fine.amountCents <= 0) continue;
    const open = candidates.filter((book) => !charges.has(book));
    const book =
      open.find((book) => fine.metadataId && book.metadataId === fine.metadataId) ??
      open.find((book) => fine.title && normalizeTitle(book.title) === normalizeTitle(fine.title));
    if (book) charges.set(book, fine.amountCents);
  }
  return charges;
}

// Fetches one card's checkouts and fines and applies them. Throws (changing nothing) if the
// library can't be read, so a failed login never marks books returned.
export async function syncLibraryCard(
  card: LibraryCard
): Promise<Omit<ReconcileResult, 'changed'> & { checkedOut: number; balanceCents: number }> {
  const { checkouts, fines } = await getLibraryAccount(card.number, card.pin, card.system);
  const balanceCents = fines.reduce((sum, fine) => sum + fine.amountCents, 0);

  return AppDataSource.transaction(async (manager) => {
    const existing = await manager.getRepository(Book).findBy({ libraryCardId: card.id });
    const { changed, created, returned, lost } = reconcileCheckouts(
      card,
      existing,
      checkouts,
      fines
    );
    await manager.getRepository(Book).save(changed);
    await manager
      .getRepository(LibraryCard)
      .update(card.id, { balanceCents, balanceUpdatedAt: new Date() });
    return { checkedOut: checkouts.length, created, returned, lost, balanceCents };
  });
}
