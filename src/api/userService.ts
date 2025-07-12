// User service for API tests
export class UserService {
  async getUser(id: string): Promise<any> {
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`
    };
  }

  async createUser(userData: any): Promise<any> {
    const user = await this.validateUser(userData);
    return this.saveUser(user);
  }

  private async validateUser(userData: any): Promise<any> {
    if (!userData.name) {
      throw new Error('Name is required');
    }
    return userData;
  }

  private async saveUser(user: any): Promise<any> {
    return {
      ...user,
      id: Math.random().toString(36).substr(2, 9)
    };
  }
}