import { ConfigService } from './ConfigService';
import { UserRepository } from '../repositories/UserRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { ConnectionPool } from '../utils/ConnectionPool';

export class DatabaseService {
  private pool: ConnectionPool;
  private userRepo: UserRepository;
  private productRepo: ProductRepository;

  constructor(private config: ConfigService) {}

  async connect(): Promise<void> {
    const dbConfig = this.config.getDatabase();
    this.pool = new ConnectionPool(dbConfig);
    await this.pool.initialize();

    this.userRepo = new UserRepository(this.pool);
    this.productRepo = new ProductRepository(this.pool);
  }

  getUserRepository(): UserRepository {
    return this.userRepo;
  }

  getProductRepository(): ProductRepository {
    return this.productRepo;
  }

  async cleanup(): Promise<void> {
    await this.userRepo.deleteInactive();
    await this.productRepo.archiveOld();
  }

  async disconnect(): Promise<void> {
    await this.pool.close();
  }
}
