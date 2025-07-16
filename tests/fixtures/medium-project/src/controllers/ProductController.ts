import { DatabaseService } from '../services/DatabaseService';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Logger } from '../utils/Logger';
import { Product } from '../models/Product';
import { CacheService } from '../services/CacheService';

interface Request {
  action: string;
  productId?: string;
  category?: string;
}

export class ProductController {
  private cache: CacheService;

  constructor(
    private db: DatabaseService,
    private auth: AuthMiddleware,
    private logger: Logger
  ) {
    this.cache = new CacheService();
  }

  async handleRequest(request: Request): Promise<any> {
    this.logger.info(`Handling product request: ${request.action}`);

    if (!this.auth.isAuthorized(request)) {
      throw new Error('Unauthorized');
    }

    switch (request.action) {
      case 'featured':
        return this.getFeaturedProducts();
      case 'byCategory':
        return this.getProductsByCategory(request.category!);
      case 'detail':
        return this.getProductDetail(request.productId!);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  private async getFeaturedProducts(): Promise<Product[]> {
    const cacheKey = 'featured-products';
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      this.logger.debug('Returning cached featured products');
      return cached;
    }

    const products = await this.db.getProductRepository().findFeatured();
    await this.cache.set(cacheKey, products, 3600); // Cache for 1 hour

    return this.enrichProducts(products);
  }

  private async getProductsByCategory(category: string): Promise<Product[]> {
    const products = await this.db.getProductRepository().findByCategory(category);
    return this.enrichProducts(products);
  }

  private async getProductDetail(id: string): Promise<Product> {
    const product = await this.db.getProductRepository().findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    return this.enrichProduct(product);
  }

  private enrichProducts(products: Product[]): Product[] {
    return products.map(product => this.enrichProduct(product));
  }

  private enrichProduct(product: Product): Product {
    return {
      ...product,
      imageUrl: this.generateImageUrl(product),
      availability: this.checkAvailability(product),
    };
  }

  private generateImageUrl(product: Product): string {
    return `/images/products/${product.id}.jpg`;
  }

  private checkAvailability(product: Product): string {
    return product.stock > 0 ? 'in-stock' : 'out-of-stock';
  }
}
