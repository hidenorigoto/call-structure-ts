import { jest } from '@jest/globals';

// Mock all dependencies before any imports
jest.mock('inquirer');
jest.mock('ora');
jest.mock('fs');
jest.mock('glob');
jest.mock('inquirer-autocomplete-prompt');
jest.mock('../../src/analyzer/CallGraphAnalyzer');
jest.mock('../../src/formatter/JsonFormatter');
jest.mock('../../src/formatter/YamlFormatter');
jest.mock('../../src/formatter/MermaidFormatter');
jest.mock('../../src/cli/commands/analyze');
jest.mock('../../src/cli/commands/test');
jest.mock('../../src/cli/commands/analyze-batch');

// Now import the modules
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs';
import { glob } from 'glob';

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedOra = ora as unknown as jest.MockedFunction<typeof ora>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedGlob = glob as unknown as jest.MockedFunction<typeof glob>;

// Import after mocking
import { interactiveCommand } from '../../src/cli/commands/interactive';

describe('InteractiveCommand', () => {
  let mockSpinner: any;
  let mockPrompt: jest.Mock<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock spinner
    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      stop: jest.fn(),
      succeed: jest.fn(),
      fail: jest.fn()
    };
    mockedOra.mockReturnValue(mockSpinner);
    
    // Mock inquirer
    mockPrompt = jest.fn();
    mockedInquirer.prompt = mockPrompt as any;
    mockedInquirer.registerPrompt = jest.fn();
    
    // Mock console methods
    jest.spyOn(console, 'clear').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Default fs mocks
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('mock file content');
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.statSync.mockReturnValue({ mtime: new Date() } as any);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Main Menu', () => {
    it('should display welcome message and main menu', async () => {
      // Mock exit action
      mockPrompt.mockResolvedValueOnce({ action: 'exit' });
      
      await interactiveCommand({});
      
      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Welcome to Call Structure TS Interactive Mode!\n');
      expect(mockedInquirer.prompt).toHaveBeenCalledWith([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'analyze' }),
          expect.objectContaining({ value: 'test' }),
          expect.objectContaining({ value: 'batch' }),
          expect.objectContaining({ value: 'recent' }),
          expect.objectContaining({ value: 'help' }),
          expect.objectContaining({ value: 'exit' })
        ])
      }]);
    });
    
    it('should exit when exit is selected', async () => {
      mockPrompt.mockResolvedValueOnce({ action: 'exit' });
      
      await interactiveCommand({});
      
      expect(console.log).toHaveBeenCalledWith('\nGoodbye! 👋\n');
    });
  });
  
  describe('Analyze Function', () => {
    it('should analyze a function when analyze is selected', async () => {
      // Mock glob to return some files
      mockedGlob.mockResolvedValue(['src/test.ts', 'src/another.ts']);
      
      // Mock inquirer prompts
      mockPrompt
        .mockResolvedValueOnce({ action: 'analyze' })
        .mockResolvedValueOnce({ file: 'src/test.ts' })
        .mockResolvedValueOnce({ func: { name: 'testFunction' } })
        .mockResolvedValueOnce({ format: 'json' })
        .mockResolvedValueOnce({ maxDepth: 10, includeMetrics: false })
        .mockResolvedValueOnce({ shouldSave: false })
        .mockResolvedValueOnce({ continue: '' })
        .mockResolvedValueOnce({ action: 'exit' });
      
      // Mock Project and source file analysis
      const mockProject = {
        addSourceFileAtPath: jest.fn().mockReturnValue({
          getFunctions: jest.fn().mockReturnValue([{
            getName: jest.fn().mockReturnValue('testFunction')
          }]),
          getClasses: jest.fn().mockReturnValue([])
        })
      };
      
      jest.doMock('ts-morph', () => ({
        Project: jest.fn().mockImplementation(() => mockProject)
      }));
      
      // Mock analyzer
      const mockAnalyzer = {
        analyzeFromEntryPoint: jest.fn<any>().mockResolvedValue({
          nodes: [],
          edges: [],
          metadata: {}
        })
      };
      
      jest.doMock('../../src/analyzer/CallGraphAnalyzer', () => ({
        CallGraphAnalyzer: jest.fn().mockImplementation(() => mockAnalyzer)
      }));
      
      // Mock formatter
      const mockFormatter = {
        format: jest.fn().mockReturnValue('{"result": "mock"}')
      };
      
      jest.doMock('../../src/formatter/JsonFormatter', () => ({
        JsonFormatter: jest.fn().mockImplementation(() => mockFormatter)
      }));
      
      // Re-import to get mocked version
      const { interactiveCommand: mockedInteractiveCommand } = 
        await import('../../src/cli/commands/interactive');
      
      await mockedInteractiveCommand({});
      
      expect(mockSpinner.start).toHaveBeenCalledWith('Scanning for TypeScript files...');
      expect(mockSpinner.stop).toHaveBeenCalled();
    });
  });
  
  describe('Help System', () => {
    it('should display help when help is selected', async () => {
      mockPrompt
        .mockResolvedValueOnce({ action: 'help' })
        .mockResolvedValueOnce({ continue: '' })
        .mockResolvedValueOnce({ action: 'exit' });
      
      await interactiveCommand({});
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📚 Call Structure TS Interactive Mode Help'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔍 Analyze a function'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🧪 Test against specification'));
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const error = new Error('Test error');
      
      mockPrompt
        .mockResolvedValueOnce({ action: 'analyze' })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ continue: '' })
        .mockResolvedValueOnce({ action: 'exit' });
      
      // Mock logger
      const mockLogger = {
        error: jest.fn()
      };
      
      jest.doMock('../../src/utils/logger', () => ({
        logger: mockLogger
      }));
      
      // Re-import to get mocked version
      const { interactiveCommand: mockedInteractiveCommand } = 
        await import('../../src/cli/commands/interactive');
      
      await mockedInteractiveCommand({});
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error: Test error');
    });
  });
  
  describe('File Discovery', () => {
    it('should filter TypeScript files correctly', async () => {
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.tsx',
        'node_modules/lib.ts',
        'dist/output.ts',
        'src/test.spec.ts'
      ];
      
      mockedGlob.mockResolvedValue(files);
      
      // Mock autocomplete search
      mockPrompt
        .mockResolvedValueOnce({ action: 'analyze' })
        .mockImplementation(async (questions: any) => {
          if (questions[0].type === 'autocomplete') {
            // Call the source function to test filtering
            const result = await questions[0].source({}, 'file1');
            expect(result).toContain('src/file1.ts');
            expect(result).toContain('src/file2.ts');
            return { file: 'src/file1.ts' };
          }
          return { action: 'exit' };
        });
      
      await interactiveCommand({});
      
      expect(mockedGlob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignore: expect.arrayContaining([
            '**/node_modules/**',
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/dist/**'
          ])
        })
      );
    });
  });
  
  describe('Project Root Handling', () => {
    it('should use provided project root', async () => {
      const projectRoot = '/custom/path';
      
      mockPrompt.mockResolvedValueOnce({ action: 'exit' });
      
      await interactiveCommand({ projectRoot });
      
      // Verify project root is resolved
      expect(mockedGlob).not.toHaveBeenCalled(); // Not called until analyze is selected
    });
  });
});