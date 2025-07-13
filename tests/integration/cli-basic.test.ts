import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

describe('CLI Basic Integration Tests', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const exampleProjectPath = path.join(__dirname, '../../examples/simple-project');
  
  beforeAll(() => {
    // Ensure the CLI is built
    if (!fs.existsSync(cliPath)) {
      execSync('npm run build', { cwd: path.join(__dirname, '../..') });
    }
  });

  describe('Version Command', () => {
    it('should display correct version', () => {
      const output = execSync(`node ${cliPath} --version`, { encoding: 'utf8' });
      expect(output.trim()).toBe('0.1.0');
    });
  });

  describe('Help Command', () => {
    it('should display help for analyze command', () => {
      const output = execSync(`node ${cliPath} analyze --help`, { encoding: 'utf8' });
      expect(output).toContain('Analyze call graph from an entry point');
      expect(output).toContain('--entry');
      expect(output).toContain('--output');
      expect(output).toContain('--format');
      expect(output).toContain('--max-depth');
    });
  });

  describe('Basic Analyze Functionality', () => {
    const outputPath = path.join(exampleProjectPath, 'test-cli-output.json');

    afterEach(() => {
      // Clean up output file
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    });

    it('should fail when entry point is not provided', () => {
      expect(() => {
        execSync(`node ${cliPath} analyze`, { encoding: 'utf8' });
      }).toThrow();
    });

    it('should fail with invalid entry point format', () => {
      expect(() => {
        execSync(`node ${cliPath} analyze --entry "invalid-format" --quiet`, { 
          encoding: 'utf8',
          cwd: exampleProjectPath,
          stdio: 'pipe' 
        });
      }).toThrow();
    });

    it('should analyze entry point and save to file', () => {
      execSync(
        `node ${cliPath} analyze --entry "src/main.ts#main" --output test-cli-output.json --quiet`,
        { 
          encoding: 'utf8',
          cwd: exampleProjectPath,
          stdio: 'pipe'
        }
      );

      // Check file was created
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Verify content
      const content = fs.readFileSync(outputPath, 'utf8');
      const result = JSON.parse(content);
      
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result.entryPointId).toContain('main');
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should support different output formats', () => {
      // Test YAML format
      const yamlPath = path.join(exampleProjectPath, 'test-cli-output.yaml');
      execSync(
        `node ${cliPath} analyze --entry "src/main.ts#main" --output test-cli-output.yaml --format yaml --quiet`,
        { 
          encoding: 'utf8',
          cwd: exampleProjectPath,
          stdio: 'pipe'
        }
      );
      
      expect(fs.existsSync(yamlPath)).toBe(true);
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      expect(yamlContent).toContain('metadata:');
      expect(yamlContent).toContain('entry_point:');
      expect(yamlContent).toContain('functions:');
      expect(yamlContent).toContain('calls:');
      
      // Clean up
      fs.unlinkSync(yamlPath);

      // Test Mermaid format
      const mermaidPath = path.join(exampleProjectPath, 'test-cli-output.md');
      execSync(
        `node ${cliPath} analyze --entry "src/main.ts#main" --output test-cli-output.md --format mermaid --quiet`,
        { 
          encoding: 'utf8',
          cwd: exampleProjectPath,
          stdio: 'pipe'
        }
      );
      
      expect(fs.existsSync(mermaidPath)).toBe(true);
      const mermaidContent = fs.readFileSync(mermaidPath, 'utf8');
      expect(mermaidContent).toContain('flowchart');
      expect(mermaidContent).toContain('main');
      
      // Clean up
      fs.unlinkSync(mermaidPath);
    });

    it('should respect max-depth option', () => {
      execSync(
        `node ${cliPath} analyze --entry "src/main.ts#main" --output test-cli-output.json --max-depth 1 --quiet`,
        { 
          encoding: 'utf8',
          cwd: exampleProjectPath,
          stdio: 'pipe'
        }
      );

      const content = fs.readFileSync(outputPath, 'utf8');
      const result = JSON.parse(content);
      
      expect(result.metadata.maxDepth).toBe(1);
      // With max depth 1, we should have fewer nodes than with default depth
      expect(result.nodes.length).toBeLessThan(10);
    });
  });

  describe('Error Handling', () => {
    it('should provide user-friendly error for non-existent file', () => {
      let stderr = '';
      
      try {
        execSync(
          `node ${cliPath} analyze --entry "non-existent.ts#main" --quiet`,
          { 
            encoding: 'utf8',
            cwd: exampleProjectPath,
            stdio: 'pipe'
          }
        );
      } catch (e: any) {
        stderr = e.stderr || '';
      }

      expect(stderr).toContain('SOURCE_FILE_NOT_FOUND');
      expect(stderr).toContain('non-existent.ts');
    });

    it('should provide user-friendly error for non-existent function', () => {
      let stderr = '';
      
      try {
        execSync(
          `node ${cliPath} analyze --entry "src/main.ts#nonExistentFunction" --quiet`,
          { 
            encoding: 'utf8',
            cwd: exampleProjectPath,
            stdio: 'pipe'
          }
        );
      } catch (e: any) {
        stderr = e.stderr || '';
      }

      expect(stderr).toContain('ENTRY_POINT_NOT_FOUND');
      expect(stderr).toContain('nonExistentFunction');
    });
  });

  describe('Package Configuration', () => {
    it('should have correct bin entry in package.json', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.bin).toHaveProperty('call-structure');
      expect(packageJson.bin['call-structure']).toBe('dist/cli/index.js');
    });

    it('should be executable after build', () => {
      expect(fs.existsSync(cliPath)).toBe(true);
      
      // Check if file has shebang
      const content = fs.readFileSync(cliPath.replace('dist/', 'src/').replace('.js', '.ts'), 'utf8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });
  });
});