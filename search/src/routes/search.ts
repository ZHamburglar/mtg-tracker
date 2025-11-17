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

router.get('/api/search/:id/prices', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
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

    // Get all price history for this card
    const prices = await CardPrice.findByCardId(id);

    res.status(200).json({
      card: {
        id: card.id,
        name: card.name,
        set_code: card.set_code,
        set_name: card.set_name
      },
      priceHistory: prices,
      totalRecords: prices.length,
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