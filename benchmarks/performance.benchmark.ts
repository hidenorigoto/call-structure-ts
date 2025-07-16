import { CallGraphAnalyzer } from '../src/analyzer/CallGraphAnalyzer';
import { PerformanceOptimizer } from '../src/performance/PerformanceOptimizer';
import * as fs from 'fs-extra';
import * as path from 'path';

interface BenchmarkResult {
  name: string;
  duration: number;
  memory: {
    before: number;
    after: number;
    used: number;
  };
  filesAnalyzed: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmarks(): Promise<void> {
    console.log('🚀 Running Performance Benchmarks...\n');

    // Setup test project paths
    const projectPaths = {
      small: path.join(__dirname, '../tests/fixtures/small-project'),
      medium: path.join(__dirname, '../tests/fixtures/medium-project'),
      large: path.join(__dirname, '../tests/fixtures/large-project'),
      currentProject: path.join(__dirname, '..'),
    };

    // Clean cache before benchmarks
    await this.cleanCache();

    // Run benchmarks
    await this.benchmark('Small Project - No Optimization', async () => {
      await this.analyzeWithoutOptimization(projectPaths.small);
    });

    await this.benchmark('Small Project - With Cache', async () => {
      await this.analyzeWithCache(projectPaths.small);
    });

    await this.benchmark('Small Project - Parallel (4 workers)', async () => {
      await this.analyzeWithParallel(projectPaths.small, 4);
    });

    await this.benchmark('Medium Project - No Optimization', async () => {
      await this.analyzeWithoutOptimization(projectPaths.medium);
    });

    await this.benchmark('Medium Project - With Cache (2nd run)', async () => {
      // First run to populate cache
      await this.analyzeWithCache(projectPaths.medium);
      // Second run with cache
      await this.analyzeWithCache(projectPaths.medium);
    });

    await this.benchmark('Large Project - No Optimization', async () => {
      await this.analyzeWithoutOptimization(projectPaths.large);
    });

    await this.benchmark('Large Project - Parallel (8 workers)', async () => {
      await this.analyzeWithParallel(projectPaths.large, 8);
    });

    await this.benchmark('Large Project - Full Optimization', async () => {
      await this.analyzeWithFullOptimization(projectPaths.large);
    });

    // Print results
    this.printResults();
  }

  private async benchmark(name: string, fn: () => Promise<void>): Promise<void> {
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = process.hrtime.bigint();

    await fn();

    const endTime = process.hrtime.bigint();
    const memAfter = process.memoryUsage().heapUsed;

    const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms

    this.results.push({
      name,
      duration,
      memory: {
        before: memBefore / 1024 / 1024, // Convert to MB
        after: memAfter / 1024 / 1024,
        used: (memAfter - memBefore) / 1024 / 1024,
      },
      filesAnalyzed: 0, // Will be set by analysis methods
    });
  }

  private async analyzeWithoutOptimization(projectPath: string): Promise<void> {
    const context = {
      rootPath: projectPath,
      tsConfigPath: path.join(projectPath, 'tsconfig.json'),
      packageJsonPath: path.join(projectPath, 'package.json'),
      sourcePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules/**', '**/*.test.ts'],
    };

    const analyzer = new CallGraphAnalyzer(context);
    const result = await analyzer.analyzeFromEntryPoint('src/index.ts#main');

    // Update files analyzed count
    if (this.results.length > 0) {
      this.results[this.results.length - 1].filesAnalyzed = result.nodes.length || 0;
    }
  }

  private async analyzeWithCache(projectPath: string): Promise<void> {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    const optimizer = new PerformanceOptimizer(tsConfigPath, {
      enableCache: true,
      enableParallel: false,
      cacheDir: '.benchmark-cache',
      silent: true,
    });

    const result = await optimizer.analyze('src/index.ts#main');

    if (this.results.length > 0) {
      this.results[this.results.length - 1].filesAnalyzed = result.nodes.length || 0;
    }
  }

  private async analyzeWithParallel(projectPath: string, workers: number): Promise<void> {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    const optimizer = new PerformanceOptimizer(tsConfigPath, {
      enableCache: false,
      enableParallel: true,
      concurrency: workers,
      silent: true,
    });

    const result = await optimizer.analyze('src/index.ts#main');

    if (this.results.length > 0) {
      this.results[this.results.length - 1].filesAnalyzed = result.nodes.length || 0;
    }
  }

  private async analyzeWithFullOptimization(projectPath: string): Promise<void> {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    const optimizer = PerformanceOptimizer.createFast(tsConfigPath);

    const result = await optimizer.analyze('src/index.ts#main');

    if (this.results.length > 0) {
      this.results[this.results.length - 1].filesAnalyzed = result.nodes.length || 0;
    }
  }

  private async cleanCache(): Promise<void> {
    const cacheDir = '.benchmark-cache';
    if (await fs.pathExists(cacheDir)) {
      await fs.remove(cacheDir);
    }
  }

  private printResults(): void {
    console.log('\n📊 Benchmark Results\n');
    console.log('═'.repeat(80));
    console.log(
      'Benchmark'.padEnd(40) + 'Duration (ms)'.padEnd(15) + 'Memory (MB)'.padEnd(15) + 'Files'
    );
    console.log('─'.repeat(80));

    for (const result of this.results) {
      console.log(
        result.name.padEnd(40) +
          result.duration.toFixed(2).padEnd(15) +
          result.memory.used.toFixed(2).padEnd(15) +
          result.filesAnalyzed
      );
    }

    console.log('═'.repeat(80));

    // Calculate improvements
    const baselineIdx = this.results.findIndex(r =>
      r.name.includes('Large Project - No Optimization')
    );
    const optimizedIdx = this.results.findIndex(r =>
      r.name.includes('Large Project - Full Optimization')
    );

    if (baselineIdx >= 0 && optimizedIdx >= 0) {
      const baseline = this.results[baselineIdx];
      const optimized = this.results[optimizedIdx];
      const improvement = (baseline.duration / optimized.duration).toFixed(2);

      console.log(`\n🎯 Performance Improvement: ${improvement}x faster with full optimization`);
      console.log(
        `   Memory saved: ${(baseline.memory.used - optimized.memory.used).toFixed(2)} MB`
      );
    }
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runBenchmarks().catch(console.error);
}

export { PerformanceBenchmark };
