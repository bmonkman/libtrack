import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from './ormconfig';
import { LibraryCard } from './entities/LibraryCard';
import { handleCors } from './utils/utils';
import { requireAuth } from './utils/auth';

const libraryCardRepository = AppDataSource.getRepository(LibraryCard);

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
        // Filter library cards by authenticated user
        const libraryCards = await libraryCardRepository.find({
          where: { userId: authUser.id },
          order: { displayName: 'ASC' },
        });

        // Don't expose PIN in response
        const sanitizedCards = libraryCards.map(({ pin, ...card }) => card);
        return res.json(sanitizedCards);
      }

      case 'POST': {
        const { number, pin, displayName, system } = req.body;

        if (!number || !pin || !displayName) {
          return res.status(400).json({ error: 'Number, PIN, and display name are required' });
        }

        const libraryCard = libraryCardRepository.create({
          number,
          pin,
          displayName,
          system,
          userId: authUser.id,
        });

        const savedCard = await libraryCardRepository.save(libraryCard);

        // Don't expose PIN in response
        const { pin: _, ...sanitizedCard } = savedCard;
        return res.status(201).json(sanitizedCard);
      }

      case 'PUT': {
        const id = req.url?.split('/').pop();
        const { number, pin, displayName, system } = req.body;

        if (!id || !number || !displayName || !system) {
          return res
            .status(400)
            .json({ error: 'ID, number, display name, and system are required' });
        }

        // Ensure the library card belongs to the authenticated user
        const libraryCard = await libraryCardRepository.findOne({
          where: { id, userId: authUser.id },
        });

        if (!libraryCard) {
          return res.status(404).json({ error: 'Library card not found or access denied' });
        }

        libraryCard.number = number;
        if (pin) {
          libraryCard.pin = pin;
        }
        libraryCard.displayName = displayName;
        libraryCard.system = system;

        const updatedCard = await libraryCardRepository.save(libraryCard);

        // Don't expose PIN in response
        const { pin: _, ...sanitizedCard } = updatedCard;
        return res.json(sanitizedCard);
      }

      case 'DELETE': {
        const id = req.url?.split('/').pop();
        if (!id) {
          return res.status(400).json({ error: 'Library card ID is required' });
        }

        // Ensure the library card belongs to the authenticated user
        const libraryCard = await libraryCardRepository.findOne({
          where: { id, userId: authUser.id },
        });

        if (!libraryCard) {
          return res.status(404).json({ error: 'Library card not found or access denied' });
        }

        await libraryCardRepository.remove(libraryCard);
        return res.status(204).end();
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in library cards handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
