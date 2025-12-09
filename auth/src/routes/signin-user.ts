import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { validateRequest } from '../middlewares/validate-request';
import { BadRequestError } from '../errors/bad-request-error';
import { getRedisClient } from '../config/redis';

import { User } from '../models/user';
import { logger } from '../logger';

const router = express.Router();

// Lazy initialization: Store is created on first request when Redis is guaranteed to be ready
let signinRateLimiter: ReturnType<typeof rateLimit>;

const getSigninRateLimiter = () => {
  if (!signinRateLimiter) {
    signinRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 5, // 5 requests per window
      standardHeaders: 'draft-7', // Use RateLimit header
      legacyHeaders: false, // Disable X-RateLimit-* headers
      message: 'Too many signin attempts from this IP, please try again after 15 minutes.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      store: new RedisStore({
        sendCommand: (...args: any[]) => {
          const client = getRedisClient();
          return (client as any).call(...args);
        },
        prefix: 'rl:signin:',
      }),
      // Fallback to memory store if Redis becomes unavailable during runtime
      passOnStoreError: true,
    });
  }
  return signinRateLimiter;
};

router.post(
  '/api/users/signin',
  (req: express.Request, res: express.Response, next: express.NextFunction) => getSigninRateLimiter()(req, res, next),
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
