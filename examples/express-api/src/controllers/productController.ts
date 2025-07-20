import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/productService';
import { CacheService } from '../services/cache';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

export class ProductController {
  private productService: ProductService;
  private cacheService: CacheService;

  constructor() {
    this.productService = new ProductService();
    this.cacheService = CacheService.getInstance();
  }

  getAllProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        category: req.query.category as string,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        search: req.query.search as string
      };
      
      const cacheKey = `products:${JSON.stringify(filters)}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }
      
      const products = await this.productService.getAllProducts(filters);
      
      await this.cacheService.set(cacheKey, products, 600); // Cache for 10 minutes
      
      res.json(products);
    } catch (error) {
      next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      const cacheKey = `product:${id}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }
      
      const product = await this.productService.getProductById(id);
      
      if (!product) {
        throw new ApiError('Product not found', 404);
      }
      
      await this.cacheService.set(cacheKey, product, 3600); // Cache for 1 hour
      
      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const productData = req.body;
      
      // Check for duplicate SKU
      const existingProduct = await this.productService.getProductBySku(productData.sku);
      if (existingProduct) {
        throw new ApiError('Product with this SKU already exists', 409);
      }
      
      const product = await this.productService.createProduct(productData);
      
      // Invalidate related caches
      await this.cacheService.invalidatePattern('products:*');
      await this.cacheService.invalidatePattern('categories:*');
      
      logger.info(`Product created: ${product.id} - ${product.name}`);
      
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const product = await this.productService.updateProduct(id, updates);
      
      if (!product) {
        throw new ApiError('Product not found', 404);
      }
      
      // Invalidate caches
      await this.cacheService.del(`product:${id}`);
      await this.cacheService.invalidatePattern('products:*');
      
      logger.info(`Product updated: ${id}`);
      
      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      await this.productService.deleteProduct(id);
      
      // Invalidate caches
      await this.cacheService.del(`product:${id}`);
      await this.cacheService.invalidatePattern('products:*');
      await this.cacheService.invalidatePattern('categories:*');
      
      logger.info(`Product deleted: ${id}`);
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cacheKey = 'categories:all';
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }
      
      const categories = await this.productService.getCategories();
      
      await this.cacheService.set(cacheKey, categories, 3600); // Cache for 1 hour
      
      res.json(categories);
    } catch (error) {
      next(error);
    }
  };

  getProductStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.productService.getProductStatistics();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}