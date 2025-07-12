// User service for API tests
export class UserService {
  async getUser(id: string): Promise<{ id: string; name: string; email: string }> {
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`
    };
  }

  async createUser(userData: { name: string; email?: string }): Promise<{ id: string; name: string; email?: string }> {
    const user = await this.validateUser(userData);
    return this.saveUser(user);
  }

  private async validateUser(userData: { name: string; email?: string }): Promise<{ name: string; email?: string }> {
    if (!userData.name) {
      throw new Error('Name is required');
    }
    return userData;
  }

  private async saveUser(user: { name: string; email?: string }): Promise<{ id: string; name: string; email?: string }> {
    return {
      ...user,
      id: Math.random().toString(36).substr(2, 9)
    };
  }
}