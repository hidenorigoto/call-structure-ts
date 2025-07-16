import { greet, calculate } from './utils';
import { UserService } from './services/UserService';

export function main(): void {
  console.log('Starting small project...');

  const message = greet('World');
  console.log(message);

  const result = calculate(10, 20);
  console.log(`Calculation result: ${result}`);

  const userService = new UserService();
  const users = userService.getAllUsers();
  console.log(`Found ${users.length} users`);
}

if (require.main === module) {
  main();
}
