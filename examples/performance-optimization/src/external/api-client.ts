export class ExternalApiClient {
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly rateLimit = 100;

  async fetchResource(id: string): Promise<any> {
    await this.enforceRateLimit();
    await this.simulateApiCall();
    
    return {
      resourceId: id,
      status: 'active',
      data: {
        views: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 100),
      },
    };
  }

  async fetchMetadata(_id: string): Promise<any> {
    await this.enforceRateLimit();
    await this.simulateApiCall();
    
    return {
      tags: ['featured', 'trending', 'popular'].slice(0, Math.floor(Math.random() * 3) + 1),
      categories: ['electronics', 'clothing', 'home'].slice(0, Math.floor(Math.random() * 2) + 1),
      attributes: {
        color: ['red', 'blue', 'green'][Math.floor(Math.random() * 3)],
        size: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
      },
    };
  }

  async batchFetch(ids: string[]): Promise<any[]> {
    await this.enforceRateLimit();
    await this.simulateApiCall(ids.length * 20);
    
    return ids.map(id => ({
      id,
      resource: this.fetchResource(id),
      metadata: this.fetchMetadata(id),
    }));
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.rateLimit;
    
    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private async simulateApiCall(baseTime: number = 100): Promise<void> {
    const variance = Math.random() * 50;
    const delay = baseTime + variance;
    
    if (Math.random() < 0.05) {
      await this.delay(delay * 5);
    } else {
      await this.delay(delay);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  resetStats(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}