import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';
import '@mtg-tracker/common';  // Import to ensure UserPayload type is available

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.currentUser) {
    throw new NotAuthorizedError();
  }

  if (req.currentUser.role !== 'admin') {
    throw new NotAuthorizedError();
  }

  next();
};
