import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenService } from '../services/tokenService';
import { UserService } from '../services/userService';
import { ApiError } from '../utils/apiError';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

// Extended in express.d.ts file instead
// declare global {
//   namespace Express {
//     interface Request {
//       user?: JwtPayload;
//     }
//   }
// }

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('No token provided', 401);
    }
    
    const token = authHeader.substring(7);
    const tokenService = new TokenService();
    
    // Verify token
    const decoded = await tokenService.verifyAccessToken(token);
    
    if (!decoded) {
      throw new ApiError('Invalid token', 401);
    }
    
    // Check if user still exists and is active
    const userService = new UserService();
    const user = await userService.getUserById(decoded.id);
    
    if (!user || !user.isActive) {
      throw new ApiError('User not found or inactive', 401);
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError('Token expired', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};