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

		// Return base deck info only - counts and analytics are computed in the route handler now
		const payload = {
			deck: {
				...deck
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

		// Compute analytics now (so cached payloads still get fresh analytics)
		const deckCards = await DeckCard.findByDeck(deckId);
		const mana_cost_tally: Record<string, number> = {};
		const cmc_tally: Record<string, number> = {};
		const rarity_tally: Record<string, number> = {};
		let totalCmcSum = 0;
		let totalQtySum = 0;

		let total_cards = 0;
		let mainboard_count = 0;
		let sideboard_count = 0;
		let commander_count = 0;

		for (const dc of deckCards) {
			const qty = dc.quantity || 1;
			const typeLine = dc.card?.type_line || '';

			// Counts (all cards count, including Lands) — exclude commanders from total_cards
			if (dc.category !== 'commander') {
				total_cards += qty;
				// Rarity tally uses the same basis as total_cards (exclude commanders)
				const rarity = (dc.card?.rarity || 'unknown').toString();
				rarity_tally[rarity] = (rarity_tally[rarity] || 0) + qty;
			}
			switch (dc.category) {
				case 'mainboard':
					mainboard_count += qty;
					break;
				case 'sideboard':
					sideboard_count += qty;
					break;
				case 'commander':
					commander_count += qty;
					break;
			}

			// Skip Lands for mana/CMC computations
			if (/\bLand\b/i.test(typeLine)) continue;

			// Mana symbols
			const manaCost = dc.card?.mana_cost;
			if (manaCost) {
				const symbols = manaCost.match(/\{[^}]+\}/g);
				if (symbols) {
					for (const s of symbols) {
						mana_cost_tally[s] = (mana_cost_tally[s] || 0) + qty;
					}
				}
			}

			// CMC
			const cmcVal = dc.card?.cmc;
			const cmcNum = cmcVal !== undefined && cmcVal !== null ? Number(cmcVal) : NaN;
			if (!isNaN(cmcNum)) {
				const key = String(cmcNum);
				cmc_tally[key] = (cmc_tally[key] || 0) + qty;
				totalCmcSum += cmcNum * qty;
				totalQtySum += qty;
			}
		}

		const average_cmc = totalQtySum > 0 ? parseFloat((totalCmcSum / totalQtySum).toFixed(2)) : 0;

		// Return only the summary useful for analytics (no card lists)
		res.status(200).json({ deck: { ...data.deck, total_cards, mainboard_count, sideboard_count, commander_count, rarity_tally, mana_cost_tally, cmc_tally, average_cmc }, timestamp: data.timestamp });
	} catch (err) {
		logger.error('Analytics route error', { error: err instanceof Error ? err.message : String(err) });
		res.status(500).json({ error: 'Failed to get analytics data' });
	}
});

export { router as analyticsRouter };
