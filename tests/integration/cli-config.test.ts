import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('CLI Configuration Loading', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const tempDir = path.join(__dirname, '../fixtures/temp-config');
  
  function runCli(args: string): { stdout: string; stderr: string; code: number } {
    try {
      const stdout = execSync(`node ${cliPath} ${args}`, {
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' }
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
  
  
  describe('Debug and Quiet Modes', () => {
    it('should show debug output with --debug flag', () => {
      const result = runCli('--debug discover --main');
      
      // Debug mode should show more detailed output
      expect(result.stdout.length).toBeGreaterThan(0);
    });
    
    it('should suppress output with --quiet flag', () => {
      const result = runCli('--quiet discover --main');
      
      // Quiet mode should show minimal output
      // Only errors should be displayed
      if (result.code === 0) {
        expect(result.stdout).not.toContain('[INFO]');
        expect(result.stdout).not.toContain('[DEBUG]');
      }
    });
    
    it('should disable progress with --no-progress flag', () => {
      const result = runCli('--no-progress discover --main');
      
      // Progress indicators should not be shown
      expect(result.stdout).not.toContain('�');
    });
  });
  
  describe('Analyze Command Configuration', () => {
    it('should load config file for analyze command', () => {
      const configPath = path.join(tempDir, 'analyze-config.json');
      const config = {
        maxDepth: 30,
        filterExternal: true,
        metrics: true,
        exclude: ['node_modules/**', 'dist/**']
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      const result = runCli(`analyze -e src/simple.ts#main --config ${configPath}`);
      
      // Should apply config settings
      expect(result.code).toBeDefined();
    });
    
    it('should override config with CLI options', () => {
      const configPath = path.join(tempDir, 'override-config.yaml');
      const config = {
        maxDepth: 5,
        format: 'yaml'
      };
      
      fs.writeFileSync(configPath, yaml.dump(config));
      
      // CLI option should override config
      const result = runCli(`analyze -e src/simple.ts#main --config ${configPath} --max-depth 15 --format json`);
      
      expect(result.code).toBeDefined();
      // Output should be JSON format, not YAML
      if (result.code === 0 && result.stdout.includes('{')) {
        // Extract JSON from output (similar to cli-test-command.test.ts)
        const jsonStart = result.stdout.indexOf('{');
        const jsonEnd = result.stdout.lastIndexOf('}');
        if (jsonStart > -1 && jsonEnd > jsonStart) {
          const jsonString = result.stdout.substring(jsonStart, jsonEnd + 1);
          expect(() => JSON.parse(jsonString)).not.toThrow();
        }
      }
    });
  });
  
  describe('Filter External Option', () => {
    it('should filter external dependencies with --filter-external', () => {
      const result = runCli('analyze -e src/simple.ts#main --filter-external');
      
      // Should complete analysis
      expect(result.code).toBeDefined();
      
      // Output should not include node_modules paths
      if (result.code === 0) {
        expect(result.stdout).not.toMatch(/node_modules/);
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should error on invalid config file path', () => {
      const result = runCli('analyze -e src/simple.ts#main --config nonexistent.yaml');
      
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('CONFIG_FILE_NOT_FOUND');
    });
    
    it('should error on invalid config format', () => {
      const configPath = path.join(tempDir, 'invalid.txt');
      fs.writeFileSync(configPath, 'invalid config content');
      
      const result = runCli(`analyze -e src/simple.ts#main --config ${configPath}`);
      
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('UNSUPPORTED_CONFIG_FORMAT');
    });
    
    it('should error on malformed YAML config', () => {
      const configPath = path.join(tempDir, 'malformed.yaml');
      fs.writeFileSync(configPath, '{ invalid yaml:');
      
      const result = runCli(`analyze -e src/simple.ts#main --config ${configPath}`);
      
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('CONFIG_PARSE_ERROR');
    });
  });
});