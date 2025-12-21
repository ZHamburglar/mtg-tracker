import express, { Request, Response} from 'express';
import { body } from 'express-validator';
import { emailValidator, usernameValidator, passwordValidator } from '../middlewares/validators';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';
import { BadRequestError, validateRequest } from '@mtg-tracker/common';
import { createRateLimiter } from '../middlewares/rate-limiter';
import { logger } from '../logger';

export const router = express.Router();

// Rate limiter: 10 new user attempts per 1 minute per IP
const newUserRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  prefix: 'rl:newuser:',
  message: 'Too many new user attempts from this IP, please try again after 1 minute.',
});

router.post('/api/users/newuser',
  newUserRateLimiter,
  [
    emailValidator,
    usernameValidator,
    passwordValidator
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