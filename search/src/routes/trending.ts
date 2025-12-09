import express, { Request, Response } from 'express';
import { query } from 'express-validator';
import { validateRequest } from '@mtg-tracker/common';
import { TrendingCard } from '../models/trending-card';
import { getRedisClient } from '../config/redis';

import { logger } from '../logger';

const router = express.Router();

// Cache TTL: 24 hours in seconds
const CACHE_TTL = 24 * 60 * 60;

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

    logger.log('GET /api/search/trending - Request started', {
      timeframe,
      limit,
      priceType,
      direction,
      timestamp: new Date().toISOString()
    });

    try {
      // Only cache for 24h and 7d timeframes with USD pricing
      const shouldCache = (timeframe === '24h' || timeframe === '7d') && priceType === 'price_usd';
      const cacheKey = shouldCache ? `trending:${timeframe}:${priceType}:${direction}:${limit}` : null;

      // Try to get from cache first
      if (cacheKey) {
        try {
          const redis = getRedisClient();
          const cachedData = await redis.get(cacheKey);
          
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            logger.log('GET /api/search/trending - Cache hit', {
              timeframe,
              priceType,
              direction,
              cacheKey,
              duration: Date.now() - startTime
            });
            
            return res.status(200).json({
              ...parsed,
              cached: true,
              timestamp: new Date().toISOString()
            });
          }
        } catch (cacheError) {
          // Log cache error but continue to fetch from database
          logger.warn('Redis cache read failed, falling back to database', {
            error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
            cacheKey
          });
        }
      }

      // Query pre-calculated trending data from the database
      const trendingCards = await TrendingCard.getTrendingCards(
        timeframe,
        limit,
        priceType,
        direction
      );

      // Get last update time to inform users when data was calculated
      const lastUpdate = await TrendingCard.getLastUpdateTime();

      const responseData = {
        timeframe,
        priceType,
        direction,
        count: trendingCards.length,
        cards: trendingCards,
        lastUpdate,
      };

      // Cache the result if applicable
      if (cacheKey) {
        try {
          const redis = getRedisClient();
          await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(responseData));
          logger.log('GET /api/search/trending - Cached result', {
            cacheKey,
            ttl: CACHE_TTL
          });
        } catch (cacheError) {
          logger.warn('Failed to cache trending cards', {
            error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
            cacheKey
          });
        }
      }

      logger.log('GET /api/search/trending - Success', {
        timeframe,
        priceType,
        direction,
        cardsReturned: trendingCards.length,
        lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
        cached: false,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        ...responseData,
        cached: false,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('GET /api/search/trending - Error', {
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
