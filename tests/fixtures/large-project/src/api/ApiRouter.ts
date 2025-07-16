import { UserController } from '../controllers/UserController';
import { ProductController } from '../controllers/ProductController';
import { OrderController } from '../controllers/OrderController';
import { PaymentController } from '../controllers/PaymentController';
import { RateLimiter } from '../middleware/RateLimiter';
import { ErrorHandler } from '../middleware/ErrorHandler';
import { RequestLogger } from '../middleware/RequestLogger';

export class ApiRouter {
  private routes: Map<string, any> = new Map();
  private middleware: any[] = [];

  constructor(
    private userController: UserController,
    private productController: ProductController,
    private orderController: OrderController,
    private paymentController: PaymentController
  ) {
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.middleware.push(new RequestLogger());
    this.middleware.push(new RateLimiter());
    this.middleware.push(new ErrorHandler());
  }

  private setupRoutes(): void {
    this.addRoute('/api/users', this.userController);
    this.addRoute('/api/products', this.productController);
    this.addRoute('/api/orders', this.orderController);
    this.addRoute('/api/payments', this.paymentController);

    this.setupWebhooks();
    this.setupHealthChecks();
  }

  private addRoute(path: string, controller: any): void {
    this.routes.set(path, controller);
    this.applyMiddleware(path);
  }

  private applyMiddleware(path: string): void {
    this.middleware.forEach(mw => mw.apply(path));
  }

  private setupWebhooks(): void {
    this.addRoute('/webhooks/payment', new PaymentWebhookHandler());
    this.addRoute('/webhooks/inventory', new InventoryWebhookHandler());
  }

  private setupHealthChecks(): void {
    this.addRoute('/health', new HealthCheckController());
    this.addRoute('/metrics', new MetricsController());
  }
}

class PaymentWebhookHandler {
  async handle(_request: any): Promise<void> {
    console.log('Payment webhook received');
  }
}

class InventoryWebhookHandler {
  async handle(_request: any): Promise<void> {
    console.log('Inventory webhook received');
  }
}

class HealthCheckController {
  async handle(): Promise<any> {
    return { status: 'healthy' };
  }
}

class MetricsController {
  async handle(): Promise<any> {
    return { uptime: process.uptime() };
  }
}
