import bcrypt from 'bcrypt';
import { UserService } from './userService';
import { TokenService } from './tokenService';
import { CacheService } from './cache';
import { User } from '../models/user';

interface LoginResult {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private userService: UserService;
  private tokenService: TokenService;
  private cache: CacheService;

  constructor() {
    this.userService = new UserService();
    this.tokenService = new TokenService();
    this.cache = CacheService.getInstance();
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    return this.userService.createUser(data);
  }

  async login(email: string, password: string): Promise<LoginResult | null> {
    const user = await this.userService.getUserByEmail(email);
    
    if (!user || !user.isActive) {
      return null;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }
    
    // Update last login
    await this.userService.updateLastLogin(user.id);
    
    // Generate tokens
    const accessToken = this.tokenService.generateAccessToken(user);
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);
    
    // Cache session
    await this.cache.set(`session:${user.id}`, {
      userId: user.id,
      accessToken,
      refreshToken,
      loginTime: new Date()
    }, 86400); // 24 hours
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> {
    const userId = await this.tokenService.verifyRefreshToken(refreshToken);
    
    if (!userId) {
      return null;
    }
    
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isActive) {
      return null;
    }
    
    // Generate new tokens
    const newAccessToken = this.tokenService.generateAccessToken(user);
    const newRefreshToken = await this.tokenService.generateRefreshToken(user.id);
    
    // Invalidate old refresh token
    await this.tokenService.invalidateRefreshToken(refreshToken);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(userId: string): Promise<void> {
    // Clear session cache
    await this.cache.del(`session:${userId}`);
    
    // Invalidate all refresh tokens for user
    await this.tokenService.invalidateAllUserTokens(userId);
  }

  async getSession(userId: string): Promise<any> {
    return this.cache.get(`session:${userId}`);
  }

  async invalidateAllSessions(userId: string): Promise<void> {
    await this.cache.del(`session:${userId}`);
    await this.tokenService.invalidateAllUserTokens(userId);
  }
}