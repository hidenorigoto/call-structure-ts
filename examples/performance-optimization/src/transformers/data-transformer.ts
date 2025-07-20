export class DataTransformer {
  normalize(data: any): any {
    return {
      ...data,
      normalized: true,
      prices: this.normalizePrices(data),
      scores: this.normalizeScores(data.scores),
      metadata: this.normalizeMetadata(data.metadata),
    };
  }

  aggregate(data: any): any {
    return {
      ...data,
      aggregated: {
        totalScore: this.calculateTotalScore(data),
        averageRank: this.calculateAverageRank(data.rankings),
        combinedTags: this.combineTags(data),
        priceRange: this.calculatePriceRange(data),
      },
    };
  }

  format(data: any): any {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      pricing: {
        current: data.price,
        range: data.aggregated?.priceRange,
        currency: 'USD',
      },
      metrics: {
        scores: data.scores,
        rankings: data.rankings,
        predictions: data.predictions,
      },
      metadata: {
        tags: data.aggregated?.combinedTags || [],
        categories: data.metadata?.categories || [],
        attributes: data.metadata?.attributes || {},
      },
      performance: {
        totalScore: data.aggregated?.totalScore,
        averageRank: data.aggregated?.averageRank,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private normalizePrices(data: any): any {
    const price = data.price || 0;
    
    return {
      raw: price,
      normalized: price / 100,
      withTax: price * 1.1,
      withDiscount: price * 0.9,
    };
  }

  private normalizeScores(scores: any): any {
    if (!scores) return {};
    
    const total = Object.values(scores)
      .filter(v => typeof v === 'number')
      .reduce((sum: number, score: any) => sum + score, 0) as number;
    
    const normalized: any = {};
    
    for (const [key, value] of Object.entries(scores)) {
      if (typeof value === 'number') {
        normalized[key] = {
          raw: value,
          percentage: (value / total) * 100,
          normalized: value,
        };
      }
    }
    
    return normalized;
  }

  private normalizeMetadata(metadata: any): any {
    if (!metadata) return {};
    
    return {
      ...metadata,
      tags: Array.isArray(metadata.tags) ? 
        metadata.tags.map((tag: string) => tag.toLowerCase()) : [],
      categories: Array.isArray(metadata.categories) ?
        metadata.categories.map((cat: string) => cat.toLowerCase()) : [],
    };
  }

  private calculateTotalScore(data: any): number {
    if (!data.scores) return 0;
    
    return Object.values(data.scores)
      .filter(v => typeof v === 'number')
      .reduce((sum: number, score: any) => sum + score, 0) as number;
  }

  private calculateAverageRank(rankings: any): number {
    if (!rankings) return 0;
    
    const ranks = Object.values(rankings).filter(v => typeof v === 'number') as number[];
    
    if (ranks.length === 0) return 0;
    
    return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
  }

  private combineTags(data: any): string[] {
    const tags = new Set<string>();
    
    if (data.metadata?.tags) {
      data.metadata.tags.forEach((tag: string) => tags.add(tag));
    }
    
    if (data.external?.metadata?.tags) {
      data.external.metadata.tags.forEach((tag: string) => tags.add(tag));
    }
    
    return Array.from(tags);
  }

  private calculatePriceRange(data: any): any {
    const basePrice = data.price || 0;
    
    return {
      min: basePrice * 0.8,
      max: basePrice * 1.2,
      average: basePrice,
    };
  }

  transformBatch(items: any[]): any[] {
    return items.map(item => this.format(this.aggregate(this.normalize(item))));
  }

  async streamTransform(
    items: any[],
    onItem: (item: any, index: number) => void,
  ): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      const transformed = this.format(this.aggregate(this.normalize(items[i])));
      onItem(transformed, i);
      
      if (i % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }
}