import { UserService } from './services/UserService';

export async function main(): Promise<void> {
  const userService = new UserService();
  
  console.log('Creating new user...');
  const userData = { name: 'John Doe', email: 'john@example.com' };
  const user = await userService.createUser(userData);
  
  console.log('Retrieving user...');
  const retrievedUser = await userService.getUserById(user.id);
  
  console.log('User operations completed:', retrievedUser);
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}