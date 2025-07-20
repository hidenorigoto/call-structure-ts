import { CreateOrderDTO } from '../dto/CreateOrderDTO';
import { OrderService } from '../services/OrderService';
import { Order } from '../../domain/entities/Order';

export class CreateOrderUseCase {
  constructor(private readonly orderService: OrderService) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    // Validate input
    this.validateOrderData(dto);
    
    // Create order through the service
    const order = await this.orderService.createOrder(dto);
    
    // Log for audit purposes
    console.log(`Order created: ${order.getId()}`);
    
    return order;
  }

  private validateOrderData(dto: CreateOrderDTO): void {
    if (!dto.customerId) {
      throw new Error('Customer ID is required');
    }
    
    if (!dto.items || dto.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
    
    if (!dto.shippingAddress) {
      throw new Error('Shipping address is required');
    }
    
    if (!dto.billingAddress) {
      throw new Error('Billing address is required');
    }
    
    // Validate each item
    dto.items.forEach((item, index) => {
      if (!item.productId) {
        throw new Error(`Product ID is required for item at index ${index}`);
      }
      
      if (!item.quantity || item.quantity <= 0) {
        throw new Error(`Invalid quantity for item at index ${index}`);
      }
    });
  }
}