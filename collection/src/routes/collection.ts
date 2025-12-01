import express, { Request, Response } from 'express';
import { body, query } from 'express-validator';
import { validateRequest, currentUser, requireAuth } from '@mtg-tracker/common';
import { UserCardCollection, FinishType } from '../models/user-card-collection';

import { logger } from '../logger';

const router = express.Router();

/**
 * GET /api/collection
 * Get all cards in the authenticated user's collection
 */
router.get(
  '/api/collection',
  currentUser,
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('finish_type')
      .optional()
      .isIn(['normal', 'foil', 'etched'])
      .withMessage('Finish type must be normal, foil, or etched')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      
      // Parse query parameters
      const limit = parseInt(req.query.limit as string) || 100;
      const page = parseInt(req.query.page as string) || 1;
      const offset = (page - 1) * limit;
      const finish_type = req.query.finish_type as FinishType | undefined;

      // Get user's collection
      const options: { limit?: number; offset?: number; finish_type?: FinishType } = {
        limit,
        offset
      };
      if (finish_type) {
        options.finish_type = finish_type;
      }
      const { cards, total } = await UserCardCollection.findByUser(userId, options);

      // Enrich collection with card data and prices
      const pool = UserCardCollection.getPool();
      const enrichedCards = await Promise.all(
        cards.map(async (collectionItem) => {
          // Get card details
          const [cardRows] = await pool.query<any[]>(
            'SELECT id, name, set_name, set_code, rarity, image_uri_png, image_uri_small FROM cards WHERE id = ?',
            [collectionItem.card_id]
          );
          
          // Get latest price
          const [priceRows] = await pool.query<any[]>(
            'SELECT price_usd, price_usd_foil FROM card_prices WHERE card_id = ? ORDER BY created_at DESC LIMIT 1',
            [collectionItem.card_id]
          );

          return {
            ...collectionItem,
            cardData: {
              id: cardRows[0]?.id || null,
              name: cardRows[0]?.name || 'Unknown Card',
              set_name: cardRows[0]?.set_name || null,
              set_code: cardRows[0]?.set_code || null,
              rarity: cardRows[0]?.rarity || null,
              image_uri_png: cardRows[0]?.image_uri_png || null,
              image_uri_small: cardRows[0]?.image_uri_small || null,
              prices: {
                usd: priceRows[0]?.price_usd || null,
                usd_foil: priceRows[0]?.price_usd_foil || null
              }
            }
          };
        })
      );

      const totalPages = Math.ceil(total / limit);

      // Get cached collection value
      const cachedValue = await UserCardCollection.getCachedCollectionValue(userId);

      res.status(200).json({
        cards: enrichedCards,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalRecords: total,
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        collectionValue: cachedValue ? {
          totalValueUsd: parseFloat(cachedValue.total_value_usd.toString()),
          totalCards: cachedValue.total_cards,
          totalQuantity: cachedValue.total_quantity,
          lastUpdated: cachedValue.last_updated
        } : null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching user collection:', error);
      res.status(500).json({
        error: 'Failed to fetch collection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/collection/stats
 * Get collection statistics for the authenticated user
 */
router.get(
  '/api/collection/stats',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const stats = await UserCardCollection.getStats(userId);

      res.status(200).json({
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching collection stats:', error);
      res.status(500).json({
        error: 'Failed to fetch collection stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/collection/check/:cardId
 * Check if a card exists in user's collection and return all versions
 */
router.get(
  '/api/collection/check/:cardId',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { cardId } = req.params;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      const versions = await UserCardCollection.findAllFinishesByUserAndCard(userId, cardId);

      if (versions.length === 0) {
        return res.status(200).json({
          inCollection: false,
          cardId,
          versions: [],
          totalQuantity: 0,
          timestamp: new Date().toISOString()
        });
      }

      const totalQuantity = await UserCardCollection.getTotalQuantity(userId, cardId);

      // Get card details and prices for each version
      const pool = UserCardCollection.getPool();
      const enrichedVersions = await Promise.all(
        versions.map(async (version) => {
          const [cardRows] = await pool.query<any[]>(
            'SELECT id, name, set_name, set_code, rarity, image_uri_png, image_uri_small FROM cards WHERE id = ?',
            [version.card_id]
          );
          
          const [priceRows] = await pool.query<any[]>(
            'SELECT price_usd, price_usd_foil FROM card_prices WHERE card_id = ? ORDER BY created_at DESC LIMIT 1',
            [version.card_id]
          );

          return {
            ...version,
            cardData: {
              id: cardRows[0]?.id || null,
              name: cardRows[0]?.name || 'Unknown Card',
              set_name: cardRows[0]?.set_name || null,
              set_code: cardRows[0]?.set_code || null,
              rarity: cardRows[0]?.rarity || null,
              image_uri_png: cardRows[0]?.image_uri_png || null,
              image_uri_small: cardRows[0]?.image_uri_small || null
            },
            currentPrice: version.finish_type === 'foil' 
              ? priceRows[0]?.price_usd_foil 
              : priceRows[0]?.price_usd,
            priceType: version.finish_type === 'foil' ? 'usd_foil' : 'usd'
          };
        })
      );

      res.status(200).json({
        inCollection: true,
        cardId,
        versions: enrichedVersions,
        totalQuantity,
        summary: {
          normalQuantity: versions.find(v => v.finish_type === 'normal')?.quantity || 0,
          foilQuantity: versions.find(v => v.finish_type === 'foil')?.quantity || 0,
          etchedQuantity: versions.find(v => v.finish_type === 'etched')?.quantity || 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error checking card in collection:', error);
      res.status(500).json({
        error: 'Failed to check card',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/collection/:cardId
 * Get all versions (finishes) of a specific card in user's collection
 */
router.get(
  '/api/collection/:cardId',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { cardId } = req.params;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      const cards = await UserCardCollection.findAllFinishesByUserAndCard(userId, cardId);

      if (cards.length === 0) {
        return res.status(404).json({
          error: 'Card not found in collection',
          cardId
        });
      }

      const totalQuantity = await UserCardCollection.getTotalQuantity(userId, cardId);

      res.status(200).json({
        cardId,
        versions: cards,
        totalQuantity,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching card from collection:', error);
      res.status(500).json({
        error: 'Failed to fetch card',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/collection
 * Add a card to the authenticated user's collection
 */
router.post(
  '/api/collection',
  currentUser,
  requireAuth,
  [
    body('card_id')
      .notEmpty()
      .withMessage('Card ID is required')
      .isLength({ min: 36, max: 36 })
      .withMessage('Card ID must be a valid UUID'),
    body('quantity')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Quantity must be between 1 and 1000'),
    body('finish_type')
      .optional()
      .isIn(['normal', 'foil', 'etched'])
      .withMessage('Finish type must be normal, foil, or etched')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { card_id, quantity, finish_type } = req.body;

      // Add card to collection (or increment if exists)
      const card = await UserCardCollection.addCard({
        user_id: userId,
        card_id,
        quantity: quantity || 1,
        finish_type: finish_type || 'normal'
      });

      res.status(201).json({
        card,
        message: 'Card added to collection successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error adding card to collection:', error);
      res.status(500).json({
        error: 'Failed to add card to collection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/collection/:cardId/increment
 * Increment quantity of a card by 1
 */
router.post(
  '/api/collection/:cardId/increment',
  currentUser,
  requireAuth,
  [
    body('finish_type')
      .notEmpty()
      .withMessage('Finish type is required')
      .isIn(['normal', 'foil', 'etched'])
      .withMessage('Finish type must be normal, foil, or etched')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { cardId } = req.params;
      const { finish_type } = req.body;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      // Add card (will increment by 1 if exists)
      const card = await UserCardCollection.addCard({
        user_id: userId,
        card_id: cardId,
        quantity: 1,
        finish_type
      });

      res.status(200).json({
        card,
        message: 'Card quantity incremented successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error incrementing card quantity:', error);
      res.status(500).json({
        error: 'Failed to increment card quantity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/collection/:cardId/decrement
 * Decrement quantity of a card by 1
 */
router.post(
  '/api/collection/:cardId/decrement',
  currentUser,
  requireAuth,
  [
    body('finish_type')
      .notEmpty()
      .withMessage('Finish type is required')
      .isIn(['normal', 'foil', 'etched'])
      .withMessage('Finish type must be normal, foil, or etched')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { cardId } = req.params;
      const { finish_type } = req.body;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      // Check if card exists before decrementing
      const existingCard = await UserCardCollection.findByUserCardAndFinish(
        userId,
        cardId,
        finish_type
      );

      if (!existingCard) {
        return res.status(404).json({
          error: 'Card not found in collection',
          cardId
        });
      }

      // Remove 1 card
      await UserCardCollection.removeCard(
        userId,
        cardId,
        finish_type,
        1
      );

      // Get updated card info (may be null if quantity reached 0)
      const card = await UserCardCollection.findByUserCardAndFinish(
        userId,
        cardId,
        finish_type
      );

      res.status(200).json({
        card,
        message: card 
          ? 'Card quantity decremented successfully'
          : 'Card removed from collection (quantity reached 0)',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error decrementing card quantity:', error);
      res.status(500).json({
        error: 'Failed to decrement card quantity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * PUT /api/collection/:cardId
 * Update the quantity of a specific card in user's collection
 */
router.put(
  '/api/collection/:cardId',
  currentUser,
  requireAuth,
  [
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 0, max: 1000 })
      .withMessage('Quantity must be between 0 and 1000'),
    body('finish_type')
      .notEmpty()
      .withMessage('Finish type is required')
      .isIn(['normal', 'foil', 'etched'])
      .withMessage('Finish type must be normal, foil, or etched')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { cardId } = req.params;
      const { quantity, finish_type } = req.body;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      // Update quantity (will delete if quantity is 0)
      const card = await UserCardCollection.updateQuantity({
        user_id: userId,
        card_id: cardId,
        finish_type,
        quantity
      });

      if (!card) {
        return res.status(200).json({
          message: 'Card removed from collection (quantity was 0)',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        card,
        message: 'Card quantity updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating card quantity:', error);
      res.status(500).json({
        error: 'Failed to update card quantity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/collection/:cardId
 * Remove a card from user's collection
 */
router.delete(
  '/api/collection/:cardId',
  currentUser,
  requireAuth,
  [
    query('finish_type')
      .notEmpty()
      .withMessage('Finish type is required')
      .isIn(['normal', 'foil', 'etched'])
      .withMessage('Finish type must be normal, foil, or etched'),
    query('quantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const { cardId } = req.params;
      const finish_type = req.query.finish_type as FinishType;
      const quantity = req.query.quantity ? parseInt(req.query.quantity as string) : undefined;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      // Remove card (or decrement quantity if specified)
      const success = await UserCardCollection.removeCard(
        userId,
        cardId,
        finish_type,
        quantity
      );

      if (!success) {
        return res.status(404).json({
          error: 'Card not found in collection',
          cardId
        });
      }

      res.status(200).json({
        message: quantity 
          ? `Removed ${quantity} card(s) from collection`
          : 'Card removed from collection successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error removing card from collection:', error);
      res.status(500).json({
        error: 'Failed to remove card from collection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as collectionRouter };