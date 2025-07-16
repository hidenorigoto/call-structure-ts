export class QueryBuilder {
  private query: any = {};

  constructor(private table: string) {
    this.query.table = table;
  }

  select(fields: string[] = ['*']): this {
    this.query.type = 'SELECT';
    this.query.fields = fields;
    return this;
  }

  insert(data: any): this {
    this.query.type = 'INSERT';
    this.query.data = data;
    return this;
  }

  update(data: any): this {
    this.query.type = 'UPDATE';
    this.query.data = data;
    return this;
  }

  delete(): this {
    this.query.type = 'DELETE';
    return this;
  }

  where(field: string, operator: string, value?: any): this {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }

    if (!this.query.where) {
      this.query.where = [];
    }

    this.query.where.push({ field, operator, value });
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.query.orderBy = { field, direction };
    return this;
  }

  limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  returning(fields: string | string[]): this {
    this.query.returning = fields;
    return this;
  }

  build(): string {
    // Simulate SQL building
    return JSON.stringify(this.query);
  }
}
