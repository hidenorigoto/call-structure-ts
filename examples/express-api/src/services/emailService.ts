import { logger } from '../utils/logger';

export class EmailService {
  private fromAddress: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'noreply@example.com';
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
    
    const subject = 'Verify Your Email Address';
    const body = `
      Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account, please ignore this email.
    `;
    
    await this.sendEmail(email, subject, body);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
    
    const subject = 'Password Reset Request';
    const body = `
      You requested a password reset. Click the link below to reset your password:
      
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this, please ignore this email.
    `;
    
    await this.sendEmail(email, subject, body);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const subject = 'Welcome to Our Platform!';
    const body = `
      Hi ${name},
      
      Welcome to our platform! We're excited to have you on board.
      
      Here are some things you can do:
      - Update your profile
      - Browse our products
      - Make your first purchase
      
      If you have any questions, feel free to reach out to our support team.
      
      Best regards,
      The Team
    `;
    
    await this.sendEmail(email, subject, body);
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // In a real application, this would use an email service like SendGrid, AWS SES, etc.
    logger.info({
      type: 'email',
      from: this.fromAddress,
      to,
      subject,
      timestamp: new Date().toISOString()
    });
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}