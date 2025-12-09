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
      const userId = parseInt(String(req.currentUser!.id));
      
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
            'SELECT id, name, set_name, set_code, rarity, image_uri_png, image_uri_small, has_multiple_faces FROM cards WHERE id = ?',
            [collectionItem.card_id]
          );
          
          // Get latest price
          const [priceRows] = await pool.query<any[]>(
            'SELECT price_usd, price_usd_foil FROM card_prices WHERE card_id = ? ORDER BY created_at DESC LIMIT 1',
            [collectionItem.card_id]
          );

          // Get card faces if card has multiple faces
          let cardFaces = null;
          if (cardRows[0]?.has_multiple_faces) {
            const [faceRows] = await pool.query<any[]>(
              'SELECT * FROM card_faces WHERE card_id = ? ORDER BY face_order',
              [collectionItem.card_id]
            );
            cardFaces = faceRows;
          }

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
              has_multiple_faces: cardRows[0]?.has_multiple_faces || false,
              card_faces: cardFaces,
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
      const userId = parseInt(String(req.currentUser!.id));
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
 * Also returns other printings (same oracle_id) that are in collection
 */
router.get(
  '/api/collection/check/:cardId',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const { cardId } = req.params;

      if (!cardId) {
        return res.status(400).json({
          error: 'Card ID is required'
        });
      }

      const versions = await UserCardCollection.findAllFinishesByUserAndCard(userId, cardId);
      
      // Get the card's oracle_id
      const pool = UserCardCollection.getPool();
      const [cardRows] = await pool.query<any[]>(
        'SELECT oracle_id FROM cards WHERE id = ? LIMIT 1',
        [cardId]
      );
      
      const oracleId = cardRows[0]?.oracle_id;
      let otherPrints: any[] = [];
      
      // If card has an oracle_id, find other printings in collection
      if (oracleId) {
        const oraclePrints = await UserCardCollection.findByUserAndOracleId(userId, oracleId);
        
        // Filter out the current card_id from other prints
        const otherPrintRecords = oraclePrints.filter(p => p.card_id !== cardId);
        
        // Enrich other prints with card details
        if (otherPrintRecords.length > 0) {
          otherPrints = await Promise.all(
            otherPrintRecords.map(async (print) => {
              const [printCardRows] = await pool.query<any[]>(
                'SELECT id, name, set_name, set_code, rarity, image_uri_png, image_uri_small FROM cards WHERE id = ?',
                [print.card_id]
              );
              
              const [priceRows] = await pool.query<any[]>(
                'SELECT price_usd, price_usd_foil, price_usd_etched FROM card_prices WHERE card_id = ? ORDER BY created_at DESC LIMIT 1',
                [print.card_id]
              );

              return {
                ...print,
                cardData: {
                  id: printCardRows[0]?.id || null,
                  name: printCardRows[0]?.name || 'Unknown Card',
                  set_name: printCardRows[0]?.set_name || null,
                  set_code: printCardRows[0]?.set_code || null,
                  rarity: printCardRows[0]?.rarity || null,
                  image_uri_png: printCardRows[0]?.image_uri_png || null,
                  image_uri_small: printCardRows[0]?.image_uri_small || null
                },
                currentPrice: print.finish_type === 'foil' 
                  ? priceRows[0]?.price_usd_foil 
                  : print.finish_type === 'etched'
                  ? priceRows[0]?.price_usd_etched
                  : priceRows[0]?.price_usd,
                priceType: print.finish_type === 'foil' ? 'usd_foil' : print.finish_type === 'etched' ? 'usd_etched' : 'usd'
              };
            })
          );
        }
      }

      if (versions.length === 0 && otherPrints.length === 0) {
        return res.status(200).json({
          inCollection: false,
          cardId,
          versions: [],
          otherPrints: [],
          totalQuantity: 0,
          timestamp: new Date().toISOString()
        });
      }

      const totalQuantity = await UserCardCollection.getTotalQuantity(userId, cardId);

      // Get card details and prices for each version
      const enrichedVersions = await Promise.all(
        versions.map(async (version) => {
          const [cardRows] = await pool.query<any[]>(
            'SELECT id, name, set_name, set_code, rarity, image_uri_png, image_uri_small FROM cards WHERE id = ?',
            [version.card_id]
          );
          
          const [priceRows] = await pool.query<any[]>(
            'SELECT price_usd, price_usd_foil, price_usd_etched FROM card_prices WHERE card_id = ? ORDER BY created_at DESC LIMIT 1',
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
              : version.finish_type === 'etched'
              ? priceRows[0]?.price_usd_etched
              : priceRows[0]?.price_usd,
            priceType: version.finish_type === 'foil' ? 'usd_foil' : version.finish_type === 'etched' ? 'usd_etched' : 'usd'
          };
        })
      );

      res.status(200).json({
        inCollection: versions.length > 0,
        cardId,
        versions: enrichedVersions,
        otherPrints: otherPrints,
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
 * GET /api/collection/analytics
 * Get comprehensive analytics for the authenticated user's collection
 */
router.get(
  '/api/collection/analytics',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const pool = UserCardCollection.getPool();

      // Get all collection items with card data
      const [collectionRows] = await pool.query<any[]>(`
        SELECT 
          ucc.*,
          c.name,
          c.rarity,
          c.type_line,
          c.edhrec_rank,
          c.reserved,
          c.image_uri_small,
          c.has_multiple_faces,
          cp.price_usd,
          cp.price_usd_foil,
          cp.price_usd_etched,
          cp.created_at as price_date
        FROM user_card_collection ucc
        INNER JOIN cards c ON ucc.card_id = c.id
        LEFT JOIN card_prices cp ON c.id = cp.card_id
        WHERE ucc.user_id = ?
        AND cp.id = (
          SELECT id FROM card_prices 
          WHERE card_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        )
      `, [userId]);

      if (collectionRows.length === 0) {
        return res.status(200).json({
          analytics: {
            mostValuableCards: [],
            priceGainers: [],
            priceLosers: [],
            recentlyAdded: [],
            reservedListCards: [],
            staples: [],
            valueByRarity: [],
            cardsByRarity: [],
            cardsByType: []
          }
        });
      }

      // Get card faces for multi-face cards
      const cardFacesMap = new Map();
      const multiFaceCardIds = collectionRows
        .filter(card => card.has_multiple_faces)
        .map(card => card.card_id);
      
      if (multiFaceCardIds.length > 0) {
        const [facesRows] = await pool.query<any[]>(
          `SELECT card_id, image_uri_small FROM card_faces WHERE card_id IN (?) AND face_order = 0`,
          [multiFaceCardIds]
        );
        facesRows.forEach((face: any) => {
          cardFacesMap.set(face.card_id, face.image_uri_small);
        });
      }

      // Calculate card values
      const enrichedCards = collectionRows.map((card: any) => {
        let price = 0;
        if (card.finish_type === 'foil') {
          price = parseFloat(card.price_usd_foil || 0);
        } else if (card.finish_type === 'etched') {
          price = parseFloat(card.price_usd_etched || 0);
        } else {
          price = parseFloat(card.price_usd || 0);
        }
        
        // Use card face image if available, otherwise use card image
        const imageUri = card.has_multiple_faces && cardFacesMap.has(card.card_id)
          ? cardFacesMap.get(card.card_id)
          : card.image_uri_small;
        
        return {
          ...card,
          image_uri_small: imageUri,
          current_price: price,
          total_value: price * card.quantity
        };
      });

      // Most valuable cards (top 20)
      const mostValuableCards = enrichedCards
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 20)
        .map(card => ({
          card_id: card.card_id,
          name: card.name,
          quantity: card.quantity,
          finish_type: card.finish_type,
          current_price: card.current_price,
          total_value: card.total_value,
          image_uri: card.image_uri_small,
          rarity: card.rarity
        }));

      // Get price history for trend analysis
      const [priceHistoryRows] = await pool.query<any[]>(`
        SELECT 
          ucc.card_id,
          ucc.quantity,
          ucc.finish_type,
          c.name,
          c.image_uri_small,
          c.has_multiple_faces,
          c.rarity,
          cp_old.price_usd as old_price_usd,
          cp_old.price_usd_foil as old_price_usd_foil,
          cp_old.price_usd_etched as old_price_usd_etched,
          cp_new.price_usd as new_price_usd,
          cp_new.price_usd_foil as new_price_usd_foil,
          cp_new.price_usd_etched as new_price_usd_etched
        FROM user_card_collection ucc
        INNER JOIN cards c ON ucc.card_id = c.id
        LEFT JOIN card_prices cp_old ON c.id = cp_old.card_id
        LEFT JOIN card_prices cp_new ON c.id = cp_new.card_id
        WHERE ucc.user_id = ?
        AND cp_old.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND cp_old.id = (
          SELECT id FROM card_prices 
          WHERE card_id = c.id 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          ORDER BY created_at ASC 
          LIMIT 1
        )
        AND cp_new.id = (
          SELECT id FROM card_prices 
          WHERE card_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        )
      `, [userId]);

      // Calculate price changes
      const priceChanges = priceHistoryRows.map((card: any) => {
        const oldPrice = card.finish_type === 'foil' ? parseFloat(card.old_price_usd_foil || 0) :
                        card.finish_type === 'etched' ? parseFloat(card.old_price_usd_etched || 0) :
                        parseFloat(card.old_price_usd || 0);
        const newPrice = card.finish_type === 'foil' ? parseFloat(card.new_price_usd_foil || 0) :
                        card.finish_type === 'etched' ? parseFloat(card.new_price_usd_etched || 0) :
                        parseFloat(card.new_price_usd || 0);
        
        const priceChange = newPrice - oldPrice;
        const percentChange = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
        
        // Use card face image if available, otherwise use card image
        const imageUri = card.has_multiple_faces && cardFacesMap.has(card.card_id)
          ? cardFacesMap.get(card.card_id)
          : card.image_uri_small;
        
        return {
          card_id: card.card_id,
          name: card.name,
          quantity: card.quantity,
          finish_type: card.finish_type,
          old_price: oldPrice,
          new_price: newPrice,
          price_change: priceChange,
          percent_change: percentChange,
          image_uri: imageUri,
          rarity: card.rarity
        };
      }).filter(card => card.new_price > 0 && card.old_price > 0);

      // Fastest growing cards (top 10)
      const priceGainers = priceChanges
        .filter(card => card.percent_change > 0)
        .sort((a, b) => b.percent_change - a.percent_change)
        .slice(0, 10);

      // Biggest losers (top 10)
      const priceLosers = priceChanges
        .filter(card => card.percent_change < 0)
        .sort((a, b) => a.percent_change - b.percent_change)
        .slice(0, 10);

      // Recently added cards (last 20)
      const recentlyAdded = enrichedCards
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
        .map(card => ({
          card_id: card.card_id,
          name: card.name,
          quantity: card.quantity,
          finish_type: card.finish_type,
          current_price: card.current_price,
          added_at: card.created_at,
          image_uri: card.image_uri_small,
          rarity: card.rarity
        }));

      // Reserved list cards
      const reservedListCards = enrichedCards
        .filter(card => card.reserved === true || card.reserved === 1)
        .map(card => ({
          card_id: card.card_id,
          name: card.name,
          quantity: card.quantity,
          finish_type: card.finish_type,
          current_price: card.current_price,
          total_value: card.total_value,
          image_uri: card.image_uri_small,
          rarity: card.rarity
        }));

      // Staples (EDHRec rank < 1000)
      const staples = enrichedCards
        .filter(card => card.edhrec_rank && card.edhrec_rank < 1000)
        .sort((a, b) => (a.edhrec_rank || Infinity) - (b.edhrec_rank || Infinity))
        .map(card => ({
          card_id: card.card_id,
          name: card.name,
          quantity: card.quantity,
          finish_type: card.finish_type,
          edhrec_rank: card.edhrec_rank,
          current_price: card.current_price,
          image_uri: card.image_uri_small,
          rarity: card.rarity
        }));

      // Value distribution by rarity
      const valueByRarity = enrichedCards.reduce((acc: any, card: any) => {
        const rarity = card.rarity || 'unknown';
        if (!acc[rarity]) {
          acc[rarity] = { rarity, total_value: 0, count: 0, quantity: 0 };
        }
        acc[rarity].total_value += card.total_value;
        acc[rarity].count += 1;
        acc[rarity].quantity += card.quantity;
        return acc;
      }, {});

      // Cards by rarity breakdown
      const cardsByRarity = Object.values(valueByRarity);

      // Cards by type
      const typeStats = enrichedCards.reduce((acc: any, card: any) => {
        if (!card.type_line) return acc;
        
        // Extract primary type (before —)
        const primaryType = card.type_line.split('—')[0].trim();
        const types = primaryType.split(' ').filter((t: string) => 
          ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle'].includes(t)
        );
        
        types.forEach((type: string) => {
          if (!acc[type]) {
            acc[type] = { type, count: 0, quantity: 0 };
          }
          acc[type].count += 1;
          acc[type].quantity += card.quantity;
        });
        
        return acc;
      }, {});

      const cardsByType = Object.values(typeStats);

      res.status(200).json({
        analytics: {
          mostValuableCards,
          priceGainers,
          priceLosers,
          recentlyAdded,
          reservedListCards,
          staples,
          valueByRarity: cardsByRarity,
          cardsByRarity,
          cardsByType
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching collection analytics:', error);
      res.status(500).json({
        error: 'Failed to fetch collection analytics',
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
      const userId = parseInt(String(req.currentUser!.id));
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
      const userId = parseInt(String(req.currentUser!.id));
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
      const userId = parseInt(String(req.currentUser!.id));
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
      const userId = parseInt(String(req.currentUser!.id));
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
      const userId = parseInt(String(req.currentUser!.id));
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
      const userId = parseInt(String(req.currentUser!.id));
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