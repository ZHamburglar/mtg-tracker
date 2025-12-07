import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { currentUser } from '@mtg-tracker/common';
import { User } from '../models/user';
import { BadRequestError } from '../errors/bad-request-error';
import { NotFoundError } from '../errors/not-found-error';
import { validateRequest } from '../middlewares/validate-request';
import { requireAdmin } from '../middlewares/require-admin';
import { logger } from '../logger';

export const router = express.Router();

router.patch('/api/users/:id',
  currentUser,
  requireAdmin,
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email must be valid'),
    body('password')
      .optional()
      .trim()
      .isLength({ min: 8, max: 25 })
      .withMessage('Password must be between 8 and 25 characters'),
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password, role } = req.body;
    
    if (!req.params.id) {
      throw new BadRequestError('User ID is required');
    }

    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    // Check if user exists
    const existingUser = await User.findById(userId);

    if (!existingUser) {
      throw new NotFoundError();
    }

    // If changing email, check if new email is already in use by another user
    if (email && email !== existingUser.email) {
      const emailInUse = await User.findByEmail(email);
      if (emailInUse && emailInUse.id !== existingUser.id) {
        throw new BadRequestError('Email already in use');
      }
    }

    // Build update object
    const updates: any = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (role) updates.role = role;

    // Update user
    const updatedUser = await User.updateById(userId, updates);

    if (!updatedUser) {
      throw new NotFoundError();
    }

    logger.log('User updated:', { id: updatedUser.id, role: updatedUser.role });

    // Return updated user (without password)
    res.status(200).json({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      is_active: updatedUser.is_active,
      is_verified: updatedUser.is_verified,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at
    });
  }
);

export { router as updateUserRouter };
