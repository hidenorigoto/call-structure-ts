# Performance Features

This document describes the performance optimization features available in the call-structure-ts library.

## Overview

The library includes several performance optimization techniques:

1. **File-based Caching** - Caches analysis results to avoid re-analyzing unchanged files
2. **Parallel Processing** - Analyzes multiple files in parallel using worker threads
3. **Incremental Analysis** - Only re-analyzes files that have changed
4. **AST Traversal Optimization** - Skips uninteresting nodes during traversal
5. **Performance Monitoring** - Tracks analysis metrics and performance

## Usage

### Basic Performance Optimization

```typescript
import { PerformanceOptimizer } from './src/performance/PerformanceOptimizer';

// Create optimizer with default settings
const optimizer = PerformanceOptimizer.createDefault('./tsconfig.json');

// Analyze with optimizations
const result = await optimizer.analyze('src/index.ts#main');
```

### Fast Configuration

```typescript
// Create optimizer with aggressive optimizations
const optimizer = PerformanceOptimizer.createFast('./tsconfig.json');
const result = await optimizer.analyze('src/index.ts#main');
```

### Custom Configuration

```typescript
const optimizer = new PerformanceOptimizer('./tsconfig.json', {
  enableCache: true,
  enableParallel: true,
  enableIncremental: true,
  cacheDir: '.custom-cache',
  concurrency: 8,
  maxDepth: 20,
});
```

## Performance Metrics

The library tracks detailed performance metrics:

```typescript
const result = await optimizer.analyze('src/index.ts#main');

// Access performance metrics
console.log(result.metadata.performance);
// Output:
// {
//   analysisTime: 1250,
//   totalNodes: 145,
//   totalEdges: 98,
//   memoryUsage: 45.2,
//   filesAnalyzed: 23,
//   nodesPerSecond: 116,
//   averageDepth: 3.2
// }
```

## Cache Management

### Cache Operations

```typescript
// Get cache statistics
const stats = await optimizer.getCacheStats();

// Clear cache
await optimizer.clearCache();

// Prune expired entries
const pruned = await optimizer.pruneCache();
```

### Cache Configuration

```typescript
const cacheManager = new CacheManager({
  cacheDir: '.custom-cache',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

## Parallel Processing

The parallel analyzer automatically distributes file analysis across multiple worker threads:

```typescript
const parallelAnalyzer = new ParallelAnalyzer({
  tsConfigPath: './tsconfig.json',
  concurrency: 8,
  cacheManager: cacheManager,
});

const results = await parallelAnalyzer.analyzeFiles(filePaths);
```

## Incremental Analysis

For long-running processes or file watching:

```typescript
const incrementalAnalyzer = new IncrementalAnalyzer('./tsconfig.json', {
  watch: true,
  cacheDir: '.incremental-cache',
});

// Analyze with file watching
const result = await incrementalAnalyzer.analyzeIncremental('src/index.ts#main');
```

## Performance Benchmarks

Run performance benchmarks to measure optimization impact:

```bash
npx tsx benchmarks/performance.benchmark.ts
```

This will run comprehensive benchmarks comparing different optimization strategies across small, medium, and large projects.

## Best Practices

1. **Use caching** for repeated analyses of the same codebase
2. **Enable parallel processing** for large projects with many files
3. **Use incremental analysis** for file watching scenarios
4. **Monitor performance metrics** to identify bottlenecks
5. **Clean cache periodically** to avoid stale data
6. **Adjust concurrency** based on available CPU cores

## Troubleshooting

### High Memory Usage

- Reduce concurrency level
- Enable cache pruning
- Use smaller maxDepth values

### Slow Analysis

- Enable all optimizations
- Increase concurrency
- Use cache warmup for frequently analyzed files

### Cache Issues

- Clear cache if results seem stale
- Check cache directory permissions
- Verify file modification times are correct
