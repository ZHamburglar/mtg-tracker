import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { validateRequest } from '../middlewares/validate-request';
import { BadRequestError } from '../errors/bad-request-error';
import { rateLimit } from '../middlewares/rate-limit';

import { User } from '../models/user';
import { logger } from '../logger';

const router = express.Router();

// Rate limiter: 5 signin attempts per 15 minutes per IP
const signinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many signin attempts from this IP, please try again after 15 minutes.',
  skipSuccessfulRequests: false, // Count all attempts (successful or not)
  skipFailedRequests: false
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
