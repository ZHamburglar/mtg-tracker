import express from 'express';
import { currentUser } from '@mtg-tracker/common';
import { logger } from '../logger';
import { createRateLimiter } from '../middlewares/rate-limiter';

const currentUserLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  prefix: 'rl:current-user',
  message: 'Too many requests, please try again later.'
});

const router = express.Router();

router.get('/api/users/currentuser', currentUserLimiter, currentUser, (req, res) => {
  logger.log('Current user requested:', { currentUser: req.currentUser });
  res.send({ currentUser: req.currentUser || null });
});

export { router as currentUserRouter };
