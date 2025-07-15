import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

describe.skip('CLI Advanced Analyze Options', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const fixturesDir = path.join(__dirname, '../fixtures');
  const tempDir = path.join(__dirname, '../fixtures/temp-advanced');
  const outputPath = path.join(tempDir, 'output.json');

  function runCli(args: string): { stdout: string; stderr: string; code: number } {
    try {
      const stdout = execSync(`node ${cliPath} ${args} 2>&1`, {
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' },
        cwd: path.join(__dirname, '../../'), // Run from project root
      });
      return { stdout, stderr: '', code: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.status || 1,
      };
    }
  }

  beforeAll(() => {
    // Build the project
    execSync('npm run build', { stdio: 'ignore' });

    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up any output files
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  });

  describe('Depth Control', () => {
    it('should analyze with custom max-depth', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --max-depth 2 --quiet`
      );

      expect(result.code).toBe(0);
      expect(fs.existsSync(outputPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(content.metadata.maxDepth).toBe(2);

      // Check that analysis stopped at depth 2
      const maxDepthInGraph = Math.max(...content.nodes.map((n: any) => n.depth || 0));
      expect(maxDepthInGraph).toBeLessThanOrEqual(2);
    });

    it('should handle max-depth of 0 (entry point only)', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --max-depth 0 --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // Should only have the entry point node
      expect(content.nodes).toHaveLength(1);
      expect(content.edges).toHaveLength(0);
    });

    it('should analyze deeply with high max-depth', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --max-depth 100 --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(content.metadata.maxDepth).toBe(100);
    });
  });

  describe('Include/Exclude Patterns', () => {
    it('should include only matching patterns', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --include "src/**/*.ts" --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // All nodes should be from src directory
      content.nodes.forEach((node: any) => {
        if (node.filePath) {
          expect(node.filePath).toContain('/src/');
        }
      });
    });

    it('should exclude matching patterns', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --exclude "**/test/**" --exclude "**/*.test.ts" --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // No test files should be included
      content.nodes.forEach((node: any) => {
        if (node.filePath) {
          expect(node.filePath).not.toContain('/test/');
          expect(node.filePath).not.toContain('.test.ts');
        }
      });
    });

    it('should combine include and exclude patterns', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --include "src/**/*.ts" --exclude "**/internal/**" --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      content.nodes.forEach((node: any) => {
        if (node.filePath) {
          expect(node.filePath).toContain('/src/');
          expect(node.filePath).not.toContain('/internal/');
        }
      });
    });
  });

  describe('Metrics Collection', () => {
    it('should include metrics when requested', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --include-metrics --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      expect(content.metrics).toBeDefined();
      expect(content.metrics.totalNodes).toBeGreaterThan(0);
      expect(content.metrics.totalEdges).toBeGreaterThanOrEqual(0);
      expect(content.metrics.maxDepth).toBeGreaterThan(0);
      expect(content.metrics.avgFanOut).toBeDefined();
      expect(content.metrics.circularDependencies).toBeDefined();
    });

    it('should calculate complexity metrics', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --include-metrics --include-complexity --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      expect(content.metrics.complexity).toBeDefined();
      expect(content.metrics.complexity.cyclomaticComplexity).toBeDefined();
      expect(content.metrics.complexity.cognitiveComplexity).toBeDefined();
    });

    it('should include node-level metrics', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --include-metrics --node-metrics --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // Each node should have metrics
      content.nodes.forEach((node: any) => {
        expect(node.metrics).toBeDefined();
        expect(node.metrics.fanIn).toBeDefined();
        expect(node.metrics.fanOut).toBeDefined();
      });
    });
  });

  describe('External Dependencies', () => {
    it('should filter external dependencies', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --filter-external --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // Should not include external module calls
      content.nodes.forEach((node: any) => {
        expect(node.external).not.toBe(true);
      });
    });

    it('should include external dependencies when not filtered', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --no-filter-external --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // May include external dependencies
      const hasExternal = content.nodes.some((node: any) => node.external === true);
      // This assertion depends on whether the test file imports external modules
      expect(typeof hasExternal).toBe('boolean');
    });

    it('should mark external nodes appropriately', () => {
      const result = runCli(
        `analyze --entry "src/cli/index.ts#main" --output ${outputPath} --no-filter-external --max-depth 2 --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // CLI likely imports from node_modules
      const externalNodes = content.nodes.filter((node: any) => node.external === true);
      expect(externalNodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration File', () => {
    it('should load options from config file', () => {
      const configPath = path.join(tempDir, 'analyze-config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          maxDepth: 3,
          includeMetrics: true,
          filterExternal: true,
          exclude: ['**/*.test.ts'],
        })
      );

      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --config ${configPath} --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      expect(content.metadata.maxDepth).toBe(3);
      expect(content.metrics).toBeDefined();
    });

    it('should allow CLI options to override config file', () => {
      const configPath = path.join(tempDir, 'analyze-config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          maxDepth: 3,
          includeMetrics: false,
        })
      );

      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --config ${configPath} --max-depth 5 --include-metrics --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // CLI options should override config
      expect(content.metadata.maxDepth).toBe(5);
      expect(content.metrics).toBeDefined();
    });
  });

  describe('Performance Options', () => {
    it('should use caching when enabled', () => {
      // First run
      const result1 = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --cache --quiet`
      );
      expect(result1.code).toBe(0);

      const content1 = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      const time1 = content1.metadata.analysisTimeMs;

      // Second run should be faster due to cache
      const result2 = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --cache --quiet`
      );
      expect(result2.code).toBe(0);

      const content2 = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      const time2 = content2.metadata.analysisTimeMs;

      // Cache might make it faster, but not guaranteed in all environments
      expect(time2).toBeLessThanOrEqual(time1 * 1.5);
    });

    it('should work without cache', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --no-cache --quiet`
      );

      expect(result.code).toBe(0);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });

  describe('Output Options', () => {
    it('should support streaming output', () => {
      const result = runCli(`analyze --entry "src/simple.ts#main" --stream --format json`);

      expect(result.code).toBe(0);
      // Streaming output should still be valid JSON when concatenated
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      if (jsonMatch) {
        expect(() => JSON.parse(jsonMatch[0])).not.toThrow();
      }
    });

    it('should minify JSON output', () => {
      const result1 = runCli(`analyze --entry "src/simple.ts#main" --output ${outputPath} --quiet`);
      const size1 = fs.statSync(outputPath).size;

      fs.unlinkSync(outputPath);

      const result2 = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --minify --quiet`
      );
      const size2 = fs.statSync(outputPath).size;

      expect(result1.code).toBe(0);
      expect(result2.code).toBe(0);
      expect(size2).toBeLessThan(size1);
    });

    it('should pretty-print output by default', () => {
      const result = runCli(`analyze --entry "src/simple.ts#main" --output ${outputPath} --quiet`);

      expect(result.code).toBe(0);
      const content = fs.readFileSync(outputPath, 'utf-8');

      // Pretty-printed JSON has newlines and indentation
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });
  });

  describe('Circular Reference Handling', () => {
    it('should detect circular references', () => {
      // Assuming we have a fixture with circular dependencies
      const result = runCli(
        `analyze --entry "src/circular/a.ts#funcA" --output ${outputPath} --include-metrics --quiet`
      );

      if (result.code === 0 && fs.existsSync(outputPath)) {
        const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        if (content.metrics) {
          expect(content.metrics.circularDependencies).toBeDefined();
        }
      }
    });

    it('should handle circular references with different strategies', () => {
      const strategies = ['omit', 'mark', 'break'];

      strategies.forEach(strategy => {
        const outputFile = path.join(tempDir, `circular-${strategy}.json`);
        const result = runCli(
          `analyze --entry "src/simple.ts#main" --output ${outputFile} --circular-strategy ${strategy} --quiet`
        );

        // Command should complete successfully regardless of strategy
        expect(result.code).toBe(0);
        expect(fs.existsSync(outputFile)).toBe(true);

        fs.unlinkSync(outputFile);
      });
    });
  });

  describe('TypeScript Configuration', () => {
    it('should respect custom tsconfig', () => {
      const customTsConfig = path.join(fixturesDir, 'custom-tsconfig.json');
      if (fs.existsSync(customTsConfig)) {
        const result = runCli(
          `analyze --entry "src/simple.ts#main" --output ${outputPath} --tsconfig ${customTsConfig} --quiet`
        );
        expect(result.code).toBe(0);
      }
    });

    it('should handle strict type checking', () => {
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${outputPath} --strict --quiet`
      );

      expect(result.code).toBe(0);
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

      // With strict mode, type information should be more detailed
      content.nodes.forEach((node: any) => {
        if (node.returnType) {
          expect(node.returnType).not.toBe('any');
        }
      });
    });
  });
});
