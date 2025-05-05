import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from './ormconfig';
import { LibraryCard } from './entities/LibraryCard';

const libraryCardRepository = AppDataSource.getRepository(LibraryCard);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    switch (req.method) {
      case 'GET': {
        const libraryCards = await libraryCardRepository.find();
        return res.json(libraryCards);
      }

      case 'POST': {
        const { number, pin } = req.body;

        if (!number || !pin) {
          return res.status(400).json({ error: 'Number and PIN are required' });
        }

        const libraryCard = libraryCardRepository.create({ number, pin });
        const savedCard = await libraryCardRepository.save(libraryCard);
        return res.status(201).json(savedCard);
      }

      case 'PUT': {
        const { id } = req.query;
        const { number, pin } = req.body;

        if (!id || !number || !pin) {
          return res.status(400).json({ error: 'ID, number, and PIN are required' });
        }

        const libraryCard = await libraryCardRepository.findOneBy({ id: id as string });

        if (!libraryCard) {
          return res.status(404).json({ error: 'Library card not found' });
        }

        libraryCard.number = number;
        libraryCard.pin = pin;

        const updatedCard = await libraryCardRepository.save(libraryCard);
        return res.json(updatedCard);
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in library cards handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
