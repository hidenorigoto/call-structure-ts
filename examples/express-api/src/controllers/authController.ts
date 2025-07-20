import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { UserService } from '../services/userService';
import { EmailService } from '../services/emailService';
import { TokenService } from '../services/tokenService';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

export class AuthController {
  private authService: AuthService;
  private userService: UserService;
  private emailService: EmailService;
  private tokenService: TokenService;

  constructor() {
    this.authService = new AuthService();
    this.userService = new UserService();
    this.emailService = new EmailService();
    this.tokenService = new TokenService();
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await this.userService.getUserByEmail(email);
      if (existingUser) {
        throw new ApiError('Email already registered', 409);
      }
      
      // Create user
      const user = await this.authService.register({ name, email, password });
      
      // Generate verification token
      const verificationToken = await this.tokenService.generateVerificationToken(user.id);
      
      // Send verification email
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
      
      logger.info(`User registered: ${user.email}`);
      
      res.status(201).json({
        message: 'Registration successful. Please check your email for verification.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      const result = await this.authService.login(email, password);
      
      if (!result) {
        throw new ApiError('Invalid credentials', 401);
      }
      
      logger.info(`User logged in: ${email}`);
      
      res.json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      
      const result = await this.authService.refreshToken(refreshToken);
      
      if (!result) {
        throw new ApiError('Invalid refresh token', 401);
      }
      
      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      
      if (userId) {
        await this.authService.logout(userId);
      }
      
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      
      const user = await this.userService.getUserByEmail(email);
      
      if (user) {
        const resetToken = await this.tokenService.generatePasswordResetToken(user.id);
        await this.emailService.sendPasswordResetEmail(email, resetToken);
      }
      
      // Always return success to prevent email enumeration
      res.json({ 
        message: 'If the email exists, a password reset link has been sent.' 
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      
      const userId = await this.tokenService.verifyPasswordResetToken(token);
      
      if (!userId) {
        throw new ApiError('Invalid or expired reset token', 400);
      }
      
      await this.userService.updatePassword(userId, newPassword);
      
      // Invalidate all existing sessions
      await this.authService.invalidateAllSessions(userId);
      
      logger.info(`Password reset for user: ${userId}`);
      
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.body;
      
      const userId = await this.tokenService.verifyEmailToken(token);
      
      if (!userId) {
        throw new ApiError('Invalid or expired verification token', 400);
      }
      
      await this.userService.verifyEmail(userId);
      
      logger.info(`Email verified for user: ${userId}`);
      
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  };

  getCurrentSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new ApiError('No active session', 401);
      }
      
      const session = await this.authService.getSession(userId);
      
      res.json(session);
    } catch (error) {
      next(error);
    }
  };
}