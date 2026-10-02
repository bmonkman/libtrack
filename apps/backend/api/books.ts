import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from '../lib/ormconfig';
import { Book, BookState } from '../lib/entities/Book';
import { In, LessThan } from 'typeorm';
import { handleCors } from '../lib/utils/utils';
import { requireAuth } from '../lib/utils/auth';
import { todayInLibraryTimeZone } from '../lib/utils/dates';

const isBookState = (value: unknown): value is BookState =>
  Object.values(BookState).includes(value as BookState);

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
        // ?states=checked_out,found  and/or  ?overdue=true (not returned, due before today)
        const states = String(req.query.states ?? '')
          .split(',')
          .filter((state): state is BookState => isBookState(state));
        const overdueOnly = req.query.overdue === 'true';

        const books = await bookRepository.find({
          where: {
            userId: authUser.id,
            ...(overdueOnly
              ? {
                  state: In(states.length ? states : [BookState.CHECKED_OUT, BookState.FOUND]),
                  dueDate: LessThan(todayInLibraryTimeZone()),
                }
              : states.length
                ? { state: In(states) }
                : {}),
          },
          order: overdueOnly ? { dueDate: 'ASC', title: 'ASC' } : { title: 'ASC' },
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
        const { updates } = req.body;

        // Validate that updates is an array
        if (!Array.isArray(updates)) {
          return res.status(400).json({ error: 'Updates must be an array' });
        }

        const typedUpdates = updates as Array<{ id: string; state: BookState }>;
        if (typedUpdates.some((update) => !update?.id || !isBookState(update.state))) {
          return res.status(400).json({ error: 'Each update needs an id and a valid state' });
        }

        const updatedBooks = await Promise.all(
          typedUpdates.map(async (update) => {
            // Ensure the book belongs to the authenticated user
            const book = await bookRepository.findOne({
              where: { id: update.id, userId: authUser.id },
            });
            if (!book) return null;

            book.state = update.state;
            return bookRepository.save(book);
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
