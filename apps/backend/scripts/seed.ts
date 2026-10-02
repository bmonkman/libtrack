// Fills a local database with sample cards and books so the UI has something to show.
//
//   npm run seed                 seeds every user that has no library cards yet
//   npm run seed -- --user <id>  seeds one user (adds to whatever they already have)
//
// Users can't be seeded: signing in needs a real passkey. Register in the browser (or let the
// Playwright fixture do it), then seed.
import { AppDataSource } from '../lib/ormconfig';
import { Book, BookState } from '../lib/entities/Book';
import { LibraryCard, LibrarySystem } from '../lib/entities/LibraryCard';
import { User } from '../lib/entities/User';
import { todayInLibraryTimeZone } from '../lib/utils/dates';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// [title, author, isbn, state, due in N days from today]
const SAMPLE_BOOKS: [string, string, string, BookState, number][] = [
  ['The Very Hungry Caterpillar', 'Eric Carle', '9780399226908', BookState.CHECKED_OUT, -3],
  ['Where the Wild Things Are', 'Maurice Sendak', '9780060254926', BookState.FOUND, -1],
  ['Goodnight Moon', 'Margaret Wise Brown', '9780064430173', BookState.CHECKED_OUT, 0],
  ['The Gruffalo', 'Julia Donaldson', '9780142403877', BookState.CHECKED_OUT, 2],
  ['Green Eggs and Ham', 'Dr. Seuss', '9780394800165', BookState.FOUND, 4],
  ['The Cat in the Hat', 'Dr. Seuss', '9780394800011', BookState.CHECKED_OUT, 6],
  [
    'Chicka Chicka Boom Boom',
    'Bill Martin Jr. and others',
    '9781442450707',
    BookState.CHECKED_OUT,
    9,
  ],
  [
    'Brown Bear, Brown Bear, What Do You See?',
    'Bill Martin Jr.',
    '9780805047905',
    BookState.FOUND,
    12,
  ],
  ['Corduroy', 'Don Freeman', '9780140501735', BookState.CHECKED_OUT, 14],
  ['Make Way for Ducklings', 'Robert McCloskey', '9780140564341', BookState.CHECKED_OUT, 16],
  ['The Snowy Day', 'Ezra Jack Keats', '9780140501827', BookState.FOUND, 18],
  ['Harold and the Purple Crayon', 'Crockett Johnson', '9780064430227', BookState.CHECKED_OUT, 20],
  ['Guess How Much I Love You', 'Sam McBratney', '9780763642648', BookState.CHECKED_OUT, 21],
  ['Owl Moon', 'Jane Yolen', '9780399214578', BookState.FOUND, 21],
  ["Charlotte's Web", 'E. B. White', '9780064400558', BookState.CHECKED_OUT, 23],
  ['Frog and Toad Are Friends', 'Arnold Lobel', '9780064440202', BookState.CHECKED_OUT, 25],
  ['Matilda', 'Roald Dahl', '9780142410370', BookState.RETURNED, -20],
  ['The Giving Tree', 'Shel Silverstein', '9780060256654', BookState.RETURNED, -30],
  ['Curious George', 'H. A. Rey', '9780395150238', BookState.RETURNED, -40],
  ['Madeline', 'Ludwig Bemelmans', '9780140501988', BookState.RETURNED, -45],
];

// Books the library is charging for as lost (still in the house), in cents
const LOST_CHARGES: Record<string, number> = { 'Harold and the Purple Crayon': 700 };

async function seedUser(user: User): Promise<void> {
  const today = todayInLibraryTimeZone();
  const cards = await AppDataSource.getRepository(LibraryCard).save([
    Object.assign(new LibraryCard('29000000000001', '0000', 'Sample Card A', LibrarySystem.NWPL), {
      userId: user.id,
    }),
    Object.assign(new LibraryCard('29000000000002', '0000', 'Sample Card B', LibrarySystem.NWPL), {
      userId: user.id,
    }),
  ]);

  const books = SAMPLE_BOOKS.map(([title, author, isbn, state, dueInDays], i) =>
    Object.assign(new Book(isbn, title), {
      author,
      state,
      dueDate: addDays(today, dueInDays),
      checkoutId: `seed-${user.id.slice(0, 8)}-${i}`,
      lostChargeCents: LOST_CHARGES[title] ?? null,
      libraryCardId: cards[i % cards.length].id,
      userId: user.id,
    })
  );
  await AppDataSource.getRepository(Book).save(books);

  // Each card owes what its lost books are charged
  for (const card of cards) {
    const balanceCents = books
      .filter((book) => book.libraryCardId === card.id)
      .reduce((sum, book) => sum + (book.lostChargeCents ?? 0), 0);
    await AppDataSource.getRepository(LibraryCard).update(card.id, {
      balanceCents,
      balanceUpdatedAt: new Date(),
    });
  }
  console.log(`Seeded ${user.name} (${user.id}): ${cards.length} cards, ${books.length} books`);
}

async function main() {
  const userFlag = process.argv.indexOf('--user');
  const userId = userFlag >= 0 ? process.argv[userFlag + 1] : undefined;

  await AppDataSource.initialize();
  try {
    const users = userId
      ? await AppDataSource.getRepository(User).findBy({ id: userId })
      : await AppDataSource.getRepository(User)
          .createQueryBuilder('user')
          .leftJoin('user.libraryCards', 'card')
          .where('card.id IS NULL')
          .getMany();

    if (users.length === 0) {
      console.log(userId ? `No user ${userId}` : 'No users without cards to seed');
    }
    for (const user of users) {
      await seedUser(user);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
