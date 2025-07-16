import { ConnectionPool } from '../utils/ConnectionPool';
import { Product } from '../models/Product';
import { QueryBuilder } from '../utils/QueryBuilder';

export class ProductRepository {
  private queryBuilder: QueryBuilder;

  constructor(private pool: ConnectionPool) {
    this.queryBuilder = new QueryBuilder('products');
  }

  async findAll(): Promise<Product[]> {
    const query = this.queryBuilder.select().build();
    return this.pool.query(query);
  }

  async findById(id: string): Promise<Product | null> {
    const query = this.queryBuilder.select().where('id', id).build();
    const results = await this.pool.query(query);
    return results[0] || null;
  }

  async findByCategory(category: string): Promise<Product[]> {
    const query = this.queryBuilder.select().where('category', category).build();
    return this.pool.query(query);
  }

  async findFeatured(): Promise<Product[]> {
    const query = this.queryBuilder
      .select()
      .where('featured', true)
      .orderBy('rating', 'DESC')
      .limit(10)
      .build();
    return this.pool.query(query);
  }

  async archiveOld(): Promise<number> {
    const query = this.queryBuilder
      .update({ archived: true })
      .where('createdAt', '<', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
      .build();
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }
}
