import { Product } from '../entities/Product';

export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findAll(): Promise<Product[]>;
  findAvailableProducts(): Promise<Product[]>;
  update(product: Product): Promise<void>;
  delete(id: string): Promise<void>;
  findByIds(ids: string[]): Promise<Product[]>;
}