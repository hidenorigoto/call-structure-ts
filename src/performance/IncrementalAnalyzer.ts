import { CallGraphAnalyzer } from '../analyzer/CallGraphAnalyzer';
import { CallGraph, ProjectContext } from '../types/CallGraph';
import { CacheManager } from './CacheManager';
import { ParallelAnalyzer } from './ParallelAnalyzer';
import { ProgressReporter } from './ProgressReporter';
import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface IncrementalOptions {
  cacheDir?: string;
  watch?: boolean;
  parallel?: boolean;
  concurrency?: number;
  maxDepth?: number;
  includeExternal?: boolean;
  progressReporter?: ProgressReporter;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
}

export class IncrementalAnalyzer extends EventEmitter {
  private analyzer: CallGraphAnalyzer;
  private cache: CacheManager;
  private parallelAnalyzer?: ParallelAnalyzer;
  private progressReporter: ProgressReporter;
  private fileWatcher?: FSWatcher;
  private options: IncrementalOptions;
  private watchedFiles: Set<string> = new Set();
  private pendingChanges: Map<string, FileChangeEvent> = new Map();
  private debounceTimer?: NodeJS.Timeout;
  private debounceDelay = 300; // ms

  constructor(tsConfigPath: string, options: IncrementalOptions = {}) {
    super();
    const context: ProjectContext = {
      rootPath: path.dirname(tsConfigPath),
      tsConfigPath,
      sourcePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['node_modules/**', '**/*.spec.ts', '**/*.test.ts'],
    };
    this.analyzer = new CallGraphAnalyzer(context);
    this.options = options;
    this.cache = new CacheManager({ cacheDir: options.cacheDir });
    this.progressReporter = options.progressReporter || ProgressReporter.forFileAnalysis();

    if (options.parallel) {
      this.parallelAnalyzer = new ParallelAnalyzer({
        tsConfigPath,
        concurrency: options.concurrency,
        cacheManager: this.cache,
        maxDepth: options.maxDepth,
        includeExternal: options.includeExternal,
        progressReporter: this.progressReporter,
      });

      // Forward progress events
      this.parallelAnalyzer.on('progress', info => {
        this.emit('progress', info);
      });

      this.parallelAnalyzer.on('error', error => {
        this.emit('error', error);
      });
    }

    if (options.watch) {
      this.setupFileWatcher();
    }
  }

  async analyzeIncremental(entryPoint?: string): Promise<CallGraph> {
    const sourceFiles = this.analyzer['project'].getSourceFiles();
    const filePaths = sourceFiles.map(sf => sf.getFilePath());

    // Track watched files
    filePaths.forEach(fp => this.watchedFiles.add(fp));

    if (this.options.parallel && this.parallelAnalyzer) {
      // Use parallel analysis
      const results = await this.parallelAnalyzer.analyzeFiles(filePaths);
      return this.parallelAnalyzer.mergeResults(results);
    } else {
      // Use sequential analysis with caching
      const startTime = Date.now();
      let graph: CallGraph | null = null;
      this.progressReporter.start('Performing incremental analysis...');

      if (entryPoint) {
        // Analyze from specific entry point
        const [file, functionName] = this.parseEntryPoint(entryPoint);
        graph = await this.analyzeWithCache(file, functionName);
      } else {
        // Analyze all files and merge
        const results = new Map();
        let completed = 0;
        const total = filePaths.length;

        for (const filePath of filePaths) {
          const cached = await this.cache.get(filePath);
          if (cached) {
            results.set(filePath, cached);
          } else {
            // Analyze file
            const sourceFile = this.analyzer['project'].getSourceFile(filePath);
            if (sourceFile) {
              const result = await this.analyzeFile(filePath);
              results.set(filePath, result);
              await this.cache.set(filePath, result);
            }
          }

          completed++;
          this.progressReporter.update({
            total,
            completed,
            current: filePath,
            percentage: (completed / total) * 100,
          });
        }

        if (this.parallelAnalyzer) {
          graph = this.parallelAnalyzer.mergeResults(results);
        } else {
          graph = this.mergeResults(results);
        }
      }

      const endTime = Date.now();
      if (graph) {
        graph.metadata.analysisTimeMs = endTime - startTime;
      }

      this.progressReporter.success();
      return graph || this.createEmptyGraph();
    }
  }

  private async analyzeWithCache(file: string, functionName: string): Promise<CallGraph> {
    // Check if we have a cached analysis for this specific entry point
    const cacheKey = `${file}#${functionName}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      // Convert cached result to CallGraph
      return this.resultToCallGraph(cached);
    }

    // Perform fresh analysis
    const entryPointStr = `${file}#${functionName}`;
    const graph = await this.analyzer.analyzeFromEntryPoint(entryPointStr);

    // Cache the result
    const result = this.callGraphToResult(graph);
    await this.cache.set(cacheKey, result);

    return graph;
  }

  private async analyzeFile(filePath: string): Promise<any> {
    const sourceFile = this.analyzer['project'].getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`File not found: ${filePath}`);
    }

    // This would use the analyzer's internal methods to analyze a single file
    // For now, returning a simplified result
    return {
      filePath,
      nodes: [],
      edges: [],
      imports: [],
      exports: [],
      analyzedAt: new Date().toISOString(),
      metrics: {
        functionCount: 0,
        classCount: 0,
      },
    };
  }

  private setupFileWatcher(): void {
    const projectDir = path.dirname(this.options.cacheDir || process.cwd());

    this.fileWatcher = watch(projectDir, {
      persistent: true,
      ignored: [/node_modules/, /\.git/, /\.cache/, /dist/, /build/, /coverage/],
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    this.fileWatcher
      .on('add', (filePath: any) => this.handleFileChange('add', filePath))
      .on('change', (filePath: any) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath: any) => this.handleFileChange('unlink', filePath))
      .on('error', (error: any) => this.emit('watchError', error));
  }

  private handleFileChange(type: 'add' | 'change' | 'unlink', filePath: any): void {
    // Only process TypeScript files
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return;
    }

    // Store the change
    this.pendingChanges.set(filePath, { type, path: filePath });

    // Debounce the processing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, this.debounceDelay);
  }

  private async processPendingChanges(): Promise<void> {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    // Invalidate cache for changed files
    for (const change of changes) {
      await this.cache.invalidate(change.path);

      if (change.type === 'unlink') {
        this.watchedFiles.delete(change.path);
      } else {
        this.watchedFiles.add(change.path);
      }
    }

    // Emit batch change event
    this.emit('filesChanged', changes);

    // Optionally trigger re-analysis
    if (this.options.watch) {
      this.emit('reanalyze', changes);
    }
  }

  private parseEntryPoint(entryPoint: string): [string, string] {
    const parts = entryPoint.split('#');
    if (parts.length !== 2) {
      throw new Error(`Invalid entry point format: ${entryPoint}. Expected "file#function"`);
    }
    return [parts[0], parts[1]];
  }

  private mergeResults(results: Map<string, any>): CallGraph {
    // Simple merge implementation - would be more sophisticated in practice
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const [, result] of results) {
      nodes.push(...(result.nodes || []));
      edges.push(...(result.edges || []));
    }

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        entryPoint: '',
        maxDepth: this.options.maxDepth || 10,
        projectRoot: process.cwd(),
        totalFiles: results.size,
        analysisTimeMs: 0,
      },
      nodes,
      edges,
      entryPointId: nodes[0]?.id || '',
    };
  }

  private resultToCallGraph(result: any): CallGraph {
    return {
      metadata: {
        generatedAt: result.analyzedAt,
        entryPoint: result.filePath,
        maxDepth: this.options.maxDepth || 10,
        projectRoot: process.cwd(),
        totalFiles: 1,
        analysisTimeMs: 0,
      },
      nodes: result.nodes || [],
      edges: result.edges || [],
      entryPointId: result.nodes?.[0]?.id || '',
    };
  }

  private callGraphToResult(graph: CallGraph): any {
    return {
      filePath: graph.metadata.entryPoint,
      nodes: graph.nodes,
      edges: graph.edges,
      imports: [],
      exports: [],
      analyzedAt: graph.metadata.generatedAt,
      metrics: {
        functionCount: graph.nodes.filter(n => n.type === 'function').length,
        classCount: 0, // Classes are not nodes in our current implementation
      },
    };
  }

  private createEmptyGraph(): CallGraph {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        entryPoint: '',
        maxDepth: this.options.maxDepth || 10,
        projectRoot: process.cwd(),
        totalFiles: 0,
        analysisTimeMs: 0,
      },
      nodes: [],
      edges: [],
      entryPointId: '',
    };
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  async getCacheStats(): Promise<any> {
    return this.cache.getCacheStats();
  }

  async close(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
    if (this.parallelAnalyzer) {
      await this.parallelAnalyzer.terminate();
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
