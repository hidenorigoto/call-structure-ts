export class Money {
  private readonly amount: number;
  private readonly currency: string;

  constructor(amount: number, currency: string) {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    this.amount = amount;
    this.currency = currency.toUpperCase();
  }

  public getAmount(): number {
    return this.amount;
  }

  public getCurrency(): string {
    return this.currency;
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  public subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    if (this.amount < other.amount) {
      throw new Error('Insufficient funds');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  public multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  public toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}