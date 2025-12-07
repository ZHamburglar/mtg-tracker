import express, { Request, Response } from 'express';
import { User } from '../models/user';

const router = express.Router();

router.get('/api/users/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'auth',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/users/ready', async (req: Request, res: Response) => {
  // Readiness probe - can the service handle traffic?
  try {
    // Check database connection
    const pool = User.getPool();
    if (!pool) {
      return res.status(503).json({ 
        status: 'not ready',
        error: 'Database pool not initialized'
      });
    }
    
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
