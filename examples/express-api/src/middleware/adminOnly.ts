import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new ApiError('Authentication required', 401);
  }
  
  if (req.user.role !== 'admin') {
    throw new ApiError('Admin access required', 403);
  }
  
  next();
};