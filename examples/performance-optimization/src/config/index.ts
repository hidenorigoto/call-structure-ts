export interface Config {
  cache: {
    ttl: number;
    maxSize: number;
    evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
  };
  processing: {
    batchSize: number;
    parallel: boolean;
    useCache: boolean;
    maxRetries: number;
    retryDelay: number;
  };
  database: {
    connectionTimeout: number;
    queryTimeout: number;
    poolSize: number;
  };
  api: {
    timeout: number;
    maxRetries: number;
    rateLimit: number;
  };
  monitoring: {
    metricsInterval: number;
    logLevel: string;
  };
}

export function loadConfiguration(): Config {
  return {
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '3600'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000'),
      evictionPolicy: (process.env.CACHE_EVICTION_POLICY || 'LRU') as any,
    },
    processing: {
      batchSize: parseInt(process.env.BATCH_SIZE || '10'),
      parallel: process.env.PARALLEL === 'true',
      useCache: process.env.USE_CACHE !== 'false',
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
    },
    database: {
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    },
    api: {
      timeout: parseInt(process.env.API_TIMEOUT || '10000'),
      maxRetries: parseInt(process.env.API_MAX_RETRIES || '3'),
      rateLimit: parseInt(process.env.API_RATE_LIMIT || '100'),
    },
    monitoring: {
      metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
      logLevel: process.env.LOG_LEVEL || 'info',
    },
  };
}