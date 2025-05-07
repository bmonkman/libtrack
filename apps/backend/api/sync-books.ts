import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from './ormconfig';
import { Book, BookState } from './entities/Book';
import { LibraryCard } from './entities/LibraryCard';
import { getCheckedOutBooks } from './utils/library-sync';
import { handleCors } from './utils/utils';

// This endpoint is designed to be called by a Vercel Cron Job
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // Security check: Only allow this endpoint to be triggered by Vercel Cron
  //   const authHeader = req.headers.authorization;
  //   const cronSecret = process.env.CRON_SECRET;

  //   // Verify this is a legitimate cron request
  //   if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
  //     return res.status(401).json({ error: 'Unauthorized' });
  //   }

  try {
    // Initialize the database connection if not already initialized
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    console.log('[Cron Job] Starting daily book sync task');

    // Get all library cards to potentially fetch data from multiple library systems
    const libraryCardRepository = AppDataSource.getRepository(LibraryCard);
    const bookRepository = AppDataSource.getRepository(Book);

    const libraryCards = await libraryCardRepository.find({});

    console.log(`[Cron Job] Processing ${libraryCards.length} library cards`);

    // Track the results of our sync operation
    const syncResults = {
      processedCards: libraryCards.length,
      updatedBooks: 0,
      errors: [] as string[],
    };

    // For each library card, we will fetch the checked-out books
    for (const card of libraryCards) {
      console.log(`[Cron Job] Processing card ${card.id}`);
      try {
        // Skip if no card number or PIN
        if (!card.number || !card.pin) {
          syncResults.errors.push(`Library card ${card.id} is missing card number or PIN`);
          continue;
        }

        // Fetch books from the library system based on the card
        const checkedOutBooks = await getCheckedOutBooks(card.number, card.pin, card.system);

        console.log(`[Cron Job] Retrieved ${checkedOutBooks.length} books for card ${card.id}`);

        // Process each book - update existing or create new ones
        for (const bookData of checkedOutBooks) {
          // Check if book already exists in our database by ISBN
          let book = bookData.isbn
            ? await bookRepository.findOne({
                where: { isbn: bookData.isbn },
              })
            : null;

          if (!book) {
            // Create new book if not found
            const isbn =
              bookData.isbn ||
              `placeholder-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            book = new Book(isbn, bookData.title, bookData.coverImage);
            book.title = bookData.title;
            book.state = BookState.CHECKED_OUT;
            book.libraryCardId = card.id;
            book.userId = card.userId;
          }

          book.dueDate = bookData.dueDate;

          // If the book is already overdue, mark it accordingly
          if (book.dueDate < new Date()) {
            book.state = BookState.OVERDUE;
          }

          await bookRepository.save(book);
          syncResults.updatedBooks++;
        }
      } catch (error) {
        console.error(`[Cron Job] Error processing library card ${card.id}:`, error);
        syncResults.errors.push(`Error processing library card ${card.id}: ${error}`);
      }
    }

    console.log('[Cron Job] Book sync completed successfully');
    return res.status(200).json({
      success: true,
      message: 'Daily book sync completed',
      results: syncResults,
    });
  } catch (error) {
    console.error('[Cron Job] Error in daily book sync:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during book sync',
    });
  }
}
