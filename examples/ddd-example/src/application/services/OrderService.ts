import { Order } from '../../domain/entities/Order';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { InventoryService } from '../../domain/services/InventoryService';
import { PricingService } from '../../domain/services/PricingService';
import { NotificationService } from './NotificationService';
import { CreateOrderDTO } from '../dto/CreateOrderDTO';
import { OrderAggregate } from '../../domain/aggregates/OrderAggregate';

export class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly productRepository: IProductRepository,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: PricingService,
    private readonly notificationService: NotificationService
  ) {}

  async createOrder(dto: CreateOrderDTO): Promise<Order> {
    // Verify customer exists
    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${dto.customerId}`);
    }

    // Create order aggregate
    const orderAggregate = new OrderAggregate();
    const order = orderAggregate.createOrder(
      dto.customerId,
      dto.shippingAddress,
      dto.billingAddress
    );

    // Add items to order
    for (const item of dto.items) {
      const product = await this.productRepository.findById(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Check inventory
      const isAvailable = await this.inventoryService.checkAvailability(
        product.getId(),
        item.quantity
      );
      if (!isAvailable) {
        throw new Error(`Insufficient inventory for product: ${product.getName()}`);
      }

      // Apply pricing rules
      const finalPrice = await this.pricingService.calculatePrice(
        product,
        item.quantity,
        customer
      );
      
      // Reserve inventory
      await this.inventoryService.reserveStock(product.getId(), item.quantity);

      // Add item with calculated price
      orderAggregate.addItem(order, product, item.quantity, finalPrice);
    }

    // Calculate totals
    const total = order.calculateTotal();
    console.log(`Order total: ${total.getAmount()} ${total.getCurrency()}`);

    // Save order
    await this.orderRepository.save(order);

    // Send notifications
    await this.notificationService.notifyOrderCreated(order, customer);

    return order;
  }

  async confirmOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const customer = await this.customerRepository.findById(order.getCustomerId());
    if (!customer) {
      throw new Error(`Customer not found: ${order.getCustomerId()}`);
    }

    // Confirm inventory for all items
    for (const item of order.getItems()) {
      await this.inventoryService.confirmReservation(
        item.product.getId(),
        item.quantity
      );
    }

    order.confirm();
    await this.orderRepository.save(order);

    // Send confirmation notification
    await this.notificationService.notifyOrderConfirmed(order, customer);

    return order;
  }

  async cancelOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (!order.canBeCancelled()) {
      throw new Error('Order cannot be cancelled in its current state');
    }

    const customer = await this.customerRepository.findById(order.getCustomerId());
    if (!customer) {
      throw new Error(`Customer not found: ${order.getCustomerId()}`);
    }

    // Release inventory for all items
    for (const item of order.getItems()) {
      await this.inventoryService.releaseStock(
        item.product.getId(),
        item.quantity
      );
    }

    order.cancel();
    await this.orderRepository.save(order);

    // Send cancellation notification
    await this.notificationService.notifyOrderCancelled(order, customer);

    return order;
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    return await this.orderRepository.findByCustomerId(customerId);
  }
}