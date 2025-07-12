import { UserService } from './services/UserService';
import { logger } from './utils/logger';

async function main() {
  const userService = new UserService();
  
  try {
    logger.info('Starting simple project example');
    
    const userData = {
      name: 'John Doe',
      email: 'john.doe@example.com'
    };
    
    const user = await userService.createUser(userData);
    logger.success(`User created: ${user.name} (${user.id})`);
    
    const retrievedUser = await userService.getUserById(user.id);
    if (retrievedUser) {
      logger.info(`Retrieved user: ${retrievedUser.name}`);
    }
  } catch (error) {
    logger.error('Error in main execution:', error);
  }
}

if (require.main === module) {
  main();
}