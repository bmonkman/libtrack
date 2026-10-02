import { getLibraryAccount } from '../lib/utils/library-sync';

// Command line arguments
const cardNumber = process.argv[2];
const pin = process.argv[3];
const librarySystem = process.argv[4] || 'nwpl';

if (!cardNumber || !pin) {
  console.log('Usage: ts-node sync-books-cli.ts <library-card-number> <pin> [library-system]');
  process.exit(1);
}

async function main() {
  try {
    console.log(`Fetching card ${cardNumber} from ${librarySystem}...`);
    const { checkouts: books, fines } = await getLibraryAccount(cardNumber, pin, librarySystem);

    console.log(`\nRetrieved ${books.length} books:\n`);

    books.forEach((book, index) => {
      console.log(`${index + 1}. ${book.title}`);
      console.log(`   ISBN: ${book.isbn || 'N/A'}`);
      console.log(`   Due Date: ${book.dueDate}`);
      console.log(`   Cover Image: ${book.coverImage || 'N/A'}`);
      console.log('');
    });

    console.log(`${fines.length} fines/credits:`);
    for (const fine of fines) {
      console.log(
        `   ${fine.status} ${fine.description} $${(fine.amountCents / 100).toFixed(2)} ${fine.title ?? ''}`
      );
    }
  } catch (error) {
    console.error('Error syncing books:', error);
  }
}

main().catch(console.error);
