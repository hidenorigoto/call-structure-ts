import { ConfigService } from '../services/ConfigService';
import { DatabaseService } from '../services/DatabaseService';
import { UserController } from '../controllers/UserController';
import { ProductController } from '../controllers/ProductController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Logger } from '../utils/Logger';

export class Application {
  private db: DatabaseService;
  private userController: UserController;
  private productController: ProductController;
  private authMiddleware: AuthMiddleware;

  constructor(
    private config: ConfigService,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    this.logger.info('Initializing application...');

    this.db = new DatabaseService(this.config);
    await this.db.connect();

    this.authMiddleware = new AuthMiddleware(this.config, this.logger);
    this.userController = new UserController(this.db, this.authMiddleware, this.logger);
    this.productController = new ProductController(this.db, this.authMiddleware, this.logger);

    await this.setupRoutes();
  }

  async run(): Promise<void> {
    this.logger.info('Running application...');

    await this.userController.handleRequest({ action: 'list' });
    await this.productController.handleRequest({ action: 'featured' });

    await this.performBackgroundTasks();
  }

  private async setupRoutes(): Promise<void> {
    this.logger.debug('Setting up routes...');

    this.registerRoute('/users', this.userController);
    this.registerRoute('/products', this.productController);
  }

  private registerRoute(path: string, _controller: any): void {
    this.logger.debug(`Registering route: ${path}`);
  }

  private async performBackgroundTasks(): Promise<void> {
    await this.cleanupOldData();
    await this.syncWithExternalServices();
  }

  private async cleanupOldData(): Promise<void> {
    this.logger.info('Cleaning up old data...');
    await this.db.cleanup();
  }

  private async syncWithExternalServices(): Promise<void> {
    this.logger.info('Syncing with external services...');
  }
}
