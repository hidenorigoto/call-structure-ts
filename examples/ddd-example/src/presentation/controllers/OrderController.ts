import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase';
import { CreateOrderDTO } from '../../application/dto/CreateOrderDTO';
import { Order } from '../../domain/entities/Order';
import { Address } from '../../domain/value-objects/Address';

export interface OrderResponse {
  id: string;
  customerId: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }>;
  total: {
    amount: number;
    currency: string;
  };
  shippingAddress: Address;
  billingAddress: Address;
  createdAt: string;
}

export class OrderController {
  constructor(private readonly createOrderUseCase: CreateOrderUseCase) {}

  async createOrder(dto: CreateOrderDTO): Promise<OrderResponse> {
    console.log(`[OrderController] Creating order for customer ${dto.customerId}`);
    
    try {
      // Validate request
      this.validateCreateOrderRequest(dto);
      
      // Execute use case
      const order = await this.createOrderUseCase.execute(dto);
      
      // Transform to response
      const response = this.mapOrderToResponse(order);
      
      console.log(`[OrderController] Order created successfully: ${response.id}`);
      return response;
      
    } catch (error) {
      console.error(`[OrderController] Error creating order:`, error);
      
      // In a real application, we would handle different error types
      // and return appropriate HTTP status codes
      throw {
        status: 400,
        message: error instanceof Error ? error.message : 'Failed to create order',
        code: 'ORDER_CREATION_FAILED'
      };
    }
  }

  private validateCreateOrderRequest(dto: CreateOrderDTO): void {
    // Additional controller-level validation
    // The use case will also validate, but we can catch obvious issues here
    
    if (!dto) {
      throw new Error('Request body is required');
    }
    
    if (dto.items && dto.items.some(item => item.quantity > 100)) {
      throw new Error('Cannot order more than 100 units of a single product');
    }
  }

  private mapOrderToResponse(order: Order): OrderResponse {
    const total = order.calculateTotal();
    
    return {
      id: order.getId(),
      customerId: order.getCustomerId(),
      status: order.getStatus().getStatus(),
      items: order.getItems().map(item => ({
        productId: item.product.getId(),
        productName: item.product.getName(),
        quantity: item.quantity,
        unitPrice: item.unitPrice.getAmount(),
        currency: item.unitPrice.getCurrency()
      })),
      total: {
        amount: total.getAmount(),
        currency: total.getCurrency()
      },
      shippingAddress: order.getShippingAddress(),
      billingAddress: order.getBillingAddress(),
      createdAt: new Date().toISOString()
    };
  }

  // Additional controller methods would go here:
  // - getOrder(orderId: string)
  // - updateOrder(orderId: string, updates: UpdateOrderDTO)
  // - cancelOrder(orderId: string)
  // - listOrders(filters: ListOrdersDTO)
  // etc.
}