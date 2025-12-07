import express from 'express';
import { logger } from '../logger';

const router = express.Router();

router.post('/api/users/signout', (req, res) => {
  req.session = null;

  logger.log('User signed out');

  res.send({});
});

export { router as userSignoutRouter };