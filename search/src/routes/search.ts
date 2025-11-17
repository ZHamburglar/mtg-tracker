import express, { Request, Response } from 'express';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';

const router = express.Router();

router.get('/api/search/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    const card = await Card.findById(id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    res.status(200).json({
      card,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching for card:', error);
    res.status(500).json({
      error: 'Failed to search for card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prices/latest', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    const card = await Card.findById(id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    const latestPrice = await CardPrice.getLatestByCardId(id);

    if (!latestPrice) {
      return res.status(404).json({
        error: 'No price data found for this card',
        id
      });
    }

    res.status(200).json({
      card: {
        id: card.id,
        name: card.name,
        set_code: card.set_code,
        set_name: card.set_name
      },
      price: latestPrice,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching latest card price:', error);
    res.status(500).json({
      error: 'Failed to fetch latest card price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prices', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    // Validate pagination parameters
    if (limit > 1000) {
      return res.status(400).json({
        error: 'Limit cannot exceed 1000'
      });
    }

    // First verify the card exists
    const card = await Card.findById(id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    // Get paginated price history and total count
    const [prices, total] = await Promise.all([
      CardPrice.findByCardId(id, limit, offset),
      CardPrice.countByCardId(id)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      card: {
        id: card.id,
        name: card.name,
        set_code: card.set_code,
        set_name: card.set_name
      },
      priceHistory: prices,
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
    console.error('Error fetching card prices:', error);
    res.status(500).json({
      error: 'Failed to fetch card prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as searchRouter };