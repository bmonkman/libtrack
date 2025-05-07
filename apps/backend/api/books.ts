import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from './ormconfig';
import { Book, BookState } from './entities/Book';
import { In } from 'typeorm';
import { handleCors } from './utils/utils';
import { requireAuth } from './utils/auth';

const bookRepository = AppDataSource.getRepository(Book);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Require authentication for all requests
    const authUser = await requireAuth(req, res);
    if (!authUser) {
      return; // requireAuth has already sent the response
    }

    switch (req.method) {
      case 'GET': {
        const states = Array.isArray(req.query.states)
          ? (req.query.states as BookState[])
          : req.query.states
            ? [req.query.states as BookState]
            : undefined;

        // Filter books by authenticated user
        const books = await bookRepository.find({
          where: {
            userId: authUser.id,
            ...(states ? { state: In(states) } : {}),
          },
          order: { title: 'ASC' },
          relations: ['libraryCard'],
        });
        return res.json(books);
      }

      case 'POST': {
        const { isbn, title, pictureUrl } = req.body;
        if (!isbn || !title) {
          return res.status(400).json({ error: 'ISBN and title are required' });
        }

        const book = new Book(isbn, title, pictureUrl);
        book.userId = authUser.id;
        const savedBook = await bookRepository.save(book);
        return res.status(201).json(savedBook);
      }

      case 'PUT': {
        const updates = req.body as Array<{
          id: string;
          isbn: string;
          state: BookState;
          dueDate?: string;
          libraryCardId?: string;
        }>;

        const updatedBooks = await Promise.all(
          updates.map(async (update) => {
            // Ensure the book belongs to the authenticated user
            const book = await bookRepository.findOne({
              where: { id: update.id, userId: authUser.id },
            });

            if (book) {
              book.state = update.state;
              book.dueDate = update.dueDate ? new Date(update.dueDate) : undefined;
              if (update.libraryCardId) {
                book.libraryCardId = update.libraryCardId;
              }
              return bookRepository.save(book);
            }
            return null;
          })
        );
        return res.json(updatedBooks.filter(Boolean));
      }

      case 'DELETE': {
        const id = req.url?.split('/').pop();
        if (!id) {
          return res.status(400).json({ error: 'Book ID is required' });
        }

        // Ensure the book belongs to the authenticated user
        const book = await bookRepository.findOne({
          where: { id, userId: authUser.id },
        });

        if (!book) {
          return res.status(404).json({ error: 'Book not found or access denied' });
        }

        await bookRepository.remove(book);
        return res.status(204).end();
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in books handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
