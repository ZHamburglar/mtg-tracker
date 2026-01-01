import express, { Request, Response } from 'express';
import { Deck } from '../models/deck';
import { DeckCard } from '../models/deck-card';
import { getRedisClient, isRedisConnected } from '../config/redis';
import { logger } from '../logger';

const router = express.Router();

const DECK_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const DECK_CACHE_PREFIX = 'deck:id:';

export async function getDeckForAnalytics(deckId: number) {
	const cacheKey = `${DECK_CACHE_PREFIX}${deckId}`;

	try {
		if (isRedisConnected()) {
			try {
				const client = getRedisClient();
				const cached = await client.get(cacheKey);
				if (cached) {
					const parsed = JSON.parse(cached);
					return parsed; // { deck: { ... }, timestamp }
				}
			} catch (err) {
				logger.error('Error reading deck cache from redis for analytics', { deckId, error: err instanceof Error ? err.message : String(err) });
			}
		}

		// Fallback: compute from DB (deck + counts)
		const deck = await Deck.findById(deckId);
		if (!deck) return null;

		const counts = await DeckCard.getCardCountsByCategory(deckId);

		const payload = {
			deck: {
				...deck,
				...counts
			},
			timestamp: new Date().toISOString()
		};

		// Try to prime Redis cache for future requests
		try {
			if (isRedisConnected()) {
				const client = getRedisClient();
				await client.set(cacheKey, JSON.stringify(payload), { EX: Math.floor(DECK_CACHE_TTL / 1000) });
			}
		} catch (err) {
			logger.error('Failed to set deck cache from analytics', { deckId, error: err instanceof Error ? err.message : String(err) });
		}

		return payload;
	} catch (err) {
		logger.error('Error computing deck for analytics', { deckId, error: err instanceof Error ? err.message : String(err) });
		return null;
	}
}

// Example analytics route that uses the helper (does NOT return card lists)
router.get('/api/deck/:id/analytics', async (req: Request, res: Response) => {
	try {
		const deckId = parseInt(String(req.params.id));
		const data = await getDeckForAnalytics(deckId);
		if (!data) return res.status(404).json({ error: 'Deck not found' });

    console.log('Analytics data retrieved for deck:', deckId, data);

		// Return only the summary useful for analytics (no card lists)
		res.status(200).json({ deck: data.deck, timestamp: data.timestamp });
	} catch (err) {
		logger.error('Analytics route error', { error: err instanceof Error ? err.message : String(err) });
		res.status(500).json({ error: 'Failed to get analytics data' });
	}
});

export { router as analyticsRouter };
