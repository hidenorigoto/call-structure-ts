import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { AnalysisResult } from '../types/AnalysisResult';

export interface CacheEntry {
  fileHash: string;
  timestamp: number;
  analysis: AnalysisResult;
}

export interface CacheOptions {
  cacheDir?: string;
  maxAge?: number; // Max age in milliseconds
}

export class CacheManager {
  private cacheDir: string;
  private maxAge: number;

  constructor(options: CacheOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.call-structure-cache');
    this.maxAge = options.maxAge || 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    fs.ensureDirSync(this.cacheDir);
  }

  async get(filePath: string): Promise<AnalysisResult | null> {
    try {
      const cacheKey = this.getCacheKey(filePath);
      const cachePath = path.join(this.cacheDir, cacheKey);

      if (!(await fs.pathExists(cachePath))) {
        return null;
      }

      const entry: CacheEntry = await fs.readJson(cachePath);

      // Check if cache is expired
      if (Date.now() - entry.timestamp > this.maxAge) {
        await this.invalidate(filePath);
        return null;
      }

      // Check if file has been modified
      const currentHash = await this.getFileHash(filePath);
      if (entry.fileHash !== currentHash) {
        await this.invalidate(filePath);
        return null;
      }

      return entry.analysis;
    } catch (error) {
      // If any error occurs, treat as cache miss
      return null;
    }
  }

  async set(filePath: string, analysis: AnalysisResult): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(filePath);
      const cachePath = path.join(this.cacheDir, cacheKey);
      const fileHash = await this.getFileHash(filePath);

      const entry: CacheEntry = {
        fileHash,
        timestamp: Date.now(),
        analysis,
      };

      await fs.writeJson(cachePath, entry, { spaces: 2 });
    } catch (error) {
      // Silently fail on cache write errors
      console.warn(`Failed to write cache for ${filePath}:`, error);
    }
  }

  async invalidate(filePath: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(filePath);
      const cachePath = path.join(this.cacheDir, cacheKey);
      await fs.remove(cachePath);
    } catch {
      // Ignore errors when invalidating cache
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.emptyDir(this.cacheDir);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: number;
  }> {
    const files = await fs.readdir(this.cacheDir);
    let totalSize = 0;
    let oldestEntry = Date.now();

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;

      try {
        const entry: CacheEntry = await fs.readJson(filePath);
        if (entry.timestamp < oldestEntry) {
          oldestEntry = entry.timestamp;
        }
      } catch {
        // Skip invalid cache entries
      }
    }

    return {
      totalEntries: files.length,
      totalSize,
      oldestEntry,
    };
  }

  private getCacheKey(filePath: string): string {
    const normalized = path.normalize(filePath);
    const hash = crypto.createHash('md5').update(normalized).digest('hex');
    return `${hash}.json`;
  }

  private async getFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async pruneExpired(): Promise<number> {
    let pruned = 0;
    const files = await fs.readdir(this.cacheDir);

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      try {
        const entry: CacheEntry = await fs.readJson(filePath);
        if (Date.now() - entry.timestamp > this.maxAge) {
          await fs.remove(filePath);
          pruned++;
        }
      } catch {
        // Remove invalid cache entries
        await fs.remove(filePath);
        pruned++;
      }
    }

    return pruned;
  }
}
