import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/api/listing/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'listing',
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };
