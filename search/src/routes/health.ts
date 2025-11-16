import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/api/search/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'search',
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };
