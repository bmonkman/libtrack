import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from './ormconfig';
import { Book, BookState } from './entities/Book';
import { In } from 'typeorm';

const bookRepository = AppDataSource.getRepository(Book);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    switch (req.method) {
      case 'GET': {
        const states = Array.isArray(req.query.states)
          ? (req.query.states as BookState[])
          : req.query.states
            ? [req.query.states as BookState]
            : undefined;

        const books = await bookRepository.find({
          where: states ? { state: In(states) } : undefined,
        });
        return res.json(books);
      }

      case 'PUT': {
        const updates = req.body as Array<{ id: string; isbn: string; state: BookState }>;
        const updatedBooks = await Promise.all(
          updates.map(async (update) => {
            const book = await bookRepository.findOneBy({ id: update.id });
            if (book) {
              book.state = update.state;
              return bookRepository.save(book);
            }
            return null;
          })
        );
        return res.json(updatedBooks.filter(Boolean));
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in books handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
