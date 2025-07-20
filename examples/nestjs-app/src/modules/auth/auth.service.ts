import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User } from '../users/entities/user.entity';
import { CacheService } from '../../common/services/cache.service';
import { MailService } from '../../common/services/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    
    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    
    return null;
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Send welcome email
    await this.mailService.sendWelcomeEmail(user.email, user.name);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(user: User): Promise<AuthResponseDto> {
    const tokens = await this.generateTokens(user);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Check if token is blacklisted
      const isBlacklisted = await this.cacheService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Blacklist old refresh token
      await this.cacheService.set(
        `blacklist:${refreshToken}`,
        true,
        this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS'),
      );

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    // In a real app, you might want to blacklist the current tokens
    await this.cacheService.del(`user:session:${userId}`);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    
    if (user) {
      // Generate reset token
      const resetToken = this.generatePasswordResetToken();
      
      // Save token with expiry
      await this.cacheService.set(
        `password-reset:${resetToken}`,
        user.id,
        3600, // 1 hour
      );

      // Send email
      await this.mailService.sendPasswordResetEmail(email, resetToken);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Get user ID from token
    const userId = await this.cacheService.get<string>(`password-reset:${token}`);
    
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.usersService.updatePassword(userId, hashedPassword);

    // Delete reset token
    await this.cacheService.del(`password-reset:${token}`);
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Partial<User> {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  private generatePasswordResetToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}