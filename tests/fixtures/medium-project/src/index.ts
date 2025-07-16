import { Application } from './core/Application';
import { ConfigService } from './services/ConfigService';
import { Logger } from './utils/Logger';

export async function main(): Promise<void> {
  const logger = new Logger('Main');
  logger.info('Starting medium project...');

  const config = new ConfigService();
  await config.load();

  const app = new Application(config, logger);
  await app.initialize();
  await app.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Application failed:', error);
    process.exit(1);
  });
}
