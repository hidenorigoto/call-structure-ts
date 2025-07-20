import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache';
import { ApiError } from '../utils/apiError';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests, please try again later.'
};

export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = defaultConfig;
    const cache = CacheService.getInstance();
    
    // Create a unique key for the client
    const key = `rate_limit:${req.ip}:${req.path}`;
    
    // Get current count
    const current = await cache.get<number>(key) || 0;
    
    if (current >= config.maxRequests) {
      throw new ApiError(config.message || 'Rate limit exceeded', 429);
    }
    
    // Increment count
    await cache.increment(key, 1, Math.floor(config.windowMs / 1000));
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current - 1));
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString());
    
    next();
  } catch (error) {
    next(error);
  }
};

// Create specialized rate limiters for different endpoints
export const createRateLimiter = (config: Partial<RateLimitConfig>) => {
  const finalConfig = { ...defaultConfig, ...config };
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cache = CacheService.getInstance();
      const key = `rate_limit:${req.ip}:${req.path}`;
      const current = await cache.get<number>(key) || 0;
      
      if (current >= finalConfig.maxRequests) {
        throw new ApiError(finalConfig.message || 'Rate limit exceeded', 429);
      }
      
      await cache.increment(key, 1, Math.floor(finalConfig.windowMs / 1000));
      
      res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - current - 1));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + finalConfig.windowMs).toISOString());
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Specialized rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later.'
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 60,
  message: 'API rate limit exceeded.'
});