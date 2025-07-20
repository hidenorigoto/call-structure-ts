import { DatabaseService } from './database';
import { ApiError } from '../utils/apiError';

interface ProductFilters {
  page: number;
  limit: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export class ProductService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async getAllProducts(filters: ProductFilters): Promise<any> {
    const where: any = {};
    
    if (filters.category) {
      where.category = filters.category;
    }
    
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }
    
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } }
      ];
    }
    
    const offset = (filters.page - 1) * filters.limit;
    
    const [products, total] = await Promise.all([
      this.db.products.findMany({
        where,
        skip: offset,
        take: filters.limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.db.products.count({ where })
    ]);
    
    return {
      products,
      total,
      page: filters.page,
      totalPages: Math.ceil(total / filters.limit)
    };
  }

  async getProductById(id: string): Promise<any> {
    return this.db.products.findUnique({
      where: { id }
    });
  }

  async getProductBySku(sku: string): Promise<any> {
    return this.db.products.findUnique({
      where: { sku }
    });
  }

  async createProduct(data: any): Promise<any> {
    return this.db.products.create({
      data
    });
  }

  async updateProduct(id: string, data: any): Promise<any> {
    return this.db.products.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.getProductById(id);
    if (!product) {
      throw new ApiError('Product not found', 404);
    }
    
    await this.db.products.delete({
      where: { id }
    });
  }

  async getCategories(): Promise<string[]> {
    const products = await this.db.products.findMany();
    const categories = new Set(products.map(p => p.category));
    return Array.from(categories).sort();
  }

  async getProductStatistics(): Promise<any> {
    const products = await this.db.products.findMany();
    
    const stats = {
      totalProducts: products.length,
      totalValue: 0,
      avgPrice: 0,
      outOfStock: 0,
      lowStock: 0,
      categoryCounts: {} as Record<string, number>
    };
    
    for (const product of products) {
      stats.totalValue += product.price * product.stock;
      
      if (product.stock === 0) {
        stats.outOfStock++;
      } else if (product.stock < 10) {
        stats.lowStock++;
      }
      
      stats.categoryCounts[product.category] = 
        (stats.categoryCounts[product.category] || 0) + 1;
    }
    
    stats.avgPrice = products.length > 0 
      ? products.reduce((sum, p) => sum + p.price, 0) / products.length 
      : 0;
    
    return stats;
  }
}