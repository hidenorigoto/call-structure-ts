import { LargeService, ProcessingOptions } from '../services/large-service';
import { Logger } from '../utils/logger';
import { DataValidator } from '../validators/data-validator';
import { ErrorHandler } from '../utils/error-handler';
import { ProgressTracker } from '../monitoring/progress-tracker';

export interface ProcessingConfig {
  batchSize: number;
  parallel: boolean;
  useCache: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class DataProcessor {
  private readonly validator: DataValidator;
  private readonly errorHandler: ErrorHandler;
  private readonly progressTracker: ProgressTracker;

  constructor(
    private readonly service: LargeService,
    private readonly logger: Logger,
  ) {
    this.validator = new DataValidator();
    this.errorHandler = new ErrorHandler(logger);
    this.progressTracker = new ProgressTracker();
  }

  async processLargeDataset(config: ProcessingConfig): Promise<void> {
    this.logger.info('Starting large dataset processing', config);
    
    const dataset = await this.loadDataset();
    const validIds = await this.validateDataset(dataset);
    
    this.progressTracker.start(validIds.length);
    
    try {
      await this.processInChunks(validIds, config);
      
      const performance = await this.service.analyzePerformance();
      this.logger.info('Performance analysis:', performance);
      
    } catch (error) {
      this.errorHandler.handle(error, 'Dataset processing failed');
      throw error;
    } finally {
      this.progressTracker.complete();
    }
  }

  private async loadDataset(): Promise<string[]> {
    this.logger.debug('Loading dataset...');
    
    const ids: string[] = [];
    for (let i = 0; i < 10000; i++) {
      ids.push(`item-${i}`);
    }
    
    return ids;
  }

  private async validateDataset(ids: string[]): Promise<string[]> {
    this.logger.debug('Validating dataset...');
    
    const validIds: string[] = [];
    const invalidIds: string[] = [];
    
    for (const id of ids) {
      if (this.validator.isValidId(id)) {
        validIds.push(id);
      } else {
        invalidIds.push(id);
      }
    }
    
    if (invalidIds.length > 0) {
      this.logger.warn(`Found ${invalidIds.length} invalid IDs`);
    }
    
    return validIds;
  }

  private async processInChunks(
    ids: string[],
    config: ProcessingConfig,
  ): Promise<void> {
    const chunkSize = config.batchSize * 10;
    
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      
      try {
        await this.processChunk(chunk, config);
        this.progressTracker.update(i + chunk.length);
      } catch (error) {
        if (config.maxRetries && config.maxRetries > 0) {
          await this.retryChunk(chunk, config);
        } else {
          throw error;
        }
      }
    }
  }

  private async processChunk(
    ids: string[],
    config: ProcessingConfig,
  ): Promise<void> {
    this.logger.debug(`Processing chunk of ${ids.length} items`);
    
    const options: ProcessingOptions = {
      useCache: config.useCache,
      parallel: config.parallel,
      batchSize: config.batchSize,
    };
    
    await this.service.processBatch(ids, options);
  }

  private async retryChunk(
    ids: string[],
    config: ProcessingConfig,
  ): Promise<void> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= (config.maxRetries || 3); attempt++) {
      try {
        this.logger.warn(`Retrying chunk (attempt ${attempt})`);
        
        if (config.retryDelay) {
          await this.delay(config.retryDelay * attempt);
        }
        
        await this.processChunk(ids, config);
        return;
      } catch (error) {
        lastError = error;
        this.logger.error(`Retry attempt ${attempt} failed:`, error);
      }
    }
    
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processWithStrategies(): Promise<void> {
    const strategies = [
      { name: 'Sequential', config: { batchSize: 1, parallel: false, useCache: false } },
      { name: 'Parallel', config: { batchSize: 10, parallel: true, useCache: false } },
      { name: 'Cached', config: { batchSize: 10, parallel: true, useCache: true } },
    ];
    
    const results: any[] = [];
    
    for (const strategy of strategies) {
      this.logger.info(`Testing strategy: ${strategy.name}`);
      
      const startTime = Date.now();
      await this.processLargeDataset(strategy.config);
      const duration = Date.now() - startTime;
      
      results.push({
        strategy: strategy.name,
        duration,
        config: strategy.config,
      });
    }
    
    this.logger.info('Strategy comparison:', results);
  }
}