import express, { Request, Response } from 'express';
import { Card } from '../models/card';

const router = express.Router();

router.get('/api/search/health', (req: Request, res: Response) => {
  console.log('[Search] GET /api/search/health - Health check request');
  
  res.status(200).json({
    status: 'healthy',
    service: 'search',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/search/ready', async (req: Request, res: Response) => {
  try {
    const pool = Card.getPool();
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
