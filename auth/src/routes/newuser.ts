import express, { Request, Response} from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { User } from '../models/user';
import { BadRequestError } from '../errors/bad-request-error';
import { validateRequest } from '../middlewares/validate-request';
import { getRedisClient } from '../config/redis';
import { logger } from '../logger';

export const router = express.Router();

// Lazy initialization: Store is created on first request when Redis is guaranteed to be ready
let newUserRateLimiter: ReturnType<typeof rateLimit>;

const getNewUserRateLimiter = () => {
  if (!newUserRateLimiter) {
    newUserRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 10, // 10 requests per window
      standardHeaders: 'draft-7', // Use RateLimit header
      legacyHeaders: false, // Disable X-RateLimit-* headers
      message: 'Too many new user attempts from this IP, please try again after 15 minutes.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      store: new RedisStore({
        sendCommand: (...args: any[]) => {
          const client = getRedisClient();
          return (client as any).call(...args);
        },
        prefix: 'rl:newuser:',
      }),
      // Fallback to memory store if Redis becomes unavailable during runtime
      passOnStoreError: true,
    });
  }
  return newUserRateLimiter;
};

router.post('/api/users/newuser',
  (req: express.Request, res: express.Response, next: express.NextFunction) => getNewUserRateLimiter()(req, res, next),
  [
    body('email')
      .isEmail()
      .withMessage('Email must be valid'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    body('password')
      .trim()
      .isLength({ min: 8, max: 25 })
      .withMessage('Password must be between 8 and 25 characters')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, username, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);

    if (existingUser) {
      throw new BadRequestError('Email in use');
    }

    // Create new user in database
    const user = await User.create({
      email,
      username,
      password,
      role: 'user'
    });

    // Generate JWT token
    const userJwt = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      process.env.JWT_KEY || 'your-secret-key'
    );

    // Store it on session object
    req.session = {
      jwt: userJwt
    };

    logger.log('New user created:', { id: user.id, username: user.username, role: user.role });

    res.status(201).send({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });
});

export { router as newUserRouter };