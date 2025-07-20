import bcrypt from 'bcrypt';
import { DatabaseService } from './database';
import { CacheService } from './cache';
import { ApiError } from '../utils/apiError';
import { User, UserCreateInput, UserUpdateInput } from '../models/user';

export class UserService {
  private db: DatabaseService;
  private cache: CacheService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.cache = CacheService.getInstance();
  }

  async getAllUsers(options: {
    page: number;
    limit: number;
    sort: string;
  }): Promise<{ users: User[]; total: number; page: number; totalPages: number }> {
    const offset = (options.page - 1) * options.limit;
    
    const [users, total] = await Promise.all([
      this.db.users.findMany({
        skip: offset,
        take: options.limit,
        orderBy: { [options.sort]: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true
        }
      }),
      this.db.users.count()
    ]);
    
    return {
      users,
      total,
      page: options.page,
      totalPages: Math.ceil(total / options.limit)
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await this.db.users.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true
      }
    });
    
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.db.users.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    return user;
  }

  async createUser(data: UserCreateInput): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const user = await this.db.users.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: data.role || 'user',
        isActive: true,
        isVerified: false
      }
    });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async updateUser(id: string, data: UserUpdateInput): Promise<User | null> {
    const user = await this.db.users.update({
      where: { id },
      data: {
        ...data,
        email: data.email?.toLowerCase(),
        updatedAt: new Date()
      }
    });
    
    if (!user) return null;
    
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.db.users.findUnique({
      where: { id }
    });
    
    if (!user) {
      throw new ApiError('User not found', 404);
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new ApiError('Current password is incorrect', 400);
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await this.db.users.update({
      where: { id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    });
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await this.db.users.update({
      where: { id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    });
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.users.delete({
      where: { id }
    });
  }

  async verifyEmail(id: string): Promise<void> {
    await this.db.users.update({
      where: { id },
      data: { 
        isVerified: true,
        updatedAt: new Date()
      }
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.users.update({
      where: { id },
      data: { 
        lastLogin: new Date()
      }
    });
  }

  async getUserStatistics(): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      adminUsers,
      recentUsers
    ] = await Promise.all([
      this.db.users.count(),
      this.db.users.count({ where: { isActive: true } }),
      this.db.users.count({ where: { isVerified: true } }),
      this.db.users.count({ where: { role: 'admin' } }),
      this.db.users.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);
    
    return {
      total: totalUsers,
      active: activeUsers,
      verified: verifiedUsers,
      admins: adminUsers,
      newThisWeek: recentUsers,
      percentActive: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
      percentVerified: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0
    };
  }

  async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.db.users.findUnique({
      where: { id: userId }
    });
    
    if (!user) return false;
    
    return bcrypt.compare(password, user.password);
  }
}