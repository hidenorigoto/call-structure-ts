import { analyzeBatchCommand, BatchOptions } from '../../src/cli/commands/analyze-batch';
import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../../src/analyzer/CallGraphAnalyzer');
jest.mock('../../src/utils/logger');
jest.mock('fs');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedCallGraphAnalyzer = CallGraphAnalyzer as jest.MockedClass<typeof CallGraphAnalyzer>;

describe('AnalyzeBatchCommand', () => {
  let mockAnalyzer: jest.Mocked<CallGraphAnalyzer>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockReturnValue(undefined);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    
    // Mock the analyzer
    mockAnalyzer = {
      analyzeFromEntryPoint: jest.fn().mockResolvedValue({
        nodes: [{ id: 'node1' }, { id: 'node2' }],
        edges: [{ source: 'node1', target: 'node2' }],
        metadata: { 
          maxDepth: 3,
          generatedAt: new Date().toISOString(),
          entryPoint: 'test',
          projectRoot: '.',
          totalFiles: 1,
          analysisTimeMs: 100
        },
        entryPointId: 'node1'
      })
    } as any;
    
    mockedCallGraphAnalyzer.mockImplementation(() => mockAnalyzer);
    
    // Mock console methods
    (logger.progress as jest.Mock).mockImplementation(() => {});
    (logger.info as jest.Mock).mockImplementation(() => {});
    (logger.success as jest.Mock).mockImplementation(() => {});
    (logger.error as jest.Mock).mockImplementation(() => {});
  });
  
  describe('Configuration Loading', () => {
    it('should load YAML configuration', async () => {
      const yamlContent = `
entry_points:
  - file: src/test.ts
    function: main
    output: test.json
common_options:
  max_depth: 5
`;
      
      mockedFs.readFileSync.mockReturnValue(yamlContent);
      
      const options: BatchOptions = {
        config: 'batch.yaml',
        outputDir: './output',
        parallel: 2
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockedFs.readFileSync).toHaveBeenCalledWith('batch.yaml', 'utf-8');
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledWith('src/test.ts#main');
    });
    
    it('should load JSON configuration', async () => {
      const jsonContent = JSON.stringify({
        entry_points: [{
          file: 'src/test.ts',
          function: 'main',
          output: 'test.json'
        }]
      });
      
      mockedFs.readFileSync.mockReturnValue(jsonContent);
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockedFs.readFileSync).toHaveBeenCalledWith('batch.json', 'utf-8');
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalled();
    });
    
    it('should throw error for missing config file', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      const options: BatchOptions = {
        config: 'missing.yaml',
        outputDir: './output',
        parallel: 1
      };
      
      await expect(analyzeBatchCommand(options)).rejects.toThrow('Batch configuration file not found');
    });
    
    it('should validate configuration structure', async () => {
      const invalidConfig = JSON.stringify({ invalid: 'config' });
      mockedFs.readFileSync.mockReturnValue(invalidConfig);
      
      const options: BatchOptions = {
        config: 'invalid.json',
        outputDir: './output',
        parallel: 1
      };
      
      await expect(analyzeBatchCommand(options)).rejects.toThrow('Invalid batch configuration');
    });
  });
  
  describe('Analysis Execution', () => {
    it('should analyze multiple entry points', async () => {
      const config = {
        entry_points: [
          { file: 'src/a.ts', function: 'funcA', output: 'a.json' },
          { file: 'src/b.ts', function: 'funcB', output: 'b.json' },
          { file: 'src/c.ts', function: 'funcC', output: 'c.json' }
        ]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 2
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledTimes(3);
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledWith('src/a.ts#funcA');
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledWith('src/b.ts#funcB');
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledWith('src/c.ts#funcC');
    });
    
    it('should handle class methods', async () => {
      const config = {
        entry_points: [{
          file: 'src/service.ts',
          className: 'UserService',
          function: 'create',
          output: 'user-create.json'
        }]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledWith('src/service.ts#UserService.create');
    });
    
    it('should apply common options', async () => {
      const config = {
        entry_points: [{
          file: 'src/test.ts',
          function: 'main',
          output: 'test.json'
        }],
        common_options: {
          max_depth: 20,
          exclude_patterns: ['node_modules/**']
        }
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      // Check that CallGraphAnalyzer was created with correct options
      expect(mockedCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxDepth: 20,
          excludePatterns: [expect.any(RegExp)]
        })
      );
    });
    
    it('should override common options with entry-specific options', async () => {
      const config = {
        entry_points: [{
          file: 'src/test.ts',
          function: 'main',
          output: 'test.json',
          options: {
            maxDepth: 30
          }
        }],
        common_options: {
          max_depth: 10
        }
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockedCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxDepth: 30
        })
      );
    });
  });
  
  describe('Error Handling', () => {
    it('should continue on error when continueOnError is true', async () => {
      const config = {
        entry_points: [
          { file: 'src/a.ts', function: 'funcA', output: 'a.json' },
          { file: 'src/b.ts', function: 'funcB', output: 'b.json' },
          { file: 'src/c.ts', function: 'funcC', output: 'c.json' }
        ]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      // Make the second analysis fail
      const mockMetadata = {
        maxDepth: 0,
        generatedAt: new Date().toISOString(),
        entryPoint: 'test',
        projectRoot: '.',
        totalFiles: 1,
        analysisTimeMs: 100
      };
      
      mockAnalyzer.analyzeFromEntryPoint
        .mockResolvedValueOnce({ 
          nodes: [], 
          edges: [], 
          metadata: mockMetadata, 
          entryPointId: 'test' 
        })
        .mockRejectedValueOnce(new Error('Analysis failed'))
        .mockResolvedValueOnce({ 
          nodes: [], 
          edges: [], 
          metadata: mockMetadata, 
          entryPointId: 'test' 
        });
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1,
        continueOnError: true
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed: src/b.ts#funcB'));
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Success: 2'));
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Failed: 1'));
    });
    
    it('should stop on first error when continueOnError is false', async () => {
      const config = {
        entry_points: [
          { file: 'src/a.ts', function: 'funcA', output: 'a.json' },
          { file: 'src/b.ts', function: 'funcB', output: 'b.json' }
        ]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      mockAnalyzer.analyzeFromEntryPoint.mockRejectedValueOnce(new Error('Analysis failed'));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1,
        continueOnError: false
      };
      
      await expect(analyzeBatchCommand(options)).rejects.toThrow('Analysis failed');
    });
  });
  
  describe('Output Generation', () => {
    it('should generate individual output files', async () => {
      const config = {
        entry_points: [
          { file: 'src/a.ts', function: 'funcA', output: 'a.json' },
          { file: 'src/b.ts', function: 'funcB', output: 'b.yaml' }
        ]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join('./output', 'a.json'),
        expect.any(String),
        'utf-8'
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join('./output', 'b.yaml'),
        expect.any(String),
        'utf-8'
      );
    });
    
    it('should generate combined report', async () => {
      const config = {
        entry_points: [
          { file: 'src/a.ts', function: 'funcA', output: 'a.json' }
        ]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join('./output', 'batch-report.json'),
        expect.stringContaining('"summary"'),
        'utf-8'
      );
    });
    
    it('should create output directory if it does not exist', async () => {
      const config = {
        entry_points: [
          { file: 'src/test.ts', function: 'main', output: 'test.json' }
        ]
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      mockedFs.existsSync.mockImplementation((path) => {
        if (path === 'batch.json') return true;
        if (path === './output') return false;
        return true;
      });
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 1
      };
      
      await analyzeBatchCommand(options);
      
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith('./output', { recursive: true });
    });
  });
  
  describe('Progress Tracking', () => {
    it('should show progress for batches', async () => {
      const config = {
        entry_points: Array.from({ length: 5 }, (_, i) => ({
          file: `src/file${i}.ts`,
          function: `func${i}`,
          output: `out${i}.json`
        }))
      };
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(config));
      
      const options: BatchOptions = {
        config: 'batch.json',
        outputDir: './output',
        parallel: 2
      };
      
      await analyzeBatchCommand(options);
      
      expect(logger.info).toHaveBeenCalledWith('Processing batch 1/3');
      expect(logger.info).toHaveBeenCalledWith('Processing batch 2/3');
      expect(logger.info).toHaveBeenCalledWith('Processing batch 3/3');
    });
  });
});