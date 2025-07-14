import { testCommand, TestOptions } from '../../src/cli/commands/test';
import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { StructureValidator } from '../../src/analyzer/StructureValidator';
import { mermaidToCallGraph } from '../../src/parser/MermaidVisitor';
import { logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

jest.mock('../../src/analyzer/CallGraphAnalyzer');
jest.mock('../../src/analyzer/StructureValidator');
jest.mock('../../src/parser/MermaidVisitor');
jest.mock('fs');
jest.mock('../../src/utils/logger');

describe('Test Command', () => {
  const mockCallGraphAnalyzer = CallGraphAnalyzer as jest.MockedClass<typeof CallGraphAnalyzer>;
  const mockStructureValidator = StructureValidator as jest.MockedClass<typeof StructureValidator>;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockMermaidToCallGraph = mermaidToCallGraph as jest.MockedFunction<typeof mermaidToCallGraph>;
  
  let mockProcess: any;
  let consoleLogSpy: jest.SpyInstance;
  
  const sampleCallGraph = {
    metadata: {
      generatedAt: '2024-01-01T00:00:00Z',
      entryPoint: 'main',
      maxDepth: 3,
      projectRoot: '/project',
      totalFiles: 1,
      analysisTimeMs: 100
    },
    nodes: [
      {
        id: 'node_1',
        name: 'main',
        filePath: 'src/simple.ts',
        line: 1,
        type: 'function' as const,
        async: false,
        parameters: [],
        returnType: 'void'
      }
    ],
    edges: [],
    entryPointId: 'node_1'
  };
  
  const validationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {
      requiredEdgesFound: 0,
      requiredEdgesTotal: 0,
      forbiddenEdgesFound: 0,
      missingNodes: [],
      unexpectedNodes: []
    }
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProcess = {
      exit: jest.fn()
    };
    (global as any).process.exit = mockProcess.exit;
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('mock file content');
    
    const mockAnalyzer = {
      analyzeFromEntryPoint: jest.fn().mockResolvedValue(sampleCallGraph)
    };
    mockCallGraphAnalyzer.mockImplementation(() => mockAnalyzer as any);
    
    const mockValidator = {
      validate: jest.fn().mockReturnValue(validationResult),
      generateReport: jest.fn().mockReturnValue('Validation Report')
    };
    mockStructureValidator.mockImplementation(() => mockValidator as any);
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
  });
  
  describe('YAML Specification Loading', () => {
    it('should load valid YAML specification', async () => {
      const yamlContent = yaml.dump({
        name: 'Test Spec',
        entryPoint: { file: 'src/main.ts', function: 'main' },
        requiredEdges: [{ from: 'main', to: 'helper', type: 'sync' }],
        forbiddenEdges: []
      });
      
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const options: TestOptions = {
        spec: 'test.yaml',
        format: 'text'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('All tests passed')
      );
    });
    
    it('should fail for invalid YAML', async () => {
      mockFs.readFileSync.mockReturnValue('{ invalid yaml:');
      
      const options: TestOptions = {
        spec: 'invalid.yaml'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('YAML_PARSE_ERROR')
      );
    });
    
    it('should fail for missing entry point in YAML', async () => {
      const yamlContent = yaml.dump({
        name: 'Test Spec',
        requiredEdges: []
      });
      
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const options: TestOptions = {
        spec: 'missing-entry.yaml'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_SPEC_FORMAT')
      );
    });
  });
  
  describe('Mermaid Specification Loading', () => {
    it('should load valid Mermaid specification', async () => {
      const mermaidContent = `%% test-spec: { name: "Test Spec", entryPoint: { file: "src/main.ts", function: "main" } } %%
flowchart TD
  A --> B`;
      
      mockFs.readFileSync.mockReturnValue(mermaidContent);
      mockMermaidToCallGraph.mockReturnValue({
        ...sampleCallGraph,
        nodes: [
          { ...sampleCallGraph.nodes[0], id: 'node_1', name: 'A' },
          { ...sampleCallGraph.nodes[0], id: 'node_2', name: 'B' }
        ],
        edges: [{
          id: 'edge_1',
          source: 'node_1',
          target: 'node_2',
          type: 'sync',
          line: 1
        }]
      });
      
      const options: TestOptions = {
        spec: 'test.mmd',
        format: 'text'
      };
      
      await testCommand(options);
      
      expect(mockMermaidToCallGraph).toHaveBeenCalled();
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });
    
    it('should fail for Mermaid without metadata', async () => {
      const mermaidContent = 'flowchart TD\n  A --> B';
      
      mockFs.readFileSync.mockReturnValue(mermaidContent);
      
      const options: TestOptions = {
        spec: 'no-metadata.mmd'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('MISSING_MERMAID_METADATA')
      );
    });
    
    it('should fail for invalid Mermaid diagram', async () => {
      const mermaidContent = `%% test-spec: { entryPoint: { file: "src/main.ts", function: "main" } } %%
invalid mermaid`;
      
      mockFs.readFileSync.mockReturnValue(mermaidContent);
      mockMermaidToCallGraph.mockReturnValue(null);
      
      const options: TestOptions = {
        spec: 'invalid.mmd'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('MERMAID_PARSE_ERROR')
      );
    });
  });
  
  describe('Validation and Output', () => {
    beforeEach(() => {
      const yamlContent = yaml.dump({
        name: 'Test Spec',
        entryPoint: { file: 'src/main.ts', function: 'main' },
        requiredEdges: [],
        forbiddenEdges: []
      });
      mockFs.readFileSync.mockReturnValue(yamlContent);
    });
    
    it('should output text format by default', async () => {
      const options: TestOptions = {
        spec: 'test.yaml'
      };
      
      await testCommand(options);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Validation Report');
    });
    
    it('should output JSON format when specified', async () => {
      const options: TestOptions = {
        spec: 'test.yaml',
        format: 'json'
      };
      
      await testCommand(options);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"isValid": true')
      );
    });
    
    it('should show verbose error information', async () => {
      const failedResult = {
        ...validationResult,
        isValid: false,
        errors: [{
          type: 'missing_edge' as const,
          message: 'Required edge not found',
          expected: { from: 'A', to: 'B', type: 'sync' },
          actual: null,
          location: { file: 'src/main.ts', line: 10 }
        }]
      };
      
      const mockValidator = {
        validate: jest.fn().mockReturnValue(failedResult),
        generateReport: jest.fn().mockReturnValue('Validation Report')
      };
      mockStructureValidator.mockImplementation(() => mockValidator as any);
      
      const options: TestOptions = {
        spec: 'test.yaml',
        format: 'text',
        verbose: true
      };
      
      await testCommand(options);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detailed Error Information')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error Type: missing_edge')
      );
    });
    
    it('should exit with code 1 for failed validation', async () => {
      const failedResult = {
        ...validationResult,
        isValid: false,
        errors: [{ type: 'missing_edge' as const, message: 'Test failed' }]
      };
      
      const mockValidator = {
        validate: jest.fn().mockReturnValue(failedResult),
        generateReport: jest.fn().mockReturnValue('Validation Report')
      };
      mockStructureValidator.mockImplementation(() => mockValidator as any);
      
      const options: TestOptions = {
        spec: 'test.yaml'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Tests failed with 1 errors')
      );
    });
  });
  
  describe('File Handling', () => {
    it('should fail when spec file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const options: TestOptions = {
        spec: 'nonexistent.yaml'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SPEC_FILE_NOT_FOUND')
      );
    });
    
    it('should fail for unsupported file format', async () => {
      const options: TestOptions = {
        spec: 'test.txt'
      };
      
      await testCommand(options);
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('UNSUPPORTED_SPEC_FORMAT')
      );
    });
  });
  
  describe('Options Handling', () => {
    beforeEach(() => {
      const yamlContent = yaml.dump({
        name: 'Test Spec',
        entryPoint: { file: 'src/main.ts', function: 'main' },
        requiredEdges: []
      });
      mockFs.readFileSync.mockReturnValue(yamlContent);
    });
    
    it('should use custom target directory', async () => {
      const options: TestOptions = {
        spec: 'test.yaml',
        target: 'lib'
      };
      
      await testCommand(options);
      
      const analyzer = mockCallGraphAnalyzer.mock.results[0].value;
      expect(mockCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePatterns: ['lib/**/*.ts']
        }),
        expect.any(Object)
      );
    });
    
    it('should use custom tsconfig path', async () => {
      const options: TestOptions = {
        spec: 'test.yaml',
        tsconfig: 'custom.tsconfig.json'
      };
      
      await testCommand(options);
      
      expect(mockCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.objectContaining({
          tsConfigPath: 'custom.tsconfig.json'
        }),
        expect.any(Object)
      );
    });
    
    it('should use custom max depth', async () => {
      const options: TestOptions = {
        spec: 'test.yaml',
        maxDepth: '5'
      };
      
      await testCommand(options);
      
      expect(mockCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxDepth: 5
        })
      );
    });
  });
});