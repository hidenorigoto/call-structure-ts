import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { SymbolResolver } from '../../src/analyzer/SymbolResolver';

describe('SymbolResolver', () => {
  let resolver: SymbolResolver;
  let project: Project;

  beforeEach(() => {
    project = new Project({ 
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });
    resolver = new SymbolResolver(project);
  });

  afterEach(() => {
    resolver.clearCache();
  });

  describe('resolveIdentifier', () => {
    it('should resolve function identifiers', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function testFunction() {
          return 'test';
        }
        
        function caller() {
          testFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        expect(Node.isFunctionDeclaration(resolved!)).toBe(true);
      }
    });

    it('should resolve variable identifiers with function initializers', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const myFunction = function() {
          return 'test';
        };
        
        function caller() {
          myFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        expect(Node.isVariableDeclaration(resolved!)).toBe(true);
      }
    });

    it('should resolve arrow function variables', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const arrowFunction = () => 'test';
        
        function caller() {
          arrowFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        expect(Node.isVariableDeclaration(resolved!)).toBe(true);
      }
    });

    it('should return undefined for non-existent identifiers', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function caller() {
          nonExistentFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeUndefined();
      }
    });
  });

  describe('resolvePropertyAccess', () => {
    it('should resolve method calls on classes', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          myMethod() {
            return 'test';
          }
        }
        
        function caller() {
          const obj = new TestClass();
          obj.myMethod();
        }
      `);

      const propertyAccessExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const methodCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'myMethod'
      );
      
      if (methodCall && Node.isPropertyAccessExpression(methodCall)) {
        const resolved = resolver.resolvePropertyAccess(methodCall);
        expect(resolved).toBeDefined();
        expect(Node.isMethodDeclaration(resolved!)).toBe(true);
      }
    });

    it('should resolve static method calls', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          static staticMethod() {
            return 'static';
          }
        }
        
        function caller() {
          TestClass.staticMethod();
        }
      `);

      const propertyAccessExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const staticMethodCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'staticMethod'
      );
      
      if (staticMethodCall && Node.isPropertyAccessExpression(staticMethodCall)) {
        const resolved = resolver.resolvePropertyAccess(staticMethodCall);
        expect(resolved).toBeDefined();
        expect(Node.isMethodDeclaration(resolved!)).toBe(true);
      }
    });

    it('should resolve property access on objects with function properties', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          myProp = () => 'test';
        }
        
        function caller() {
          const obj = new TestClass();
          obj.myProp();
        }
      `);

      const propertyAccessExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const propCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'myProp'
      );
      
      if (propCall && Node.isPropertyAccessExpression(propCall)) {
        const resolved = resolver.resolvePropertyAccess(propCall);
        // Should resolve to the property declaration
        expect(resolved).toBeDefined();
      }
    });

    it('should return undefined for non-existent properties', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          myMethod() {
            return 'test';
          }
        }
        
        function caller() {
          const obj = new TestClass();
          obj.nonExistentMethod();
        }
      `);

      const propertyAccessExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const nonExistentCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'nonExistentMethod'
      );
      
      if (nonExistentCall && Node.isPropertyAccessExpression(nonExistentCall)) {
        const resolved = resolver.resolvePropertyAccess(nonExistentCall);
        expect(resolved).toBeUndefined();
      }
    });
  });

  describe('import resolution', () => {
    it('should resolve named imports', () => {
      const helperFile = project.createSourceFile('helper.ts', `
        export function helperFunction() {
          return 'helper';
        }
      `);

      const mainFile = project.createSourceFile('main.ts', `
        import { helperFunction } from './helper';
        
        function main() {
          helperFunction();
        }
      `);

      const callExpressions = mainFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        expect(Node.isFunctionDeclaration(resolved!)).toBe(true);
        expect(resolved!.getSourceFile().getFilePath()).toBe('/helper.ts');
      }
    });

    it('should resolve default imports', () => {
      const helperFile = project.createSourceFile('helper.ts', `
        export default function defaultFunction() {
          return 'default';
        }
      `);

      const mainFile = project.createSourceFile('main.ts', `
        import defaultFunction from './helper';
        
        function main() {
          defaultFunction();
        }
      `);

      const callExpressions = mainFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        expect(resolved!.getSourceFile().getFilePath()).toBe('/helper.ts');
      }
    });

    it('should resolve imported class methods', () => {
      const serviceFile = project.createSourceFile('service.ts', `
        export class UserService {
          getUser(id: number) {
            return { id, name: 'User' };
          }
        }
      `);

      const mainFile = project.createSourceFile('main.ts', `
        import { UserService } from './service';
        
        function main() {
          const service = new UserService();
          service.getUser(1);
        }
      `);

      const propertyAccessExpressions = mainFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const methodCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'getUser'
      );
      
      if (methodCall && Node.isPropertyAccessExpression(methodCall)) {
        const resolved = resolver.resolvePropertyAccess(methodCall);
        expect(resolved).toBeDefined();
        expect(Node.isMethodDeclaration(resolved!)).toBe(true);
        expect(resolved!.getSourceFile().getFilePath()).toBe('/service.ts');
      }
    });

    it('should handle namespace imports', () => {
      const utilsFile = project.createSourceFile('utils.ts', `
        export function format(str: string) {
          return str.toUpperCase();
        }
        
        export function parse(str: string) {
          return str.toLowerCase();
        }
      `);

      const mainFile = project.createSourceFile('main.ts', `
        import * as Utils from './utils';
        
        function main() {
          Utils.format('test');
        }
      `);

      const propertyAccessExpressions = mainFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const namespaceCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'format'
      );
      
      if (namespaceCall && Node.isPropertyAccessExpression(namespaceCall)) {
        const resolved = resolver.resolvePropertyAccess(namespaceCall);
        expect(resolved).toBeDefined();
        expect(resolved!.getSourceFile().getFilePath()).toBe('/utils.ts');
      }
    });
  });

  describe('getFullyQualifiedName', () => {
    it('should generate correct names for functions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function testFunction() {
          return 'test';
        }
      `);

      const functionDeclaration = sourceFile.getFunctions()[0];
      const fqn = resolver.getFullyQualifiedName(functionDeclaration);
      
      expect(fqn).toBe('/test.ts#testFunction');
    });

    it('should generate correct names for instance methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          instanceMethod() {
            return 'instance';
          }
        }
      `);

      const classDeclaration = sourceFile.getClasses()[0];
      const method = classDeclaration.getMethods()[0];
      const fqn = resolver.getFullyQualifiedName(method);
      
      expect(fqn).toBe('/test.ts#TestClass::instanceMethod');
    });

    it('should generate correct names for static methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          static staticMethod() {
            return 'static';
          }
        }
      `);

      const classDeclaration = sourceFile.getClasses()[0];
      const method = classDeclaration.getMethods()[0];
      const fqn = resolver.getFullyQualifiedName(method);
      
      expect(fqn).toBe('/test.ts#TestClass.staticMethod');
    });

    it('should generate correct names for constructors', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          constructor(name: string) {
            this.name = name;
          }
        }
      `);

      const classDeclaration = sourceFile.getClasses()[0];
      const constructor = classDeclaration.getConstructors()[0];
      const fqn = resolver.getFullyQualifiedName(constructor);
      
      expect(fqn).toBe('/test.ts#TestClass.constructor');
    });

    it('should generate correct names for getters and setters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          private _value = 0;
          
          get value() {
            return this._value;
          }
          
          set value(val: number) {
            this._value = val;
          }
          
          static get staticValue() {
            return 42;
          }
        }
      `);

      const classDeclaration = sourceFile.getClasses()[0];
      const getter = classDeclaration.getGetAccessors().find(g => !g.isStatic());
      const setter = classDeclaration.getSetAccessors()[0];
      const staticGetter = classDeclaration.getGetAccessors().find(g => g.isStatic());
      
      expect(resolver.getFullyQualifiedName(getter!)).toBe('/test.ts#TestClass::get:value');
      expect(resolver.getFullyQualifiedName(setter)).toBe('/test.ts#TestClass::set:value');
      expect(resolver.getFullyQualifiedName(staticGetter!)).toBe('/test.ts#TestClass.get:staticValue');
    });

    it('should generate correct names for arrow functions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const arrowFunction = () => 'test';
      `);

      const variableDeclaration = sourceFile.getVariableDeclarations()[0];
      const fqn = resolver.getFullyQualifiedName(variableDeclaration);
      
      expect(fqn).toBe('/test.ts#arrowFunction');
    });

    it('should generate fallback names for anonymous functions', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const callback = function() {
          return 'anonymous';
        };
      `);

      const variableDeclaration = sourceFile.getVariableDeclarations()[0];
      const functionExpression = variableDeclaration.getInitializer();
      const fqn = resolver.getFullyQualifiedName(functionExpression!);
      
      expect(fqn).toBe('/test.ts#callback');
    });
  });

  describe('resolveModulePath', () => {
    it('should resolve module paths correctly', () => {
      const helperFile = project.createSourceFile('lib/helper.ts', `
        export function helperFunction() {
          return 'helper';
        }
      `);

      const mainFile = project.createSourceFile('main.ts', `
        import { helperFunction } from './lib/helper';
        
        function main() {
          helperFunction();
        }
      `);

      const resolved = resolver.resolveModulePath('./lib/helper', '/main.ts');
      expect(resolved).toBeDefined();
      expect(resolved!.getFilePath()).toBe('/lib/helper.ts');
    });

    it('should return undefined for non-existent modules', () => {
      const mainFile = project.createSourceFile('main.ts', `
        // No actual import, just testing resolution
      `);

      const resolved = resolver.resolveModulePath('./nonexistent', '/main.ts');
      expect(resolved).toBeUndefined();
    });

    it('should handle module resolution errors gracefully', () => {
      const resolved = resolver.resolveModulePath('./missing', '/nonexistent.ts');
      expect(resolved).toBeUndefined();
    });

    it('should cache module resolution results', () => {
      const helperFile = project.createSourceFile('utils/helper.ts', `
        export function utilFunction() {
          return 'util';
        }
      `);

      const mainFile = project.createSourceFile('app.ts', `
        import { utilFunction } from './utils/helper';
      `);

      // First resolution
      const resolved1 = resolver.resolveModulePath('./utils/helper', '/app.ts');
      const stats1 = resolver.getCacheStats();

      // Second resolution should use cache
      const resolved2 = resolver.resolveModulePath('./utils/helper', '/app.ts');
      const stats2 = resolver.getCacheStats();

      expect(resolved1).toBe(resolved2);
      expect(stats2.moduleCacheSize).toBeGreaterThan(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle identifiers with no symbols gracefully', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function test() {
          // This creates an identifier that may not have a symbol
          const x = unknownVariable;
        }
      `);

      const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
      const unknownIdentifier = identifiers.find(id => id.getText() === 'unknownVariable');

      if (unknownIdentifier) {
        const resolved = resolver.resolveIdentifier(unknownIdentifier);
        expect(resolved).toBeUndefined();
      }
    });

    it('should handle property access on undefined types', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function test() {
          const obj: any = undefined;
          obj.someProperty();
        }
      `);

      const propertyAccess = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)[0];
      if (propertyAccess) {
        const resolved = resolver.resolvePropertyAccess(propertyAccess);
        // Should handle gracefully without throwing
        expect(resolved).toBeUndefined();
      }
    });

    it('should handle import specifier resolution errors', () => {
      // Create a file with an import that can't be resolved
      const sourceFile = project.createSourceFile('test.ts', `
        import { nonExistentFunction } from './nonexistent';
        
        function test() {
          nonExistentFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      if (callExpressions.length > 0) {
        const expression = callExpressions[0].getExpression();
        if (Node.isIdentifier(expression)) {
          const resolved = resolver.resolveIdentifier(expression);
          // Should handle gracefully
          expect(resolved).toBeUndefined();
        }
      }
    });

    it('should handle symbols with no declarations', () => {
      // This tests the edge case where a symbol exists but has no declarations
      const sourceFile = project.createSourceFile('test.ts', `
        declare function declaredFunction(): void;
        
        function test() {
          declaredFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      if (callExpressions.length > 0) {
        const expression = callExpressions[0].getExpression();
        if (Node.isIdentifier(expression)) {
          const resolved = resolver.resolveIdentifier(expression);
          // Should handle symbols that might not have accessible declarations
          expect(resolved).toBeDefined();
        }
      }
    });
  });

  describe('private method coverage', () => {
    describe('resolveSymbol', () => {
      it('should handle symbols with multiple declarations', () => {
        const sourceFile = project.createSourceFile('test.ts', `
          function overloaded(x: string): string;
          function overloaded(x: number): number;
          function overloaded(x: any): any {
            return x;
          }
          
          function test() {
            overloaded('test');
          }
        `);

        const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
        if (callExpressions.length > 0) {
          const expression = callExpressions[0].getExpression();
          if (Node.isIdentifier(expression)) {
            const resolved = resolver.resolveIdentifier(expression);
            expect(resolved).toBeDefined();
            expect(Node.isFunctionDeclaration(resolved!)).toBe(true);
          }
        }
      });
    });

    describe('resolveImportedSymbol', () => {
      it('should handle import clause (default import)', () => {
        const defaultFile = project.createSourceFile('default.ts', `
          export default class DefaultClass {
            method() {
              return 'default';
            }
          }
        `);

        const mainFile = project.createSourceFile('main.ts', `
          import DefaultClass from './default';
          
          function test() {
            const instance = new DefaultClass();
            instance.method();
          }
        `);

        const constructorCalls = mainFile.getDescendantsOfKind(SyntaxKind.NewExpression);
        if (constructorCalls.length > 0) {
          const expression = constructorCalls[0].getExpression();
          if (Node.isIdentifier(expression)) {
            const resolved = resolver.resolveIdentifier(expression);
            expect(resolved).toBeDefined();
            expect(resolved!.getSourceFile().getFilePath()).toBe('/default.ts');
          }
        }
      });

      it('should handle namespace import without resolving further', () => {
        const utilsFile = project.createSourceFile('utils.ts', `
          export function util1() { return 'util1'; }
          export function util2() { return 'util2'; }
        `);

        const mainFile = project.createSourceFile('main.ts', `
          import * as Utils from './utils';
          
          function test() {
            // Test namespace identifier resolution
            const ns = Utils;
          }
        `);

        const identifiers = mainFile.getDescendantsOfKind(SyntaxKind.Identifier);
        const utilsIdentifier = identifiers.find(id => id.getText() === 'Utils' && 
          !Node.isImportSpecifier(id.getParent()) && 
          !Node.isNamespaceImport(id.getParent()));

        if (utilsIdentifier) {
          const resolved = resolver.resolveIdentifier(utilsIdentifier);
          // Should resolve to the namespace import declaration
          expect(resolved).toBeDefined();
        }
      });
    });

    describe('findExportedSymbol', () => {
      it('should find specific named exports', () => {
        const moduleFile = project.createSourceFile('module.ts', `
          export const namedExport = 'named';
          export default 'default';
          export function namedFunction() { return 'function'; }
        `);

        const mainFile = project.createSourceFile('main.ts', `
          import { namedExport, namedFunction } from './module';
          
          function test() {
            console.log(namedExport);
            namedFunction();
          }
        `);

        const callExpressions = mainFile.getDescendantsOfKind(SyntaxKind.CallExpression);
        const namedFunctionCall = callExpressions.find(call => {
          const expr = call.getExpression();
          return Node.isIdentifier(expr) && expr.getText() === 'namedFunction';
        });

        if (namedFunctionCall) {
          const expression = namedFunctionCall.getExpression();
          if (Node.isIdentifier(expression)) {
            const resolved = resolver.resolveIdentifier(expression);
            expect(resolved).toBeDefined();
            expect(Node.isFunctionDeclaration(resolved!)).toBe(true);
          }
        }
      });

      it('should find default exports', () => {
        const defaultFile = project.createSourceFile('defaultModule.ts', `
          export default function defaultExport() {
            return 'default';
          }
        `);

        const mainFile = project.createSourceFile('main.ts', `
          import defaultExport from './defaultModule';
          
          function test() {
            defaultExport();
          }
        `);

        const callExpressions = mainFile.getDescendantsOfKind(SyntaxKind.CallExpression);
        if (callExpressions.length > 0) {
          const expression = callExpressions[0].getExpression();
          if (Node.isIdentifier(expression)) {
            const resolved = resolver.resolveIdentifier(expression);
            expect(resolved).toBeDefined();
            expect(resolved!.getSourceFile().getFilePath()).toBe('/defaultModule.ts');
          }
        }
      });
    });

    describe('getFullyQualifiedName edge cases', () => {
      it('should handle anonymous classes', () => {
        const sourceFile = project.createSourceFile('test.ts', `
          const AnonymousClass = class {
            method() {
              return 'anonymous';
            }
          };
        `);

        const classes = sourceFile.getDescendantsOfKind(SyntaxKind.ClassExpression);
        if (classes.length > 0) {
          const fqn = resolver.getFullyQualifiedName(classes[0]);
          // Anonymous class expressions get a fallback name based on kind and line
          expect(fqn).toMatch(/\/test\.ts#ClassExpression:\d+/);
        }
      });

      it('should handle variable declarations without function initializers', () => {
        const sourceFile = project.createSourceFile('test.ts', `
          const simpleVariable = 'not a function';
          const objectVariable = { prop: 'value' };
        `);

        const variables = sourceFile.getVariableDeclarations();
        const simpleVar = variables.find(v => v.getName() === 'simpleVariable');
        const objectVar = variables.find(v => v.getName() === 'objectVariable');

        if (simpleVar) {
          const fqn = resolver.getFullyQualifiedName(simpleVar);
          expect(fqn).toBe('/test.ts#simpleVariable');
        }

        if (objectVar) {
          const fqn = resolver.getFullyQualifiedName(objectVar);
          expect(fqn).toBe('/test.ts#objectVariable');
        }
      });

      it('should handle standalone arrow functions', () => {
        const sourceFile = project.createSourceFile('test.ts', `
          const callback = (x: number) => x * 2;
          
          function test() {
            [1, 2, 3].map((x: number) => x * 2);
          }
        `);

        const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
        if (arrowFunctions.length > 1) {
          // Test the inline arrow function (not assigned to variable)
          const inlineArrow = arrowFunctions.find(af => {
            const parent = af.getParent();
            return !Node.isVariableDeclaration(parent);
          });

          if (inlineArrow) {
            const fqn = resolver.getFullyQualifiedName(inlineArrow);
            expect(fqn).toMatch(/\/test\.ts#anonymous:\d+/);
          }
        }
      });

      it('should handle unknown node types with fallback', () => {
        const sourceFile = project.createSourceFile('test.ts', `
          interface TestInterface {
            prop: string;
          }
        `);

        const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
        if (interfaces.length > 0) {
          const fqn = resolver.getFullyQualifiedName(interfaces[0]);
          expect(fqn).toMatch(/\/test\.ts#InterfaceDeclaration:\d+/);
        }
      });
    });

    describe('isFunctionLikeNode', () => {
      it('should correctly identify all function-like nodes', () => {
        const sourceFile = project.createSourceFile('test.ts', `
          function regularFunction() {}
          
          class TestClass {
            method() {}
            get getter() { return 'value'; }
            set setter(value: string) {}
            constructor() {}
          }
          
          const arrow = () => {};
          const funcExpr = function() {};
        `);

        const functionDecl = sourceFile.getFunctions()[0];
        const classDecl = sourceFile.getClasses()[0];
        const method = classDecl.getMethods()[0];
        const getter = classDecl.getGetAccessors()[0];
        const setter = classDecl.getSetAccessors()[0];
        const constructor = classDecl.getConstructors()[0];
        const arrowFunction = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)[0];
        const functionExpression = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)[0];

        // Test the private method through public interface
        expect(resolver.getFullyQualifiedName(functionDecl)).toContain('regularFunction');
        expect(resolver.getFullyQualifiedName(method)).toContain('method');
        expect(resolver.getFullyQualifiedName(getter)).toContain('get:getter');
        expect(resolver.getFullyQualifiedName(setter)).toContain('set:setter');
        expect(resolver.getFullyQualifiedName(constructor)).toContain('constructor');
        expect(resolver.getFullyQualifiedName(arrowFunction)).toContain('arrow');
        expect(resolver.getFullyQualifiedName(functionExpression)).toContain('funcExpr');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle circular imports gracefully', () => {
      const fileA = project.createSourceFile('a.ts', `
        import { functionB } from './b';
        
        export function functionA() {
          functionB();
        }
      `);

      const fileB = project.createSourceFile('b.ts', `
        import { functionA } from './a';
        
        export function functionB() {
          functionA();
        }
      `);

      const callExpressions = fileA.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callInA = callExpressions[0];
      const expression = callInA.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        expect(resolved!.getSourceFile().getFilePath()).toBe('/b.ts');
      }
    });

    it('should handle complex inheritance scenarios', () => {
      const baseFile = project.createSourceFile('base.ts', `
        export class BaseClass {
          baseMethod() {
            return 'base';
          }
        }
      `);

      const derivedFile = project.createSourceFile('derived.ts', `
        import { BaseClass } from './base';
        
        export class DerivedClass extends BaseClass {
          derivedMethod() {
            return this.baseMethod();
          }
        }
      `);

      const propertyAccessExpressions = derivedFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const baseMethodCall = propertyAccessExpressions.find(pa => 
        Node.isPropertyAccessExpression(pa) && pa.getName() === 'baseMethod'
      );
      
      if (baseMethodCall && Node.isPropertyAccessExpression(baseMethodCall)) {
        const resolved = resolver.resolvePropertyAccess(baseMethodCall);
        expect(resolved).toBeDefined();
        expect(resolved!.getSourceFile().getFilePath()).toBe('/base.ts');
      }
    });

    it('should handle re-exports', () => {
      const originalFile = project.createSourceFile('original.ts', `
        export function originalFunction() {
          return 'original';
        }
      `);

      const reexportFile = project.createSourceFile('reexport.ts', `
        export { originalFunction } from './original';
      `);

      const mainFile = project.createSourceFile('main.ts', `
        import { originalFunction } from './reexport';
        
        function main() {
          originalFunction();
        }
      `);

      const callExpressions = mainFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        const resolved = resolver.resolveIdentifier(expression);
        expect(resolved).toBeDefined();
        // Should ultimately resolve to the original file
        expect(resolved!.getSourceFile().getFilePath()).toBe('/original.ts');
      }
    });
  });

  describe('caching', () => {
    it('should cache resolution results', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function testFunction() {
          return 'test';
        }
        
        function caller() {
          testFunction();
          testFunction(); // Second call to same function
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBe(2);
      
      const firstCall = callExpressions[0].getExpression();
      const secondCall = callExpressions[1].getExpression();
      
      if (Node.isIdentifier(firstCall) && Node.isIdentifier(secondCall)) {
        // First resolution
        const resolved1 = resolver.resolveIdentifier(firstCall);
        const stats1 = resolver.getCacheStats();
        
        // Second resolution should use cache
        const resolved2 = resolver.resolveIdentifier(secondCall);
        const stats2 = resolver.getCacheStats();
        
        expect(resolved1).toBe(resolved2);
        expect(stats2.resolutionCacheSize).toBeGreaterThan(0);
      }
    });

    it('should clear cache when requested', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function testFunction() {
          return 'test';
        }
        
        function caller() {
          testFunction();
        }
      `);

      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      expect(callExpressions.length).toBeGreaterThan(0);
      
      const callExpression = callExpressions[0];
      const expression = callExpression.getExpression();
      
      if (Node.isIdentifier(expression)) {
        resolver.resolveIdentifier(expression);
        
        const statsBefore = resolver.getCacheStats();
        expect(statsBefore.resolutionCacheSize).toBeGreaterThan(0);
        
        resolver.clearCache();
        
        const statsAfter = resolver.getCacheStats();
        expect(statsAfter.resolutionCacheSize).toBe(0);
        expect(statsAfter.moduleCacheSize).toBe(0);
      }
    });
  });
});