import express, { Request, Response } from 'express';
import { UserCardCollection } from '../models/user-card-collection';
import { natsWrapper } from '../nats-wrapper';

const router = express.Router();

router.get('/api/collection/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'collection',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/collection/ready', async (req: Request, res: Response) => {
  try {
    const pool = UserCardCollection.getPool();
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    
    const natsClient = natsWrapper.client;
    const natsConnected = !natsClient.isClosed();

    res.status(200).json({ 
      status: 'ready',
      database: 'connected',
      nats: natsConnected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as healthRouter };
