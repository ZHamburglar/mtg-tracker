import express, { Request, Response} from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';

export const router = express.Router();

router.post('/api/users/newuser',
  [
    body('email')
      .isEmail()
      .withMessage('Email must be valid'),
    body('password')
      .trim()
      .isLength({ min: 8, max: 25 })
      .withMessage('Password must be between 8 and 25 characters')
  ],
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);

    if (existingUser) {
      throw new Error('Email in use');
    }

    // Create new user in database
    const user = await User.create({
      email,
      password,
      role: 'user'
    });

    // Generate JWT token
    const userJwt = jwt.sign(
      {
        id: user.id,
        email: user.email,
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
      role: user.role
    });
});

export { router as newUserRouter };