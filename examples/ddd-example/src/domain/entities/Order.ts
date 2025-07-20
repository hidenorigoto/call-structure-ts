import { v4 as uuidv4 } from 'uuid';
import { Money } from '../value-objects/Money';
import { OrderStatus, OrderStatusType } from '../value-objects/OrderStatus';
import { Address } from '../value-objects/Address';
import { Product } from './Product';

export interface OrderItem {
  product: Product;
  quantity: number;
  unitPrice: Money;
}

export class Order {
  private readonly id: string;
  private readonly customerId: string;
  private readonly items: OrderItem[];
  private status: OrderStatus;
  private readonly createdAt: Date;
  private shippingAddress: Address;
  private billingAddress: Address;

  constructor(
    customerId: string,
    shippingAddress: Address,
    billingAddress: Address,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.customerId = customerId;
    this.items = [];
    this.status = new OrderStatus(OrderStatusType.PENDING);
    this.createdAt = new Date();
    this.shippingAddress = shippingAddress;
    this.billingAddress = billingAddress;
  }

  public getId(): string {
    return this.id;
  }

  public getCustomerId(): string {
    return this.customerId;
  }

  public getStatus(): OrderStatus {
    return this.status;
  }

  public getItems(): OrderItem[] {
    return [...this.items];
  }

  public addItem(product: Product, quantity: number): void {
    if (this.status.getStatus() !== OrderStatusType.PENDING) {
      throw new Error('Cannot add items to non-pending order');
    }

    if (!product.isAvailable(quantity)) {
      throw new Error(`Product ${product.getName()} is not available in requested quantity`);
    }

    const existingItem = this.items.find(item => item.product.getId() === product.getId());
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.items.push({
        product,
        quantity,
        unitPrice: product.getPrice()
      });
    }
  }

  public removeItem(productId: string): void {
    if (this.status.getStatus() !== OrderStatusType.PENDING) {
      throw new Error('Cannot remove items from non-pending order');
    }

    const index = this.items.findIndex(item => item.product.getId() === productId);
    if (index === -1) {
      throw new Error('Product not found in order');
    }

    this.items.splice(index, 1);
  }

  public calculateTotal(): Money {
    if (this.items.length === 0) {
      throw new Error('Order has no items');
    }

    return this.items.reduce((total, item) => {
      const itemTotal = item.unitPrice.multiply(item.quantity);
      return total.add(itemTotal);
    }, new Money(0, this.items[0].unitPrice.getCurrency()));
  }

  public confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm order with no items');
    }
    this.updateStatus(OrderStatusType.CONFIRMED);
  }

  public process(): void {
    this.updateStatus(OrderStatusType.PROCESSING);
  }

  public ship(): void {
    this.updateStatus(OrderStatusType.SHIPPED);
  }

  public deliver(): void {
    this.updateStatus(OrderStatusType.DELIVERED);
  }

  public cancel(): void {
    if (this.status.isCompleted()) {
      throw new Error('Cannot cancel completed order');
    }
    this.updateStatus(OrderStatusType.CANCELLED);
  }

  private updateStatus(newStatus: OrderStatusType): void {
    this.status = this.status.transitionTo(newStatus);
  }

  public canBeCancelled(): boolean {
    return !this.status.isCompleted() && 
           this.status.getStatus() !== OrderStatusType.SHIPPED;
  }

  public getShippingAddress(): Address {
    return this.shippingAddress;
  }

  public getBillingAddress(): Address {
    return this.billingAddress;
  }

  public getOrderDate(): Date {
    return this.createdAt;
  }
}