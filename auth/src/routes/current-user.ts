import express from 'express';
import { currentUser } from '@mtg-tracker/common';
import { logger } from '../logger';

const router = express.Router();

router.get('/api/users/currentuser', currentUser, (req, res) => {
  logger.log('Current user requested:', { currentUser: req.currentUser });
  res.send({ currentUser: req.currentUser || null });
});

export { router as currentUserRouter };
