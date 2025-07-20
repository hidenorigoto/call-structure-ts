import { v4 as uuidv4 } from 'uuid';
import { Address } from '../value-objects/Address';

export class Customer {
  private readonly id: string;
  private name: string;
  private email: string;
  private phoneNumber: string;
  private address: Address;
  private isActive: boolean;

  constructor(
    name: string,
    email: string,
    phoneNumber: string,
    address: Address,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.name = name;
    this.email = email;
    this.phoneNumber = phoneNumber;
    this.address = address;
    this.isActive = true;
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Customer name is required');
    }
    if (!this.isValidEmail(this.email)) {
      throw new Error('Invalid email address');
    }
    if (!this.phoneNumber || this.phoneNumber.trim().length === 0) {
      throw new Error('Phone number is required');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getEmail(): string {
    return this.email;
  }

  public getAddress(): Address {
    return this.address;
  }

  public getPhone(): string {
    return this.phoneNumber;
  }

  public updateAddress(newAddress: Address): void {
    this.address = newAddress;
  }

  public updateContactInfo(name: string, email: string, phoneNumber: string): void {
    this.name = name;
    this.email = email;
    this.phoneNumber = phoneNumber;
    this.validate();
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public activate(): void {
    this.isActive = true;
  }

  public canPlaceOrder(): boolean {
    return this.isActive;
  }
}