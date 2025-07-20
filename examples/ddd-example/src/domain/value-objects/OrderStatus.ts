export enum OrderStatusType {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export class OrderStatus {
  private readonly status: OrderStatusType;
  private readonly updatedAt: Date;

  constructor(status: OrderStatusType, updatedAt?: Date) {
    this.status = status;
    this.updatedAt = updatedAt || new Date();
  }

  public getStatus(): OrderStatusType {
    return this.status;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public canTransitionTo(newStatus: OrderStatusType): boolean {
    const transitions: Record<OrderStatusType, OrderStatusType[]> = {
      [OrderStatusType.PENDING]: [OrderStatusType.CONFIRMED, OrderStatusType.CANCELLED],
      [OrderStatusType.CONFIRMED]: [OrderStatusType.PROCESSING, OrderStatusType.CANCELLED],
      [OrderStatusType.PROCESSING]: [OrderStatusType.SHIPPED, OrderStatusType.CANCELLED],
      [OrderStatusType.SHIPPED]: [OrderStatusType.DELIVERED],
      [OrderStatusType.DELIVERED]: [],
      [OrderStatusType.CANCELLED]: []
    };

    return transitions[this.status].includes(newStatus);
  }

  public transitionTo(newStatus: OrderStatusType): OrderStatus {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }
    return new OrderStatus(newStatus);
  }

  public isPending(): boolean {
    return this.status === OrderStatusType.PENDING;
  }

  public isCompleted(): boolean {
    return this.status === OrderStatusType.DELIVERED || this.status === OrderStatusType.CANCELLED;
  }

  public toString(): string {
    return this.status;
  }
}