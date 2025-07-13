import { Project, SourceFile } from 'ts-morph';
import { MethodAnalyzer } from '../../src/analyzer/MethodAnalyzer';
import { CallGraphNode } from '../../src/types';

describe('MethodAnalyzer', () => {
  let analyzer: MethodAnalyzer;
  let project: Project;

  beforeEach(() => {
    analyzer = new MethodAnalyzer();
    project = new Project({ 
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });
  });

  describe('basic class methods', () => {
    it('should analyze instance methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class UserService {
          getUser(id: number): string {
            return "user";
          }
          
          async createUser(name: string): Promise<void> {
            // async method
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(2);
      
      const getUser = methods.find(m => m.name === 'getUser');
      expect(getUser).toBeDefined();
      expect(getUser!.type).toBe('method');
      expect(getUser!.async).toBe(false);
      expect(getUser!.static).toBe(false);
      expect(getUser!.visibility).toBe('public');
      expect(getUser!.className).toBe('UserService');
      expect(getUser!.id).toBe('/test.ts#UserService::getUser');
      expect(getUser!.parameters).toHaveLength(1);
      expect(getUser!.parameters[0].name).toBe('id');
      expect(getUser!.parameters[0].type).toContain('number');
      
      const createUser = methods.find(m => m.name === 'createUser');
      expect(createUser).toBeDefined();
      expect(createUser!.async).toBe(true);
      expect(createUser!.returnType).toContain('Promise');
    });

    it('should analyze static methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class Utils {
          static formatDate(date: Date): string {
            return date.toISOString();
          }
          
          static getInstance(): Utils {
            return new Utils();
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(2);
      
      const formatDate = methods.find(m => m.name === 'formatDate');
      expect(formatDate).toBeDefined();
      expect(formatDate!.type).toBe('method');
      expect(formatDate!.static).toBe(true);
      expect(formatDate!.id).toBe('/test.ts#Utils.formatDate');
      
      const getInstance = methods.find(m => m.name === 'getInstance');
      expect(getInstance).toBeDefined();
      expect(getInstance!.static).toBe(true);
      expect(getInstance!.id).toBe('/test.ts#Utils.getInstance');
    });

    it('should analyze constructor', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class Service {
          constructor(private name: string, public id: number = 1) {
            // constructor body
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(1);
      
      const constructor = methods[0];
      expect(constructor.name).toBe('constructor');
      expect(constructor.type).toBe('constructor');
      expect(constructor.async).toBe(false);
      expect(constructor.static).toBe(false);
      expect(constructor.visibility).toBe('public');
      expect(constructor.className).toBe('Service');
      expect(constructor.id).toBe('/test.ts#Service.constructor');
      expect(constructor.parameters).toHaveLength(2);
      expect(constructor.parameters[0].name).toBe('name');
      expect(constructor.parameters[1].name).toBe('id');
      expect(constructor.parameters[1].optional).toBe(false); // has default value but not optional
    });

    it('should analyze getters and setters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class Model {
          private _value = 0;
          
          get value(): number {
            return this._value;
          }
          
          set value(val: number) {
            this._value = val;
          }
          
          static get defaultValue(): number {
            return 42;
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(3);
      
      const getter = methods.find(m => m.id.includes('get:value'));
      expect(getter).toBeDefined();
      expect(getter!.name).toBe('value');
      expect(getter!.type).toBe('accessor');
      expect(getter!.static).toBe(false);
      expect(getter!.id).toBe('/test.ts#Model::get:value');
      
      const setter = methods.find(m => m.id.includes('set:value'));
      expect(setter).toBeDefined();
      expect(setter!.name).toBe('value');
      expect(setter!.type).toBe('accessor');
      expect(setter!.static).toBe(false);
      expect(setter!.id).toBe('/test.ts#Model::set:value');
      
      const staticGetter = methods.find(m => m.id.includes('get:defaultValue'));
      expect(staticGetter).toBeDefined();
      expect(staticGetter!.static).toBe(true);
      expect(staticGetter!.id).toBe('/test.ts#Model.get:defaultValue');
    });
  });

  describe('method visibility', () => {
    it('should detect method visibility modifiers', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          public publicMethod(): void {}
          
          private privateMethod(): void {}
          
          protected protectedMethod(): void {}
          
          implicitPublicMethod(): void {}
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(4);
      
      const publicMethod = methods.find(m => m.name === 'publicMethod');
      expect(publicMethod!.visibility).toBe('public');
      
      const privateMethod = methods.find(m => m.name === 'privateMethod');
      expect(privateMethod!.visibility).toBe('private');
      
      const protectedMethod = methods.find(m => m.name === 'protectedMethod');
      expect(protectedMethod!.visibility).toBe('protected');
      
      const implicitPublic = methods.find(m => m.name === 'implicitPublicMethod');
      expect(implicitPublic!.visibility).toBe('public');
    });

    it('should detect constructor visibility', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class PublicConstructor {
          constructor() {}
        }
        
        class PrivateConstructor {
          private constructor() {}
        }
        
        class ProtectedConstructor {
          protected constructor() {}
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(3);
      
      const publicCtor = methods.find(m => m.className === 'PublicConstructor');
      expect(publicCtor!.visibility).toBe('public');
      
      const privateCtor = methods.find(m => m.className === 'PrivateConstructor');
      expect(privateCtor!.visibility).toBe('private');
      
      const protectedCtor = methods.find(m => m.className === 'ProtectedConstructor');
      expect(protectedCtor!.visibility).toBe('protected');
    });

    it('should detect accessor visibility', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          private _value = 0;
          
          public get publicValue(): number {
            return this._value;
          }
          
          private get privateValue(): number {
            return this._value;
          }
          
          protected set protectedValue(val: number) {
            this._value = val;
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(3);
      
      const publicGetter = methods.find(m => m.id.includes('get:publicValue'));
      expect(publicGetter!.visibility).toBe('public');
      
      const privateGetter = methods.find(m => m.id.includes('get:privateValue'));
      expect(privateGetter!.visibility).toBe('private');
      
      const protectedSetter = methods.find(m => m.id.includes('set:protectedValue'));
      expect(protectedSetter!.visibility).toBe('protected');
    });
  });

  describe('complex scenarios', () => {
    it('should handle method overloading', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class Calculator {
          add(a: number, b: number): number;
          add(a: string, b: string): string;
          add(a: any, b: any): any {
            return a + b;
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      // Should only find the implementation, not the overload signatures
      expect(methods).toHaveLength(1);
      expect(methods[0].name).toBe('add');
    });

    it('should handle multiple classes in one file', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class UserService {
          getUser(): string {
            return "user";
          }
        }
        
        class OrderService {
          getOrder(): string {
            return "order";
          }
          
          static getInstance(): OrderService {
            return new OrderService();
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(3);
      
      const userMethod = methods.find(m => m.className === 'UserService');
      expect(userMethod).toBeDefined();
      expect(userMethod!.name).toBe('getUser');
      
      const orderMethods = methods.filter(m => m.className === 'OrderService');
      expect(orderMethods).toHaveLength(2);
      expect(orderMethods.map(m => m.name)).toContain('getOrder');
      expect(orderMethods.map(m => m.name)).toContain('getInstance');
    });

    it('should handle abstract methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        abstract class AbstractService {
          abstract process(): void;
          
          concrete(): string {
            return "concrete";
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(2);
      
      const abstractMethod = methods.find(m => m.name === 'process');
      expect(abstractMethod).toBeDefined();
      expect(abstractMethod!.type).toBe('method');
      
      const concreteMethod = methods.find(m => m.name === 'concrete');
      expect(concreteMethod).toBeDefined();
      expect(concreteMethod!.type).toBe('method');
    });

    it('should handle optional parameters', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class TestClass {
          method(required: string, optional?: number, withDefault: boolean = true): void {}
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(1);
      
      const method = methods[0];
      expect(method.parameters).toHaveLength(3);
      expect(method.parameters[0].optional).toBe(false);
      expect(method.parameters[1].optional).toBe(true);
      expect(method.parameters[2].optional).toBe(false); // has default but not optional
      expect(method.parameters[2].defaultValue).toBe('true');
    });

    it('should handle generic methods', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class GenericClass<T> {
          process<U>(input: T, transformer: U): U {
            return transformer;
          }
          
          static create<T>(): GenericClass<T> {
            return new GenericClass<T>();
          }
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(2);
      
      const instanceMethod = methods.find(m => m.name === 'process');
      expect(instanceMethod).toBeDefined();
      expect(instanceMethod!.static).toBe(false);
      
      const staticMethod = methods.find(m => m.name === 'create');
      expect(staticMethod).toBeDefined();
      expect(staticMethod!.static).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle anonymous classes', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        const obj = new class {
          method(): void {}
        }();
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(1);
      expect(methods[0].className).toBe('AnonymousClass');
      expect(methods[0].name).toBe('method');
    });

    it('should handle empty classes', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class EmptyClass {
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(0);
    });

    it('should handle classes with only properties', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class DataClass {
          public name: string = "test";
          private _id: number = 1;
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      expect(methods).toHaveLength(0);
    });

    it('should handle decorator usage', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        function decorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {}
        
        class DecoratedClass {
          @decorator
          decoratedMethod(): void {}
          
          normalMethod(): void {}
        }
      `);

      const methods = analyzer.analyzeSourceFile(sourceFile);
      
      // Should find the function declaration and both methods
      expect(methods).toHaveLength(2);
      
      const decoratedMethod = methods.find(m => m.name === 'decoratedMethod');
      expect(decoratedMethod).toBeDefined();
      expect(decoratedMethod!.type).toBe('method');
      
      const normalMethod = methods.find(m => m.name === 'normalMethod');
      expect(normalMethod).toBeDefined();
      expect(normalMethod!.type).toBe('method');
    });
  });

  describe('analyzeClassDeclaration', () => {
    it('should analyze specific class declaration', () => {
      const sourceFile = project.createSourceFile('test.ts', `
        class SpecificClass {
          method1(): void {}
          method2(): string { return "test"; }
        }
        
        class OtherClass {
          otherMethod(): void {}
        }
      `);

      const classes = sourceFile.getClasses();
      const specificClass = classes.find(c => c.getName() === 'SpecificClass')!;
      
      const methods = analyzer.analyzeClassDeclaration(specificClass);
      
      expect(methods).toHaveLength(2);
      expect(methods.every(m => m.className === 'SpecificClass')).toBe(true);
      expect(methods.map(m => m.name)).toContain('method1');
      expect(methods.map(m => m.name)).toContain('method2');
    });
  });
});