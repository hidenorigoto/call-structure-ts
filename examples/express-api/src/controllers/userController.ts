import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { CacheService } from '../services/cache';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

export class UserController {
  private userService: UserService;
  private cacheService: CacheService;

  constructor() {
    this.userService = new UserService();
    this.cacheService = CacheService.getInstance();
  }

  getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 10, sort = 'createdAt' } = req.query;
      
      const cacheKey = `users:${page}:${limit}:${sort}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }
      
      const users = await this.userService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        sort: sort as string
      });
      
      await this.cacheService.set(cacheKey, users, 300); // Cache for 5 minutes
      
      res.json(users);
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      const user = await this.userService.getUserById(id);
      
      if (!user) {
        throw new ApiError('User not found', 404);
      }
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new ApiError('Unauthorized', 401);
      }
      
      const user = await this.userService.getUserById(userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData = req.body;
      
      const existingUser = await this.userService.getUserByEmail(userData.email);
      if (existingUser) {
        throw new ApiError('Email already exists', 409);
      }
      
      const user = await this.userService.createUser(userData);
      
      logger.info(`User created: ${user.id}`);
      
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Users can only update their own profile unless admin
      if (req.user?.id !== id && req.user?.role !== 'admin') {
        throw new ApiError('Forbidden', 403);
      }
      
      const user = await this.userService.updateUser(id, updates);
      
      if (!user) {
        throw new ApiError('User not found', 404);
      }
      
      // Invalidate cache
      await this.cacheService.invalidatePattern('users:*');
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      
      // Users can only change their own password
      if (req.user?.id !== id) {
        throw new ApiError('Forbidden', 403);
      }
      
      await this.userService.changePassword(id, currentPassword, newPassword);
      
      logger.info(`Password changed for user: ${id}`);
      
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      await this.userService.deleteUser(id);
      
      // Invalidate cache
      await this.cacheService.invalidatePattern('users:*');
      
      logger.info(`User deleted: ${id}`);
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.userService.getUserStatistics();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}