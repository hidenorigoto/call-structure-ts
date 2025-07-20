export interface CacheConfig {
  ttl: number;
  maxSize: number;
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

interface CacheEntry {
  value: any;
  expires: number;
  accessCount: number;
  lastAccess: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
  };

  constructor(private readonly config: CacheConfig) {}

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.config.ttl) * 1000;
    
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }
    
    this.cache.set(key, {
      value,
      expires,
      accessCount: 0,
      lastAccess: Date.now(),
    });
    
    this.stats.size = this.cache.size;
  }

  async delete(key: string): Promise<boolean> {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async close(): Promise<void> {
    await this.clear();
  }

  private evict(): void {
    let keyToEvict: string | null = null;
    
    switch (this.config.evictionPolicy) {
      case 'LRU':
        keyToEvict = this.findLeastRecentlyUsed();
        break;
      case 'LFU':
        keyToEvict = this.findLeastFrequentlyUsed();
        break;
      case 'FIFO':
        keyToEvict = this.cache.keys().next().value || null;
        break;
    }
    
    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  private findLeastRecentlyUsed(): string | null {
    let lruKey: string | null = null;
    let oldestAccess = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        lruKey = key;
      }
    }
    
    return lruKey;
  }

  private findLeastFrequentlyUsed(): string | null {
    let lfuKey: string | null = null;
    let lowestCount = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lowestCount) {
        lowestCount = entry.accessCount;
        lfuKey = key;
      }
    }
    
    return lfuKey;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  async warmUp(keys: string[], loader: (key: string) => Promise<any>): Promise<void> {
    const batchSize = 50;
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (key) => {
          const value = await loader(key);
          await this.set(key, value);
        })
      );
    }
  }

  getMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.value).length;
    }
    
    return totalSize;
  }
}