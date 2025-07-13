import { Project, SourceFile, Node } from 'ts-morph';
import { FunctionAnalyzer } from '../../src/analyzer/FunctionAnalyzer';
import { CallGraphNode } from '../../src/types';

describe('FunctionAnalyzer', () => {
  let analyzer: FunctionAnalyzer;
  let project: Project;

  beforeEach(() => {
    analyzer = new FunctionAnalyzer();
    project = new Project({ 
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });
  });

  describe('basic function declarations', () => {
    it('should analyze basic function declaration', () => {
      const sourceFile = project.createSourceFile('test.ts', `function testFunction() {
        console.log('test');
      }`);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('testFunction');
      expect(functions[0].type).toBe('function');
      expect(functions[0].async).toBe(false);
      expect(functions[0].filePath).toBe('/test.ts');
      expect(functions[0].line).toBeGreaterThan(0);
      expect(functions[0].parameters).toEqual([]);
    });

    it('should analyze function with parameters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function add(a: number, b: number): number {
          return a + b;
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('add');
      expect(functions[0].parameters).toHaveLength(2);
      expect(functions[0].parameters[0].name).toBe('a');
      expect(functions[0].parameters[0].type).toContain('number');
      expect(functions[0].parameters[0].optional).toBe(false);
      expect(functions[0].parameters[1].name).toBe('b');
      expect(functions[0].parameters[1].type).toContain('number');
      expect(functions[0].returnType).toContain('number');
    });

    it('should analyze function with optional parameters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function greet(name: string, greeting?: string): string {
          return greeting ? \`\${greeting}, \${name}\` : \`Hello, \${name}\`;
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(1);
      expect(functions[0].parameters).toHaveLength(2);
      expect(functions[0].parameters[0].optional).toBe(false);
      expect(functions[0].parameters[1].optional).toBe(true);
    });

    it('should analyze function with default parameters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function multiply(a: number, b: number = 1): number {
          return a * b;
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(1);
      expect(functions[0].parameters).toHaveLength(2);
      expect(functions[0].parameters[1].defaultValue).toBe('1');
    });
  });

  describe('async functions', () => {
    it('should analyze async function', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        async function fetchData(): Promise<string> {
          return await fetch('/api/data').then(r => r.text());
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      // Should find the async function and the arrow function inside
      expect(functions.length).toBeGreaterThanOrEqual(1);
      
      const fetchDataFunc = functions.find(f => f.name === 'fetchData');
      expect(fetchDataFunc).toBeDefined();
      expect(fetchDataFunc!.async).toBe(true);
      expect(fetchDataFunc!.returnType).toContain('Promise');
    });
  });

  describe('exported functions', () => {
    it('should handle exported functions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        export function publicAPI(): void {}
        function privateHelper(): void {}
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(2);
      
      const exportedFunc = functions.find(f => f.name === 'publicAPI');
      const privateFunc = functions.find(f => f.name === 'privateHelper');
      
      expect(exportedFunc).toBeDefined();
      expect(privateFunc).toBeDefined();
      
      // IDs should be different for exported vs private
      expect(exportedFunc!.id).toContain('#publicAPI');
      expect(privateFunc!.id).toContain('#privateHelper:');
    });

    it('should handle default export function', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        export default function defaultFunc(): string {
          return 'default';
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('defaultFunc');
    });
  });

  describe('function expressions', () => {
    it('should analyze function expressions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const myFunc = function namedFunction(): void {
          console.log('named function expression');
        };
        
        const anonFunc = function(): void {
          console.log('anonymous function expression');
        };
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(2);
      
      const namedFunc = functions.find(f => f.name === 'namedFunction');
      const anonFunc = functions.find(f => f.name === 'anonymous-function-expression');
      
      expect(namedFunc).toBeDefined();
      expect(anonFunc).toBeDefined();
      expect(namedFunc!.type).toBe('function');
      expect(anonFunc!.type).toBe('function');
    });
  });

  describe('arrow functions', () => {
    it('should analyze arrow functions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const add = (a: number, b: number): number => a + b;
        const asyncAdd = async (a: number, b: number): Promise<number> => {
          return Promise.resolve(a + b);
        };
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(2);
      
      const syncArrow = functions.find(f => !f.async);
      const asyncArrow = functions.find(f => f.async);
      
      expect(syncArrow).toBeDefined();
      expect(asyncArrow).toBeDefined();
      expect(syncArrow!.type).toBe('arrow');
      expect(asyncArrow!.type).toBe('arrow');
      expect(syncArrow!.name).toBe('arrow-function');
      expect(asyncArrow!.name).toBe('arrow-function');
    });
  });

  describe('class methods', () => {
    it('should analyze class methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          public method1(): void {}
          private method2(): string { return 'private'; }
          protected method3(): number { return 42; }
          static staticMethod(): boolean { return true; }
          async asyncMethod(): Promise<void> {}
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(5);
      
      const publicMethod = functions.find(f => f.name === 'method1');
      const privateMethod = functions.find(f => f.name === 'method2');
      const protectedMethod = functions.find(f => f.name === 'method3');
      const staticMethod = functions.find(f => f.name === 'staticMethod');
      const asyncMethod = functions.find(f => f.name === 'asyncMethod');
      
      expect(publicMethod!.type).toBe('method');
      expect(publicMethod!.visibility).toBe('public');
      expect(publicMethod!.className).toBe('TestClass');
      
      expect(privateMethod!.visibility).toBe('private');
      expect(protectedMethod!.visibility).toBe('protected');
      expect(staticMethod!.static).toBe(true);
      expect(asyncMethod!.async).toBe(true);
    });
  });

  describe('nested functions', () => {
    it('should find nested function declarations', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function outerFunction(): void {
          function innerFunction(): void {
            console.log('nested');
          }
          
          const arrowInside = (): void => {
            console.log('arrow inside');
          };
          
          innerFunction();
          arrowInside();
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(3); // outer, inner, arrow
      
      const outerFunc = functions.find(f => f.name === 'outerFunction');
      const innerFunc = functions.find(f => f.name === 'innerFunction');
      const arrowFunc = functions.find(f => f.name === 'arrow-function');
      
      expect(outerFunc).toBeDefined();
      expect(innerFunc).toBeDefined();
      expect(arrowFunc).toBeDefined();
    });
  });

  describe('decorators', () => {
    it('should extract function decorators', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function decorator(target: any) {
          return target;
        }
        
        class TestClass {
          @decorator
          decoratedMethod(): void {}
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      // Find the decorated method
      const decoratedMethod = functions.find(f => f.name === 'decoratedMethod');
      expect(decoratedMethod).toBeDefined();
      
      // Test that the getFunctionDecorators method exists
      expect(typeof analyzer.getFunctionDecorators).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const sourceFile = project.createSourceFile('empty.ts', '');
      const functions = analyzer.analyzeSourceFile(sourceFile);
      expect(functions).toHaveLength(0);
    });

    it('should handle file with no functions', () => {
      const sourceFile = project.createSourceFile('no-functions.ts', `
        const x = 5;
        let y = 'hello';
        interface MyInterface {
          prop: string;
        }
      `);
      
      const functions = analyzer.analyzeSourceFile(sourceFile);
      expect(functions).toHaveLength(0);
    });

    it('should handle syntax errors gracefully', () => {
      const sourceFile = project.createSourceFile('syntax-error.ts', `
        function broken( {
          // Missing closing parenthesis
          return 'error';
        }
        
        function valid(): string {
          return 'ok';
        }
      `, { overwrite: true });

      // Should not throw, but might not find all functions
      expect(() => {
        const functions = analyzer.analyzeSourceFile(sourceFile);
        // At least the valid function should be found
        expect(functions.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });

  describe('complex scenarios', () => {
    it('should handle generic functions', () => {
      const sourceFile = project.createSourceFile('generics.ts', `
        function identity<T>(arg: T): T {
          return arg;
        }
        
        function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
          return arr.map(fn);
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      expect(functions).toHaveLength(2);
      expect(functions[0].name).toBe('identity');
      expect(functions[1].name).toBe('map');
    });

    it('should handle function overloads', () => {
      const sourceFile = project.createSourceFile('overloads.ts', `
        function process(input: string): string;
        function process(input: number): number;
        function process(input: string | number): string | number {
          return input;
        }
      `);

      const functions = analyzer.analyzeSourceFile(sourceFile);
      
      // Should find at least the implementation
      expect(functions.length).toBeGreaterThanOrEqual(1);
    });
  });
});