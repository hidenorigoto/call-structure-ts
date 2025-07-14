import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('CLI Analyze-Batch Command', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const fixturesDir = path.join(__dirname, '../fixtures');
  const tempDir = path.join(__dirname, '../fixtures/temp-batch');
  
  function runCli(args: string): { stdout: string; stderr: string; code: number } {
    try {
      const stdout = execSync(`node ${cliPath} ${args} 2>&1`, {
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' },
        cwd: path.join(__dirname, '../../') // Run from project root
      });
      return { stdout, stderr: '', code: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.status || 1
      };
    }
  }
  
  beforeAll(() => {
    // Build the project
    execSync('npm run build', { stdio: 'ignore' });
    
    // Create temp directory with absolute path
    const absoluteTempDir = path.resolve(tempDir);
    if (!fs.existsSync(absoluteTempDir)) {
      fs.mkdirSync(absoluteTempDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('Basic Functionality', () => {
    it('should require --config option', () => {
      const result = runCli('analyze-batch');
      
      expect(result.code).toBe(1);
      expect(result.stdout).toContain("required option '--config <file>' not specified");
    });
    
    it('should error on missing config file', () => {
      const result = runCli('analyze-batch --config nonexistent.yaml');
      
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('CONFIG_FILE_NOT_FOUND');
    });
    
    it('should analyze multiple entry points', () => {
      const configPath = path.join(tempDir, 'test-batch.yaml');
      const outputDir = path.join(tempDir, 'batch-output');
      
      // Create a test batch config
      const config = {
        entry_points: [
          {
            file: 'src/simple.ts',
            function: 'main',
            output: 'simple-main.json'
          },
          {
            file: 'src/simple.ts',
            function: 'helper',
            output: 'simple-helper.json'
          }
        ],
        common_options: {
          max_depth: 5,
          format: 'json',
          projectRoot: path.join(__dirname, '../../')
        }
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      const result = runCli(`analyze-batch --config ${configPath} --output-dir ${outputDir}`);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Processing 2 entry points');
      expect(result.stdout).toContain('Batch analysis complete');
      
      // Check output files
      expect(fs.existsSync(path.join(outputDir, 'simple-main.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'simple-helper.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'batch-report.json'))).toBe(true);
      
      // Verify batch report
      const reportPath = path.join(outputDir, 'batch-report.json');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      
      expect(report.summary.total).toBe(2);
      expect(report.summary.successful).toBe(2);
      expect(report.summary.failed).toBe(0);
      expect(report.results).toHaveLength(2);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle analysis failures with --continue-on-error', () => {
      const configPath = path.join(tempDir, 'test-batch-error.yaml');
      const outputDir = path.join(tempDir, 'batch-error-output');
      
      const config = {
        entry_points: [
          {
            file: 'src/simple.ts',
            function: 'main',
            output: 'simple-main.json'
          },
          {
            file: 'src/nonexistent.ts',
            function: 'foo',
            output: 'error.json'
          },
          {
            file: 'src/simple.ts',
            function: 'helper',
            output: 'simple-helper.json'
          }
        ],
        common_options: {
          projectRoot: path.join(__dirname, '../../')
        }
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      const result = runCli(`analyze-batch --config ${configPath} --output-dir ${outputDir} --continue-on-error`);
      
      // Should complete successfully despite one failure
      expect(result.code).toBe(0);
      // Error messages are now merged into stdout with 2>&1
      expect(result.stdout).toContain('✗ Failed: src/nonexistent.ts#foo');
      expect(result.stdout).toContain('Success: 2');
      expect(result.stdout).toContain('Failed: 1');
      
      // Check that successful analyses were completed
      expect(fs.existsSync(path.join(outputDir, 'simple-main.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'simple-helper.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'error.json'))).toBe(false);
    });
    
    it('should stop on first error without --continue-on-error', () => {
      const configPath = path.join(tempDir, 'test-batch-stop.yaml');
      const outputDir = path.join(tempDir, 'batch-stop-output');
      
      const config = {
        entry_points: [
          {
            file: 'src/nonexistent.ts',
            function: 'foo',
            output: 'error.json'
          },
          {
            file: 'src/simple.ts',
            function: 'main',
            output: 'simple-main.json'
          }
        ],
        common_options: {
          projectRoot: path.join(__dirname, '../../')
        }
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      const result = runCli(`analyze-batch --config ${configPath} --output-dir ${outputDir} --parallel 1`);
      
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('✗ Failed: src/nonexistent.ts#foo');
    });
  });
  
  describe('Parallel Processing', () => {
    it('should respect --parallel option', () => {
      const configPath = path.join(tempDir, 'test-batch-parallel.yaml');
      const outputDir = path.join(tempDir, 'batch-parallel-output');
      
      const config = {
        entry_points: Array.from({ length: 6 }, (_, i) => ({
          file: 'src/simple.ts',
          function: i % 2 === 0 ? 'main' : 'helper',
          output: `output-${i}.json`
        })),
        common_options: {
          projectRoot: path.join(__dirname, '../../')
        }
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      const result = runCli(`analyze-batch --config ${configPath} --output-dir ${outputDir} --parallel 2`);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Processing 6 entry points with concurrency: 2');
      expect(result.stdout).toContain('Processing batch 1/3');
      expect(result.stdout).toContain('Processing batch 2/3');
      expect(result.stdout).toContain('Processing batch 3/3');
    });
  });
  
  describe('Configuration Formats', () => {
    it('should support JSON configuration', () => {
      const configPath = path.join(tempDir, 'test-batch.json');
      const outputDir = path.join(tempDir, 'batch-json-output');
      
      const config = {
        entry_points: [
          {
            file: 'src/simple.ts',
            function: 'main',
            output: 'main.json'
          }
        ],
        common_options: {
          projectRoot: path.join(__dirname, '../../')
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      const result = runCli(`analyze-batch --config ${configPath} --output-dir ${outputDir}`);
      
      expect(result.code).toBe(0);
      expect(fs.existsSync(path.join(outputDir, 'main.json'))).toBe(true);
    });
    
    it('should validate configuration structure', () => {
      const configPath = path.join(tempDir, 'invalid-batch.yaml');
      
      // Missing entry_points
      const config = {
        common_options: {
          max_depth: 10
        }
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      const result = runCli(`analyze-batch --config ${configPath}`);
      
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('INVALID_CONFIG');
      expect(result.stdout).toContain('missing or invalid entry_points array');
    });
  });
  
  describe('Output Formats', () => {
    it('should generate different output formats', () => {
      const configPath = path.join(tempDir, 'test-formats.yaml');
      const outputDir = path.join(tempDir, 'batch-formats-output');
      
      const config = {
        entry_points: [
          {
            file: 'src/simple.ts',
            function: 'main',
            output: 'main.json',
            options: { format: 'json' }
          },
          {
            file: 'src/simple.ts',
            function: 'helper',
            output: 'helper.yaml',
            options: { format: 'yaml' }
          },
          {
            file: 'src/simple.ts',
            function: 'asyncHelper',
            output: 'async.mmd',
            options: { format: 'mermaid' }
          }
        ],
        common_options: {
          projectRoot: path.join(__dirname, '../../')
        }
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      const result = runCli(`analyze-batch --config ${configPath} --output-dir ${outputDir}`);
      
      expect(result.code).toBe(0);
      
      // Check JSON output
      const jsonContent = fs.readFileSync(path.join(outputDir, 'main.json'), 'utf-8');
      expect(() => JSON.parse(jsonContent)).not.toThrow();
      
      // Check YAML output
      const yamlContent = fs.readFileSync(path.join(outputDir, 'helper.yaml'), 'utf-8');
      expect(() => yaml.load(yamlContent)).not.toThrow();
      
      // Check Mermaid output
      const mermaidContent = fs.readFileSync(path.join(outputDir, 'async.mmd'), 'utf-8');
      expect(mermaidContent).toContain('flowchart TD');
    });
  });
});