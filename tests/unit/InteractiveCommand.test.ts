import { jest } from '@jest/globals';

// Mock all dependencies before any imports
jest.mock('inquirer');
jest.mock('ora');
jest.mock('fs');
jest.mock('glob');
jest.mock('inquirer-autocomplete-prompt');
jest.mock('ts-morph');
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
import { Project } from 'ts-morph';

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedOra = ora as unknown as jest.MockedFunction<typeof ora>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedGlob = glob as unknown as jest.MockedFunction<typeof glob>;
const mockedProject = Project as jest.MockedClass<typeof Project>;

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
    
    // Mock ts-morph Project
    const mockSourceFile = {
      getFunctions: jest.fn().mockReturnValue([]),
      getClasses: jest.fn().mockReturnValue([])
    };
    (mockedProject.prototype.addSourceFileAtPath as any) = jest.fn().mockReturnValue(mockSourceFile);
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
    it('should show analyze flow when analyze is selected', async () => {
      // Mock glob to return empty array (no files found)
      mockedGlob.mockResolvedValue([]);
      
      // Mock inquirer prompts - select analyze, see no files message, then exit
      mockPrompt
        .mockResolvedValueOnce({ action: 'analyze' })
        .mockResolvedValueOnce({ continue: '' })
        .mockResolvedValueOnce({ action: 'exit' });
      
      await interactiveCommand({});
      
      // Should have called glob to find TypeScript files
      expect(mockedGlob).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Function Analysis'));
      expect(console.log).toHaveBeenCalledWith('❌ No TypeScript files found in the project.');
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
    it('should continue after errors', async () => {
      // Mock glob to throw an error when called
      mockedGlob.mockRejectedValueOnce(new Error('Test error'));
      
      mockPrompt
        .mockResolvedValueOnce({ action: 'analyze' })
        .mockResolvedValueOnce({ continue: '' })
        .mockResolvedValueOnce({ action: 'exit' });
      
      // Should not throw
      await expect(interactiveCommand({})).resolves.not.toThrow();
      
      // Should have tried to call glob
      expect(mockedGlob).toHaveBeenCalled();
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