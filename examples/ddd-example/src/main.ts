import { CreateOrderUseCase } from './application/use-cases/CreateOrderUseCase';
import { OrderService } from './application/services/OrderService';
import { NotificationService } from './application/services/NotificationService';
import { CustomerRepository } from './infrastructure/repositories/CustomerRepository';
import { OrderRepository } from './infrastructure/repositories/OrderRepository';
import { ProductRepository } from './infrastructure/repositories/ProductRepository';
import { InventoryService } from './domain/services/InventoryService';
import { PricingService } from './domain/services/PricingService';
import { EmailService } from './infrastructure/external/EmailService';
import { SMSService } from './infrastructure/external/SMSService';
import { OrderController } from './presentation/controllers/OrderController';
import { CreateOrderDTO } from './application/dto/CreateOrderDTO';
import { Address } from './domain/value-objects/Address';

export async function main() {
  console.log('Starting DDD example application...');
  
  // Initialize repositories
  const customerRepository = new CustomerRepository();
  const orderRepository = new OrderRepository();
  const productRepository = new ProductRepository();
  
  // Initialize domain services
  const inventoryService = new InventoryService();
  const pricingService = new PricingService();
  
  // Initialize infrastructure services
  const emailService = new EmailService();
  const smsService = new SMSService();
  
  // Initialize application services
  const notificationService = new NotificationService(emailService, smsService);
  const orderService = new OrderService(
    orderRepository,
    customerRepository,
    productRepository,
    inventoryService,
    pricingService,
    notificationService
  );
  
  // Initialize use cases
  const createOrderUseCase = new CreateOrderUseCase(orderService);
  
  // Initialize controllers
  const orderController = new OrderController(createOrderUseCase);
  
  // Simulate order creation
  const orderData: CreateOrderDTO = {
    customerId: 'customer-123',
    items: [
      { productId: 'product-001', quantity: 2 },
      { productId: 'product-002', quantity: 1 }
    ],
    shippingAddress: new Address('123 Main St', 'New York', 'NY', '10001', 'USA'),
    billingAddress: new Address('456 Billing Ave', 'New York', 'NY', '10002', 'USA')
  };
  
  try {
    const result = await orderController.createOrder(orderData);
    console.log('Order created successfully:', result);
  } catch (error) {
    console.error('Error creating order:', error);
  }
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}