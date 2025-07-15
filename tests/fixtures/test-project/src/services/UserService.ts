// User service with dependency injection pattern

export interface Logger {
  log(message: string): void;
  error(message: string): void;
}

export interface Database {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<void>;
}

export class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(`[LOG] ${message}`);
  }

  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}

export class MockDatabase implements Database {
  async query(_sql: string, _params?: any[]): Promise<any[]> {
    // Mock implementation
    return [];
  }

  async execute(_sql: string, _params?: any[]): Promise<void> {
    // Mock implementation
  }
}

export class UserService {
  constructor(
    private logger: Logger,
    private db: Database
  ) {}

  async getUser(id: string): Promise<User | null> {
    this.logger.log(`Fetching user ${id}`);

    try {
      const results = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);

      if (results.length === 0) {
        return null;
      }

      return this.mapToUser(results[0]);
    } catch (error) {
      this.logger.error(`Failed to fetch user: ${error}`);
      throw error;
    }
  }

  async createUser(user: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user ${user.email}`);

    const id = this.generateId();
    const newUser: User = {
      id,
      ...user,
      createdAt: new Date(),
    };

    await this.db.execute('INSERT INTO users (id, email, name, createdAt) VALUES (?, ?, ?, ?)', [
      newUser.id,
      newUser.email,
      newUser.name,
      newUser.createdAt,
    ]);

    return newUser;
  }

  async updateUser(id: string, updates: UpdateUserDto): Promise<User | null> {
    const user = await this.getUser(id);
    if (!user) {
      return null;
    }

    const updatedUser = { ...user, ...updates };

    await this.db.execute('UPDATE users SET email = ?, name = ? WHERE id = ?', [
      updatedUser.email,
      updatedUser.name,
      id,
    ]);

    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) {
      return false;
    }

    await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
    this.logger.log(`Deleted user ${id}`);

    return true;
  }

  private mapToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.createdAt),
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Static method example
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
}
