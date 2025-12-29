import express, { Request, Response } from 'express';
import axios from 'axios';
import { body, query, param } from 'express-validator';
import { validateRequest, currentUser, requireAuth } from '@mtg-tracker/common';
import { Deck } from '../models/deck';
import { DeckCard } from '../models/deck-card';
import { logger } from '../logger';

const router = express.Router();

/**
 * POST /api/deck/:id/combos
 * Checks the cards in a deck and sends them to Commander Spellbook API to get combos
 */
router.get(
  '/api/deck/:id/combos',
  async (req: Request, res: Response) => {
    try {
      const deckId = parseInt(String(req.params.id));

      // Find the deck and verify ownership
      const deck = await Deck.findById(deckId);
      if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
      }

      // Get all cards in the deck (mainboard only for now)
      const cards = await DeckCard.findByDeck(deckId);

      // Structure for Commander Spellbook API (only cards with valid name)
      const main = cards
        .filter(card => card.category === 'mainboard' && card.card?.name && card.card.name.trim())
        .map(card => (
          {
          card: card.card?.name,
          quantity: card.quantity
        }));
      const commanders = cards
        .filter(card => card.category === 'commander' && card.card?.name && card.card.name.trim())
        .map(card => ({
          card: card.card?.name,
          quantity: card.quantity
        }));

      const payload = { main, commanders };

      // Send request to Commander Spellbook API
      const apiUrl = 'https://backend.commanderspellbook.com/find-my-combos';
      const apiResponse = await axios.post(apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      // Normalize included to an array (some API responses use object maps)
      let includedRaw = apiResponse.data.results?.included || [];
      let included: any[] = [];
      if (Array.isArray(includedRaw)) {
        included = includedRaw;
      } else if (includedRaw && typeof includedRaw === 'object') {
        included = Object.values(includedRaw);
      }

      // Aggregate bracketTags counts from included items
      const bracketTagsCount: Record<string, number> = {};
      if (Array.isArray(included)) {
        included.forEach((item: any) => {
          // Accept multiple possible field names and shapes from the external API
          const tags = item?.bracketTags ?? item?.bracketTag ?? item?.bracket_tags ?? item?.bracket_tag;
          if (!tags) return;

          if (Array.isArray(tags)) {
            tags.forEach((tag: any) => {
              const name = typeof tag === 'string' ? tag : (tag?.name ? String(tag.name) : null);
              if (name) {
                bracketTagsCount[name] = (bracketTagsCount[name] || 0) + 1;
              }
            });
            return;
          }

          if (typeof tags === 'string') {
            bracketTagsCount[tags] = (bracketTagsCount[tags] || 0) + 1;
            return;
          }

          // If tags is an object, try common shapes (e.g., { name: 'S' } or { tags: ['S'] })
          if (typeof tags === 'object') {
            if (tags.name && typeof tags.name === 'string') {
              bracketTagsCount[tags.name] = (bracketTagsCount[tags.name] || 0) + 1;
            } else if (Array.isArray(tags.tags)) {
              tags.tags.forEach((t: any) => {
                const name = typeof t === 'string' ? t : (t?.name ? String(t.name) : null);
                if (name) bracketTagsCount[name] = (bracketTagsCount[name] || 0) + 1;
              });
            }
          }
        });
      }

      // Return included count and a small sample to help debugging
      const includedCount = included.length;

      res.status(200).json({
        count: includedCount,
        combos: included,
        almostIncluded: apiResponse.data.results?.almostIncluded || [],
        bracketTags: bracketTagsCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error checking combos for deck:', error);
      res.status(500).json({
        error: 'Failed to check combos',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

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

      res.status(200).json({
        decks: decksWithCounts,
        timestamp: new Date().toISOString()
      });
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

      // Add card counts
      const counts = await DeckCard.getCardCountsByCategory(deckId);

      res.status(200).json({
        deck: {
          ...deck,
          ...counts
        },
        timestamp: new Date().toISOString()
      });
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
      .withMessage('is_commander must be a boolean')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const deckId = parseInt(String(req.params.id));
      const { card_id, quantity, category, is_commander } = req.body;

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
          is_commander: is_commander || false
        });
      }

      logger.info(`Card ${card_id} added to deck ${deckId} (${category})`);

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
