import { UserService } from './UserService';

export async function main(): Promise<void> {
  const userService = new UserService();
  
  console.log('Creating new user...');
  const user = await userService.createUser('John Doe', 'john@example.com');
  
  console.log('Retrieving user...');
  const retrievedUser = await userService.getUserById(user.id);
  
  console.log('User operations completed:', retrievedUser);
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}