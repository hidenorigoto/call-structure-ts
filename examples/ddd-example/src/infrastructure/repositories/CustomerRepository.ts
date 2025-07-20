import { Customer } from '../../domain/entities/Customer';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
import { Address } from '../../domain/value-objects/Address';

export class CustomerRepository implements ICustomerRepository {
  // In-memory storage for demo purposes
  private customers: Map<string, Customer> = new Map();

  constructor() {
    // Initialize with some test data
    this.initializeTestData();
  }

  async findById(id: string): Promise<Customer | null> {
    console.log(`[CustomerRepository] Finding customer by ID: ${id}`);
    const customer = this.customers.get(id) || null;
    
    if (customer) {
      console.log(`[CustomerRepository] Customer found: ${customer.getName()}`);
    } else {
      console.log(`[CustomerRepository] Customer not found: ${id}`);
    }
    
    return customer;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    console.log(`[CustomerRepository] Finding customer by email: ${email}`);
    
    for (const customer of this.customers.values()) {
      if (customer.getEmail() === email) {
        console.log(`[CustomerRepository] Customer found: ${customer.getName()}`);
        return customer;
      }
    }
    
    console.log(`[CustomerRepository] Customer not found with email: ${email}`);
    return null;
  }

  async save(customer: Customer): Promise<void> {
    console.log(`[CustomerRepository] Saving customer: ${customer.getId()}`);
    this.customers.set(customer.getId(), customer);
    console.log(`[CustomerRepository] Customer saved successfully`);
  }

  async update(customer: Customer): Promise<void> {
    console.log(`[CustomerRepository] Updating customer: ${customer.getId()}`);
    
    if (!this.customers.has(customer.getId())) {
      throw new Error(`Customer not found: ${customer.getId()}`);
    }
    
    this.customers.set(customer.getId(), customer);
    console.log(`[CustomerRepository] Customer updated successfully`);
  }

  async delete(id: string): Promise<void> {
    console.log(`[CustomerRepository] Deleting customer: ${id}`);
    
    if (!this.customers.has(id)) {
      throw new Error(`Customer not found: ${id}`);
    }
    
    this.customers.delete(id);
    console.log(`[CustomerRepository] Customer deleted successfully`);
  }

  async findByIds(ids: string[]): Promise<Customer[]> {
    console.log(`[CustomerRepository] Finding customers by IDs: ${ids.join(', ')}`);
    const customers: Customer[] = [];
    
    for (const id of ids) {
      const customer = this.customers.get(id);
      if (customer) {
        customers.push(customer);
      }
    }
    
    console.log(`[CustomerRepository] Found ${customers.length} customers`);
    return customers;
  }

  async count(): Promise<number> {
    const count = this.customers.size;
    console.log(`[CustomerRepository] Total customers: ${count}`);
    return count;
  }

  async findActiveCustomers(): Promise<Customer[]> {
    console.log(`[CustomerRepository] Finding active customers`);
    const activeCustomers = Array.from(this.customers.values());
    console.log(`[CustomerRepository] Found ${activeCustomers.length} active customers`);
    return activeCustomers;
  }

  async exists(id: string): Promise<boolean> {
    console.log(`[CustomerRepository] Checking if customer exists: ${id}`);
    const exists = this.customers.has(id);
    console.log(`[CustomerRepository] Customer ${id} exists: ${exists}`);
    return exists;
  }

  private initializeTestData(): void {
    // Create test customers
    const addresses = [
      new Address('123 Main St', 'New York', 'NY', '10001', 'USA'),
      new Address('456 Oak Ave', 'Los Angeles', 'CA', '90001', 'USA'),
      new Address('789 Pine Rd', 'Chicago', 'IL', '60601', 'USA')
    ];

    const customers = [
      new Customer(
        'John Doe',
        'john.doe@example.com',
        '+1234567890',
        addresses[0],
        'customer-123'
      ),
      new Customer(
        'Jane Smith',
        'jane.smith@example.com',
        '+1234567891',
        addresses[1],
        'customer-456'
      ),
      new Customer(
        'Bob Johnson',
        'bob.johnson@example.com',
        '+1234567892',
        addresses[2],
        'customer-789'
      )
    ];

    customers.forEach(customer => {
      this.customers.set(customer.getId(), customer);
    });

    console.log(`[CustomerRepository] Initialized with ${customers.length} test customers`);
  }
}