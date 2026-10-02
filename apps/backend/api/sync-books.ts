import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from '../lib/ormconfig';
import { LibraryCard } from '../lib/entities/LibraryCard';
import { syncLibraryCard } from '../lib/utils/book-sync';

// This endpoint is designed to be called by a Vercel Cron Job
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends CRON_SECRET as a bearer token. Without the check anyone could trigger a
  // login to every stored library card.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const libraryCards = await AppDataSource.getRepository(LibraryCard).find();
    console.log(`[Cron Job] Syncing ${libraryCards.length} library cards`);

    // In parallel: each card is several sequential requests to BiblioCommons, and the function
    // has a short time limit. A failure on one card leaves that card's books untouched.
    const outcomes = await Promise.allSettled(libraryCards.map((card) => syncLibraryCard(card)));

    const results = libraryCards.map((card, i) => {
      const outcome = outcomes[i];
      if (outcome.status === 'fulfilled') {
        return { libraryCardId: card.id, ...outcome.value };
      }
      console.error(`[Cron Job] Library card ${card.id} failed:`, String(outcome.reason));
      return { libraryCardId: card.id, error: String(outcome.reason) };
    });

    const failed = results.filter((result) => 'error' in result).length;
    console.log(`[Cron Job] Done: ${libraryCards.length - failed} cards synced, ${failed} failed`);
    // Any card failing returns 500 so the run shows as failed in Vercel's cron log
    return res.status(failed ? 500 : 200).json({ success: failed === 0, results });
  } catch (error) {
    console.error('[Cron Job] Error in daily book sync:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during book sync',
    });
  }
}
