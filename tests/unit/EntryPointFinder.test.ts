import { Project, SourceFile } from 'ts-morph';
import { EntryPointFinder } from '../../src/analyzer/EntryPointFinder';

describe('EntryPointFinder', () => {
  let finder: EntryPointFinder;
  let project: Project;

  beforeEach(() => {
    project = new Project({ 
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });
    finder = new EntryPointFinder(project);
  });

  describe('parseEntryPointString', () => {
    it('should find function entry point', () => {
      const sourceFile = project.createSourceFile('src/index.ts', `
        export function main() {
          console.log('Hello');
        }
      `);

      const entryPoint = finder.findEntryPoint('src/index.ts#main');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.name).toBe('main');
      expect(entryPoint.file).toBe('/src/index.ts');
      expect(entryPoint.type).toBe('function');
      expect(entryPoint.className).toBeUndefined();
      expect(entryPoint.id).toBe('/src/index.ts#main');
    });

    it('should find class method entry point', () => {
      const sourceFile = project.createSourceFile('src/UserService.ts', `
        export class UserService {
          createUser(name: string) {
            return { name };
          }
        }
      `);

      const entryPoint = finder.findEntryPoint('src/UserService.ts#UserService.createUser');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.name).toBe('createUser');
      expect(entryPoint.file).toBe('/src/UserService.ts');
      expect(entryPoint.type).toBe('method');
      expect(entryPoint.className).toBe('UserService');
      expect(entryPoint.isStatic).toBe(false);
      expect(entryPoint.id).toBe('/src/UserService.ts#UserService.createUser');
    });

    it('should find static method entry point', () => {
      const sourceFile = project.createSourceFile('src/Utils.ts', `
        export class Utils {
          static formatDate(date: Date) {
            return date.toISOString();
          }
        }
      `);

      const entryPoint = finder.findEntryPoint('src/Utils.ts#Utils.formatDate');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('method');
      expect(entryPoint.isStatic).toBe(true);
    });

    it('should find constructor entry point', () => {
      const sourceFile = project.createSourceFile('src/Service.ts', `
        export class Service {
          constructor(private name: string) {}
        }
      `);

      const entryPoint = finder.findEntryPoint('src/Service.ts#Service.constructor');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('constructor');
      expect(entryPoint.name).toBe('constructor');
    });

    it('should find arrow function variable', () => {
      const sourceFile = project.createSourceFile('src/utils.ts', `
        export const calculate = (a: number, b: number) => a + b;
      `);

      const entryPoint = finder.findEntryPoint('src/utils.ts#calculate');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('arrow');
      expect(entryPoint.name).toBe('calculate');
    });

    it('should find function expression variable', () => {
      const sourceFile = project.createSourceFile('src/helpers.ts', `
        const helper = function(x: string) {
          return x.toUpperCase();
        };
      `);

      const entryPoint = finder.findEntryPoint('src/helpers.ts#helper');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('expression');
    });

    it('should find getter entry point', () => {
      const sourceFile = project.createSourceFile('src/Model.ts', `
        export class Model {
          private _value = 42;
          
          get value() {
            return this._value;
          }
        }
      `);

      const entryPoint = finder.findEntryPoint('src/Model.ts#Model.value');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('getter');
    });

    it('should find setter entry point', () => {
      const sourceFile = project.createSourceFile('src/Model.ts', `
        export class Model {
          private _value = 0;
          
          set value(val: number) {
            this._value = val;
          }
        }
      `);

      const entryPoint = finder.findEntryPoint('src/Model.ts#Model.value');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('setter');
    });

    it('should find class property with arrow function', () => {
      const sourceFile = project.createSourceFile('src/Component.ts', `
        export class Component {
          handleClick = () => {
            console.log('clicked');
          }
        }
      `);

      const entryPoint = finder.findEntryPoint('src/Component.ts#Component.handleClick');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.type).toBe('arrow');
    });

    it('should handle missing file extensions', () => {
      const sourceFile = project.createSourceFile('src/index.ts', `
        export function main() {}
      `);

      // Should work without .ts extension
      const entryPoint = finder.findEntryPoint('src/index#main');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.file).toBe('/src/index.ts');
    });

    it('should handle tsx files', () => {
      const sourceFile = project.createSourceFile('src/Component.tsx', `
        export function Component() {
          return <div>Hello</div>;
        }
      `);

      // Should find .tsx files when .ts is not found
      const entryPoint = finder.findEntryPoint('src/Component#Component');
      
      expect(entryPoint).toBeDefined();
      expect(entryPoint.file).toBe('/src/Component.tsx');
    });

    it('should handle relative paths', () => {
      const sourceFile = project.createSourceFile('/project/src/deep/nested/file.ts', `
        export function deepFunction() {}
      `);

      // Should find by partial path
      const entryPoint = finder.findEntryPoint('deep/nested/file.ts#deepFunction');
      
      expect(entryPoint).toBeDefined();
    });

    it('should throw on invalid format', () => {
      expect(() => finder.findEntryPoint('invalid-format'))
        .toThrow('Invalid entry point format: invalid-format');

      expect(() => finder.findEntryPoint('file.ts'))
        .toThrow('Invalid entry point format: file.ts');

      expect(() => finder.findEntryPoint('#function'))
        .toThrow('Invalid entry point format: #function');
    });

    it('should throw on invalid class method format', () => {
      const sourceFile = project.createSourceFile('src/file.ts', `
        export class MyClass {
          method() {}
        }
      `);

      expect(() => finder.findEntryPoint('src/file.ts#Class.Method.TooMany'))
        .toThrow('Invalid class method format');
    });

    it('should throw when source file not found', () => {
      expect(() => finder.findEntryPoint('nonexistent.ts#main'))
        .toThrow('Source file not found: nonexistent.ts');
    });

    it('should throw when function not found', () => {
      const sourceFile = project.createSourceFile('src/file.ts', `
        export function other() {}
      `);

      expect(() => finder.findEntryPoint('src/file.ts#missing'))
        .toThrow('Entry point not found: missing in src/file.ts');
    });

    it('should throw when class not found', () => {
      const sourceFile = project.createSourceFile('src/file.ts', `
        export class OtherClass {}
      `);

      expect(() => finder.findEntryPoint('src/file.ts#MissingClass.method'))
        .toThrow('Entry point not found: MissingClass.method in src/file.ts');
    });

    it('should throw when method not found', () => {
      const sourceFile = project.createSourceFile('src/file.ts', `
        export class MyClass {
          otherMethod() {}
        }
      `);

      expect(() => finder.findEntryPoint('src/file.ts#MyClass.missingMethod'))
        .toThrow('Entry point not found: MyClass.missingMethod in src/file.ts');
    });
  });
});