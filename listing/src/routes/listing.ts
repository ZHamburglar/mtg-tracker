import express, { Request, Response } from 'express';
import { ListingModel, CreateListingInput, UpdateListingInput } from '../models/listing';
import { validateRequest, currentUser, requireAuth } from '@mtg-tracker/common';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

/**
 * POST /api/listing
 * Create a new listing (Protected route - requires authentication)
 */
router.post(
  '/api/listing',
  currentUser,
  requireAuth,
  [
    body('card_id').notEmpty().withMessage('card_id is required'),
    body('collection_id').isInt({ min: 1 }).withMessage('Valid collection_id is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('finish_type').isIn(['normal', 'foil', 'etched']).withMessage('Invalid finish_type'),
    body('condition').isIn(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']).withMessage('Invalid condition'),
    body('listing_type').isIn(['physical', 'online']).withMessage('listing_type must be physical or online'),
    body('price_cents').isInt({ min: 0 }).withMessage('price_cents must be a positive integer'),
    body('marketplace').optional().isString(),
    body('language').optional().isString(),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('notes').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      console.log(`[Listing] Creating listing for user ${userId}, card ${req.body.card_id}`);
      
      const input: CreateListingInput = {
        user_id: userId,
        card_id: req.body.card_id,
        collection_id: req.body.collection_id,
        quantity: req.body.quantity,
        finish_type: req.body.finish_type,
        condition: req.body.condition,
        listing_type: req.body.listing_type,
        price_cents: req.body.price_cents,
        marketplace: req.body.marketplace,
        language: req.body.language,
        currency: req.body.currency,
        notes: req.body.notes
      };

      const listing = await ListingModel.createListing(input);
      
      console.log(`[Listing] Created listing ${listing.id}`);
      res.status(201).json(listing);
    } catch (error) {
      console.error('[Listing] Error creating listing:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create listing' 
      });
    }
  }
);

/**
 * GET /api/listing/user
 * Get all listings for the current authenticated user
 */
router.get(
  '/api/listing/user',
  currentUser,
  requireAuth,
  [
    query('status').optional().isIn(['active', 'sold', 'cancelled', 'expired']),
    query('listing_type').optional().isIn(['physical', 'online'])
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.currentUser!.id);
      const status = req.query.status as any;
      const listingType = req.query.listing_type as any;

      console.log(`[Listing] Fetching listings for current user ${userId}`);
      const listings = await ListingModel.getUserListings(userId, status, listingType);

      res.json({
        count: listings.length,
        listings
      });
    } catch (error) {
      console.error('[Listing] Error fetching current user listings:', error);
      res.status(500).json({ error: 'Failed to fetch user listings' });
    }
  }
);

/**
 * GET /api/listing/:id
 * Get a specific listing by ID
 */
router.get(
  '/api/listing/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid listing ID is required')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const listingId = parseInt(req.params.id!);
      const userId = req.query.user_id ? parseInt(req.query.user_id as string) : undefined;
      
      console.log(`[Listing] Fetching listing ${listingId}`);
      const listing = await ListingModel.getListingById(listingId, userId);

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      res.json(listing);
    } catch (error) {
      console.error('[Listing] Error fetching listing:', error);
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  }
);

/**
 * GET /api/listing/user/:userId
 * Get all listings for a user
 */
router.get(
  '/api/listing/user/:userId',
  [
    param('userId').isInt({ min: 1 }).withMessage('Valid user ID is required'),
    query('status').optional().isIn(['active', 'sold', 'cancelled', 'expired']),
    query('listing_type').optional().isIn(['physical', 'online'])
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = parseInt(req.params.userId!);
      const status = req.query.status as any;
      const listingType = req.query.listing_type as any;

      console.log(`[Listing] Fetching listings for user ${userId}`);
      const listings = await ListingModel.getUserListings(userId, status, listingType);

      res.json({
        count: listings.length,
        listings
      });
    } catch (error) {
      console.error('[Listing] Error fetching user listings:', error);
      res.status(500).json({ error: 'Failed to fetch user listings' });
    }
  }
);

/**
 * GET /api/listing/card/:cardId
 * Get all listings for a specific card
 */
router.get(
  '/api/listing/card/:cardId',
  [
    param('cardId').notEmpty().withMessage('card ID is required'),
    query('status').optional().isIn(['active', 'sold', 'cancelled', 'expired']),
    query('listing_type').optional().isIn(['physical', 'online'])
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const cardId = req.params.cardId!;
      const status = (req.query.status as any) || 'active';
      const listingType = req.query.listing_type as any;

      console.log(`[Listing] Fetching listings for card ${cardId}`);
      const listings = await ListingModel.getCardListings(cardId, status, listingType);

      res.json({
        card_id: cardId,
        count: listings.length,
        listings
      });
    } catch (error) {
      console.error('[Listing] Error fetching card listings:', error);
      res.status(500).json({ error: 'Failed to fetch card listings' });
    }
  }
);

/**
 * PUT /api/listing/:id
 * Update a listing
 */
router.put(
  '/api/listing/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Valid listing ID is required'),
    body('user_id').isInt({ min: 1 }).withMessage('Valid user_id is required'),
    body('quantity').optional().isInt({ min: 1 }),
    body('condition').optional().isIn(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']),
    body('price_cents').optional().isInt({ min: 0 }),
    body('marketplace').optional().isString(),
    body('notes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const listingId = parseInt(req.params.id!);
      const userId = req.body.user_id;

      const updates: UpdateListingInput = {
        quantity: req.body.quantity,
        condition: req.body.condition,
        price_cents: req.body.price_cents,
        marketplace: req.body.marketplace,
        notes: req.body.notes
      };

      console.log(`[Listing] Updating listing ${listingId}`);
      const listing = await ListingModel.updateListing(listingId, userId, updates);

      res.json(listing);
    } catch (error) {
      console.error('[Listing] Error updating listing:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update listing' 
      });
    }
  }
);

/**
 * POST /api/listing/:id/cancel
 * Cancel a listing
 */
router.post(
  '/api/listing/:id/cancel',
  [
    param('id').isInt({ min: 1 }).withMessage('Valid listing ID is required'),
    body('user_id').isInt({ min: 1 }).withMessage('Valid user_id is required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const listingId = parseInt(req.params.id!);
      const userId = req.body.user_id;

      console.log(`[Listing] Cancelling listing ${listingId}`);
      const listing = await ListingModel.cancelListing(listingId, userId);

      res.json(listing);
    } catch (error) {
      console.error('[Listing] Error cancelling listing:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to cancel listing' 
      });
    }
  }
);

/**
 * POST /api/listing/:id/sold
 * Mark a listing as sold
 */
router.post(
  '/api/listing/:id/sold',
  [
    param('id').isInt({ min: 1 }).withMessage('Valid listing ID is required'),
    body('user_id').isInt({ min: 1 }).withMessage('Valid user_id is required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const listingId = parseInt(req.params.id!);
      const userId = req.body.user_id;

      console.log(`[Listing] Marking listing ${listingId} as sold`);
      const listing = await ListingModel.markAsSold(listingId, userId);

      res.json(listing);
    } catch (error) {
      console.error('[Listing] Error marking listing as sold:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to mark listing as sold' 
      });
    }
  }
);

/**
 * DELETE /api/listing/:id
 * Delete a listing
 */
router.delete(
  '/api/listing/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Valid listing ID is required'),
    query('user_id').isInt({ min: 1 }).withMessage('Valid user_id is required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const listingId = parseInt(req.params.id!);
      const userId = parseInt(req.query.user_id as string);

      console.log(`[Listing] Deleting listing ${listingId}`);
      await ListingModel.deleteListing(listingId, userId);

      res.status(204).send();
    } catch (error) {
      console.error('[Listing] Error deleting listing:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete listing' 
      });
    }
  }
);

export { router as listingRouter };
