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

      console.log('Combos response from Commander Spellbook API:', apiResponse.data);

      res.status(200).json({
        count: apiResponse.data.count,
        combos: apiResponse.data.results,
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
      .withMessage('Invalid format')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const { name, description, format } = req.body;

      const deck = await Deck.create({
        user_id: userId,
        name,
        description: description || null,
        format
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
      .withMessage('Invalid format')
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

      const { name, description, format } = req.body;

      const updatedDeck = await Deck.update(deckId, {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(format && { format })
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

      const deckCard = await DeckCard.update(deckId, cardId, category, {
        ...(quantity && { quantity }),
        ...(is_commander !== undefined && { is_commander })
      });

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
