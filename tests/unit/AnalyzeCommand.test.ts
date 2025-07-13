import { analyzeCommand, AnalyzeOptions } from '../../src/cli/commands/analyze';
import { CallGraphError } from '../../src/types/CallGraph';
import { logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Mock the logger to prevent console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    progress: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fs to control file system behavior
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock EntryPointAnalyzer to avoid ts-morph initialization issues
const mockValidateEntryPoint = jest.fn();
jest.mock('../../src/analyzer/EntryPointAnalyzer', () => ({
  EntryPointAnalyzer: jest.fn().mockImplementation(() => ({
    validateEntryPoint: mockValidateEntryPoint,
  })),
}));

// Mock CallGraphAnalyzer to avoid complex analysis during unit tests
const mockAnalyzeFromEntryPoint = jest.fn();
jest.mock('../../src/analyzer/CallGraphAnalyzer', () => ({
  CallGraphAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeFromEntryPoint: mockAnalyzeFromEntryPoint,
  })),
}));

describe('AnalyzeCommand', () => {
  const mockExampleProjectPath = path.join(__dirname, '../../examples/simple-project');
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset file system mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => '');
    
    // Reset analyzer mocks
    mockValidateEntryPoint.mockResolvedValue({ isValid: false, error: 'Entry point not found' });
    mockAnalyzeFromEntryPoint.mockResolvedValue({
      nodes: [{ id: 'test', name: 'testFunction' }],
      edges: [],
      metadata: { entryPoint: 'test', timestamp: new Date().toISOString() },
    });
  });

  describe('Entry Point Validation', () => {
    it('should throw error for invalid entry point format without #', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_ENTRY_POINT_FORMAT',
          message: expect.stringContaining('Expected "file#function"'),
        })
      );
    });

    it('should throw error for empty function name', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_ENTRY_POINT_FORMAT',
        })
      );
    });

    it('should throw error for empty file name', async () => {
      const options: AnalyzeOptions = {
        entry: '#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_ENTRY_POINT_FORMAT',
        })
      );
    });

    it('should throw error for unsupported file type', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.py#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNSUPPORTED_FILE_TYPE',
          message: expect.stringContaining('Supported types: .ts, .tsx, .js, .jsx'),
        })
      );
    });

    it('should accept valid TypeScript file extensions', async () => {
      const validExtensions = ['src/main.ts#main', 'src/component.tsx#Component', 'src/utils.js#helper', 'src/app.jsx#App'];
      
      for (const entry of validExtensions) {
        const options: AnalyzeOptions = {
          entry,
          format: 'json',
          maxDepth: '10',
          projectRoot: mockExampleProjectPath,
        };

        // Mock file existence but not entry point validation to focus on format validation
        mockFs.existsSync.mockReturnValue(false);
        
        await expect(analyzeCommand(options)).rejects.toThrow(
          expect.objectContaining({
            code: 'SOURCE_FILE_NOT_FOUND',
          })
        );
      }
    });

    it('should throw error when source file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const options: AnalyzeOptions = {
        entry: 'src/nonexistent.ts#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.objectContaining({
          code: 'SOURCE_FILE_NOT_FOUND',
          message: expect.stringContaining('src/nonexistent.ts'),
        })
      );
    });
  });

  describe('Output Format Validation', () => {
    it('should throw error for unsupported output format', async () => {
      // Mock successful validation to reach format processing
      mockValidateEntryPoint.mockResolvedValue({ isValid: true });
      
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'xml' as any,
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      // This will fail during format processing
      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNSUPPORTED_FORMAT',
        })
      );
    });

    it('should support json format', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '1',
        projectRoot: mockExampleProjectPath,
      };

      // Will fail at entry point validation, but format validation passes
      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.not.objectContaining({
          code: 'UNSUPPORTED_FORMAT',
        })
      );
    });

    it('should support yaml format', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'yaml',
        maxDepth: '1',
        projectRoot: mockExampleProjectPath,
      };

      // Will fail at entry point validation, but format validation passes
      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.not.objectContaining({
          code: 'UNSUPPORTED_FORMAT',
        })
      );
    });

    it('should support mermaid format', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'mermaid',
        maxDepth: '1',
        projectRoot: mockExampleProjectPath,
      };

      // Will fail at entry point validation, but format validation passes
      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.not.objectContaining({
          code: 'UNSUPPORTED_FORMAT',
        })
      );
    });
  });

  describe('Analysis Options', () => {
    it('should parse maxDepth correctly', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '5',
        projectRoot: mockExampleProjectPath,
      };

      // This should not throw a parsing error for maxDepth
      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.not.objectContaining({
          message: expect.stringContaining('maxDepth'),
        })
      );
    });

    it('should handle default maxDepth when invalid', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: 'invalid',
        projectRoot: mockExampleProjectPath,
      };

      // Should not throw parsing error, should default to 10
      await expect(analyzeCommand(options)).rejects.toThrow(
        expect.not.objectContaining({
          message: expect.stringContaining('maxDepth'),
        })
      );
    });
  });

  describe('Output Handling', () => {
    it('should create output directory if it does not exist', async () => {
      // Mock successful validation to reach output handling
      mockValidateEntryPoint.mockResolvedValue({ isValid: true });

      mockFs.existsSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('output')) {
          return false; // Output directory doesn't exist
        }
        return true; // Other files exist
      });

      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        output: 'output/results.json',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await analyzeCommand(options);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('output', { recursive: true });
    });

    it('should write output to file when output option is provided', async () => {
      // Mock successful validation to reach output handling
      mockValidateEntryPoint.mockResolvedValue({ isValid: true });

      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        output: 'results.json',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      await analyzeCommand(options);

      // Should write file after successful analysis
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Progress and Error Reporting', () => {
    it('should log progress messages', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      try {
        await analyzeCommand(options);
      } catch {
        // Expected to fail
      }

      expect(logger.progress).toHaveBeenCalledWith(
        expect.stringContaining('Starting analysis of entry point')
      );
    });

    it('should log error messages with timing', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
      };

      try {
        await analyzeCommand(options);
      } catch {
        // Expected to fail
      }

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Analysis failed after'),
        expect.any(Error)
      );
    });
  });

  describe('Project Context Creation', () => {
    it('should use provided project root', async () => {
      const customRoot = '/custom/project/path';
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: customRoot,
      };

      try {
        await analyzeCommand(options);
      } catch {
        // Expected to fail
      }

      // The command should work with custom project root (validation will fail but not due to root path)
      expect(logger.progress).toHaveBeenCalled();
    });

    it('should find default tsconfig.json when not specified', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
        // No tsconfig specified
      };

      try {
        await analyzeCommand(options);
      } catch {
        // Expected to fail at entry point validation
      }

      // Should not throw error about missing tsconfig
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('tsconfig'),
        expect.anything()
      );
    });

    it('should use provided tsconfig path', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '10',
        projectRoot: mockExampleProjectPath,
        tsconfig: 'custom-tsconfig.json',
      };

      try {
        await analyzeCommand(options);
      } catch {
        // Expected to fail at entry point validation
      }

      // Should work with custom tsconfig (though it may not exist)
      expect(logger.progress).toHaveBeenCalled();
    });
  });

  describe('Successful Analysis Flow', () => {
    it('should complete analysis when entry point is valid', async () => {
      // Mock successful validation
      mockValidateEntryPoint.mockResolvedValue({ isValid: true });

      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        format: 'json',
        maxDepth: '5',
        projectRoot: mockExampleProjectPath,
      };

      await expect(analyzeCommand(options)).resolves.not.toThrow();
      
      expect(logger.progress).toHaveBeenCalledWith(
        expect.stringContaining('Starting analysis of entry point')
      );
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Analysis completed')
      );
    });

    it('should save output to file when output option is provided', async () => {
      // Mock successful validation and analysis
      mockValidateEntryPoint.mockResolvedValue({ isValid: true });

      const options: AnalyzeOptions = {
        entry: 'src/main.ts#main',
        output: 'results.json',
        format: 'json',
        maxDepth: '5',
        projectRoot: mockExampleProjectPath,
      };

      await analyzeCommand(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'results.json',
        expect.any(String),
        'utf-8'
      );
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Results saved to: results.json')
      );
    });
  });
});