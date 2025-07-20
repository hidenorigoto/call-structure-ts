// Mock cache service for demo purposes
// In a real application, this would use Redis or similar

export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, { value: any; expiry?: number }> = new Map();

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async connect(): Promise<void> {
    console.log('[Cache] Connected to mock cache service');
  }

  async disconnect(): Promise<void> {
    console.log('[Cache] Disconnected from mock cache service');
    this.cache.clear();
  }

  async get<T = any>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const item: { value: any; expiry?: number } = { value };
    
    if (ttlSeconds) {
      item.expiry = Date.now() + (ttlSeconds * 1000);
    }
    
    this.cache.set(key, item);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async increment(key: string, by: number = 1, ttlSeconds?: number): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + by;
    await this.set(key, newValue, ttlSeconds);
    return newValue;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  // Clean up expired entries periodically
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item.expiry && item.expiry < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }
}