import { DatabaseService } from '../services/DatabaseService';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Logger } from '../utils/Logger';
import { User } from '../models/User';
import { validateUser } from '../utils/validators';

interface Request {
  action: string;
  userId?: string;
  data?: any;
}

export class UserController {
  constructor(
    private db: DatabaseService,
    private auth: AuthMiddleware,
    private logger: Logger
  ) {}

  async handleRequest(request: Request): Promise<any> {
    this.logger.info(`Handling user request: ${request.action}`);

    if (!this.auth.isAuthorized(request)) {
      throw new Error('Unauthorized');
    }

    switch (request.action) {
      case 'list':
        return this.listUsers();
      case 'get':
        return this.getUser(request.userId!);
      case 'create':
        return this.createUser(request.data);
      case 'update':
        return this.updateUser(request.userId!, request.data);
      case 'delete':
        return this.deleteUser(request.userId!);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  private async listUsers(): Promise<User[]> {
    const users = await this.db.getUserRepository().findAll();
    return users.map(user => this.sanitizeUser(user));
  }

  private async getUser(id: string): Promise<User> {
    const user = await this.db.getUserRepository().findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return this.sanitizeUser(user);
  }

  private async createUser(data: any): Promise<User> {
    validateUser(data);
    const user = await this.db.getUserRepository().create(data);
    this.logger.info(`Created user: ${user.id}`);
    return this.sanitizeUser(user);
  }

  private async updateUser(id: string, data: any): Promise<User> {
    validateUser(data);
    const user = await this.db.getUserRepository().update(id, data);
    this.logger.info(`Updated user: ${id}`);
    return this.sanitizeUser(user);
  }

  private async deleteUser(id: string): Promise<void> {
    await this.db.getUserRepository().delete(id);
    this.logger.info(`Deleted user: ${id}`);
  }

  private sanitizeUser(user: User): User {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...sanitized } = user;
    return sanitized as User;
  }
}
