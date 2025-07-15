import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

describe.skip('CLI Validate Command', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const fixturesDir = path.join(__dirname, '../fixtures');
  const tempDir = path.join(__dirname, '../fixtures/temp-validate');

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
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
  });

  describe('Entry Point Validation', () => {
    it('should validate a valid entry point', () => {
      const result = runCli('validate --entry "src/simple.ts#main"');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Entry point is valid');
      expect(result.stdout).toContain('src/simple.ts#main');
    });

    it('should fail for non-existent file', () => {
      const result = runCli('validate --entry "src/nonexistent.ts#function"');

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('FILE_NOT_FOUND');
      expect(result.stdout).toContain('src/nonexistent.ts');
    });

    it('should fail for non-existent function', () => {
      const result = runCli('validate --entry "src/simple.ts#nonexistent"');

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('FUNCTION_NOT_FOUND');
      expect(result.stdout).toContain('nonexistent');
    });

    it('should validate multiple entry points', () => {
      const entries = [
        '"src/simple.ts#main"',
        '"src/simple.ts#helper"',
        '"src/simple.ts#asyncHelper"',
      ];

      const result = runCli(`validate --entry ${entries.join(' --entry ')}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All 3 entry points are valid');
    });

    it('should report mixed validation results', () => {
      const entries = [
        '"src/simple.ts#main"',
        '"src/simple.ts#nonexistent"',
        '"src/nonexistent.ts#function"',
      ];

      const result = runCli(`validate --entry ${entries.join(' --entry ')}`);

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('Valid: 1');
      expect(result.stdout).toContain('Invalid: 2');
    });
  });

  describe('Entry Point Format Validation', () => {
    it('should reject invalid entry point format', () => {
      const result = runCli('validate --entry "invalid-format"');

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('INVALID_FORMAT');
      expect(result.stdout).toContain('Expected format: path/to/file.ts#functionName');
    });

    it('should handle absolute paths', () => {
      const absolutePath = path.join(process.cwd(), 'src/simple.ts');
      const result = runCli(`validate --entry "${absolutePath}#main"`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Entry point is valid');
    });

    it('should validate class methods', () => {
      const result = runCli('validate --entry "src/services/UserService.ts#UserService.getUser"');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Entry point is valid');
      expect(result.stdout).toContain('Class method');
    });

    it('should validate static methods', () => {
      const result = runCli('validate --entry "src/utils/Helper.ts#Helper.staticMethod"');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Entry point is valid');
      expect(result.stdout).toContain('Static method');
    });
  });

  describe('Detailed Information', () => {
    it('should show detailed information with --details flag', () => {
      const result = runCli('validate --entry "src/simple.ts#main" --details');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Entry point is valid');
      expect(result.stdout).toContain('Function signature:');
      expect(result.stdout).toContain('Parameters:');
      expect(result.stdout).toContain('Return type:');
      expect(result.stdout).toContain('Line:');
      expect(result.stdout).toContain('Column:');
    });

    it('should show async function details', () => {
      const result = runCli('validate --entry "src/simple.ts#asyncHelper" --details');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Async: true');
      expect(result.stdout).toContain('Return type:');
      expect(result.stdout).toContain('Promise');
    });

    it('should show parameter details', () => {
      const result = runCli(
        'validate --entry "src/services/UserService.ts#UserService.getUser" --details'
      );

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Parameters:');
      expect(result.stdout).toContain('id: string');
    });
  });

  describe('Output Formats', () => {
    it('should output JSON format', () => {
      const result = runCli('validate --entry "src/simple.ts#main" --format json');

      expect(result.code).toBe(0);
      const jsonOutput = JSON.parse(
        result.stdout.split('\n').find(line => line.startsWith('{')) || '{}'
      );
      expect(jsonOutput.valid).toBe(true);
      expect(jsonOutput.entryPoint).toBe('src/simple.ts#main');
      expect(jsonOutput.details).toBeDefined();
    });

    it('should output YAML format', () => {
      const result = runCli('validate --entry "src/simple.ts#main" --format yaml');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('valid: true');
      expect(result.stdout).toContain('entryPoint: src/simple.ts#main');
      expect(result.stdout).toContain('details:');
    });

    it('should save validation results to file', () => {
      const outputPath = path.join(tempDir, 'validation-results.json');
      const result = runCli(
        `validate --entry "src/simple.ts#main" --output ${outputPath} --format json`
      );

      expect(result.code).toBe(0);
      expect(fs.existsSync(outputPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(content.valid).toBe(true);
    });
  });

  describe('Batch Validation from File', () => {
    it('should validate entry points from file', () => {
      const entryPointsFile = path.join(tempDir, 'entry-points.txt');
      fs.writeFileSync(
        entryPointsFile,
        `
src/simple.ts#main
src/simple.ts#helper
src/simple.ts#asyncHelper
      `.trim()
      );

      const result = runCli(`validate --from-file ${entryPointsFile}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All 3 entry points are valid');
    });

    it('should validate JSON file with entry points', () => {
      const entryPointsFile = path.join(tempDir, 'entry-points.json');
      fs.writeFileSync(
        entryPointsFile,
        JSON.stringify({
          entryPoints: [
            { file: 'src/simple.ts', function: 'main' },
            { file: 'src/simple.ts', function: 'helper' },
          ],
        })
      );

      const result = runCli(`validate --from-file ${entryPointsFile}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All 2 entry points are valid');
    });

    it('should handle discovery output format', () => {
      // First run discover command
      const discoverOutput = path.join(tempDir, 'discovered.json');
      runCli(`discover --exports --output ${discoverOutput} --include "src/simple.ts"`);

      // Then validate the discovered entry points
      const result = runCli(`validate --from-file ${discoverOutput}`);

      expect(result.code).toBe(0);
      expect(result.stdout.includes('entry points are valid')).toBe(true);
    });
  });

  describe('TypeScript Configuration', () => {
    it('should use project tsconfig by default', () => {
      const result = runCli('validate --entry "src/simple.ts#main"');

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Entry point is valid');
    });

    it('should use custom tsconfig', () => {
      const customTsConfig = path.join(fixturesDir, 'custom-tsconfig.json');
      if (fs.existsSync(customTsConfig)) {
        const result = runCli(`validate --entry "src/simple.ts#main" --tsconfig ${customTsConfig}`);
        expect(result.code).toBe(0);
      }
    });
  });

  describe('Error Reporting', () => {
    it('should provide helpful error messages', () => {
      const result = runCli('validate --entry "src/simple.ts"');

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('INVALID_FORMAT');
      expect(result.stdout).toContain('Missing function name');
    });

    it('should suggest similar function names', () => {
      const result = runCli('validate --entry "src/simple.ts#mai"');

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('FUNCTION_NOT_FOUND');
      expect(result.stdout.includes('Did you mean: main') || result.stdout.includes('error')).toBe(
        true
      );
    });

    it('should handle TypeScript errors gracefully', () => {
      // Test with a file that has TypeScript errors
      const result = runCli('validate --entry "tests/fixtures/invalid-typescript.ts#function"');

      // Should still attempt validation even if file has TS errors
      expect(result.code).toBe(1);
      expect(
        result.stdout.includes('FILE_NOT_FOUND') || result.stdout.includes('TYPESCRIPT_ERROR')
      ).toBe(true);
    });
  });

  describe('Performance and Large Files', () => {
    it('should validate quickly for single entry point', () => {
      const start = Date.now();
      const result = runCli('validate --entry "src/simple.ts#main"');
      const duration = Date.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle validation of many entry points', () => {
      const entries: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries.push('"src/simple.ts#main"');
      }

      const result = runCli(`validate --entry ${entries.join(' --entry ')}`);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All 10 entry points are valid');
    });
  });
});
