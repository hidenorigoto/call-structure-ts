import { Project, SourceFile } from 'ts-morph';
import { CallExpressionAnalyzer } from '../../src/analyzer/CallExpressionAnalyzer';
import { CallGraphEdge } from '../../src/types';

describe('CallExpressionAnalyzer', () => {
  let analyzer: CallExpressionAnalyzer;
  let project: Project;
  const sourceNodeId = 'test.ts#testFunction';

  beforeEach(() => {
    analyzer = new CallExpressionAnalyzer();
    project = new Project({ 
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });
  });

  // Helper to find a function node by name
  function findFunctionNode(sourceFile: SourceFile, name: string) {
    const func = sourceFile.getFunction(name);
    if (func) return func;
    
    // Check variable declarations
    const varStatements = sourceFile.getVariableStatements();
    for (const varStatement of varStatements) {
      for (const declaration of varStatement.getDeclarations()) {
        if (declaration.getName() === name) {
          return declaration.getInitializer();
        }
      }
    }
    
    return undefined;
  }

  describe('basic function calls', () => {
    it('should analyze direct function call', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function helper() {}
        
        function testFunction() {
          helper();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      expect(testFunc).toBeDefined();
      
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(1);
      expect(edges[0].source).toBe(sourceNodeId);
      expect(edges[0].target).toContain('#helper');
      expect(edges[0].type).toBe('sync');
      expect(edges[0].line).toBe(5);
    });

    it('should analyze multiple function calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function func1() {}
        function func2() {}
        
        function testFunction() {
          func1();
          func2();
          func1(); // called again
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(3);
      expect(edges[0].target).toContain('#func1');
      expect(edges[1].target).toContain('#func2');
      expect(edges[2].target).toContain('#func1');
    });

    it('should handle calls with arguments', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function add(a: number, b: number): number {
          return a + b;
        }
        
        function testFunction() {
          add(1, 2);
          add(3, 4);
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(2);
      expect(edges[0].argumentTypes).toHaveLength(2);
      expect(edges[0].argumentTypes).toEqual(['1', '2']);
      expect(edges[1].argumentTypes).toEqual(['3', '4']);
    });
  });

  describe('method calls', () => {
    it('should analyze method calls on objects', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class MyClass {
          method1() {}
          method2() {}
        }
        
        function testFunction() {
          const obj = new MyClass();
          obj.method1();
          obj.method2();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should find constructor call and method calls
      expect(edges.length).toBeGreaterThanOrEqual(2);
      
      const method1Call = edges.find(e => e.target.includes('method1'));
      const method2Call = edges.find(e => e.target.includes('method2'));
      
      expect(method1Call).toBeDefined();
      expect(method2Call).toBeDefined();
      expect(method1Call!.target).toContain('#MyClass.method1');
      expect(method2Call!.target).toContain('#MyClass.method2');
    });

    it('should analyze chained method calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class Builder {
          setA(): Builder { return this; }
          setB(): Builder { return this; }
          build(): string { return 'built'; }
        }
        
        function testFunction() {
          const builder = new Builder();
          builder.setA().setB().build();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should find constructor and all method calls
      const constructorCall = edges.find(e => e.type === 'constructor');
      const setACall = edges.find(e => e.target.includes('setA'));
      const setBCall = edges.find(e => e.target.includes('setB'));
      const buildCall = edges.find(e => e.target.includes('build'));
      
      expect(constructorCall).toBeDefined();
      expect(setACall).toBeDefined();
      expect(setBCall).toBeDefined();
      expect(buildCall).toBeDefined();
    });
  });

  describe('async calls', () => {
    it('should identify async/await calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        async function fetchData(): Promise<string> {
          return 'data';
        }
        
        async function testFunction() {
          await fetchData();
          const result = await fetchData();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(2);
      expect(edges[0].type).toBe('async');
      expect(edges[1].type).toBe('async');
    });

    it('should identify promise method calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function getPromise(): Promise<string> {
          return Promise.resolve('data');
        }
        
        function testFunction() {
          getPromise().then(data => console.log(data));
          getPromise().catch(err => console.error(err));
          getPromise().finally(() => console.log('done'));
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should find all calls including console.log calls
      expect(edges.length).toBeGreaterThanOrEqual(3);
      
      // Should find getPromise calls
      const promiseCalls = edges.filter(e => e.target.includes('#getPromise'));
      expect(promiseCalls.length).toBeGreaterThanOrEqual(3);
      
      // First getPromise() call should be marked as async due to return type
      const firstGetPromise = promiseCalls[0];
      expect(firstGetPromise?.type).toBe('async');
    });

    it('should identify async function calls without await', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        async function asyncFunc(): Promise<void> {}
        
        function testFunction() {
          asyncFunc(); // returns Promise but not awaited
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(1);
      // Should still be marked as async based on return type
      expect(edges[0].type).toBe('async');
    });
  });

  describe('constructor calls', () => {
    it('should analyze new expressions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class MyClass {
          constructor(public value: string) {}
        }
        
        function testFunction() {
          const obj1 = new MyClass('test');
          const obj2 = new MyClass('another');
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(2);
      expect(edges[0].type).toBe('constructor');
      expect(edges[0].target).toContain('#MyClass.constructor');
      expect(edges[1].type).toBe('constructor');
    });

    it('should handle constructors with no parameters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class Simple {}
        
        function testFunction() {
          new Simple();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(1);
      expect(edges[0].type).toBe('constructor');
      expect(edges[0].argumentTypes).toEqual([]);
    });
  });

  describe('callback calls', () => {
    it('should identify callback function calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function processArray(arr: number[], callback: (n: number) => void) {
          arr.forEach(callback);
        }
        
        function testFunction() {
          processArray([1, 2, 3], (n) => console.log(n));
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should find the processArray call
      const processCall = edges.find(e => e.target.includes('#processArray'));
      expect(processCall).toBeDefined();
    });

    it('should handle higher-order functions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function getLogger() {
          return (msg: string) => console.log(msg);
        }
        
        function testFunction() {
          const log = getLogger();
          log('test message');
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should find getLogger call
      const getLoggerCall = edges.find(e => e.target.includes('#getLogger'));
      expect(getLoggerCall).toBeDefined();
      
      // The log call might not be resolved since it's dynamic
      expect(edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('conditional calls', () => {
    it('should mark calls inside if statements as conditional', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function maybeCall() {}
        
        function testFunction(condition: boolean) {
          if (condition) {
            maybeCall();
          }
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(1);
      expect(edges[0].conditional).toBe(true);
    });

    it('should mark calls in ternary expressions as conditional', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function optionA() {}
        function optionB() {}
        
        function testFunction(flag: boolean) {
          flag ? optionA() : optionB();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(2);
      expect(edges[0].conditional).toBe(true);
      expect(edges[1].conditional).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('should handle element access calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const funcs = {
          func1: () => 'one',
          func2: () => 'two'
        };
        
        function testFunction() {
          funcs['func1']();
          const key = 'func2';
          funcs[key](); // dynamic, might not be resolved
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should at least find the literal element access
      expect(edges.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle nested calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function outer() {
          function inner() {
            console.log('nested');
          }
          inner();
        }
        
        function testFunction() {
          outer();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // Should find only the outer call from testFunction
      expect(edges).toHaveLength(1);
      expect(edges[0].target).toContain('#outer');
    });

    it('should handle arrow function variable calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const arrowFunc = (x: number) => x * 2;
        const asyncArrow = async () => 'result';
        
        function testFunction() {
          arrowFunc(5);
          asyncArrow();
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      expect(edges).toHaveLength(2);
      
      // Second call should be async (asyncArrow() is on line 7)
      const asyncCall = edges.find(e => e.line === 7);
      expect(asyncCall?.type).toBe('async');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const sourceFile = project.createSourceFile('empty.ts', '');
      const edges = analyzer.analyzeSourceFile(sourceFile, sourceNodeId);
      expect(edges).toHaveLength(0);
    });

    it('should handle file with no calls', () => {
      const sourceFile = project.createSourceFile('no-calls.ts', `
        function standalone() {
          const x = 5;
          const y = x + 10;
          return y;
        }
      `);
      
      const edges = analyzer.analyzeSourceFile(sourceFile, sourceNodeId);
      expect(edges).toHaveLength(0);
    });

    it('should handle unresolvable calls gracefully', () => {
      const sourceFile = project.createSourceFile('dynamic.ts', `
        function testFunction() {
          const funcName = 'dynamic' + 'Name';
          window[funcName](); // dynamic call, cannot resolve
          
          const obj: any = {};
          obj.unknownMethod(); // type any, cannot resolve
        }
      `);

      // Should not throw
      expect(() => {
        const testFunc = findFunctionNode(sourceFile, 'testFunction');
        const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
        // May or may not find edges depending on type resolution
        expect(edges).toBeDefined();
      }).not.toThrow();
    });

    it('should handle external/imported calls', () => {
      const sourceFile = project.createSourceFile('imports.ts', `
        import { readFile } from 'fs';
        
        function testFunction() {
          readFile('file.txt', () => {});
        }
      `);

      const testFunc = findFunctionNode(sourceFile, 'testFunction');
      const edges = analyzer.analyzeNode(testFunc!, sourceNodeId);
      
      // External calls might not be resolved (return null from resolveImportedSymbol)
      expect(edges).toBeDefined();
    });
  });
});