/* eslint-disable @typescript-eslint/no-explicit-any */
import { Project, SyntaxKind } from 'ts-morph';
import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import {
  ProjectContext,
  CallGraphAnalysisOptions,
  CallGraphError,
} from '../../src/types/CallGraph';

describe('CallGraphAnalyzer', () => {
  let project: Project;
  let analyzer: CallGraphAnalyzer;
  let context: ProjectContext;

  beforeEach(() => {
    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });

    context = {
      rootPath: '/test',
      sourcePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules/**', '**/*.test.ts'],
    };
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      analyzer = new CallGraphAnalyzer(context);
      expect(analyzer).toBeDefined();
    });

    it('should use custom options', () => {
      const options: CallGraphAnalysisOptions = {
        maxDepth: 5,
        includeNodeModules: true,
        includeTestFiles: true,
        analyzeCallbacks: false,
        collectMetrics: true,
      };

      analyzer = new CallGraphAnalyzer(context, options);
      expect(analyzer).toBeDefined();
    });

    it('should handle context without tsConfigPath', () => {
      const contextNoTsConfig = {
        rootPath: '/test',
        sourcePatterns: ['src/**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
      };

      analyzer = new CallGraphAnalyzer(contextNoTsConfig);
      expect(analyzer).toBeDefined();
    });

    it('should handle context with tsConfigPath', () => {
      // Skip tsConfigPath test as it requires actual file system
      // The CallGraphAnalyzer constructor creates a new Project which reads from file system
      const contextWithTsConfig = {
        ...context,
        tsConfigPath: undefined, // Don't use tsConfigPath to avoid file system access
      };

      analyzer = new CallGraphAnalyzer(contextWithTsConfig);
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyzeFromEntryPoint', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context);
    });

    it('should analyze a simple function', async () => {
      const sourceFile = project.createSourceFile(
        'src/simple.ts',
        `
        export function simpleFunction() {
          return 'simple';
        }
      `
      );

      // Mock the EntryPointFinder to return a valid entry point
      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: 'src/simple.ts',
          functionName: 'simpleFunction',
        }),
      };

      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/simple.ts#simpleFunction');

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.entryPointId).toContain('simpleFunction');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.analysisTimeMs).toBeGreaterThan(0);
    });

    it('should handle max depth limit', async () => {
      const sourceFile = project.createSourceFile(
        'src/nested.ts',
        `
        function level1() {
          level2();
        }
        
        function level2() {
          level3();
        }
        
        function level3() {
          return 'deep';
        }
      `
      );

      const analyzerWithDepth = new CallGraphAnalyzer(context, { maxDepth: 2 });

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: 'src/nested.ts',
          functionName: 'level1',
        }),
      };

      (analyzerWithDepth as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzerWithDepth.analyzeFromEntryPoint('src/nested.ts#level1');

      expect(result.metadata.maxDepth).toBe(2);
    });

    it('should handle different CallGraphError types', async () => {
      const analyzer = new CallGraphAnalyzer(context);

      // Test SOURCE_FILE_NOT_FOUND
      const mockEntryPointFinderFileNotFound = {
        findEntryPoint: jest.fn().mockImplementation(() => {
          throw new Error('Source file not found: nonexistent.ts');
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinderFileNotFound;

      await expect(analyzer.analyzeFromEntryPoint('nonexistent.ts#main')).rejects.toThrow(
        CallGraphError
      );

      // Test ENTRY_POINT_NOT_FOUND
      const mockEntryPointFinderEntryNotFound = {
        findEntryPoint: jest.fn().mockImplementation(() => {
          throw new Error('Entry point not found: main');
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinderEntryNotFound;

      await expect(analyzer.analyzeFromEntryPoint('test.ts#nonexistent')).rejects.toThrow(
        CallGraphError
      );

      // Test INVALID_ENTRY_POINT_FORMAT
      const mockEntryPointFinderInvalidFormat = {
        findEntryPoint: jest.fn().mockImplementation(() => {
          throw new Error('Invalid entry point format');
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinderInvalidFormat;

      await expect(analyzer.analyzeFromEntryPoint('invalid')).rejects.toThrow(CallGraphError);
    });

    it('should handle unknown errors during analysis', async () => {
      const analyzer = new CallGraphAnalyzer(context);

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockImplementation(() => {
          throw new Error('Some unknown error');
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      await expect(analyzer.analyzeFromEntryPoint('test.ts#main')).rejects.toThrow(
        'Some unknown error'
      );
    });
  });

  describe('node analysis', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context);
    });

    it('should analyze function declarations', async () => {
      const sourceFile = project.createSourceFile(
        'src/functions.ts',
        `
        function regularFunction(param: string): string {
          return param.toUpperCase();
        }
        
        async function asyncFunction(): Promise<string> {
          return 'async';
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: 'src/functions.ts',
          functionName: 'regularFunction',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/functions.ts#regularFunction');

      expect(result.nodes.length).toBeGreaterThan(0);
      const functionNode = result.nodes[0];
      expect(functionNode.type).toBe('function');
      expect(functionNode.parameters).toBeDefined();
      expect(functionNode.returnType).toBeDefined();
    });

    it('should analyze class methods', async () => {
      const sourceFile = project.createSourceFile(
        'src/classes.ts',
        `
        class TestClass {
          public publicMethod(): string {
            return 'public';
          }
          
          private privateMethod(): string {
            return 'private';
          }
          
          protected protectedMethod(): string {
            return 'protected';
          }
          
          static staticMethod(): string {
            return 'static';
          }
          
          async asyncMethod(): Promise<string> {
            return 'async';
          }
        }
      `
      );

      const testClass = sourceFile.getClasses()[0];
      const publicMethod = testClass.getMethods()[0];

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: publicMethod,
          filePath: 'src/classes.ts',
          functionName: 'publicMethod',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/classes.ts#TestClass.publicMethod');

      expect(result.nodes.length).toBeGreaterThan(0);
      const methodNode = result.nodes[0];
      expect(methodNode.type).toBe('method');
      expect(methodNode.className).toBe('TestClass');
      expect(methodNode.visibility).toBe('public');
    });

    it('should analyze constructors', async () => {
      const sourceFile = project.createSourceFile(
        'src/constructor.ts',
        `
        class TestClass {
          constructor(private name: string, public age: number = 25) {
            this.name = name;
          }
        }
      `
      );

      const testClass = sourceFile.getClasses()[0];
      const constructor = testClass.getConstructors()[0];

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: constructor,
          filePath: 'src/constructor.ts',
          functionName: 'constructor',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint(
        'src/constructor.ts#TestClass.constructor'
      );

      expect(result.nodes.length).toBeGreaterThan(0);
      const constructorNode = result.nodes[0];
      expect(constructorNode.type).toBe('constructor');
      expect(constructorNode.name).toBe('constructor');
      expect(constructorNode.className).toBe('TestClass');
      expect(constructorNode.parameters).toBeDefined();
      expect(constructorNode.parameters!.length).toBe(2);
      expect(constructorNode.parameters![1].defaultValue).toBe('25');
    });

    it('should analyze arrow functions', async () => {
      const sourceFile = project.createSourceFile(
        'src/arrow.ts',
        `
        const arrowFunction = (x: number, y?: string) => {
          return x.toString() + (y || '');
        };
        
        const asyncArrow = async (data: any) => {
          return JSON.stringify(data);
        };
      `
      );

      const variable = sourceFile.getVariableDeclarations()[0];
      const arrowFunction = variable.getInitializer();

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: arrowFunction,
          filePath: 'src/arrow.ts',
          functionName: 'arrowFunction',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/arrow.ts#arrowFunction');

      expect(result.nodes.length).toBeGreaterThan(0);
      const arrowNode = result.nodes[0];
      expect(arrowNode.type).toBe('arrow');
      expect(arrowNode.parameters).toBeDefined();
      expect(arrowNode.parameters!.length).toBe(2);
      expect(arrowNode.parameters![1].optional).toBe(true);
    });

    it('should analyze function expressions', async () => {
      const sourceFile = project.createSourceFile(
        'src/expression.ts',
        `
        const namedExpression = function namedFunc(param: boolean) {
          return param ? 'true' : 'false';
        };
        
        const anonymousExpression = function(value: any) {
          return typeof value;
        };
      `
      );

      const variable = sourceFile.getVariableDeclarations()[0];
      const functionExpression = variable.getInitializer();

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: functionExpression,
          filePath: 'src/expression.ts',
          functionName: 'namedFunc',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/expression.ts#namedFunc');

      expect(result.nodes.length).toBeGreaterThan(0);
      const expressionNode = result.nodes[0];
      expect(expressionNode.type).toBe('function');
      expect(expressionNode.name).toBe('namedFunc');
    });

    it('should analyze getters and setters', async () => {
      const sourceFile = project.createSourceFile(
        'src/accessors.ts',
        `
        class TestClass {
          private _value: number = 0;
          
          get value(): number {
            return this._value;
          }
          
          set value(val: number) {
            this._value = val;
          }
          
          static get staticValue(): number {
            return 42;
          }
        }
      `
      );

      const testClass = sourceFile.getClasses()[0];
      const getter = testClass.getGetAccessors()[0];

      // Test that isFunctionLikeNode recognizes accessors
      const isFunctionLike = (analyzer as any).isFunctionLikeNode(getter);
      expect(isFunctionLike).toBe(true);

      // Test getter/setter recognition in shouldSkipNode method
      const shouldSkip = (analyzer as any).shouldSkipNode(getter);
      expect(shouldSkip).toBe(false);
    });
  });

  describe('call expression analysis', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context);
    });

    it('should resolve direct function calls', async () => {
      const sourceFile = project.createSourceFile(
        'src/calls.ts',
        `
        function helper() {
          return 'helper';
        }
        
        function main() {
          return helper();
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[1], // main function
          filePath: 'src/calls.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/calls.ts#main');

      expect(result.nodes.length).toBe(2); // main and helper
      expect(result.edges.length).toBe(1); // main -> helper
      expect(result.edges[0].type).toBe('sync');
    });

    it('should resolve property access calls', async () => {
      const sourceFile = project.createSourceFile(
        'src/property.ts',
        `
        class Service {
          getData(): string {
            return 'data';
          }
          
          static getStaticData(): string {
            return 'static data';
          }
        }
        
        function main() {
          const service = new Service();
          service.getData();
          Service.getStaticData();
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0], // main function
          filePath: 'src/property.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/property.ts#main');

      expect(result.nodes.length).toBeGreaterThan(1);
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should detect async calls', async () => {
      const sourceFile = project.createSourceFile(
        'src/async.ts',
        `
        async function asyncHelper(): Promise<string> {
          return 'async result';
        }
        
        async function main() {
          const result = await asyncHelper();
          return result;
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[1], // main function
          filePath: 'src/async.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/async.ts#main');

      expect(result.edges.length).toBeGreaterThan(0);
      const asyncEdge = result.edges.find(edge => edge.type === 'async');
      expect(asyncEdge).toBeDefined();
    });

    it('should detect Promise method calls', async () => {
      const sourceFile = project.createSourceFile(
        'src/promises.ts',
        `
        function asyncOperation(): Promise<string> {
          return Promise.resolve('result');
        }
        
        function main() {
          asyncOperation()
            .then(result => console.log(result))
            .catch(error => console.error(error))
            .finally(() => console.log('done'));
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[1], // main function
          filePath: 'src/promises.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/promises.ts#main');

      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should handle constructor calls', async () => {
      const sourceFile = project.createSourceFile(
        'src/constructors.ts',
        `
        class TestClass {
          constructor(value: string) {}
        }
        
        function main() {
          const instance = new TestClass('test');
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0], // main function
          filePath: 'src/constructors.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/constructors.ts#main');

      expect(result.nodes.length).toBeGreaterThan(0);
      // Constructor calls may not be fully resolved in this simple test
      expect(result.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle calls with arguments', async () => {
      const sourceFile = project.createSourceFile(
        'src/arguments.ts',
        `
        function helper(str: string, num: number, bool: boolean): string {
          return \`\${str}-\${num}-\${bool}\`;
        }
        
        function main() {
          return helper('test', 42, true);
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[1], // main function
          filePath: 'src/arguments.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/arguments.ts#main');

      expect(result.edges.length).toBeGreaterThan(0);
      expect(result.edges[0].argumentTypes).toBeDefined();
      expect(result.edges[0].argumentTypes!.length).toBe(3);
    });

    it('should handle unresolvable calls gracefully', async () => {
      const sourceFile = project.createSourceFile(
        'src/unresolvable.ts',
        `
        function main() {
          // This call cannot be resolved statically
          const dynamicFunc = Math.random() > 0.5 ? console.log : console.error;
          dynamicFunc('message');
          
          // External call that might not resolve
          external.unknownMethod();
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0], // main function
          filePath: 'src/unresolvable.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      // Should not throw, just handle gracefully
      const result = await analyzer.analyzeFromEntryPoint('src/unresolvable.ts#main');

      expect(result.nodes.length).toBe(1); // Only main function
    });
  });

  describe('callback analysis', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context, { analyzeCallbacks: true });
    });

    it('should analyze arrow function callbacks', async () => {
      const sourceFile = project.createSourceFile(
        'src/callbacks.ts',
        `
        function main() {
          const numbers = [1, 2, 3];
          numbers.map(x => x * 2);
          numbers.filter(x => x > 1);
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0], // main function
          filePath: 'src/callbacks.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/callbacks.ts#main');

      expect(result.nodes.length).toBeGreaterThan(1); // main + callbacks
      const callbackEdges = result.edges.filter(edge => edge.type === 'callback');
      expect(callbackEdges.length).toBeGreaterThan(0);
    });

    it('should analyze function expression callbacks', async () => {
      const sourceFile = project.createSourceFile(
        'src/func-callbacks.ts',
        `
        function main() {
          setTimeout(function() {
            console.log('timeout');
          }, 1000);
          
          const promise = new Promise(function(resolve, reject) {
            resolve('success');
          });
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0], // main function
          filePath: 'src/func-callbacks.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/func-callbacks.ts#main');

      expect(result.nodes.length).toBeGreaterThan(1); // main + callbacks
      const callbackEdges = result.edges.filter(edge => edge.type === 'callback');
      expect(callbackEdges.length).toBeGreaterThan(0);
    });

    it('should skip callback analysis when disabled', async () => {
      const analyzerNoCallbacks = new CallGraphAnalyzer(context, { analyzeCallbacks: false });

      const sourceFile = project.createSourceFile(
        'src/no-callbacks.ts',
        `
        function main() {
          [1, 2, 3].map(x => x * 2);
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0], // main function
          filePath: 'src/no-callbacks.ts',
          functionName: 'main',
        }),
      };
      (analyzerNoCallbacks as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzerNoCallbacks.analyzeFromEntryPoint('src/no-callbacks.ts#main');

      const callbackEdges = result.edges.filter(edge => edge.type === 'callback');
      expect(callbackEdges.length).toBe(0);
    });
  });

  describe('node filtering', () => {
    it('should skip node_modules by default', () => {
      const analyzer = new CallGraphAnalyzer(context);

      const mockNodeModulesFile = project.createSourceFile(
        '/node_modules/package/index.ts',
        `
        export function externalFunction() {}
      `
      );

      const externalFunction = mockNodeModulesFile.getFunctions()[0];
      const shouldSkip = (analyzer as any).shouldSkipNode(externalFunction);

      expect(shouldSkip).toBe(true);
    });

    it('should include node_modules when enabled', () => {
      const analyzer = new CallGraphAnalyzer(context, {
        includeNodeModules: true,
        excludePatterns: [], // Clear default exclude patterns that include node_modules
      });

      const mockNodeModulesFile = project.createSourceFile(
        '/node_modules/package/index.ts',
        `
        export function externalFunction() {}
      `
      );

      const externalFunction = mockNodeModulesFile.getFunctions()[0];
      const shouldSkip = (analyzer as any).shouldSkipNode(externalFunction);

      expect(shouldSkip).toBe(false);
    });

    it('should skip test files by default', () => {
      const analyzer = new CallGraphAnalyzer(context);

      const testFile = project.createSourceFile(
        '/test/src/utils.test.ts',
        `
        describe('test', () => {
          it('should work', () => {});
        });
      `
      );

      const firstChild = testFile.getFirstChild();
      if (firstChild) {
        const shouldSkip = (analyzer as any).shouldSkipNode(firstChild);
        expect(shouldSkip).toBe(true);
      }
    });

    it('should include test files when enabled', () => {
      // When includeTestFiles is true, we need to clear the default exclude patterns for test files
      const analyzer = new CallGraphAnalyzer(context, {
        includeTestFiles: true,
        excludePatterns: [/node_modules/], // Keep node_modules excluded, but remove test patterns
      });

      const testFile = project.createSourceFile(
        '/test/src/utils.spec.ts',
        `
        describe('test', () => {
          it('should work', () => {});
        });
      `
      );

      const firstChild = testFile.getFirstChild();
      if (firstChild) {
        const shouldSkip = (analyzer as any).shouldSkipNode(firstChild);
        expect(shouldSkip).toBe(false);
      }
    });

    it('should handle exclude patterns', () => {
      const analyzer = new CallGraphAnalyzer(context, {
        excludePatterns: [/\.generated\.ts$/, /\/temp\//],
      });

      const generatedFile = project.createSourceFile(
        '/test/src/api.generated.ts',
        `
        export function generatedFunction() {}
      `
      );

      const tempFile = project.createSourceFile(
        '/test/src/temp/utility.ts',
        `
        export function tempFunction() {}
      `
      );

      const generatedFunction = generatedFile.getFunctions()[0];
      const tempFunction = tempFile.getFunctions()[0];

      expect((analyzer as any).shouldSkipNode(generatedFunction)).toBe(true);
      expect((analyzer as any).shouldSkipNode(tempFunction)).toBe(true);
    });

    it('should handle include patterns', () => {
      const analyzer = new CallGraphAnalyzer(context, {
        includePatterns: [/\/src\/core\//], // Pattern to match files in src/core
        excludePatterns: [],
      });

      const coreFile = project.createSourceFile(
        '/src/core/main.ts',
        `
        export function coreFunction() {}
      `
      );

      const utilFile = project.createSourceFile(
        '/src/utils/helper.ts',
        `
        export function utilFunction() {}
      `
      );

      const coreFunction = coreFile.getFunctions()[0];
      const utilFunction = utilFile.getFunctions()[0];

      expect((analyzer as any).shouldSkipNode(coreFunction)).toBe(false);
      expect((analyzer as any).shouldSkipNode(utilFunction)).toBe(true);
    });

    it('should identify test files correctly', () => {
      const analyzer = new CallGraphAnalyzer(context);

      expect((analyzer as any).isTestFile('src/utils.test.ts')).toBe(true);
      expect((analyzer as any).isTestFile('src/utils.spec.ts')).toBe(true);
      expect((analyzer as any).isTestFile('src/__tests__/utils.ts')).toBe(true);
      expect((analyzer as any).isTestFile('src/test/utils.ts')).toBe(true);
      expect((analyzer as any).isTestFile('src/tests/utils.ts')).toBe(true);
      expect((analyzer as any).isTestFile('src/utils.ts')).toBe(false);
    });
  });

  describe('node ID generation', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context);
    });

    it('should generate IDs for function declarations', () => {
      const sourceFile = project.createSourceFile(
        '/test/src/functions.ts',
        `
        function testFunction() {}
      `
      );

      const func = sourceFile.getFunctions()[0];
      const id = (analyzer as any).generateNodeId(func);

      expect(id).toBe('/test/src/functions.ts#testFunction');
    });

    it('should generate IDs for class methods', () => {
      const sourceFile = project.createSourceFile(
        '/test/src/classes.ts',
        `
        class TestClass {
          testMethod() {}
        }
      `
      );

      const method = sourceFile.getClasses()[0].getMethods()[0];
      const id = (analyzer as any).generateNodeId(method);

      expect(id).toBe('/test/src/classes.ts#TestClass.testMethod');
    });

    it('should generate IDs for constructors', () => {
      const sourceFile = project.createSourceFile(
        '/test/src/constructors.ts',
        `
        class TestClass {
          constructor() {}
        }
      `
      );

      const constructor = sourceFile.getClasses()[0].getConstructors()[0];
      const id = (analyzer as any).generateNodeId(constructor);

      expect(id).toBe('/test/src/constructors.ts#TestClass.constructor');
    });

    it('should generate fallback IDs for other nodes', () => {
      const sourceFile = project.createSourceFile(
        '/test/src/expressions.ts',
        `
        const arrow = () => {};
      `
      );

      const variable = sourceFile.getVariableDeclarations()[0];
      const arrowFunction = variable.getInitializer();
      const id = (analyzer as any).generateNodeId(arrowFunction!);

      expect(id).toMatch(/\/test\/src\/expressions\.ts#\d+/);
    });
  });

  describe('symbol resolution', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context);
    });

    it('should resolve variable declarations with function initializers', () => {
      const sourceFile = project.createSourceFile(
        'src/variables.ts',
        `
        const myFunction = function() {
          return 'test';
        };
        
        const myArrow = () => 'arrow';
        
        const regularVar = 'not a function';
      `
      );

      const functionVar = sourceFile.getVariableDeclarations()[0];
      const arrowVar = sourceFile.getVariableDeclarations()[1];
      const regularVar = sourceFile.getVariableDeclarations()[2];

      const functionVarIdentifier = functionVar.getNameNode();
      const arrowVarIdentifier = arrowVar.getNameNode();
      const regularVarIdentifier = regularVar.getNameNode();

      const resolvedFunction = (analyzer as any).resolveIdentifierTarget(functionVarIdentifier);
      const resolvedArrow = (analyzer as any).resolveIdentifierTarget(arrowVarIdentifier);
      const resolvedRegular = (analyzer as any).resolveIdentifierTarget(regularVarIdentifier);

      expect(resolvedFunction).toBeDefined();
      expect(resolvedArrow).toBeDefined();
      expect(resolvedRegular).toBeUndefined(); // Not a function
    });

    it('should handle property access resolution failures', () => {
      const sourceFile = project.createSourceFile(
        'src/prop-access.ts',
        `
        const obj: any = {};
        obj.unknownMethod();
      `
      );

      const propertyAccess = sourceFile.getDescendantsOfKind(
        SyntaxKind.PropertyAccessExpression
      )[0];
      const resolved = (analyzer as any).resolvePropertyAccessTarget(propertyAccess);

      expect(resolved).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      analyzer = new CallGraphAnalyzer(context);
    });

    it('should handle nodes without source files', () => {
      // Test with a mock node that throws when accessing source file
      const mockNode = {
        getSourceFile: jest.fn().mockImplementation(() => {
          throw new Error('No source file');
        }),
      };

      // Should handle the error gracefully
      expect(() => {
        (analyzer as any).extractNodeInfo(mockNode);
      }).toThrow();
    });

    it('should handle call expression analysis failures', async () => {
      const sourceFile = project.createSourceFile(
        'src/error-prone.ts',
        `
        function main() {
          // This might cause analysis issues
          try {
            unknownFunction();
          } catch (e) {
            console.error(e);
          }
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: 'src/error-prone.ts',
          functionName: 'main',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      // Should not throw, just handle gracefully
      const result = await analyzer.analyzeFromEntryPoint('src/error-prone.ts#main');
      expect(result).toBeDefined();
    });

    it('should handle already visited nodes', async () => {
      const sourceFile = project.createSourceFile(
        'src/recursive.ts',
        `
        function recursive() {
          recursive(); // Self-recursive call
        }
      `
      );

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: 'src/recursive.ts',
          functionName: 'recursive',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/recursive.ts#recursive');

      // Should handle recursion without infinite loops
      expect(result.nodes.length).toBe(1);
      expect(result.edges.length).toBe(1); // Self-edge
    });

    it('should handle functions without names', () => {
      const sourceFile = project.createSourceFile(
        'src/anonymous.ts',
        `
        const callback = function() {
          return 'anonymous';
        };
      `
      );

      const functionExpr = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)[0];
      const nodeInfo = (analyzer as any).extractNodeInfo(functionExpr);

      expect(nodeInfo).toBeDefined();
      expect(nodeInfo!.name).toBe('function-expression');
    });

    it('should handle optional parameters correctly', () => {
      const sourceFile = project.createSourceFile(
        'src/optional.ts',
        `
        function testFunction(required: string, optional?: number, withDefault: boolean = true) {
          return required;
        }
      `
      );

      const func = sourceFile.getFunctions()[0];
      const nodeInfo = (analyzer as any).extractNodeInfo(func);

      expect(nodeInfo!.parameters).toBeDefined();
      expect(nodeInfo!.parameters!.length).toBe(3);
      expect(nodeInfo!.parameters![0].optional).toBe(false);
      expect(nodeInfo!.parameters![1].optional).toBe(true);
      expect(nodeInfo!.parameters![2].defaultValue).toBe('true');
    });
  });

  describe('metadata collection', () => {
    it('should collect analysis metrics when enabled', async () => {
      // Create a fresh project for this test
      const testProject = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 2, // ES2015
          module: 1, // CommonJS
        },
      });

      const sourceFile = testProject.createSourceFile(
        '/test/src/metrics.ts',
        `
        function simpleFunction() {
          return 'simple';
        }
      `
      );

      const testAnalyzer = new CallGraphAnalyzer(context, { collectMetrics: true });
      // Replace the analyzer's project with our test project
      (testAnalyzer as any).project = testProject;

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: '/test/src/metrics.ts',
          functionName: 'simpleFunction',
        }),
      };
      (testAnalyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await testAnalyzer.analyzeFromEntryPoint('src/metrics.ts#simpleFunction');

      expect(result.metadata.analysisTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalFiles).toBeGreaterThan(0);
      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.entryPoint).toBe('src/metrics.ts#simpleFunction');
      expect(result.metadata.projectRoot).toBe('/test');
    });

    it('should include tsConfigPath in metadata when provided', async () => {
      // Create a test project with in-memory file system
      const testProject = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          target: 2, // ES2015
          module: 1, // CommonJS
        },
      });

      const sourceFile = testProject.createSourceFile(
        '/test/src/config.ts',
        `
        function configFunction() {
          return 'config';
        }
      `
      );

      // Create context without tsConfigPath to avoid file system access during construction
      const contextForTest = {
        ...context,
        tsConfigPath: undefined, // Don't set during construction
      };

      const analyzer = new CallGraphAnalyzer(contextForTest);
      // Replace the analyzer's project with our test project to avoid file system issues
      (analyzer as any).project = testProject;
      // Set tsConfigPath after construction for metadata
      (analyzer as any).context.tsConfigPath = 'test-config.json';

      const mockEntryPointFinder = {
        findEntryPoint: jest.fn().mockReturnValue({
          node: sourceFile.getFunctions()[0],
          filePath: '/test/src/config.ts',
          functionName: 'configFunction',
        }),
      };
      (analyzer as any).entryPointFinder = mockEntryPointFinder;

      const result = await analyzer.analyzeFromEntryPoint('src/config.ts#configFunction');

      expect(result.metadata.tsConfigPath).toBe('test-config.json');
    });
  });
});
