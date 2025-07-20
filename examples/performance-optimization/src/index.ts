import { LargeService } from './services/large-service';
import { DataProcessor } from './processors/data-processor';
import { CacheManager } from './cache/cache-manager';
import { Logger } from './utils/logger';
import { MetricsCollector } from './monitoring/metrics-collector';
import { loadConfiguration } from './config';

export async function main() {
  const logger = new Logger('Main');
  const config = loadConfiguration();
  
  logger.info('Starting performance optimization example...');
  
  const cacheManager = new CacheManager(config.cache);
  const metricsCollector = new MetricsCollector();
  
  const largeService = new LargeService(cacheManager, metricsCollector);
  const dataProcessor = new DataProcessor(largeService, logger);
  
  try {
    const startTime = Date.now();
    
    await dataProcessor.processLargeDataset({
      batchSize: config.processing.batchSize,
      parallel: config.processing.parallel,
      useCache: config.processing.useCache,
    });
    
    const duration = Date.now() - startTime;
    logger.info(`Processing completed in ${duration}ms`);
    
    const metrics = metricsCollector.getMetrics();
    logger.info('Performance metrics:', metrics);
    
  } catch (error) {
    logger.error('Processing failed:', error);
    throw error;
  } finally {
    await cacheManager.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}