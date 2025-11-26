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

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        cards,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalRecords: total,
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
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