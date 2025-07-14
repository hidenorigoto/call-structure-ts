import { Project, SourceFile } from 'ts-morph';
import { EntryPointAnalyzer } from '../../src/analyzer/EntryPointAnalyzer';
import { ProjectContext, CallGraphAnalysisOptions } from '../../src/types/CallGraph';
import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';

// Mock the CallGraphAnalyzer
jest.mock('../../src/analyzer/CallGraphAnalyzer');

describe('EntryPointAnalyzer', () => {
  let analyzer: EntryPointAnalyzer;
  let mockContext: ProjectContext;

  beforeEach(() => {
    // Create a mock context without tsConfigPath to avoid loading real project
    mockContext = {
      rootPath: '/test',
      sourcePatterns: ['**/*.ts'],
      excludePatterns: ['node_modules/**/*', '**/*.test.ts'],
    };

    analyzer = new EntryPointAnalyzer(mockContext);
  });

  describe('analyzeMultipleEntryPoints', () => {
    let mockCallGraphAnalyzer: jest.Mocked<CallGraphAnalyzer>;

    beforeEach(() => {
      mockCallGraphAnalyzer = new CallGraphAnalyzer(mockContext) as jest.Mocked<CallGraphAnalyzer>;
      (CallGraphAnalyzer as jest.Mock).mockReturnValue(mockCallGraphAnalyzer);
    });

    it('should analyze multiple entry points successfully', async () => {
      const mockCallGraph = {
        nodes: [{ id: 'test', name: 'test', filePath: '/test.ts', line: 1, type: 'function' as const, async: false, parameters: [], returnType: 'void' }],
        edges: [],
        entryPointId: 'test',
        metadata: { 
          generatedAt: new Date().toISOString(), 
          entryPoint: 'test',
          maxDepth: 10,
          projectRoot: '/test',
          totalFiles: 1,
          analysisTimeMs: 100
        }
      };

      mockCallGraphAnalyzer.analyzeFromEntryPoint.mockResolvedValue(mockCallGraph);

      const entryPoints = ['src/index.ts#main', 'src/service.ts#process'];
      const results = await analyzer.analyzeMultipleEntryPoints(entryPoints);

      expect(results.size).toBe(2);
      expect(results.has('src/index.ts#main')).toBe(true);
      expect(results.has('src/service.ts#process')).toBe(true);
      expect(mockCallGraphAnalyzer.analyzeFromEntryPoint).toHaveBeenCalledTimes(2);
    });

    it('should handle analysis failures gracefully', async () => {
      mockCallGraphAnalyzer.analyzeFromEntryPoint
        .mockResolvedValueOnce({
          nodes: [],
          edges: [],
          entryPointId: 'success',
          metadata: { 
            generatedAt: new Date().toISOString(), 
            entryPoint: 'success',
            maxDepth: 10,
            projectRoot: '/test',
            totalFiles: 1,
            analysisTimeMs: 100
          }
        })
        .mockRejectedValueOnce(new Error('Analysis failed'));

      const entryPoints = ['src/success.ts#good', 'src/fail.ts#bad'];
      const results = await analyzer.analyzeMultipleEntryPoints(entryPoints);

      expect(results.size).toBe(1);
      expect(results.has('src/success.ts#good')).toBe(true);
      expect(results.has('src/fail.ts#bad')).toBe(false);
    });

    it('should pass options to CallGraphAnalyzer', async () => {
      const options: CallGraphAnalysisOptions = {
        maxDepth: 5,
        includeNodeModules: true,
      };

      const entryPoints = ['src/test.ts#func'];
      await analyzer.analyzeMultipleEntryPoints(entryPoints, options);

      expect(CallGraphAnalyzer).toHaveBeenCalledWith(mockContext, options);
    });

    it('should handle empty entry points array', async () => {
      const results = await analyzer.analyzeMultipleEntryPoints([]);
      expect(results.size).toBe(0);
    });
  });

  describe('findEntryPointsByPattern', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project({ 
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 2, // ES2015
          module: 1, // CommonJS
        },
      });
      
      // Replace the analyzer's project with our test project
      (analyzer as any).project = project;

      // Create test files
      project.createSourceFile('/src/controllers/UserController.ts', `
        export class UserController {
          getUsers() { return []; }
          createUser() { return {}; }
        }
      `);

      project.createSourceFile('/src/services/EmailService.ts', `
        export function sendEmail() { return true; }
      `);

      project.createSourceFile('/src/utils/helper.ts', `
        export function log() { return 'logged'; }
      `);
    });

    it('should find entry points by file pattern', async () => {
      const patterns = ['.*[Cc]ontroller.*'];
      const entryPoints = await analyzer.findEntryPointsByPattern(patterns);

      expect(entryPoints.length).toBeGreaterThan(0);
      expect(entryPoints).toContainEqual(
        expect.objectContaining({
          functionName: 'getUsers',
          className: 'UserController',
        })
      );
      expect(entryPoints).toContainEqual(
        expect.objectContaining({
          functionName: 'createUser',
          className: 'UserController',
        })
      );
    });

    it('should find entry points by multiple patterns', async () => {
      const patterns = ['.*Service.*', '.*utils.*'];
      const entryPoints = await analyzer.findEntryPointsByPattern(patterns);

      expect(entryPoints.length).toBeGreaterThan(0);
      expect(entryPoints.some(ep => ep.functionName === 'sendEmail')).toBe(true);
      expect(entryPoints.some(ep => ep.functionName === 'log')).toBe(true);
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const patterns = ['[invalid']; // Invalid regex
      
      await expect(analyzer.findEntryPointsByPattern(patterns)).rejects.toThrow();
    });

    it('should return empty array when no patterns match', async () => {
      const patterns = ['.*NonExistent.*'];
      const entryPoints = await analyzer.findEntryPointsByPattern(patterns);

      expect(entryPoints).toHaveLength(0);
    });
  });

  describe('findCommonEntryPoints', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project({ 
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 2, // ES2015
          module: 1, // CommonJS
        },
      });
      
      // Replace the analyzer's project with our test project
      (analyzer as any).project = project;

      // Controller files
      project.createSourceFile('/src/api/UserController.ts', `
        export class UserController {
          getUsers() { return []; }
          postUser() { return {}; }
          handleUserUpdate() { return {}; }
          createUser() { return {}; }
        }
      `);

      // Handler files
      project.createSourceFile('/src/handlers/authHandler.ts', `
        export function authHandler(req: any) { return true; }
        export function loginHandler(req: any) { return {}; }
        export function routeMiddleware(req: any) { return {}; }
      `);

      // Main function files
      project.createSourceFile('/src/index.ts', `
        export function main() { console.log('app started'); }
        function start() { console.log('starting...'); }
        export function bootstrap() { console.log('bootstrapped'); }
      `);

      // Regular service files
      project.createSourceFile('/src/services/EmailService.ts', `
        export function sendEmail() { return true; }
        export function validateEmail() { return true; }
      `);
    });

    it('should categorize entry points correctly', async () => {
      const result = await analyzer.findCommonEntryPoints();

      // Controllers
      expect(result.controllers.length).toBeGreaterThan(0);
      expect(result.controllers).toContainEqual(
        expect.objectContaining({
          functionName: 'getUsers',
          className: 'UserController',
        })
      );
      expect(result.controllers).toContainEqual(
        expect.objectContaining({
          functionName: 'handleUserUpdate',
          className: 'UserController',
        })
      );

      // Handlers
      expect(result.handlers.length).toBeGreaterThan(0);
      expect(result.handlers).toContainEqual(
        expect.objectContaining({
          functionName: 'authHandler',
        })
      );
      expect(result.handlers).toContainEqual(
        expect.objectContaining({
          functionName: 'routeMiddleware',
        })
      );

      // Main functions
      expect(result.mainFunctions.length).toBeGreaterThan(0);
      expect(result.mainFunctions).toContainEqual(
        expect.objectContaining({
          functionName: 'main',
        })
      );
      expect(result.mainFunctions).toContainEqual(
        expect.objectContaining({
          functionName: 'bootstrap',
        })
      );

      // Exported functions
      expect(result.exportedFunctions.length).toBeGreaterThan(0);
      expect(result.exportedFunctions).toContainEqual(
        expect.objectContaining({
          functionName: 'sendEmail',
        })
      );
    });

    it('should handle files with no matching patterns', async () => {
      // Clear existing files and add non-matching ones
      project.getSourceFiles().forEach(sf => sf.delete());
      
      project.createSourceFile('/src/types.ts', `
        export interface User { id: string; }
      `);

      const result = await analyzer.findCommonEntryPoints();

      expect(result.controllers).toHaveLength(0);
      expect(result.handlers).toHaveLength(0);
      expect(result.mainFunctions).toHaveLength(0);
      expect(result.exportedFunctions).toHaveLength(0);
    });
  });

  describe('validateEntryPoint', () => {
    let mockEntryPointFinder: any;

    beforeEach(() => {
      mockEntryPointFinder = {
        findEntryPoint: jest.fn()
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;
    });

    it('should validate existing function entry point', async () => {
      mockEntryPointFinder.findEntryPoint.mockReturnValue({
        file: '/src/test.ts',
        name: 'validFunction',
        className: undefined,
      });

      const result = await analyzer.validateEntryPoint('src/test.ts#validFunction');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.location).toEqual(
        expect.objectContaining({
          functionName: 'validFunction',
          className: undefined,
        })
      );
    });

    it('should validate existing class method entry point', async () => {
      mockEntryPointFinder.findEntryPoint.mockReturnValue({
        file: '/src/test.ts',
        name: 'validMethod',
        className: 'TestClass',
      });

      const result = await analyzer.validateEntryPoint('src/test.ts#TestClass.validMethod');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.location).toEqual(
        expect.objectContaining({
          functionName: 'validMethod',
          className: 'TestClass',
        })
      );
    });

    it('should return error for non-existent file', async () => {
      mockEntryPointFinder.findEntryPoint.mockImplementation(() => {
        throw new Error('Source file not found: src/nonexistent.ts');
      });

      const result = await analyzer.validateEntryPoint('src/nonexistent.ts#func');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Source file not found');
      expect(result.location).toBeUndefined();
    });

    it('should return error for non-existent function', async () => {
      mockEntryPointFinder.findEntryPoint.mockImplementation(() => {
        throw new Error('Entry point not found: nonExistentFunction in src/test.ts');
      });

      const result = await analyzer.validateEntryPoint('src/test.ts#nonExistentFunction');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Entry point not found');
      expect(result.location).toBeUndefined();
    });

    it('should return error for invalid entry point format', async () => {
      mockEntryPointFinder.findEntryPoint.mockImplementation(() => {
        throw new Error('Invalid entry point format: invalid-format');
      });

      const result = await analyzer.validateEntryPoint('invalid-format');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid entry point format');
      expect(result.location).toBeUndefined();
    });
  });

  describe('private method coverage', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project({ 
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 2, // ES2015
          module: 1, // CommonJS
        },
      });
      
      // Replace the analyzer's project with our test project
      (analyzer as any).project = project;
    });

    describe('findControllerMethods', () => {
      it('should find HTTP method-like controller methods', async () => {
        const sourceFile = project.createSourceFile('/src/ApiController.ts', `
          export class ApiController {
            getUsers() { return []; }
            postUser() { return {}; }
            deleteUser() { return true; }
            handleRequest() { return {}; }
            createItem() { return {}; }
            updateItem() { return {}; }
            removeItem() { return {}; }
            listItems() { return []; }
            regularMethod() { return 'not http'; }
          }
          
          export class NotController {
            getStuff() { return []; }
          }
        `);

        const entryPoints = (analyzer as any).findControllerMethods(sourceFile);

        expect(entryPoints.length).toBeGreaterThan(0);
        
        // Should find HTTP-like methods from controller class
        const methodNames = entryPoints.map((ep: any) => ep.functionName);
        expect(methodNames).toContain('getUsers');
        expect(methodNames).toContain('postUser');
        expect(methodNames).toContain('deleteUser');
        expect(methodNames).toContain('handleRequest');
        expect(methodNames).toContain('createItem');
        expect(methodNames).toContain('updateItem');
        expect(methodNames).toContain('removeItem');
        expect(methodNames).toContain('listItems');
        
        // Should not include regular methods
        expect(methodNames).not.toContain('regularMethod');
        
        // NotController should not be included because it doesn't have "controller" in the name
        expect(methodNames).not.toContain('getStuff');
      });

      it('should only find methods from classes with controller in name', async () => {
        const sourceFile = project.createSourceFile('/src/RegularClass.ts', `
          export class RegularClass {
            getUsers() { return []; }
            postUser() { return {}; }
          }
          
          export class AuthController {
            authenticate() { return true; }
          }
        `);

        const entryPoints = (analyzer as any).findControllerMethods(sourceFile);
        const methodNames = entryPoints.map((ep: any) => ep.functionName);
        
        // Should only include methods from AuthController
        expect(methodNames).toContain('authenticate');
        expect(methodNames).not.toContain('getUsers');
        expect(methodNames).not.toContain('postUser');
      });
    });

    describe('findHandlerFunctions', () => {
      it('should find handler-like exported functions', async () => {
        const sourceFile = project.createSourceFile('/src/handlers.ts', `
          export function authHandler() { return true; }
          export function requestHandler() { return {}; }
          export function routeMiddleware() { return {}; }
          export function handleError() { return false; }
          export function regularFunction() { return 'not handler'; }
        `);

        const entryPoints = (analyzer as any).findHandlerFunctions(sourceFile);

        expect(entryPoints.length).toBeGreaterThan(0);
        
        const functionNames = entryPoints.map((ep: any) => ep.functionName);
        expect(functionNames).toContain('authHandler');
        expect(functionNames).toContain('requestHandler');
        expect(functionNames).toContain('routeMiddleware');
        expect(functionNames).toContain('handleError');
        expect(functionNames).not.toContain('regularFunction');
      });
    });

    describe('findMainFunctions', () => {
      it('should find main-like functions', async () => {
        const sourceFile = project.createSourceFile('/src/app.ts', `
          export function main() { console.log('main'); }
          function start() { console.log('start'); }
          export function init() { console.log('init'); }
          function bootstrap() { console.log('bootstrap'); }
          export function run() { console.log('run'); }
          function execute() { console.log('execute'); }
          function regularFunction() { console.log('regular'); }
        `);

        const entryPoints = (analyzer as any).findMainFunctions(sourceFile);

        expect(entryPoints.length).toBeGreaterThan(0);
        
        const functionNames = entryPoints.map((ep: any) => ep.functionName);
        expect(functionNames).toContain('main');
        expect(functionNames).toContain('start');
        expect(functionNames).toContain('init');
        expect(functionNames).toContain('bootstrap');
        expect(functionNames).toContain('run');
        expect(functionNames).toContain('execute');
        expect(functionNames).not.toContain('regularFunction');
      });
    });

    describe('findExportedFunctions', () => {
      it('should find all exported function declarations', async () => {
        const sourceFile = project.createSourceFile('/src/exports.ts', `
          export function exportedFunc1() { return 1; }
          export function exportedFunc2() { return 2; }
          function notExported() { return 'private'; }
          export const exportedConst = 'not function';
          export class ExportedClass {}
        `);

        const entryPoints = (analyzer as any).findExportedFunctions(sourceFile);

        expect(entryPoints.length).toBe(2);
        
        const functionNames = entryPoints.map((ep: any) => ep.functionName);
        expect(functionNames).toContain('exportedFunc1');
        expect(functionNames).toContain('exportedFunc2');
        expect(functionNames).not.toContain('notExported');
      });
    });

    describe('getSourceFiles filtering', () => {
      it('should filter files based on context patterns', async () => {
        // Create files that should be included
        project.createSourceFile('/src/included.ts', 'export function test() {}');
        project.createSourceFile('/src/services/included.ts', 'export function service() {}');
        
        // Create files that should be excluded
        project.createSourceFile('/node_modules/excluded.ts', 'export function excluded() {}');
        project.createSourceFile('/src/types.d.ts', 'export interface Test {}');
        project.createSourceFile('/src/test.test.ts', 'describe("test", () => {});');

        const sourceFiles = (analyzer as any).getSourceFiles();
        const filePaths = sourceFiles.map((sf: SourceFile) => sf.getFilePath());

        // Should include source files
        expect(filePaths.some((path: string) => path.includes('src/included.ts'))).toBe(true);
        expect(filePaths.some((path: string) => path.includes('src/services/included.ts'))).toBe(true);

        // Should exclude node_modules
        expect(filePaths.some((path: string) => path.includes('node_modules'))).toBe(false);

        // Should exclude .d.ts files
        expect(filePaths.some((path: string) => path.endsWith('.d.ts'))).toBe(false);

        // Should exclude test files based on context
        expect(filePaths.some((path: string) => path.includes('.test.ts'))).toBe(false);
      });

      it('should handle custom source patterns', async () => {
        // Create analyzer with custom patterns
        const customContext = {
          ...mockContext,
          sourcePatterns: ['lib/**/*.ts', 'app/**/*.ts'],
        };
        const customAnalyzer = new EntryPointAnalyzer(customContext);
        const customProject = new Project({ 
          useInMemoryFileSystem: true,
          compilerOptions: {
            target: 2, // ES2015
            module: 1, // CommonJS
          },
        });
        
        // Replace the analyzer's project with our test project
        (customAnalyzer as any).project = customProject;

        // Create files in different directories
        customProject.createSourceFile('/lib/utils.ts', 'export function util() {}');
        customProject.createSourceFile('/app/main.ts', 'export function main() {}');
        customProject.createSourceFile('/src/other.ts', 'export function other() {}');

        const sourceFiles = (customAnalyzer as any).getSourceFiles();
        const filePaths = sourceFiles.map((sf: SourceFile) => sf.getFilePath());

        // Should include lib and app files
        expect(filePaths.some((path: string) => path.includes('lib/utils.ts'))).toBe(true);
        expect(filePaths.some((path: string) => path.includes('app/main.ts'))).toBe(true);

        // Should exclude src files (not in patterns)
        expect(filePaths.some((path: string) => path.includes('src/other.ts'))).toBe(false);
      });
    });
  });

  describe('discoverEntryPoints integration', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project({ 
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 2, // ES2015
          module: 1, // CommonJS
        },
      });
      
      // Replace the analyzer's project with our test project
      (analyzer as any).project = project;
    });

    it('should discover entry points in multiple files', async () => {
      // Create test files
      project.createSourceFile('/src/index.ts', `
        export function main() {
          console.log('main function');
        }
        
        function helper() {
          return 'helper';
        }
      `);

      project.createSourceFile('/src/services/UserService.ts', `
        export class UserService {
          constructor(private db: any) {}
          
          async createUser(name: string) {
            return this.db.save({ name });
          }
          
          async getUserById(id: string) {
            return this.db.findById(id);
          }
        }
      `);

      const entryPoints = await analyzer.discoverEntryPoints();

      expect(entryPoints.length).toBeGreaterThan(0);
      expect(entryPoints).toContainEqual(
        expect.objectContaining({
          functionName: 'main',
          className: undefined,
          exportName: 'main',
        })
      );
      expect(entryPoints).toContainEqual(
        expect.objectContaining({
          functionName: 'createUser',
          className: 'UserService',
        })
      );
      expect(entryPoints).toContainEqual(
        expect.objectContaining({
          functionName: 'constructor',
          className: 'UserService',
        })
      );
    });

    it('should handle files with no entry points', async () => {
      project.createSourceFile('/src/types.ts', `
        export interface User {
          id: string;
          name: string;
        }
        
        export type Status = 'active' | 'inactive';
      `);

      const entryPoints = await analyzer.discoverEntryPoints();
      expect(entryPoints).toHaveLength(0);
    });
  });
});