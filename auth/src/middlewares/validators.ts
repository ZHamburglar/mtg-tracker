import { body } from 'express-validator';

// Reserved usernames that are not allowed
const reservedUsernames = [
  'admin', 'root', 'system', 'support', 'moderator', 'administrator', 'mod',
  'owner', 'null', 'undefined', 'user', 'test'
];

export const emailValidator = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Email must be valid');

export const usernameValidator = body('username')
  .trim()
  .notEmpty()
  .withMessage('Username is required')
  .isLength({ min: 3, max: 50 })
  .withMessage('Username must be between 3 and 50 characters')
  // Only allow letters, numbers, underscores, hyphens
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
  // Disallow starting/ending with hyphen/underscore
  .matches(/^(?![_-])(.*?)(?<![_-])$/)
  .withMessage('Username cannot start or end with a hyphen or underscore')
  // Disallow consecutive hyphens or underscores
  .not().matches(/(--|__|_-|-_)/)
  .withMessage('Username cannot contain consecutive hyphens or underscores')
  // Forbid reserved words
  .custom((value) => {
    if (reservedUsernames.includes(value.toLowerCase())) {
      throw new Error('Username is a reserved word');
    }
    return true;
  });

export const passwordValidator = body('password')
  .trim()
  .isLength({ min: 8, max: 25 })
  .withMessage('Password must be between 8 and 25 characters')
  .matches(/^[^'";\\]+$/)
  .withMessage('Password cannot contain quotes, semicolons, or backslashes');
