import { CallGraphAnalyzer } from '../analyzer/CallGraphAnalyzer';
import { CallGraph, ProjectContext } from '../types/CallGraph';
import { CacheManager } from './CacheManager';
import { ParallelAnalyzer } from './ParallelAnalyzer';
import { IncrementalAnalyzer } from './IncrementalAnalyzer';
import { ProgressReporter } from './ProgressReporter';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface PerformanceConfig {
  enableCache?: boolean;
  enableParallel?: boolean;
  enableIncremental?: boolean;
  enableProgress?: boolean;
  cacheDir?: string;
  concurrency?: number;
  maxDepth?: number;
  includeExternal?: boolean;
  watch?: boolean;
  silent?: boolean;
}

export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private tsConfigPath: string;
  private cacheManager?: CacheManager;
  private progressReporter?: ProgressReporter;

  constructor(tsConfigPath: string, config: PerformanceConfig = {}) {
    this.tsConfigPath = tsConfigPath;
    this.config = {
      enableCache: true,
      enableParallel: true,
      enableIncremental: false,
      enableProgress: true,
      concurrency: os.cpus().length,
      ...config,
    };

    // Initialize cache manager if caching is enabled
    if (this.config.enableCache) {
      this.cacheManager = new CacheManager({
        cacheDir: this.config.cacheDir,
      });
    }

    // Initialize progress reporter if progress is enabled
    if (this.config.enableProgress && !this.config.silent) {
      this.progressReporter = ProgressReporter.forFileAnalysis({
        silent: this.config.silent,
      });
    }
  }

  async analyze(entryPoint?: string): Promise<CallGraph> {
    // If an entry point is provided, validate it exists first
    if (entryPoint) {
      const [filePath] = entryPoint.split('#');
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(path.dirname(this.tsConfigPath), filePath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Source file not found: ${filePath}`);
      }
    }

    // Determine which analyzer to use based on configuration
    if (this.config.enableIncremental) {
      return this.analyzeIncremental(entryPoint);
    } else if (this.config.enableParallel && !entryPoint) {
      return this.analyzeParallel(entryPoint);
    } else {
      return this.analyzeSequential(entryPoint);
    }
  }

  private async analyzeIncremental(entryPoint?: string): Promise<CallGraph> {
    const analyzer = new IncrementalAnalyzer(this.tsConfigPath, {
      cacheDir: this.config.cacheDir,
      watch: this.config.watch,
      parallel: this.config.enableParallel,
      concurrency: this.config.concurrency,
      maxDepth: this.config.maxDepth,
      includeExternal: this.config.includeExternal,
      progressReporter: this.progressReporter,
    });

    try {
      const result = await analyzer.analyzeIncremental(entryPoint);
      return result;
    } finally {
      if (!this.config.watch) {
        await analyzer.close();
      }
    }
  }

  private async analyzeParallel(_entryPoint?: string): Promise<CallGraph> {
    const parallelAnalyzer = new ParallelAnalyzer({
      tsConfigPath: this.tsConfigPath,
      concurrency: this.config.concurrency,
      cacheManager: this.cacheManager,
      maxDepth: this.config.maxDepth,
      includeExternal: this.config.includeExternal,
      progressReporter: this.progressReporter,
    });

    try {
      const context: ProjectContext = {
        rootPath: path.dirname(this.tsConfigPath),
        tsConfigPath: this.tsConfigPath,
        sourcePatterns: ['**/*.ts', '**/*.tsx'],
        excludePatterns: ['node_modules/**', '**/*.spec.ts', '**/*.test.ts'],
      };
      const analyzer = new CallGraphAnalyzer(context, {
        maxDepth: this.config.maxDepth,
        includeNodeModules: this.config.includeExternal,
      });
      const sourceFiles = analyzer['project'].getSourceFiles();
      const filePaths = sourceFiles.map(sf => sf.getFilePath());

      const results = await parallelAnalyzer.analyzeFiles(filePaths);
      return parallelAnalyzer.mergeResults(results);
    } finally {
      await parallelAnalyzer.terminate();
    }
  }

  private async analyzeSequential(entryPoint?: string): Promise<CallGraph> {
    const context: ProjectContext = {
      rootPath: path.dirname(this.tsConfigPath),
      tsConfigPath: this.tsConfigPath,
      sourcePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['node_modules/**', '**/*.spec.ts', '**/*.test.ts'],
    };
    const analyzer = new CallGraphAnalyzer(context, {
      maxDepth: this.config.maxDepth,
      includeNodeModules: this.config.includeExternal,
    });

    if (this.progressReporter) {
      this.progressReporter.start('Analyzing call graph...');
    }

    try {
      let result: CallGraph;

      if (entryPoint) {
        result = await analyzer.analyzeFromEntryPoint(entryPoint);
      } else {
        // For now, analyze from index.ts#main as default
        // In a real implementation, we might scan for entry points
        result = await analyzer.analyzeFromEntryPoint('src/index.ts#main');
      }

      if (this.progressReporter) {
        this.progressReporter.success('Analysis completed');
      }

      return result;
    } catch (error) {
      if (this.progressReporter) {
        this.progressReporter.fail(error as Error);
      }
      throw error;
    }
  }

  private parseEntryPoint(entryPoint: string): [string, string] {
    const parts = entryPoint.split('#');
    if (parts.length !== 2) {
      throw new Error(`Invalid entry point format: ${entryPoint}. Expected "file#function"`);
    }
    return [parts[0], parts[1]];
  }

  async getCacheStats(): Promise<object | null> {
    if (!this.cacheManager) {
      return null;
    }
    return this.cacheManager.getCacheStats();
  }

  async clearCache(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.clear();
    }
  }

  async pruneCache(): Promise<number> {
    if (!this.cacheManager) {
      return 0;
    }
    return this.cacheManager.pruneExpired();
  }

  // Static factory methods for common configurations
  static createDefault(tsConfigPath: string): PerformanceOptimizer {
    return new PerformanceOptimizer(tsConfigPath, {
      enableCache: true,
      enableParallel: true,
      enableProgress: true,
    });
  }

  static createFast(tsConfigPath: string): PerformanceOptimizer {
    return new PerformanceOptimizer(tsConfigPath, {
      enableCache: true,
      enableParallel: true,
      enableIncremental: true,
      enableProgress: true,
      concurrency: os.cpus().length * 2,
    });
  }

  static createMinimal(tsConfigPath: string): PerformanceOptimizer {
    return new PerformanceOptimizer(tsConfigPath, {
      enableCache: false,
      enableParallel: false,
      enableProgress: false,
    });
  }

  static createForCI(tsConfigPath: string): PerformanceOptimizer {
    return new PerformanceOptimizer(tsConfigPath, {
      enableCache: false, // Fresh analysis in CI
      enableParallel: true,
      enableProgress: true,
      concurrency: 2, // Conservative for CI environments
    });
  }
}
