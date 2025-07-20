import { v4 as uuidv4 } from 'uuid';
import { Money } from '../value-objects/Money';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export class Payment {
  private readonly id: string;
  private readonly orderId: string;
  private readonly amount: Money;
  private status: PaymentStatus;
  private readonly method: PaymentMethod;
  private readonly createdAt: Date;
  private processedAt?: Date;
  private transactionId?: string;
  private failureReason?: string;

  constructor(
    orderId: string,
    amount: Money,
    method: PaymentMethod,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.orderId = orderId;
    this.amount = amount;
    this.method = method;
    this.status = PaymentStatus.PENDING;
    this.createdAt = new Date();
  }

  public getId(): string {
    return this.id;
  }

  public getOrderId(): string {
    return this.orderId;
  }

  public getAmount(): Money {
    return this.amount;
  }

  public getStatus(): PaymentStatus {
    return this.status;
  }

  public getMethod(): PaymentMethod {
    return this.method;
  }

  public process(): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error('Payment has already been processed');
    }
    this.status = PaymentStatus.PROCESSING;
  }

  public complete(transactionId: string): void {
    if (this.status !== PaymentStatus.PROCESSING) {
      throw new Error('Payment must be in processing state to complete');
    }
    this.status = PaymentStatus.COMPLETED;
    this.processedAt = new Date();
    this.transactionId = transactionId;
  }

  public fail(reason: string): void {
    if (this.status !== PaymentStatus.PROCESSING) {
      throw new Error('Payment must be in processing state to fail');
    }
    this.status = PaymentStatus.FAILED;
    this.failureReason = reason;
    this.processedAt = new Date();
  }

  public refund(): void {
    if (this.status !== PaymentStatus.COMPLETED) {
      throw new Error('Can only refund completed payments');
    }
    this.status = PaymentStatus.REFUNDED;
  }

  public isSuccessful(): boolean {
    return this.status === PaymentStatus.COMPLETED;
  }

  public getTransactionId(): string | undefined {
    return this.transactionId;
  }

  public getFailureReason(): string | undefined {
    return this.failureReason;
  }
}