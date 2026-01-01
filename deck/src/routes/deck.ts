import express, { Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { validateRequest, currentUser, requireAuth } from '@mtg-tracker/common';
import { Deck } from '../models/deck';
import { DeckCard } from '../models/deck-card';
import { clearCombosCache } from './combos';
import { getRedisClient, isRedisConnected } from '../config/redis';
import { logger } from '../logger';

const router = express.Router();

// Deck cache (redis-backed with in-memory fallback map)
const DECK_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const DECK_CACHE_PREFIX = 'deck:id:';
const deckCacheMap: Map<string, { data: any; timestamp: number }> = new Map();

// Recent Decks cache (in-memory only)
const RECENT_DECK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let recentDecksCache: { data: any; timestamp: number } | null = null;

export async function clearRecentDeckCache() {
  recentDecksCache = null;
  logger.info('Cleared recent decks cache (memory)');
}

export async function clearDeckCache(deckId?: number) {
  const key = deckId ? `${DECK_CACHE_PREFIX}${deckId}` : undefined;
  try {
    if (isRedisConnected() && key) {
      const client = getRedisClient();
      await client.del(key);
      logger.info('Cleared deck cache (redis)', { deckId });
    }
  } catch (err) {
    logger.error('Failed to clear deck cache in redis', { error: err instanceof Error ? err.message : String(err), deckId });
  }

  if (!key) {
    deckCacheMap.clear();
    logger.info('Cleared all deck cache (memory)');
    return;
  }

  if (deckCacheMap.has(key)) {
    deckCacheMap.delete(key);
    logger.info('Cleared deck cache (memory)', { deckId });
  }
}

/**
 * GET /api/deck/recent
 * Get recently created decks (public, no auth required)
 */
router.get(
  '/api/deck/recent',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const cacheEntry = recentDecksCache;
      if (cacheEntry && (Date.now() - cacheEntry.timestamp) < RECENT_DECK_CACHE_TTL) {
        logger.info('Recent decks cache hit (memory)');
        return res.status(200).json(cacheEntry.data);
      }

      // Retrieve recent public decks
      const decks = await Deck.findRecent(limit);

      // Add card counts to each deck
      const decksWithCounts = await Promise.all(
        decks.map(async (deck) => {
          const counts = await DeckCard.getCardCountsByCategory(deck.id);
          return {
            ...deck,
            ...counts
          };
        })
      );

      const payload = {
        decks: decksWithCounts,
        timestamp: new Date().toISOString()
      };

      // store in memory cache
      recentDecksCache = { data: payload, timestamp: Date.now() };

      res.status(200).json(payload);
    } catch (error) {
      logger.error('Error fetching recent decks:', error);
      res.status(500).json({
        error: 'Failed to fetch recent decks',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/deck
 * Get all decks for the authenticated user
 */
router.get(
  '/api/deck',
  currentUser,
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer'),
    query('format')
      .optional()
      .isString()
      .withMessage('Format must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const format = req.query.format as string | undefined;

      const decks = await Deck.findByUser(userId, {
        limit,
        offset,
        ...(format && { format })
      });

      // Add card counts to each deck
      const decksWithCounts = await Promise.all(
        decks.map(async (deck) => {
          const counts = await DeckCard.getCardCountsByCategory(deck.id);
          return {
            ...deck,
            ...counts
          };
        })
      );

      res.status(200).json({
        decks: decksWithCounts,
        limit,
        offset,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching decks:', error);
      res.status(500).json({
        error: 'Failed to fetch decks',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/deck/:id
 * Get a specific deck (public access for viewing)
 */
router.get(
  '/api/deck/:id',
  currentUser,
  async (req: Request, res: Response) => {
    try {
      const deckId = parseInt(String(req.params.id));

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      // Try cache (redis or memory) before computing
      const cacheKey = `${DECK_CACHE_PREFIX}${deckId}`;
      try {
        if (isRedisConnected()) {
          const client = getRedisClient();
          const cached = await client.get(cacheKey);
          if (cached) {
            logger.info('Deck cache hit (redis)', { deckId });
            const parsed = JSON.parse(cached);
            return res.status(200).json(parsed);
          }
        } else if (deckCacheMap.has(cacheKey)) {
          const entry = deckCacheMap.get(cacheKey)!;
          if ((Date.now() - entry.timestamp) < DECK_CACHE_TTL) {
            logger.info('Deck cache hit (memory)', { deckId });
            return res.status(200).json(entry.data);
          } else {
            deckCacheMap.delete(cacheKey);
          }
        }
      } catch (err) {
        logger.error('Error reading deck cache', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Add card counts
      const counts = await DeckCard.getCardCountsByCategory(deckId);

      const responsePayload = {
        deck: {
          ...deck,
          ...counts
        },
        timestamp: new Date().toISOString()
      };

      // Store in cache (redis or memory)
      try {
        if (isRedisConnected()) {
          const client = getRedisClient();
          await client.set(cacheKey, JSON.stringify(responsePayload), { EX: Math.floor(DECK_CACHE_TTL / 1000) });
          logger.info('Deck cache set (redis)', { deckId });
        } else {
          deckCacheMap.set(cacheKey, { data: responsePayload, timestamp: Date.now() });
          logger.info('Deck cache set (memory)', { deckId });
        }
      } catch (err) {
        logger.error('Error setting deck cache', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      res.status(200).json(responsePayload);
    } catch (error) {
      logger.error('Error fetching deck:', error);
      res.status(500).json({
        error: 'Failed to fetch deck',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deck
 * Create a new deck
 */
router.post(
  '/api/deck',
  currentUser,
  requireAuth,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Deck name is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Deck name must be between 1 and 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    body('format')
      .notEmpty()
      .withMessage('Format is required')
      .isIn(['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'pauper', 'historic', 'brawl', 'other'])
      .withMessage('Invalid format'),
    body('visibility')
      .optional()
      .isIn(['public', 'private', 'unlisted'])
      .withMessage('Invalid visibility')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const { name, description, format, visibility } = req.body;

      const deck = await Deck.create({
        user_id: userId,
        name,
        description: description || null,
        format,
        visibility
      });

      logger.info(`Deck created: ${deck.id} by user ${userId}`);

      // Clear any stale cache for this deck (newly created)
      try {
        await clearDeckCache(deck.id);
      } catch (err) {
        logger.error('Failed to clear deck cache after create', { error: err instanceof Error ? err.message : String(err), deckId: deck.id });
      }

      // Clear recent decks cache
      if (deck.visibility === 'public') {
        try {
          await clearRecentDeckCache();
        } catch (err) {
          logger.error('Failed to clear recent decks cache after create', { error: err instanceof Error ? err.message : String(err), deckId: deck.id });
        }
      }
      

      res.status(201).json({
        deck,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating deck:', error);
      res.status(500).json({
        error: 'Failed to create deck',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * PUT /api/deck/:id
 * Update a deck
 */
router.put(
  '/api/deck/:id',
  currentUser,
  requireAuth,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Deck name must be between 1 and 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    body('format')
      .optional()
      .isIn(['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'pauper', 'historic', 'brawl', 'other'])
      .withMessage('Invalid format'),
    body('visibility')
      .optional()
      .isIn(['public', 'private', 'unlisted'])
      .withMessage('Invalid visibility')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      // Verify ownership
      if (deck.user_id !== userId) {
        return res.status(403).json({
          error: 'Unauthorized to update this deck'
        });
      }

      const { name, description, format, visibility } = req.body;

      const updatedDeck = await Deck.update(deckId, {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(format && { format }),
        ...(visibility !== undefined && { visibility })
      });

      logger.info(`Deck updated: ${deckId} by user ${userId}`);

      // Invalidate combos cache — deck metadata may affect combos
      try {
        await clearCombosCache(deckId);
      } catch (err) {
        logger.error('Failed to clear combos cache after deck update', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Invalidate deck cache
      try {
        await clearDeckCache(deckId);
      } catch (err) {
        logger.error('Failed to clear deck cache after deck update', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Clear recent decks cache
      if (visibility === 'public') {
        try {
          await clearRecentDeckCache();
        } catch (err) {
          logger.error('Failed to clear recent decks cache after create', { error: err instanceof Error ? err.message : String(err), deckId: deck.id });
        }
      }

      res.status(200).json({
        deck: updatedDeck,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating deck:', error);
      res.status(500).json({
        error: 'Failed to update deck',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/deck/:id
 * Delete a deck
 */
router.delete(
  '/api/deck/:id',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      // Verify ownership
      if (deck.user_id !== userId) {
        return res.status(403).json({
          error: 'Unauthorized to delete this deck'
        });
      }

      await Deck.delete(deckId);

      logger.info(`Deck deleted: ${deckId} by user ${userId}`);

      // Invalidate combos cache for deleted deck
      try {
        await clearCombosCache(deckId);
      } catch (err) {
        logger.error('Failed to clear combos cache after deck deletion', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Invalidate deck cache for deleted deck
      try {
        await clearDeckCache(deckId);
      } catch (err) {
        logger.error('Failed to clear deck cache after deck deletion', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Clear recent decks cache
      if (deck.visibility === 'public') {
        try {
          await clearRecentDeckCache();
        } catch (err) {
          logger.error('Failed to clear recent decks cache after create', { error: err instanceof Error ? err.message : String(err), deckId: deck.id });
        }
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting deck:', error);
      res.status(500).json({
        error: 'Failed to delete deck',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/deck/:id/cards
 * Get all cards in a deck (public access for viewing)
 */
router.get(
  '/api/deck/:id/cards',
  currentUser,
  async (req: Request, res: Response) => {
    try {
      const deckId = parseInt(String(req.params.id));

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      const cards = await DeckCard.findByDeck(deckId);

      res.status(200).json({
        cards,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching deck cards:', error);
      res.status(500).json({
        error: 'Failed to fetch deck cards',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deck/:id/cards
 * Add a card to a deck
 */
router.post(
  '/api/deck/:id/cards',
  currentUser,
  requireAuth,
  [
    body('card_id')
      .isUUID()
      .withMessage('Valid card_id is required'),
    body('quantity')
      .isInt({ min: 1, max: 999 })
      .withMessage('Quantity must be between 1 and 999'),
    body('category')
      .isIn(['mainboard', 'sideboard', 'commander'])
      .withMessage('Category must be mainboard, sideboard, or commander'),
    body('is_commander')
      .optional()
      .isBoolean()
      .withMessage('is_commander must be a boolean'),
    body('oracle_id')
      .optional()
      .isUUID()
      .withMessage('Invalid oracle_id')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));
      const { card_id, quantity, category, is_commander, oracle_id } = req.body;

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      // Verify ownership
      if (deck.user_id !== userId) {
        return res.status(403).json({
          error: 'Unauthorized to modify this deck'
        });
      }

      // Check if card already exists in this category
      const existingCard = await DeckCard.findByDeckAndCard(deckId, card_id, category);

      let deckCard;
      if (existingCard) {
        // Update quantity if card already exists
        deckCard = await DeckCard.updateQuantity(
          deckId,
          card_id,
          category,
          existingCard.quantity + quantity
        );
      } else {
        // Add new card
        deckCard = await DeckCard.create({
          deck_id: deckId,
          card_id,
          quantity,
          category,
          is_commander: is_commander || false,
          oracle_id: oracle_id ?? null
        });
      }

      logger.info(`Card ${card_id} added to deck ${deckId} (${category})`);

      // Invalidate combos cache for this deck
      try {
        await clearCombosCache(deckId);
      } catch (err) {
        logger.error('Failed to clear combos cache after adding card', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Invalidate deck cache for this deck
      try {
        await clearDeckCache(deckId);
      } catch (err) {
        logger.error('Failed to clear deck cache after adding card', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      res.status(201).json({
        deckCard,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error adding card to deck:', error);
      res.status(500).json({
        error: 'Failed to add card to deck',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deck/:id/import
 * Import a raw decklist (one card per line like "4 Lightning Bolt") and add cards to the deck.
 */
router.post(
  '/api/deck/:id/import',
  currentUser,
  requireAuth,
  [
    body('text')
      .optional()
      .isString()
      .withMessage('text must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));
      const { text } = req.body;

      const deck = await Deck.findById(deckId);
      if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
      }

      if (deck.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized to modify this deck' });
      }

      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'No decklist text provided' });
      }

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const report: { imported: number; notFound: string[]; errors: { line: string; reason: string }[] } = {
        imported: 0,
        notFound: [],
        errors: []
      };

      for (const line of lines) {
        try {
          const m = line.match(/^(\d+)\s+(.+)$/);
          if (!m) {
            report.notFound.push(line);
            continue;
          }

          const qty = parseInt(m[1]!, 10);
          const name = m[2]!.trim();

          // Resolve name -> card id (uses DeckCard helper that queries cards table)
          const resolved = await DeckCard.findCardByName(name);
          if (!resolved) {
            report.notFound.push(line);
            continue;
          }

          // Check existing and either update or create
          const existing = await DeckCard.findByDeckAndCard(deckId, resolved.id, 'mainboard');
          if (existing) {
            await DeckCard.updateQuantity(deckId, resolved.id, 'mainboard', existing.quantity + qty);
          } else {
            await DeckCard.create({
              deck_id: deckId,
              card_id: resolved.id,
              quantity: qty,
              category: 'mainboard',
              is_commander: false,
              oracle_id: resolved.oracle_id ?? null
            });
          }

          report.imported += 1;
        } catch (err) {
          report.errors.push({ line, reason: err instanceof Error ? err.message : String(err) });
        }
      }

      // Refresh deck counts
      const counts = await DeckCard.getCardCountsByCategory(deckId);

      // Invalidate combos cache for this deck after import
      try {
        await clearCombosCache(deckId);
      } catch (err) {
        logger.error('Failed to clear combos cache after import', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Invalidate deck cache for this deck after import
      try {
        await clearDeckCache(deckId);
      } catch (err) {
        logger.error('Failed to clear deck cache after import', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      res.status(200).json({ report, counts, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error importing decklist:', error);
      res.status(500).json({ error: 'Failed to import decklist', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

/**
 * PATCH /api/deck/:id/cards/:cardId
 * Update a card's quantity or category in a deck
 */
router.patch(
  '/api/deck/:id/cards/:cardId',
  currentUser,
  requireAuth,
  [
    body('quantity')
      .optional()
      .isInt({ min: 1, max: 999 })
      .withMessage('Quantity must be between 1 and 999'),
    body('category')
      .isIn(['mainboard', 'sideboard', 'commander'])
      .withMessage('Category must be mainboard, sideboard, or commander'),
    body('is_commander')
      .optional()
      .isBoolean()
      .withMessage('is_commander must be a boolean')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));
      const cardId = String(req.params.cardId);
      const { quantity, category, is_commander } = req.body;

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      // Verify ownership
      if (deck.user_id !== userId) {
        return res.status(403).json({
          error: 'Unauthorized to modify this deck'
        });
      }

      // If setting a new commander, move any existing commander to mainboard
      if (category === 'commander') {
        // Find all commander cards in this deck (should be at most 1)
        const commanders = await DeckCard.findByDeckAndCategory(deckId, 'commander');
        for (const commander of commanders) {
          if (commander.card_id !== cardId) {
            // Move old commander to mainboard by deleting the commander row and recreating in mainboard
            await DeckCard.delete(deckId, commander.card_id, 'commander');
            await DeckCard.create({
              deck_id: deckId,
              card_id: commander.card_id,
              quantity: commander.quantity,
              category: 'mainboard',
              is_commander: false
            });
          }
        }
      }

      let deckCard = await DeckCard.update(deckId, cardId, category, {
        ...(quantity && { quantity }),
        ...(is_commander !== undefined && { is_commander })
      });

      if (!deckCard) {
        // Try to find the card in any category
        const allCards = await DeckCard.findByDeck(deckId);
        const existing = allCards.find(c => c.card_id === cardId);
        if (existing) {
          // If found in a different category, remove and recreate in requested category
          if (existing.category !== category) {
            await DeckCard.delete(deckId, cardId, existing.category);
            const newQty = quantity !== undefined ? quantity : existing.quantity;
            const created = await DeckCard.create({
              deck_id: deckId,
              card_id: cardId,
              quantity: newQty,
              category,
              is_commander: is_commander !== undefined ? is_commander : (category === 'commander')
            });
            deckCard = created as any;
          } else {
            // Same category but update previously failed for some reason — try update again
            deckCard = await DeckCard.update(deckId, cardId, category, {
              ...(quantity && { quantity }),
              ...(is_commander !== undefined && { is_commander })
            });
          }
        }
      }

      if (!deckCard) {
        return res.status(404).json({
          error: 'Card not found in deck'
        });
      }

      logger.info(`Card ${cardId} updated in deck ${deckId}`);


      // Invalidate combos cache for this deck after card update
      try {
        await clearCombosCache(deckId);
      } catch (err) {
        logger.error('Failed to clear combos cache after updating card', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Invalidate deck cache for this deck after card update
      try {
        await clearDeckCache(deckId);
      } catch (err) {
        logger.error('Failed to clear deck cache after updating card', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      res.status(200).json({
        deckCard,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating deck card:', error);
      res.status(500).json({
        error: 'Failed to update deck card',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/deck/:id/cards/:cardId
 * Remove a card from a deck
 */
router.delete(
  '/api/deck/:id/cards/:cardId',
  currentUser,
  requireAuth,
  [
    query('category')
      .isIn(['mainboard', 'sideboard', 'commander'])
      .withMessage('Category must be mainboard, sideboard, or commander')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));
      const cardId = String(req.params.cardId);
      const category = req.query.category as string;

      const deck = await Deck.findById(deckId);

      if (!deck) {
        return res.status(404).json({
          error: 'Deck not found'
        });
      }

      // Verify ownership
      if (deck.user_id !== userId) {
        return res.status(403).json({
          error: 'Unauthorized to modify this deck'
        });
      }

      const deleted = await DeckCard.delete(deckId, cardId, category);

      if (!deleted) {
        return res.status(404).json({
          error: 'Card not found in deck'
        });
      }

      // Invalidate combos cache for this deck after card removal
      try {
        await clearCombosCache(deckId);
      } catch (err) {
        logger.error('Failed to clear combos cache after removing card', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      // Invalidate deck cache for this deck after card removal
      try {
        await clearDeckCache(deckId);
      } catch (err) {
        logger.error('Failed to clear deck cache after removing card', { error: err instanceof Error ? err.message : String(err), deckId });
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Error removing card from deck:', error);
      res.status(500).json({
        error: 'Failed to remove card from deck',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as deckRouter };
