import { DatabaseService } from '../services/DatabaseService';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Logger } from '../utils/Logger';
import { Order } from '../models/Order';
import { EventEmitter } from '../events/EventEmitter';
import { NotificationService } from '../services/NotificationService';

export class OrderController {
  private eventEmitter: EventEmitter;
  private notificationService: NotificationService;

  constructor(
    private db: DatabaseService,
    private auth: AuthMiddleware,
    private logger: Logger
  ) {
    this.eventEmitter = new EventEmitter();
    this.notificationService = new NotificationService();
  }

  async handleRequest(request: any): Promise<any> {
    this.logger.info(`Handling order request: ${request.action}`);

    if (!this.auth.isAuthorized(request)) {
      throw new Error('Unauthorized');
    }

    switch (request.action) {
      case 'create':
        return this.createOrder(request.data);
      case 'status':
        return this.getOrderStatus(request.orderId);
      case 'cancel':
        return this.cancelOrder(request.orderId);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  private async createOrder(orderData: any): Promise<Order> {
    const order = await this.db.getOrderRepository().create(orderData);

    await this.eventEmitter.emit('order:created', order);
    await this.notificationService.sendOrderConfirmation(order);

    return order;
  }

  private async getOrderStatus(orderId: string): Promise<any> {
    const order = await this.db.getOrderRepository().findById(orderId);
    return this.calculateOrderStatus(order);
  }

  private async cancelOrder(orderId: string): Promise<void> {
    await this.db.getOrderRepository().cancel(orderId);
    await this.eventEmitter.emit('order:cancelled', { orderId });
  }

  private calculateOrderStatus(order: Order): any {
    return {
      id: order.id,
      status: order.status,
      estimatedDelivery: this.calculateDeliveryDate(order),
    };
  }

  private calculateDeliveryDate(_order: Order): Date {
    return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  }
}
