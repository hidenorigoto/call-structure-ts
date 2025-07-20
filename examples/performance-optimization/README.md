# Performance Optimization Example

This example demonstrates how to optimize call-structure-ts for analyzing large codebases with caching, parallel processing, and other performance techniques.

## Architecture Overview

```
src/
├── index.ts                    # Entry point
├── services/                   # Core services
│   └── large-service.ts       # Main service with complex operations
├── processors/                 # Data processing
│   └── data-processor.ts      # Batch processing logic
├── cache/                      # Caching layer
│   └── cache-manager.ts       # LRU/LFU/FIFO cache implementation
├── monitoring/                 # Performance monitoring
│   ├── metrics-collector.ts   # Metrics collection
│   └── progress-tracker.ts    # Progress reporting
├── database/                   # Database simulation
│   └── connection.ts          # Mock database operations
├── external/                   # External API simulation
│   └── api-client.ts          # Rate-limited API calls
├── transformers/               # Data transformation
│   └── data-transformer.ts    # Complex transformations
├── utils/                      # Utilities
│   ├── logger.ts              # Logging
│   ├── complex-calculator.ts  # Heavy computations
│   └── error-handler.ts       # Error handling
├── validators/                 # Data validation
│   └── data-validator.ts      # Input validation
└── config/                     # Configuration
    └── index.ts               # Config loading
```

## Performance Features Demonstrated

### 1. Caching Strategies

- LRU (Least Recently Used) eviction
- LFU (Least Frequently Used) eviction
- FIFO (First In, First Out) eviction
- Cache warming and preloading
- Hit rate monitoring

### 2. Parallel Processing

- Concurrent batch processing
- Worker pool management
- Load balancing
- Progress tracking

### 3. Memory Management

- Streaming transformations
- Batch size optimization
- Memory usage monitoring
- Garbage collection hints

### 4. Error Handling

- Retry mechanisms with backoff
- Error categorization
- Partial failure handling
- Circuit breaker pattern

### 5. Monitoring & Metrics

- Real-time progress tracking
- Performance metrics collection
- Statistical analysis (p95, p99)
- Performance recommendations

## Running Performance Tests

### Basic Performance Analysis

```bash
# Analyze with default settings
call-structure analyze --entry src/index.ts --output analysis/basic.json

# With caching enabled
call-structure analyze --entry src/index.ts --output analysis/cached.json --use-cache

# With parallel processing
call-structure analyze --entry src/index.ts --output analysis/parallel.json --parallel --workers 4
```

### Batch Analysis

```bash
# Run batch analysis with configuration
call-structure batch --config performance-config.yaml
```

### Performance Profiling

```bash
# Run automated performance profiling
npm run profile

# Compare different analysis results
npm run compare
```

## Configuration Options

### Cache Configuration

```yaml
cache:
  enabled: true
  directory: '.call-structure-cache'
  ttl: 3600 # seconds
  max_size: 1000 # MB
  key_strategy: 'content-hash'
```

### Parallel Processing

```yaml
parallel:
  enabled: true
  workers: 4
  batch_size: 50
  queue_size: 1000
```

### Memory Management

```yaml
memory:
  max_heap: 4096 # MB
  gc_optimization: true
  warning_threshold: 80 # percentage
  cleanup_threshold: 90
```

## Performance Analysis Commands

### 1. Analyze Large Service

```bash
# Analyze complex service with deep call chains
call-structure analyze --entry src/services/large-service.ts \
  --depth 15 \
  --include-async \
  --output analysis/large-service.json
```

### 2. Memory-Efficient Analysis

```bash
# Use streaming and chunking for large results
call-structure analyze --entry "src/**/*.ts" \
  --stream \
  --chunk-size 100 \
  --output analysis/streamed.json
```

### 3. Incremental Analysis

```bash
# Only analyze changed files
call-structure analyze --entry src \
  --incremental \
  --cache-dir .analysis-cache \
  --output analysis/incremental.json
```

### 4. Parallel Batch Processing

```bash
# Process multiple entry points in parallel
call-structure batch --config performance-config.yaml \
  --parallel \
  --workers 8 \
  --output analysis/batch-results.json
```

## Performance Optimization Strategies

### 1. Use Caching

```bash
# First run - builds cache
call-structure analyze --entry src --use-cache

# Subsequent runs - uses cache
call-structure analyze --entry src --use-cache
```

### 2. Filter Unnecessary Files

```bash
# Exclude test files and dependencies
call-structure analyze --entry src \
  --exclude "**/*.test.ts" \
  --exclude "node_modules/**" \
  --exclude "dist/**"
```

### 3. Limit Analysis Depth

```bash
# Shallow analysis for overview
call-structure analyze --entry src --depth 3 --output analysis/shallow.json

# Deep analysis for specific modules
call-structure analyze --entry src/services/large-service.ts --depth 20
```

### 4. Use Pattern Matching

```bash
# Analyze specific patterns only
call-structure analyze --entry src \
  --pattern "async.*Service" \
  --pattern "process.*"
```

## Monitoring Performance

### Real-time Metrics

```bash
# Enable performance monitoring
call-structure analyze --entry src \
  --monitor \
  --metrics-interval 5000 \
  --output analysis/monitored.json
```

### Memory Usage

```bash
# Monitor memory usage
call-structure analyze --entry src \
  --max-heap 2048 \
  --memory-monitor \
  --output analysis/memory-monitored.json
```

## Benchmarking Results

### Sample Performance Metrics

```
Configuration         | Time    | Memory  | Cache Hit Rate
---------------------|---------|---------|---------------
Basic Analysis       | 45.2s   | 512MB   | 0%
Cached Analysis      | 12.3s   | 256MB   | 85%
Parallel (4 workers) | 15.1s   | 768MB   | 0%
Incremental          | 5.2s    | 128MB   | 95%
```

### Optimization Impact

```
Optimization          | Speedup | Memory Reduction
---------------------|---------|------------------
Caching              | 3.7x    | 50%
Parallel Processing  | 3.0x    | -50% (overhead)
Incremental Analysis | 8.7x    | 75%
Combined             | 10.2x   | 60%
```

## Best Practices

### 1. Large Codebase Analysis

```bash
# Use all optimizations for large codebases
call-structure analyze --entry src \
  --use-cache \
  --parallel \
  --incremental \
  --exclude "**/*.test.ts" \
  --max-depth 10 \
  --stream \
  --output analysis/optimized.json
```

### 2. CI/CD Integration

```yaml
# .github/workflows/analysis.yml
- name: Analyze with Caching
  run: |
    call-structure analyze --entry src \
      --use-cache \
      --cache-dir ${{ runner.temp }}/call-cache \
      --fail-fast \
      --output analysis/ci.json
```

### 3. Memory-Constrained Environments

```bash
# Optimize for low memory usage
call-structure analyze --entry src \
  --max-heap 512 \
  --stream \
  --chunk-size 50 \
  --gc-aggressive \
  --output analysis/low-memory.json
```

## Troubleshooting Performance Issues

### Slow Analysis

1. Enable caching: `--use-cache`
2. Reduce depth: `--depth 5`
3. Use parallel processing: `--parallel`
4. Exclude unnecessary files: `--exclude`

### High Memory Usage

1. Enable streaming: `--stream`
2. Reduce chunk size: `--chunk-size 50`
3. Limit heap size: `--max-heap 1024`
4. Enable GC optimization: `--gc-optimize`

### Cache Misses

1. Check cache directory permissions
2. Verify cache key strategy
3. Increase cache TTL
4. Monitor cache stats: `--cache-stats`

## Advanced Optimization

### Custom Cache Strategy

```javascript
// Custom cache key generation
const cacheKey = generateCacheKey({
  file: filePath,
  content: fileContent,
  options: analysisOptions,
});
```

### Parallel Processing Tuning

```javascript
// Optimal worker count
const workers = Math.min(os.cpus().length, Math.ceil(fileCount / 50));
```

### Memory Profiling

```bash
# Generate heap snapshot
node --inspect src/index.ts
# Open chrome://inspect to analyze
```

## Integration Examples

### With Build Tools

```json
// package.json
{
  "scripts": {
    "analyze:dev": "call-structure analyze --entry src --depth 5 --use-cache",
    "analyze:prod": "call-structure analyze --entry src --depth 15 --parallel",
    "analyze:ci": "call-structure analyze --entry src --incremental --fail-fast"
  }
}
```

### With Monitoring Systems

```javascript
// Export metrics to monitoring system
const metrics = await analyzer.getMetrics();
prometheus.register(metrics);
```

### With Documentation

```bash
# Generate performance report
call-structure analyze --entry src \
  --report performance-report.md \
  --include-metrics \
  --include-recommendations
```

## Performance Testing Script

```bash
#!/bin/bash
# test-performance.sh

echo "Testing different configurations..."

# Baseline
time call-structure analyze --entry src --output results/baseline.json

# With caching
time call-structure analyze --entry src --use-cache --output results/cached.json

# Parallel
time call-structure analyze --entry src --parallel --output results/parallel.json

# Compare results
call-structure compare results/*.json --output comparison.md
```

This example provides a comprehensive demonstration of performance optimization techniques for call-structure-ts, including caching, parallel processing, memory management, and monitoring capabilities.
