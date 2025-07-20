import { Order } from '../entities/Order';
import { Payment } from '../entities/Payment';
import { Product } from '../entities/Product';
import { Money } from '../value-objects/Money';
import { Address } from '../value-objects/Address';

export class OrderAggregate {
  private order?: Order;
  private payment?: Payment;

  constructor() {}

  public createOrder(
    customerId: string,
    shippingAddress: Address,
    billingAddress: Address
  ): Order {
    this.order = new Order(customerId, shippingAddress, billingAddress);
    return this.order;
  }

  public addItem(order: Order, product: Product, quantity: number, price?: Money): void {
    if (!this.order || this.order.getId() !== order.getId()) {
      throw new Error('Order not found in aggregate');
    }
    
    // If price is provided, update the product price
    if (price) {
      // In a real scenario, we might create a PricedProduct or similar
      // For now, we'll use the original price from the product
    }
    
    this.order.addItem(product, quantity);
  }

  public removeProduct(productId: string): void {
    if (!this.order) {
      throw new Error('No order in aggregate');
    }
    this.order.removeItem(productId);
  }

  public getOrder(): Order {
    if (!this.order) {
      throw new Error('No order in aggregate');
    }
    return this.order;
  }

  public getPayment(): Payment | undefined {
    return this.payment;
  }

  public setPayment(payment: Payment): void {
    if (!this.order) {
      throw new Error('No order in aggregate');
    }
    if (payment.getOrderId() !== this.order.getId()) {
      throw new Error('Payment does not belong to this order');
    }
    this.payment = payment;
  }
}