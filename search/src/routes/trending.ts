import express, { Request, Response } from 'express';
import { query } from 'express-validator';
import { validateRequest } from '@mtg-tracker/common';
import { TrendingCard } from '../models/trending-card';

const router = express.Router();

/**
 * GET /api/search/trending
 * Get cards with the greatest price changes over a specified timeframe
 */
router.get(
  '/api/search/trending',
  [
    query('timeframe')
      .optional()
      .isIn(['24h', '7d', '30d'])
      .withMessage('Timeframe must be 24h, 7d, or 30d'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('priceType')
      .optional()
      .isIn(['price_usd', 'price_usd_foil', 'price_eur'])
      .withMessage('Price type must be price_usd, price_usd_foil, or price_eur'),
    query('direction')
      .optional()
      .isIn(['increase', 'decrease'])
      .withMessage('Direction must be increase or decrease')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const timeframe = (req.query.timeframe as '24h' | '7d' | '30d') || '24h';
    const limit = parseInt(req.query.limit as string) || 15;
    const priceType = (req.query.priceType as 'price_usd' | 'price_usd_foil' | 'price_eur') || 'price_usd';
    const direction = (req.query.direction as 'increase' | 'decrease') || 'increase';

    console.log('[Search] GET /api/search/trending - Request started', {
      timeframe,
      limit,
      priceType,
      direction,
      timestamp: new Date().toISOString()
    });

    try {
      // Query pre-calculated trending data from the database
      const trendingCards = await TrendingCard.getTrendingCards(
        timeframe,
        limit,
        priceType,
        direction
      );

      // Get last update time to inform users when data was calculated
      const lastUpdate = await TrendingCard.getLastUpdateTime();

      console.log('[Search] GET /api/search/trending - Success', {
        timeframe,
        priceType,
        direction,
        cardsReturned: trendingCards.length,
        lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        timeframe,
        priceType,
        direction,
        count: trendingCards.length,
        cards: trendingCards,
        lastUpdate,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Search] GET /api/search/trending - Error', {
        timeframe,
        priceType,
        direction,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      });
      res.status(500).json({
        error: 'Failed to fetch trending cards',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as trendingRouter };
