// Mock database service for demo purposes
// In a real application, this would use an ORM like Prisma, TypeORM, or Sequelize

interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  sku: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private users: Map<string, MockUser> = new Map();
  private products: Map<string, MockProduct> = new Map();
  private sessions: Map<string, any> = new Map();

  private constructor() {
    this.initializeTestData();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    console.log('[Database] Connected to mock database');
  }

  async disconnect(): Promise<void> {
    console.log('[Database] Disconnected from mock database');
  }

  // Mock ORM-like interface
  get users() {
    return {
      findMany: async (options?: any) => {
        let users = Array.from(this.users.values());
        
        if (options?.where) {
          users = users.filter(user => this.matchesWhere(user, options.where));
        }
        
        if (options?.orderBy) {
          const field = Object.keys(options.orderBy)[0];
          const order = options.orderBy[field];
          users.sort((a, b) => {
            const aVal = (a as any)[field];
            const bVal = (b as any)[field];
            return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          });
        }
        
        if (options?.skip !== undefined && options?.take !== undefined) {
          users = users.slice(options.skip, options.skip + options.take);
        }
        
        if (options?.select) {
          users = users.map(user => this.selectFields(user, options.select));
        }
        
        return users;
      },
      
      findUnique: async (options: any) => {
        if (options.where.id) {
          return this.users.get(options.where.id);
        }
        if (options.where.email) {
          return Array.from(this.users.values()).find(u => u.email === options.where.email);
        }
        return null;
      },
      
      create: async (options: any) => {
        const id = this.generateId();
        const user: MockUser = {
          id,
          ...options.data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.users.set(id, user);
        return user;
      },
      
      update: async (options: any) => {
        const user = this.users.get(options.where.id);
        if (!user) return null;
        
        Object.assign(user, options.data);
        user.updatedAt = new Date();
        return user;
      },
      
      delete: async (options: any) => {
        this.users.delete(options.where.id);
      },
      
      count: async (options?: any) => {
        if (!options?.where) {
          return this.users.size;
        }
        
        let count = 0;
        for (const user of this.users.values()) {
          if (this.matchesWhere(user, options.where)) {
            count++;
          }
        }
        return count;
      }
    };
  }

  get products() {
    return {
      findMany: async (options?: any) => {
        let products = Array.from(this.products.values());
        
        if (options?.where) {
          products = products.filter(product => this.matchesWhere(product, options.where));
        }
        
        if (options?.orderBy) {
          const field = Object.keys(options.orderBy)[0];
          const order = options.orderBy[field];
          products.sort((a, b) => {
            const aVal = (a as any)[field];
            const bVal = (b as any)[field];
            return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          });
        }
        
        if (options?.skip !== undefined && options?.take !== undefined) {
          products = products.slice(options.skip, options.skip + options.take);
        }
        
        return products;
      },
      
      findUnique: async (options: any) => {
        if (options.where.id) {
          return this.products.get(options.where.id);
        }
        if (options.where.sku) {
          return Array.from(this.products.values()).find(p => p.sku === options.where.sku);
        }
        return null;
      },
      
      create: async (options: any) => {
        const id = this.generateId();
        const product: MockProduct = {
          id,
          ...options.data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.products.set(id, product);
        return product;
      },
      
      update: async (options: any) => {
        const product = this.products.get(options.where.id);
        if (!product) return null;
        
        Object.assign(product, options.data);
        product.updatedAt = new Date();
        return product;
      },
      
      delete: async (options: any) => {
        this.products.delete(options.where.id);
      },
      
      count: async (options?: any) => {
        if (!options?.where) {
          return this.products.size;
        }
        
        let count = 0;
        for (const product of this.products.values()) {
          if (this.matchesWhere(product, options.where)) {
            count++;
          }
        }
        return count;
      }
    };
  }

  private matchesWhere(item: any, where: any): boolean {
    for (const key in where) {
      const condition = where[key];
      
      if (condition && typeof condition === 'object') {
        if ('gte' in condition && item[key] < condition.gte) return false;
        if ('lte' in condition && item[key] > condition.lte) return false;
        if ('contains' in condition && !item[key].includes(condition.contains)) return false;
      } else if (item[key] !== condition) {
        return false;
      }
    }
    return true;
  }

  private selectFields(item: any, fields: any): any {
    const result: any = {};
    for (const field in fields) {
      if (fields[field]) {
        result[field] = item[field];
      }
    }
    return result;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeTestData(): void {
    // Add test users
    const hashedPassword = '$2b$10$K7L1OJ45/4Y2nIvhHu8.kOaO6a0';
    
    this.users.set('user-1', {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      password: hashedPassword,
      role: 'user',
      isActive: true,
      isVerified: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      lastLogin: new Date()
    });
    
    this.users.set('admin-1', {
      id: 'admin-1',
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      lastLogin: new Date()
    });
    
    // Add test products
    this.products.set('product-1', {
      id: 'product-1',
      name: 'Laptop Pro',
      description: 'High-performance laptop',
      price: 1299.99,
      category: 'Electronics',
      stock: 50,
      sku: 'LAPTOP-001',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    });
    
    this.products.set('product-2', {
      id: 'product-2',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse',
      price: 49.99,
      category: 'Electronics',
      stock: 200,
      sku: 'MOUSE-001',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    });
  }
}