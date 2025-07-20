import { Order } from '../entities/Order';

export interface IOrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  update(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
  findPendingOrders(): Promise<Order[]>;
  findOrdersInDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
}