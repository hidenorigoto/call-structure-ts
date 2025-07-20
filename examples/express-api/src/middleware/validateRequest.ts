import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/apiError';

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : undefined,
      message: error.msg
    }));
    
    throw new ApiError('Validation failed', 400, 'VALIDATION_ERROR', errorMessages);
  }
  
  next();
};