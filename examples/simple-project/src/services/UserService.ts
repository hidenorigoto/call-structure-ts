import { ValidationService } from './ValidationService';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private validationService: ValidationService;
  private users: Map<string, User> = new Map();

  constructor() {
    this.validationService = new ValidationService();
  }

  async createUser(data: any): Promise<User> {
    logger.info('Creating user');
    
    // Sync call
    const isValid = this.validationService.validate(data);
    if (!isValid) {
      throw new Error('Invalid user data');
    }

    const user: User = {
      id: this.generateId(),
      name: data.name,
      email: data.email
    };

    // Async call
    await this.saveToDatabase(user);
    
    // Callback usage
    this.notifyAdmins(() => {
      logger.info('Admins notified');
    });
    
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (user) {
      await this.logAccess(user);
    }
    return user || null;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async saveToDatabase(data: any): Promise<void> {
    // Simulate DB operation
    this.users.set(data.id, data);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private notifyAdmins(callback: () => void): void {
    setTimeout(callback, 0);
  }

  private async logAccess(user: User): Promise<void> {
    logger.debug(`User accessed: ${user.name}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}