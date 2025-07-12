export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: Map<string, User> = new Map();

  async createUser(name: string, email: string): Promise<User> {
    this.validateInput(name, email);
    
    const user: User = {
      id: this.generateId(),
      name,
      email
    };

    await this.saveUser(user);
    await this.sendWelcomeEmail(user);
    
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (user) {
      await this.logAccess(user);
    }
    return user || null;
  }

  private validateInput(name: string, email: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Name is required');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
    await this.delay(100); // Simulate async operation
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    console.log(`Sending welcome email to ${user.email}`);
    await this.delay(50); // Simulate async operation
  }

  private async logAccess(user: User): Promise<void> {
    console.log(`User accessed: ${user.name}`);
    await this.delay(10); // Simulate async operation
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}