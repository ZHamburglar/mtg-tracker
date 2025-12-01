import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';

interface UserPayload {
  id: number;
  email: string;
  username: string;
  role: 'user' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: UserPayload;
    }
  }
}

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
