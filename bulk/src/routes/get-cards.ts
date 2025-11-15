import express, { Request, Response } from 'express';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';
import { Set } from '../models/set';

const router = express.Router();

router.get('/api/bulk/cards/count', async (req: Request, res: Response) => {
  try {
    const total = await Card.getTotal();
    res.status(200).json({
      total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching total cards:', error);
    res.status(500).json({
      error: 'Failed to fetch total cards',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/bulk/cards/pricescount', async (req: Request, res: Response) => {
  try {
    const total = await CardPrice.getTotal();
    res.status(200).json({
      total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching total card prices:', error);
    res.status(500).json({
      error: 'Failed to fetch total card prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/bulk/cards/setcount', async (req: Request, res: Response) => {
  try {
    const total = await Set.getTotal();
    res.status(200).json({
      total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching total sets:', error);
    res.status(500).json({
      error: 'Failed to fetch total sets',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as cardsRouter };
