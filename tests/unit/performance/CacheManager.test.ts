import { CacheManager } from '../../../src/performance/CacheManager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

jest.mock('fs-extra');

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  const mockCacheDir = '.test-cache';
  const mockFilePath = '/test/file.ts';
  const mockAnalysisResult = {
    filePath: mockFilePath,
    nodes: [],
    edges: [],
    imports: [],
    exports: [],
    analyzedAt: new Date().toISOString(),
    metrics: {
      functionCount: 1,
      classCount: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.pathExists as jest.Mock).mockResolvedValue(false);
    (fs.ensureDirSync as jest.Mock).mockReturnValue(undefined);
    (fs.readJson as jest.Mock).mockResolvedValue({});
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as unknown as jest.Mock).mockResolvedValue('file content');
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (fs.stat as unknown as jest.Mock).mockResolvedValue({ mtime: new Date() });
    (fs.remove as jest.Mock).mockResolvedValue(undefined);
    (fs.emptyDir as jest.Mock).mockResolvedValue(undefined);

    cacheManager = new CacheManager({ cacheDir: mockCacheDir });
  });

  describe('constructor', () => {
    it('should create cache directory if it does not exist', () => {
      expect(fs.ensureDirSync).toHaveBeenCalledWith(expect.stringContaining(mockCacheDir));
    });

    it('should use default cache directory if not specified', () => {
      new CacheManager({});
      expect(fs.ensureDirSync).toHaveBeenCalledWith(
        expect.stringContaining('.call-structure-cache')
      );
    });
  });

  describe('get', () => {
    const cacheKey =
      crypto.createHash('md5').update(path.normalize(mockFilePath)).digest('hex') + '.json';
    const cachePath = path.join(mockCacheDir, cacheKey);

    it('should return null if cache file does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);

      const result = await cacheManager.get(mockFilePath);

      expect(result).toBeNull();
      expect(fs.pathExists).toHaveBeenCalledWith(cachePath);
    });

    it('should return null if cache is expired', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({
        analysis: mockAnalysisResult,
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        fileHash: 'old-hash',
      });

      const result = await cacheManager.get(mockFilePath);

      expect(result).toBeNull();
    });

    it('should return null if file hash does not match', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({
        analysis: mockAnalysisResult,
        timestamp: Date.now(),
        fileHash: 'old-hash',
      });

      const result = await cacheManager.get(mockFilePath);

      expect(result).toBeNull();
    });

    it('should return cached analysis if valid', async () => {
      const fileContent = 'file content';
      const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');

      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({
        analysis: mockAnalysisResult,
        timestamp: Date.now(),
        fileHash,
      });

      const result = await cacheManager.get(mockFilePath);

      expect(result).toEqual(mockAnalysisResult);
    });

    it('should handle errors gracefully', async () => {
      (fs.pathExists as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await cacheManager.get(mockFilePath);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should save analysis result to cache', async () => {
      await cacheManager.set(mockFilePath, mockAnalysisResult);

      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          analysis: mockAnalysisResult,
          timestamp: expect.any(Number),
          fileHash: expect.any(String),
        }),
        { spaces: 2 }
      );
    });

    it('should handle write errors gracefully', async () => {
      (fs.writeJson as jest.Mock).mockRejectedValue(new Error('Write error'));

      // Should not throw
      await expect(cacheManager.set(mockFilePath, mockAnalysisResult)).resolves.toBeUndefined();
    });
  });

  describe('invalidate', () => {
    it('should remove cache file', async () => {
      const cacheKey =
        crypto.createHash('md5').update(path.normalize(mockFilePath)).digest('hex') + '.json';
      const cachePath = path.join(mockCacheDir, cacheKey);

      await cacheManager.invalidate(mockFilePath);

      expect(fs.remove).toHaveBeenCalledWith(cachePath);
    });

    it('should handle removal errors gracefully', async () => {
      (fs.remove as jest.Mock).mockRejectedValue(new Error('Remove error'));

      // Should not throw
      await expect(cacheManager.invalidate(mockFilePath)).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should empty cache directory', async () => {
      await cacheManager.clear();

      expect(fs.emptyDir).toHaveBeenCalledWith(mockCacheDir);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockFiles = ['file1.json', 'file2.json'];
      const mockStats = [
        { size: 1000, mtime: new Date() },
        { size: 2000, mtime: new Date(Date.now() - 1000) },
      ];

      (fs.readdir as unknown as jest.Mock).mockResolvedValue(mockFiles);
      (fs.stat as unknown as jest.Mock)
        .mockResolvedValueOnce(mockStats[0])
        .mockResolvedValueOnce(mockStats[1]);

      const stats = await cacheManager.getCacheStats();

      expect(stats).toEqual({
        totalEntries: 2,
        totalSize: 3000,
        oldestEntry: expect.any(Number),
      });
    });

    it('should handle empty cache', async () => {
      (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);

      const stats = await cacheManager.getCacheStats();

      expect(stats).toEqual({
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: expect.any(Number),
      });
    });
  });

  describe('pruneExpired', () => {
    it('should remove expired cache entries', async () => {
      // Create a cache manager with short maxAge for testing
      const shortCacheManager = new CacheManager({
        cacheDir: mockCacheDir,
        maxAge: 100, // 100ms
      });

      const mockFiles = ['expired.json', 'valid.json'];
      (fs.readdir as unknown as jest.Mock).mockResolvedValue(mockFiles);

      // First file is expired (older than 100ms)
      (fs.readJson as jest.Mock)
        .mockResolvedValueOnce({
          timestamp: Date.now() - 200, // 200ms ago
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(), // Current
        });

      const pruned = await shortCacheManager.pruneExpired();

      expect(pruned).toBe(1);
      expect(fs.remove).toHaveBeenCalledWith(path.join(mockCacheDir, 'expired.json'));
      expect(fs.remove).not.toHaveBeenCalledWith(path.join(mockCacheDir, 'valid.json'));
    });

    it('should remove invalid cache entries during pruning', async () => {
      const mockFiles = ['error.json'];
      (fs.readdir as unknown as jest.Mock).mockResolvedValue(mockFiles);
      (fs.readJson as jest.Mock).mockRejectedValue(new Error('Read error'));

      const pruned = await cacheManager.pruneExpired();

      expect(pruned).toBe(1); // Invalid entries are removed
      expect(fs.remove).toHaveBeenCalledWith(path.join(mockCacheDir, 'error.json'));
    });
  });
});
