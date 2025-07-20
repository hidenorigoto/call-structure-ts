import { Customer } from '../entities/Customer';

export interface ICustomerRepository {
  save(customer: Customer): Promise<void>;
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  update(customer: Customer): Promise<void>;
  delete(id: string): Promise<void>;
  findActiveCustomers(): Promise<Customer[]>;
  exists(id: string): Promise<boolean>;
}