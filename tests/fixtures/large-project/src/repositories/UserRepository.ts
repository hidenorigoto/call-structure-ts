import { ConnectionPool } from '../utils/ConnectionPool';
import { User } from '../models/User';
import { QueryBuilder } from '../utils/QueryBuilder';

export class UserRepository {
  private queryBuilder: QueryBuilder;

  constructor(private pool: ConnectionPool) {
    this.queryBuilder = new QueryBuilder('users');
  }

  async findAll(): Promise<User[]> {
    const query = this.queryBuilder.select().build();
    return this.pool.query(query);
  }

  async findById(id: string): Promise<User | null> {
    const query = this.queryBuilder.select().where('id', id).build();
    const results = await this.pool.query(query);
    return results[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = this.queryBuilder.select().where('email', email).build();
    const results = await this.pool.query(query);
    return results[0] || null;
  }

  async create(data: Partial<User>): Promise<User> {
    const query = this.queryBuilder.insert(data).returning('*').build();
    const results = await this.pool.query(query);
    return results[0];
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const query = this.queryBuilder.update(data).where('id', id).returning('*').build();
    const results = await this.pool.query(query);
    return results[0];
  }

  async delete(id: string): Promise<void> {
    const query = this.queryBuilder.delete().where('id', id).build();
    await this.pool.query(query);
  }

  async deleteInactive(): Promise<number> {
    const query = this.queryBuilder
      .delete()
      .where('lastActive', '<', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      .build();
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }
}
