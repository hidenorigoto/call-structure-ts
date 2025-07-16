import { PerformanceOptimizer } from '../../../src/performance/PerformanceOptimizer';
import { CallGraphAnalyzer } from '../../../src/analyzer/CallGraphAnalyzer';
import { ParallelAnalyzer } from '../../../src/performance/ParallelAnalyzer';
import { IncrementalAnalyzer } from '../../../src/performance/IncrementalAnalyzer';
import { CacheManager } from '../../../src/performance/CacheManager';
import * as fs from 'fs';
// import * as path from 'path';
import * as os from 'os';

jest.mock('../../../src/analyzer/CallGraphAnalyzer');
jest.mock('../../../src/performance/ParallelAnalyzer');
jest.mock('../../../src/performance/IncrementalAnalyzer');
jest.mock('../../../src/performance/CacheManager');
jest.mock('fs');

describe('PerformanceOptimizer', () => {
  const mockTsConfigPath = '/test/tsconfig.json';
  const mockCallGraph = {
    nodes: [{ id: 'test', name: 'test', type: 'function' as const, filePath: '/test.ts' }],
    edges: [],
    metadata: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    (CallGraphAnalyzer.prototype.analyzeFromEntryPoint as jest.Mock).mockResolvedValue(
      mockCallGraph
    );
    (ParallelAnalyzer.prototype.analyzeFiles as jest.Mock).mockResolvedValue([]);
    (ParallelAnalyzer.prototype.mergeResults as jest.Mock).mockReturnValue(mockCallGraph);
    (ParallelAnalyzer.prototype.terminate as jest.Mock).mockResolvedValue(undefined);
    (IncrementalAnalyzer.prototype.analyzeIncremental as jest.Mock).mockResolvedValue(
      mockCallGraph
    );
    (IncrementalAnalyzer.prototype.close as jest.Mock).mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      new PerformanceOptimizer(mockTsConfigPath);

      expect(CacheManager).toHaveBeenCalled();
    });

    it('should respect custom configuration', () => {
      new PerformanceOptimizer(mockTsConfigPath, {
        enableCache: false,
        enableParallel: false,
        enableProgress: false,
      });

      expect(CacheManager).not.toHaveBeenCalled();
    });

    it('should use CPU count for default concurrency', () => {
      const cpuCount = os.cpus().length;
      const optimizer = new PerformanceOptimizer(mockTsConfigPath);

      // Verify internal config has correct concurrency
      expect((optimizer as unknown as { config: { concurrency: number } }).config.concurrency).toBe(
        cpuCount
      );
    });
  });

  describe('analyze', () => {
    it('should validate entry point file exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const optimizer = new PerformanceOptimizer(mockTsConfigPath);

      await expect(optimizer.analyze('nonexistent.ts#main')).rejects.toThrow(
        'Source file not found'
      );
    });

    it('should use incremental analyzer when enabled', async () => {
      const optimizer = new PerformanceOptimizer(mockTsConfigPath, {
        enableIncremental: true,
      });

      await optimizer.analyze('test.ts#main');

      expect(IncrementalAnalyzer).toHaveBeenCalled();
      expect(IncrementalAnalyzer.prototype.analyzeIncremental).toHaveBeenCalledWith('test.ts#main');
    });

    it('should use parallel analyzer when enabled and no entry point', async () => {
      const optimizer = new PerformanceOptimizer(mockTsConfigPath, {
        enableParallel: true,
        enableIncremental: false,
      });

      // Mock project source files
      const mockSourceFiles = [
        { getFilePath: () => '/src/file1.ts' },
        { getFilePath: () => '/src/file2.ts' },
      ];
      (
        CallGraphAnalyzer.prototype as unknown as { project: { getSourceFiles: () => unknown[] } }
      ).project = {
        getSourceFiles: () => mockSourceFiles,
      };

      await optimizer.analyze();

      expect(ParallelAnalyzer).toHaveBeenCalled();
      expect(ParallelAnalyzer.prototype.analyzeFiles).toHaveBeenCalled();
    });

    it('should use sequential analyzer by default with entry point', async () => {
      const optimizer = new PerformanceOptimizer(mockTsConfigPath, {
        enableParallel: true,
        enableIncremental: false,
      });

      await optimizer.analyze('test.ts#main');

      expect(CallGraphAnalyzer).toHaveBeenCalled();
      expect(CallGraphAnalyzer.prototype.analyzeFromEntryPoint).toHaveBeenCalledWith(
        'test.ts#main'
      );
    });

    it('should handle absolute paths', async () => {
      const optimizer = new PerformanceOptimizer(mockTsConfigPath);

      await optimizer.analyze('/absolute/path/test.ts#main');

      expect(fs.existsSync).toHaveBeenCalledWith('/absolute/path/test.ts');
    });

    it('should handle relative paths', async () => {
      const optimizer = new PerformanceOptimizer(mockTsConfigPath);

      await optimizer.analyze('src/test.ts#main');

      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('src/test.ts'));
    });
  });

  describe('factory methods', () => {
    it('should create default optimizer', () => {
      const optimizer = PerformanceOptimizer.createDefault(mockTsConfigPath);

      expect(optimizer).toBeInstanceOf(PerformanceOptimizer);
      expect(CacheManager).toHaveBeenCalled();
    });

    it('should create fast optimizer', () => {
      const optimizer = PerformanceOptimizer.createFast(mockTsConfigPath);

      expect(optimizer).toBeInstanceOf(PerformanceOptimizer);
      const config = (
        optimizer as unknown as { config: { enableIncremental: boolean; concurrency: number } }
      ).config;
      expect(config.enableIncremental).toBe(true);
      expect(config.concurrency).toBe(os.cpus().length * 2);
    });

    it('should create minimal optimizer', () => {
      const optimizer = PerformanceOptimizer.createMinimal(mockTsConfigPath);

      expect(optimizer).toBeInstanceOf(PerformanceOptimizer);
      expect(CacheManager).not.toHaveBeenCalled();
    });

    it('should create CI optimizer', () => {
      const optimizer = PerformanceOptimizer.createForCI(mockTsConfigPath);

      expect(optimizer).toBeInstanceOf(PerformanceOptimizer);
      const config = (
        optimizer as unknown as { config: { enableCache: boolean; concurrency: number } }
      ).config;
      expect(config.enableCache).toBe(false);
      expect(config.concurrency).toBe(2);
    });
  });

  describe('cache operations', () => {
    let optimizer: PerformanceOptimizer;
    let mockCacheManager: jest.Mocked<CacheManager>;

    beforeEach(() => {
      optimizer = new PerformanceOptimizer(mockTsConfigPath);
      mockCacheManager = (optimizer as unknown as { cacheManager: jest.Mocked<CacheManager> })
        .cacheManager;
      mockCacheManager.getCacheStats = jest.fn().mockResolvedValue({ files: 10 });
      mockCacheManager.clear = jest.fn().mockResolvedValue(undefined);
      mockCacheManager.pruneExpired = jest.fn().mockResolvedValue(5);
    });

    it('should get cache stats', async () => {
      const stats = await optimizer.getCacheStats();

      expect(stats).toEqual({ files: 10 });
      expect(mockCacheManager.getCacheStats).toHaveBeenCalled();
    });

    it('should return null stats when cache is disabled', async () => {
      optimizer = new PerformanceOptimizer(mockTsConfigPath, { enableCache: false });

      const stats = await optimizer.getCacheStats();

      expect(stats).toBeNull();
    });

    it('should clear cache', async () => {
      await optimizer.clearCache();

      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should not fail when clearing cache if disabled', async () => {
      optimizer = new PerformanceOptimizer(mockTsConfigPath, { enableCache: false });

      await expect(optimizer.clearCache()).resolves.toBeUndefined();
    });

    it('should prune expired cache entries', async () => {
      const pruned = await optimizer.pruneCache();

      expect(pruned).toBe(5);
      expect(mockCacheManager.pruneExpired).toHaveBeenCalled();
    });

    it('should return 0 when pruning cache if disabled', async () => {
      optimizer = new PerformanceOptimizer(mockTsConfigPath, { enableCache: false });

      const pruned = await optimizer.pruneCache();

      expect(pruned).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from sequential analysis', async () => {
      const error = new Error('Analysis failed');
      (CallGraphAnalyzer.prototype.analyzeFromEntryPoint as jest.Mock).mockRejectedValue(error);

      const optimizer = new PerformanceOptimizer(mockTsConfigPath);

      await expect(optimizer.analyze('test.ts#main')).rejects.toThrow('Analysis failed');
    });

    it('should propagate errors from parallel analysis', async () => {
      const error = new Error('Parallel analysis failed');
      (ParallelAnalyzer.prototype.analyzeFiles as jest.Mock).mockRejectedValue(error);

      const optimizer = new PerformanceOptimizer(mockTsConfigPath, {
        enableParallel: true,
      });

      // Mock project source files
      (
        CallGraphAnalyzer.prototype as unknown as { project: { getSourceFiles: () => unknown[] } }
      ).project = {
        getSourceFiles: () => [{ getFilePath: () => '/src/file.ts' }],
      };

      await expect(optimizer.analyze()).rejects.toThrow('Parallel analysis failed');
    });

    it('should close incremental analyzer even on error', async () => {
      const error = new Error('Incremental analysis failed');
      (IncrementalAnalyzer.prototype.analyzeIncremental as jest.Mock).mockRejectedValue(error);

      const optimizer = new PerformanceOptimizer(mockTsConfigPath, {
        enableIncremental: true,
        watch: false,
      });

      await expect(optimizer.analyze('test.ts#main')).rejects.toThrow(
        'Incremental analysis failed'
      );
      expect(IncrementalAnalyzer.prototype.close).toHaveBeenCalled();
    });

    it('should terminate parallel analyzer even on error', async () => {
      const error = new Error('Parallel analysis failed');
      (ParallelAnalyzer.prototype.analyzeFiles as jest.Mock).mockRejectedValue(error);

      const optimizer = new PerformanceOptimizer(mockTsConfigPath, {
        enableParallel: true,
      });

      // Mock project source files
      (
        CallGraphAnalyzer.prototype as unknown as { project: { getSourceFiles: () => unknown[] } }
      ).project = {
        getSourceFiles: () => [{ getFilePath: () => '/src/file.ts' }],
      };

      await expect(optimizer.analyze()).rejects.toThrow('Parallel analysis failed');
      expect(ParallelAnalyzer.prototype.terminate).toHaveBeenCalled();
    });
  });
});
