import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { CacheService } from './cache';
import { User } from '../models/user';

export class TokenService {
  private cache: CacheService;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.cache = CacheService.getInstance();
    this.accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || 'access-secret-key';
    this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key';
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
  }

  generateAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    
    // Store refresh token
    await this.cache.set(
      `refresh_token:${token}`,
      userId,
      7 * 24 * 60 * 60 // 7 days
    );
    
    return token;
  }

  async verifyAccessToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<string | null> {
    const userId = await this.cache.get<string>(`refresh_token:${token}`);
    return userId;
  }

  async invalidateRefreshToken(token: string): Promise<void> {
    await this.cache.del(`refresh_token:${token}`);
  }

  async invalidateAllUserTokens(userId: string): Promise<void> {
    // In a real app, you'd track all tokens per user
    // For demo, we'll just clear patterns
    await this.cache.invalidatePattern(`refresh_token:*`);
  }

  async generateVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    
    await this.cache.set(
      `verify_email:${token}`,
      userId,
      24 * 60 * 60 // 24 hours
    );
    
    return token;
  }

  async verifyEmailToken(token: string): Promise<string | null> {
    const userId = await this.cache.get<string>(`verify_email:${token}`);
    if (userId) {
      await this.cache.del(`verify_email:${token}`);
    }
    return userId;
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    
    await this.cache.set(
      `reset_password:${token}`,
      userId,
      60 * 60 // 1 hour
    );
    
    return token;
  }

  async verifyPasswordResetToken(token: string): Promise<string | null> {
    const userId = await this.cache.get<string>(`reset_password:${token}`);
    if (userId) {
      await this.cache.del(`reset_password:${token}`);
    }
    return userId;
  }
}