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