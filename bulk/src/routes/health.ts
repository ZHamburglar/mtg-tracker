import express, { Request, Response } from 'express';
import { CardPrice } from '../models/cardprice';

const router = express.Router();

router.get('/api/bulk/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'bulk',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/bulk/ready', async (req: Request, res: Response) => {
  try {
    const pool = CardPrice.getPool();
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    
    res.status(200).json({ 
      status: 'ready',
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as healthRouter };
