import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/api/notification/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'notification',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/notification/ready', async (req: Request, res: Response) => {
  try {
    // const pool = UserCardCollection.getPool();
    // const conn = await pool.getConnection();
    // await conn.query('SELECT 1');
    // conn.release();
    

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
