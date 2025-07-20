import { Product } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Money } from '../../domain/value-objects/Money';

export class ProductRepository implements IProductRepository {
  // In-memory storage for demo purposes
  private products: Map<string, Product> = new Map();

  constructor() {
    // Initialize with some test data
    this.initializeTestData();
  }

  async findById(id: string): Promise<Product | null> {
    console.log(`[ProductRepository] Finding product by ID: ${id}`);
    const product = this.products.get(id) || null;
    
    if (product) {
      console.log(`[ProductRepository] Product found: ${product.getName()}`);
    } else {
      console.log(`[ProductRepository] Product not found: ${id}`);
    }
    
    return product;
  }

  async findBySku(sku: string): Promise<Product | null> {
    console.log(`[ProductRepository] Finding product by SKU: ${sku}`);
    
    for (const product of this.products.values()) {
      if (product.getSku() === sku) {
        console.log(`[ProductRepository] Product found: ${product.getName()}`);
        return product;
      }
    }
    
    console.log(`[ProductRepository] Product not found with SKU: ${sku}`);
    return null;
  }

  async findByCategory(category: string): Promise<Product[]> {
    console.log(`[ProductRepository] Finding products by category: ${category}`);
    const productsInCategory: Product[] = [];
    
    for (const product of this.products.values()) {
      if (product.getCategory() === category) {
        productsInCategory.push(product);
      }
    }
    
    console.log(`[ProductRepository] Found ${productsInCategory.length} products in category ${category}`);
    return productsInCategory;
  }

  async save(product: Product): Promise<void> {
    console.log(`[ProductRepository] Saving product: ${product.getId()}`);
    this.products.set(product.getId(), product);
    console.log(`[ProductRepository] Product saved successfully`);
  }

  async update(product: Product): Promise<void> {
    console.log(`[ProductRepository] Updating product: ${product.getId()}`);
    
    if (!this.products.has(product.getId())) {
      throw new Error(`Product not found: ${product.getId()}`);
    }
    
    this.products.set(product.getId(), product);
    console.log(`[ProductRepository] Product updated successfully`);
  }

  async delete(id: string): Promise<void> {
    console.log(`[ProductRepository] Deleting product: ${id}`);
    
    if (!this.products.has(id)) {
      throw new Error(`Product not found: ${id}`);
    }
    
    this.products.delete(id);
    console.log(`[ProductRepository] Product deleted successfully`);
  }

  async findAll(): Promise<Product[]> {
    console.log(`[ProductRepository] Finding all products`);
    const allProducts = Array.from(this.products.values());
    console.log(`[ProductRepository] Found ${allProducts.length} products`);
    return allProducts;
  }

  async findByPriceRange(minPrice: Money, maxPrice: Money): Promise<Product[]> {
    console.log(`[ProductRepository] Finding products between ${minPrice.getAmount()} and ${maxPrice.getAmount()} ${minPrice.getCurrency()}`);
    const productsInRange: Product[] = [];
    
    for (const product of this.products.values()) {
      const productPrice = product.getPrice();
      if (productPrice.getAmount() >= minPrice.getAmount() && 
          productPrice.getAmount() <= maxPrice.getAmount() &&
          productPrice.getCurrency() === minPrice.getCurrency()) {
        productsInRange.push(product);
      }
    }
    
    console.log(`[ProductRepository] Found ${productsInRange.length} products in price range`);
    return productsInRange;
  }

  async search(query: string): Promise<Product[]> {
    console.log(`[ProductRepository] Searching products with query: ${query}`);
    const searchResults: Product[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const product of this.products.values()) {
      if (product.getName().toLowerCase().includes(lowerQuery) ||
          product.getDescription().toLowerCase().includes(lowerQuery)) {
        searchResults.push(product);
      }
    }
    
    console.log(`[ProductRepository] Found ${searchResults.length} products matching "${query}"`);
    return searchResults;
  }

  private initializeTestData(): void {
    // Create test products
    const products = [
      new Product(
        'Laptop Pro 15',
        'High-performance laptop with 15-inch display',
        'SKU-LAPTOP-001',
        new Money(1299.99, 'USD'),
        'Electronics',
        100,
        'product-001'
      ),
      new Product(
        'Wireless Mouse',
        'Ergonomic wireless mouse with precision tracking',
        'SKU-MOUSE-001',
        new Money(49.99, 'USD'),
        'Electronics',
        250,
        'product-002'
      ),
      new Product(
        'USB-C Hub',
        'Multi-port USB-C hub with HDMI and SD card reader',
        'SKU-HUB-001',
        new Money(79.99, 'USD'),
        'Electronics',
        150,
        'product-003'
      ),
      new Product(
        'Mechanical Keyboard',
        'RGB mechanical keyboard with Cherry MX switches',
        'SKU-KB-001',
        new Money(159.99, 'USD'),
        'Electronics',
        75,
        'product-004'
      ),
      new Product(
        'Monitor 27"',
        '4K IPS monitor with USB-C connectivity',
        'SKU-MON-001',
        new Money(599.99, 'USD'),
        'Electronics',
        50,
        'product-005'
      )
    ];

    products.forEach(product => {
      this.products.set(product.getId(), product);
    });

    console.log(`[ProductRepository] Initialized with ${products.length} test products`);
  }

  async findAvailableProducts(): Promise<Product[]> {
    console.log(`[ProductRepository] Finding available products`);
    const availableProducts = Array.from(this.products.values()).filter(product => 
      product.getStock() > 0
    );
    console.log(`[ProductRepository] Found ${availableProducts.length} available products`);
    return availableProducts;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    console.log(`[ProductRepository] Finding products by IDs: ${ids.join(', ')}`);
    const products: Product[] = [];
    
    for (const id of ids) {
      const product = this.products.get(id);
      if (product) {
        products.push(product);
      }
    }
    
    console.log(`[ProductRepository] Found ${products.length} products`);
    return products;
  }

  async count(): Promise<number> {
    const count = this.products.size;
    console.log(`[ProductRepository] Total products: ${count}`);
    return count;
  }
}