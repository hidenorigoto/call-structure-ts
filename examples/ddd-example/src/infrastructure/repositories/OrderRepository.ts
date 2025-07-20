import { Order } from '../../domain/entities/Order';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { OrderStatusType } from '../../domain/value-objects/OrderStatus';

export class OrderRepository implements IOrderRepository {
  // In-memory storage for demo purposes
  private orders: Map<string, Order> = new Map();

  async findById(id: string): Promise<Order | null> {
    console.log(`[OrderRepository] Finding order by ID: ${id}`);
    const order = this.orders.get(id) || null;
    
    if (order) {
      console.log(`[OrderRepository] Order found: ${order.getId()}`);
    } else {
      console.log(`[OrderRepository] Order not found: ${id}`);
    }
    
    return order;
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    console.log(`[OrderRepository] Finding orders for customer: ${customerId}`);
    const customerOrders: Order[] = [];
    
    for (const order of this.orders.values()) {
      if (order.getCustomerId() === customerId) {
        customerOrders.push(order);
      }
    }
    
    console.log(`[OrderRepository] Found ${customerOrders.length} orders for customer ${customerId}`);
    return customerOrders;
  }

  async save(order: Order): Promise<void> {
    console.log(`[OrderRepository] Saving order: ${order.getId()}`);
    this.orders.set(order.getId(), order);
    console.log(`[OrderRepository] Order saved successfully`);
  }

  async update(order: Order): Promise<void> {
    console.log(`[OrderRepository] Updating order: ${order.getId()}`);
    
    if (!this.orders.has(order.getId())) {
      throw new Error(`Order not found: ${order.getId()}`);
    }
    
    this.orders.set(order.getId(), order);
    console.log(`[OrderRepository] Order updated successfully`);
  }

  async delete(id: string): Promise<void> {
    console.log(`[OrderRepository] Deleting order: ${id}`);
    
    if (!this.orders.has(id)) {
      throw new Error(`Order not found: ${id}`);
    }
    
    this.orders.delete(id);
    console.log(`[OrderRepository] Order deleted successfully`);
  }

  async findByStatus(status: string): Promise<Order[]> {
    console.log(`[OrderRepository] Finding orders by status: ${status}`);
    const ordersWithStatus: Order[] = [];
    
    for (const order of this.orders.values()) {
      if (order.getStatus().getStatus() === status) {
        ordersWithStatus.push(order);
      }
    }
    
    console.log(`[OrderRepository] Found ${ordersWithStatus.length} orders with status ${status}`);
    return ordersWithStatus;
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    console.log(`[OrderRepository] Finding orders between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const ordersInRange: Order[] = [];
    
    for (const order of this.orders.values()) {
      // In a real implementation, we would check the order's creation date
      // For now, we'll return all orders as a placeholder
      ordersInRange.push(order);
    }
    
    console.log(`[OrderRepository] Found ${ordersInRange.length} orders in date range`);
    return ordersInRange;
  }

  async count(): Promise<number> {
    const count = this.orders.size;
    console.log(`[OrderRepository] Total orders: ${count}`);
    return count;
  }

  async countByCustomer(customerId: string): Promise<number> {
    let count = 0;
    
    for (const order of this.orders.values()) {
      if (order.getCustomerId() === customerId) {
        count++;
      }
    }
    
    console.log(`[OrderRepository] Customer ${customerId} has ${count} orders`);
    return count;
  }

  async findPendingOrders(): Promise<Order[]> {
    console.log(`[OrderRepository] Finding pending orders`);
    const pendingOrders: Order[] = [];
    
    for (const order of this.orders.values()) {
      if (order.getStatus().getStatus() === OrderStatusType.PENDING) {
        pendingOrders.push(order);
      }
    }
    
    console.log(`[OrderRepository] Found ${pendingOrders.length} pending orders`);
    return pendingOrders;
  }

  async findOrdersInDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    console.log(`[OrderRepository] Finding orders between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const ordersInRange: Order[] = [];
    
    for (const order of this.orders.values()) {
      const orderDate = order.getOrderDate();
      if (orderDate >= startDate && orderDate <= endDate) {
        ordersInRange.push(order);
      }
    }
    
    console.log(`[OrderRepository] Found ${ordersInRange.length} orders in date range`);
    return ordersInRange;
  }
}