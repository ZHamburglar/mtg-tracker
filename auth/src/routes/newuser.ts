import express, { Request, Response} from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';
import { BadRequestError } from '../errors/bad-request-error';
import { validateRequest } from '../middlewares/validate-request';

export const router = express.Router();

router.post('/api/users/newuser',
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

    res.status(201).send({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });
});

export { router as newUserRouter };