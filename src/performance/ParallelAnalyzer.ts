import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import * as fastq from 'fastq';
import { EventEmitter } from 'events';
import { AnalysisResult } from '../types/AnalysisResult';
import { CallGraph, CallGraphNode, CallGraphEdge } from '../types/CallGraph';
import { CacheManager } from './CacheManager';
import { ProgressReporter } from './ProgressReporter';

interface WorkerMessage {
  type: 'error' | 'success';
  error?: string;
  data?: AnalysisResult;
}

export interface ParallelAnalyzerOptions {
  concurrency?: number;
  tsConfigPath: string;
  cacheManager?: CacheManager;
  maxDepth?: number;
  includeExternal?: boolean;
  progressReporter?: ProgressReporter;
}

export interface ProgressInfo {
  total: number;
  completed: number;
  current: string;
  percentage: number;
}

interface QueueTask {
  file: string;
  resolve: (result: AnalysisResult) => void;
  reject: (error: Error) => void;
}

export class ParallelAnalyzer extends EventEmitter {
  private queue: fastq.queueAsPromised<QueueTask>;
  private workers: Worker[] = [];
  private tsConfigPath: string;
  private cacheManager?: CacheManager;
  private progressReporter?: ProgressReporter;
  private options: ParallelAnalyzerOptions;
  private workerPath: string;

  constructor(options: ParallelAnalyzerOptions) {
    super();
    this.options = options;
    this.tsConfigPath = options.tsConfigPath;
    this.cacheManager = options.cacheManager;
    this.progressReporter = options.progressReporter || ProgressReporter.forFileAnalysis();
    // In production, __dirname will be the dist/performance directory
    // In development, we need to find the compiled worker.js file
    let workerPath = path.join(__dirname, 'worker.js');

    // If the worker file doesn't exist, try to find it
    if (!fs.existsSync(workerPath)) {
      // Check if we're in development mode (src directory)
      if (__dirname.includes('src')) {
        // Look for compiled worker in dist directory
        const distPath = __dirname.replace('src', 'dist');
        workerPath = path.join(distPath, 'worker.js');
      }
    }

    this.workerPath = workerPath;
    this.initializeWorkers(options.concurrency || 4);

    // Create queue with worker function
    this.queue = fastq.promise(this.analyzeFileTask.bind(this), options.concurrency || 4);
  }

  private initializeWorkers(count: number): void {
    for (let i = 0; i < count; i++) {
      const worker = new Worker(this.workerPath);
      this.workers.push(worker);
    }
  }

  async analyzeFiles(files: string[]): Promise<Map<string, AnalysisResult>> {
    const results = new Map<string, AnalysisResult>();
    const total = files.length;
    let completed = 0;

    this.progressReporter?.start(`Analyzing ${total} files...`);

    // Create tasks for each file
    const tasks = files.map(file => {
      return new Promise<void>((resolve, reject) => {
        this.queue.push({
          file,
          resolve: (result: AnalysisResult) => {
            results.set(file, result);
            completed++;
            this.emitProgress({
              total,
              completed,
              current: file,
              percentage: (completed / total) * 100,
            });
            resolve();
          },
          reject,
        });
      });
    });

    await Promise.all(tasks);
    this.progressReporter?.success(`Analyzed ${total} files`);
    return results;
  }

  private analyzeInWorker(file: string): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();

      const messageHandler = (result: WorkerMessage): void => {
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);

        if (result.type === 'error') {
          reject(new Error(result.error));
        } else if (result.data) {
          resolve(result.data);
        } else {
          reject(new Error('Missing data in worker result'));
        }
      };

      const errorHandler = (error: Error): void => {
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(error);
      };

      worker.on('message', messageHandler);
      worker.on('error', errorHandler);

      worker.postMessage({
        type: 'analyze',
        file,
        tsConfigPath: this.tsConfigPath,
        options: {
          maxDepth: this.options.maxDepth,
          includeExternal: this.options.includeExternal,
        },
      });
    });
  }

  private getAvailableWorker(): Worker {
    // Simple round-robin worker selection
    const worker = this.workers.shift()!;
    this.workers.push(worker);
    return worker;
  }

  mergeResults(results: Map<string, AnalysisResult>): CallGraph {
    const allNodes = new Map<string, CallGraphNode>();
    const allEdges: CallGraphEdge[] = [];
    const metadata = {
      generatedAt: new Date().toISOString(),
      entryPoint: '',
      maxDepth: this.options.maxDepth || 10,
      projectRoot: process.cwd(),
      totalFiles: results.size,
      analysisTimeMs: 0,
    };

    // Merge all nodes and edges
    for (const [, result] of results) {
      for (const node of result.nodes) {
        allNodes.set(node.id, node);
      }
      allEdges.push(...result.edges);
    }

    // Resolve edge targets that reference nodes we've discovered
    const resolvedEdges = allEdges
      .map(edge => {
        // If target is just a function name, try to resolve it to a full node ID
        if (!edge.target.includes('#') && !edge.target.includes('.')) {
          // Look for a matching node
          for (const [nodeId, node] of allNodes) {
            if (node.name === edge.target) {
              return { ...edge, target: nodeId };
            }
          }
        }
        return edge;
      })
      .filter(edge => {
        // Only include edges where both source and target exist
        return allNodes.has(edge.source) && allNodes.has(edge.target);
      });

    return {
      metadata,
      nodes: Array.from(allNodes.values()),
      edges: resolvedEdges,
      entryPointId: allNodes.values().next().value?.id || '',
    };
  }

  private emitProgress(info: ProgressInfo): void {
    this.emit('progress', info);
    this.progressReporter?.update(info);
  }

  private async analyzeFileTask(task: QueueTask): Promise<void> {
    const { file, resolve, reject } = task;

    try {
      // Check cache first
      if (this.cacheManager) {
        const cached = await this.cacheManager.get(file);
        if (cached) {
          resolve(cached);
          return;
        }
      }

      // Analyze in worker
      const result = await this.analyzeInWorker(file);

      // Cache the result
      if (this.cacheManager) {
        await this.cacheManager.set(file, result);
      }

      resolve(result);
    } catch (error) {
      this.emit('error', { file, error });
      reject(error as Error);
    }
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
  }
}
