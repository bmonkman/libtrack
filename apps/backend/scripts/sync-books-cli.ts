import { getCheckedOutBooks, BookData } from './utils/library-sync';

// Command line arguments
const cardNumber = process.argv[2];
const pin = process.argv[3];
const librarySystem = process.argv[4] || 'NWPL';

if (!cardNumber || !pin) {
  console.log('Usage: ts-node sync-books-cli.ts <library-card-number> <pin> [library-system]');
  process.exit(1);
}

async function main() {
  try {
    console.log(`Fetching books for card ${cardNumber} from ${librarySystem}...`);
    const books = await getCheckedOutBooks(cardNumber, pin, librarySystem);

    console.log(`\nRetrieved ${books.length} books:\n`);

    books.forEach((book, index) => {
      console.log(`${index + 1}. ${book.title}`);
      console.log(`   ISBN: ${book.isbn || 'N/A'}`);
      console.log(`   Due Date: ${book.dueDate.toLocaleDateString()}`);
      console.log(`   Cover Image: ${book.coverImage || 'N/A'}`);
      console.log('');
    });

    console.log('Book sync completed successfully');
  } catch (error) {
    console.error('Error syncing books:', error);
  }
}

main().catch(console.error);
