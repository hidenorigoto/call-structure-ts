import { processArray } from '../utils';

interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ];

  getAllUsers(): User[] {
    return this.validateUsers(this.users);
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  addUser(user: User): void {
    this.users.push(user);
    this.notifyUserAdded(user);
  }

  private validateUsers(users: User[]): User[] {
    processArray(users, user => this.validateUser(user));
    return users;
  }

  private validateUser(user: User): void {
    if (!user.email.includes('@')) {
      throw new Error(`Invalid email for user ${user.name}`);
    }
  }

  private notifyUserAdded(user: User): void {
    console.log(`User ${user.name} has been added`);
  }
}
