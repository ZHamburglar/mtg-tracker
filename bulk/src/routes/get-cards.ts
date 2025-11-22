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

router.get('/api/bulk/cards/pricesduplicatedelete', async (req: Request, res: Response) => {
  try {
    console.log('Starting duplicate price deletion process...');
    
    // Find duplicates - same card_id on the same day (DATE(price_date))
    // Keep the earliest timestamp and delete the rest
    const deleteQuery = `
      DELETE cp1 FROM card_prices cp1
      INNER JOIN (
        SELECT 
          card_id,
          DATE(price_date) as price_day,
          MIN(price_date) as earliest_time
        FROM card_prices
        GROUP BY card_id, DATE(price_date)
        HAVING COUNT(*) > 1
      ) cp2 
      ON cp1.card_id = cp2.card_id 
      AND DATE(cp1.price_date) = cp2.price_day
      AND cp1.price_date > cp2.earliest_time
    `;

    const [result] = await CardPrice.getPool().execute(deleteQuery);
    const deletedCount = (result as any).affectedRows || 0;

    console.log(`Deleted ${deletedCount} duplicate price entries`);

    res.status(200).json({
      message: 'Duplicate prices deleted successfully',
      deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting duplicate prices:', error);
    res.status(500).json({
      error: 'Failed to delete duplicate prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as cardsRouter };
