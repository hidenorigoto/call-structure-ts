export class DataValidator {
  isValidId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    
    if (id.length < 3 || id.length > 100) return false;
    
    if (!/^[a-zA-Z0-9\-_]+$/.test(id)) return false;
    
    return true;
  }

  validateItem(item: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!item || typeof item !== 'object') {
      errors.push('Item must be an object');
      return { valid: false, errors };
    }
    
    if (!this.isValidId(item.id)) {
      errors.push('Invalid item ID');
    }
    
    if (!item.name || typeof item.name !== 'string') {
      errors.push('Item must have a name');
    }
    
    if (item.price !== undefined && (typeof item.price !== 'number' || item.price < 0)) {
      errors.push('Price must be a non-negative number');
    }
    
    if (item.type && !['product', 'service', 'digital'].includes(item.type)) {
      errors.push('Invalid item type');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateBatch(items: any[]): { valid: any[]; invalid: any[] } {
    const valid: any[] = [];
    const invalid: any[] = [];
    
    for (const item of items) {
      const validation = this.validateItem(item);
      
      if (validation.valid) {
        valid.push(item);
      } else {
        invalid.push({ item, errors: validation.errors });
      }
    }
    
    return { valid, invalid };
  }

  sanitizeItem(item: any): any {
    const sanitized: any = {};
    
    if (item.id && this.isValidId(item.id)) {
      sanitized.id = item.id.trim();
    }
    
    if (item.name && typeof item.name === 'string') {
      sanitized.name = item.name.trim().slice(0, 255);
    }
    
    if (typeof item.price === 'number' && item.price >= 0) {
      sanitized.price = Math.round(item.price * 100) / 100;
    }
    
    if (item.type && ['product', 'service', 'digital'].includes(item.type)) {
      sanitized.type = item.type;
    }
    
    if (item.metadata && typeof item.metadata === 'object') {
      sanitized.metadata = this.sanitizeMetadata(item.metadata);
    }
    
    return sanitized;
  }

  private sanitizeMetadata(metadata: any): any {
    const sanitized: any = {};
    
    if (Array.isArray(metadata.tags)) {
      sanitized.tags = metadata.tags
        .filter((tag: any) => typeof tag === 'string')
        .map((tag: string) => tag.trim().toLowerCase())
        .filter((tag: string) => tag.length > 0 && tag.length < 50);
    }
    
    if (Array.isArray(metadata.categories)) {
      sanitized.categories = metadata.categories
        .filter((cat: any) => typeof cat === 'string')
        .map((cat: string) => cat.trim().toLowerCase())
        .filter((cat: string) => cat.length > 0 && cat.length < 50);
    }
    
    if (metadata.attributes && typeof metadata.attributes === 'object') {
      sanitized.attributes = {};
      
      for (const [key, value] of Object.entries(metadata.attributes)) {
        if (key.length < 50 && typeof value === 'string' && value.length < 255) {
          sanitized.attributes[key] = value.trim();
        }
      }
    }
    
    return sanitized;
  }
}