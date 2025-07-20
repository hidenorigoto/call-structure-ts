import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.id
  });

  // Handle known errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: {
        message: 'Validation error',
        details: err.message
      }
    });
    return;
  }

  // Handle database errors
  if (err.name === 'MongoError' || err.name === 'SequelizeError') {
    res.status(500).json({
      error: {
        message: 'Database error',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
      }
    });
    return;
  }

  // Default error response
  res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { 
        details: err.message,
        stack: err.stack 
      })
    }
  });
};