import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { BadRequestError, validateRequest } from '@mtg-tracker/common'
import { createRateLimiter } from '../middlewares/rate-limiter';

import { User } from '../models/user';
import { logger } from '../logger';

const router = express.Router();

// Rate limiter: 5 signin attempts per 1 minute per IP
const signinRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  prefix: 'rl:signin:',
  message: 'Too many signin attempts from this IP, please try again after 1 minute.',
});

router.post(
  '/api/users/signin',
  signinRateLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Email must be valid'),
    body('password')
      .trim()
      .notEmpty()
      .withMessage('You must supply a password')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const existingUser = await User.findByEmailWithPassword(email);
    if (!existingUser) {
      throw new BadRequestError('Invalid credentials');
    }

    const passwordsMatch = await User.comparePassword(
      password,
      existingUser.password
    );
    if (!passwordsMatch) {
      throw new BadRequestError('Invalid Credentials');
    }

    // Generate JWT
    const userJwt = jwt.sign(
      {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
        role: existingUser.role
      },
      process.env.JWT_KEY || 'your-secret-key'
    );

    // Store it on session object
    req.session = {
      jwt: userJwt
    };

    logger.log('User signed in:', { id: existingUser.id, username: existingUser.username });
    
    res.status(200).send({
      id: existingUser.id,
      email: existingUser.email,
      username: existingUser.username,
      role: existingUser.role,
      is_active: existingUser.is_active,
      is_verified: existingUser.is_verified
    });
  }
);

export { router as userSigninRouter };
