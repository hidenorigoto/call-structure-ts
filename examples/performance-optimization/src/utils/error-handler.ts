import { Logger } from './logger';

export class ErrorHandler {
  constructor(private readonly logger: Logger) {}

  handle(error: any, context: string): void {
    this.logger.error(`Error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      context,
    });

    if (error.code === 'ECONNREFUSED') {
      this.logger.error('Connection refused - check if services are running');
    } else if (error.code === 'ETIMEDOUT') {
      this.logger.error('Request timeout - consider increasing timeout values');
    } else if (error.code === 'ENOMEM') {
      this.logger.error('Out of memory - reduce batch size or increase memory limit');
    }
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      delay: number;
      backoff?: number;
      onRetry?: (attempt: number, error: any) => void;
    },
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (options.onRetry) {
          options.onRetry(attempt, error);
        }

        if (attempt < options.maxRetries) {
          const delay = options.delay * Math.pow(options.backoff || 1, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  isRetryable(error: any): boolean {
    const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
    
    if (error.code && retryableCodes.includes(error.code)) {
      return true;
    }

    if (error.response?.status >= 500) {
      return true;
    }

    if (error.message?.includes('rate limit')) {
      return true;
    }

    return false;
  }

  categorizeError(error: any): string {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'network';
    }

    if (error.code === 'ETIMEDOUT') {
      return 'timeout';
    }

    if (error.code === 'ENOMEM' || error.message?.includes('memory')) {
      return 'memory';
    }

    if (error.response?.status >= 400 && error.response?.status < 500) {
      return 'client';
    }

    if (error.response?.status >= 500) {
      return 'server';
    }

    return 'unknown';
  }

  createErrorReport(errors: any[]): any {
    const categorized: Record<string, any[]> = {};
    
    for (const error of errors) {
      const category = this.categorizeError(error);
      
      if (!categorized[category]) {
        categorized[category] = [];
      }
      
      categorized[category].push({
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      totalErrors: errors.length,
      categories: categorized,
      recommendations: this.generateErrorRecommendations(categorized),
    };
  }

  private generateErrorRecommendations(categorized: Record<string, any[]>): string[] {
    const recommendations: string[] = [];

    if (categorized.network?.length > 0) {
      recommendations.push('Check network connectivity and service availability');
    }

    if (categorized.timeout?.length > 0) {
      recommendations.push('Increase timeout values or optimize slow operations');
    }

    if (categorized.memory?.length > 0) {
      recommendations.push('Reduce batch sizes or increase available memory');
    }

    if (categorized.client?.length > 0) {
      recommendations.push('Review request parameters and authentication');
    }

    return recommendations;
  }
}