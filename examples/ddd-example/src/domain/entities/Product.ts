import { v4 as uuidv4 } from 'uuid';
import { Money } from '../value-objects/Money';

export class Product {
  private readonly id: string;
  private name: string;
  private description: string;
  private price: Money;
  private stockQuantity: number;
  private sku: string;
  private category: string;
  private isActive: boolean;

  constructor(
    name: string,
    description: string,
    sku: string,
    price: Money,
    category: string,
    stockQuantity: number,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description;
    this.sku = sku;
    this.price = price;
    this.category = category;
    this.stockQuantity = stockQuantity;
    this.isActive = true;
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Product name is required');
    }
    if (this.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
    if (!this.sku || this.sku.trim().length === 0) {
      throw new Error('SKU is required');
    }
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getPrice(): Money {
    return this.price;
  }

  public getStockQuantity(): number {
    return this.stockQuantity;
  }

  public getStock(): number {
    return this.stockQuantity;
  }

  public getSku(): string {
    return this.sku;
  }

  public getDescription(): string {
    return this.description;
  }

  public getCategory(): string {
    return this.category;
  }

  public isAvailable(quantity: number): boolean {
    return this.isActive && this.stockQuantity >= quantity;
  }

  public reduceStock(quantity: number): void {
    if (!this.isAvailable(quantity)) {
      throw new Error(`Insufficient stock for product ${this.name}`);
    }
    this.stockQuantity -= quantity;
  }

  public increaseStock(quantity: number): void {
    this.stockQuantity += quantity;
  }

  public updatePrice(newPrice: Money): void {
    this.price = newPrice;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public activate(): void {
    this.isActive = true;
  }

  public calculateTotalPrice(quantity: number): Money {
    return this.price.multiply(quantity);
  }
}