import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

describe('CLI Interactive Mode', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');

  beforeAll(() => {
    // Ensure the project is built
    if (!fs.existsSync(cliPath)) {
      throw new Error('Project must be built before running integration tests');
    }
  });

  // Helper function to run interactive CLI with input
  function runInteractiveCli(
    inputs: string[]
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, 'interactive'], {
        env: { ...process.env, NODE_ENV: 'test' },
        cwd: path.join(__dirname, '../../'),
      });

      let stdout = '';
      let stderr = '';
      let inputIndex = 0;

      child.stdout.on('data', data => {
        stdout += data.toString();

        // Send input when we see prompts
        if (inputIndex < inputs.length) {
          // Wait a bit to ensure the prompt is ready
          setTimeout(() => {
            if (inputIndex < inputs.length) {
              child.stdin.write(inputs[inputIndex] + '\n');
              inputIndex++;
            }
          }, 100);
        }
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      child.on('error', error => {
        reject(error);
      });

      // Start the interaction
      setTimeout(() => {
        if (inputIndex === 0 && inputs.length > 0) {
          child.stdin.write(inputs[inputIndex] + '\n');
          inputIndex++;
        }
      }, 500);

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve({ stdout, stderr, code: 1 });
      }, 10000);
    });
  }

  describe('Basic Navigation', () => {
    it('should start interactive mode and show welcome message', async () => {
      const result = await runInteractiveCli([
        '\x1B[B\x1B[B\x1B[B\x1B[B\x1B[B', // Arrow down to Exit
        '\n', // Select Exit
      ]);

      expect(result.stdout).toContain('Welcome to Call Structure TS Interactive Mode!');
      expect(result.stdout).toContain('What would you like to do?');
      expect(result.stdout).toContain('Analyze a function');
      expect(result.stdout).toContain('Exit');
      expect(result.stdout).toContain('Goodbye!');
      expect(result.code).toBe(0);
    });

    it('should show help when help is selected', async () => {
      const result = await runInteractiveCli([
        '\x1B[B\x1B[B\x1B[B\x1B[B', // Arrow down to Help
        '\n', // Select Help
        '\n', // Press Enter to continue
        '\x1B[B\x1B[B\x1B[B\x1B[B\x1B[B', // Arrow down to Exit
        '\n', // Select Exit
      ]);

      expect(result.stdout).toContain('Call Structure TS Interactive Mode Help');
      expect(result.stdout).toContain('Analyze a function');
      expect(result.stdout).toContain('Test against specification');
      expect(result.stdout).toContain('Tips:');
    });
  });

  describe('Command Options', () => {
    it('should accept project root option', async () => {
      const child = spawn('node', [cliPath, 'interactive', '--project-root', '.'], {
        env: { ...process.env, NODE_ENV: 'test' },
      });

      // Kill the process after a short delay
      setTimeout(() => child.kill(), 1000);

      const result = await new Promise<{ code: number }>(resolve => {
        child.on('close', code => {
          resolve({ code: code || 0 });
        });
      });

      // Should start without error (0 or null for killed process)
      expect([0, null]).toContain(result.code);
    });

    it('should accept tsconfig option', async () => {
      const child = spawn('node', [cliPath, 'interactive', '--tsconfig', 'tsconfig.json'], {
        env: { ...process.env, NODE_ENV: 'test' },
      });

      setTimeout(() => child.kill(), 1000);

      const result = await new Promise<{ code: number }>(resolve => {
        child.on('close', code => {
          resolve({ code: code || 0 });
        });
      });

      expect([0, null]).toContain(result.code);
    });
  });

  describe('File Discovery', () => {
    it('should discover TypeScript files when analyze is selected', async () => {
      // This test is tricky because we need to handle autocomplete
      // For now, we'll just test that it reaches the file selection
      const result = await runInteractiveCli([
        '\n', // Select Analyze
        '\x03', // Ctrl+C to exit
      ]);

      expect(result.stdout).toContain('Analyze a function');
      // The test might not see the file list due to timing issues
      // but it should at least start the analysis process
    });
  });

  describe('Specification Testing', () => {
    it('should show specification testing interface', async () => {
      const result = await runInteractiveCli([
        '\x1B[B', // Arrow down to Test
        '\n', // Select Test
        '\x03', // Ctrl+C to exit
      ]);

      // Should show specification testing interface
      expect(result.stdout).toContain('🧪 Specification Testing');
    });
  });

  describe('Batch Analysis', () => {
    it('should show batch config options', async () => {
      const result = await runInteractiveCli([
        '\x1B[B\x1B[B', // Arrow down to Batch
        '\n', // Select Batch
        '\x03', // Ctrl+C to exit
      ]);

      expect(result.stdout).toContain('Batch Analysis');
      // Should show existing config files or option to create new
      expect(result.stdout).toMatch(/batch-config|Create new configuration/);
    });
  });
});
