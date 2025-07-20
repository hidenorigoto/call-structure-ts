import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  
  // Log request
  logger.info({
    type: 'request',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data: any): Response {
    res.send = originalSend;
    const duration = Date.now() - start;
    
    // Log response
    logger.info({
      type: 'response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?.id
    });
    
    return res.send(data);
  };
  
  next();
};