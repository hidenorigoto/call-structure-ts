import { Project, SourceFile } from 'ts-morph';
import { NodeCountVisitor, FunctionNameCollector, MaxDepthVisitor } from '../analyzer/ExampleVisitor';

describe('ASTVisitor Integration Tests', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
      },
    });
  });

  describe('NodeCountVisitor', () => {
    it('should count nodes in simple file', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        function add(a: number, b: number): number {
          return a + b;
        }
        
        const multiply = (x: number, y: number) => x * y;
        
        class Calculator {
          divide(a: number, b: number): number {
            return a / b;
          }
        }
        `
      );

      const visitor = new NodeCountVisitor();
      const count = visitor.visit(sourceFile);

      // Should count function declarations, arrow functions, methods, and call expressions
      expect(count).toBeGreaterThan(0);
    });

    it('should count nested functions', () => {
      const sourceFile = project.createSourceFile(
        'nested.ts',
        `
        function outer() {
          function inner() {
            const arrow = () => {
              console.log('nested');
            };
            arrow();
          }
          inner();
        }
        `
      );

      const visitor = new NodeCountVisitor();
      const count = visitor.visit(sourceFile);

      // Should count: outer function, inner function, arrow function, and 2 call expressions
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('should handle empty file', () => {
      const sourceFile = project.createSourceFile('empty.ts', '');

      const visitor = new NodeCountVisitor();
      const count = visitor.visit(sourceFile);

      expect(count).toBe(0);
    });
  });

  describe('FunctionNameCollector', () => {
    it('should collect function names', () => {
      const sourceFile = project.createSourceFile(
        'functions.ts',
        `
        function processData() {}
        function calculateTotal() {}
        
        class Service {
          async fetchData() {}
          private validateInput() {}
        }
        
        const helper = () => {};
        `
      );

      const visitor = new FunctionNameCollector();
      const names = visitor.visit(sourceFile) || [];

      expect(names).toContain('processData');
      expect(names).toContain('calculateTotal');
      expect(names).toContain('fetchData');
      expect(names).toContain('validateInput');
      expect(names).toContain('arrow-function'); // For the arrow function
    });

    it('should handle anonymous functions', () => {
      const sourceFile = project.createSourceFile(
        'anonymous.ts',
        `
        const arr = [1, 2, 3];
        arr.map(function(x) { return x * 2; });
        arr.filter(() => true);
        
        setTimeout(function() {
          console.log('timeout');
        }, 1000);
        `
      );

      const visitor = new FunctionNameCollector();
      const names = visitor.visit(sourceFile) || [];

      // Should have anonymous functions and arrow functions
      expect(names.filter(n => n === 'anonymous').length).toBeGreaterThan(0);
      expect(names.filter(n => n === 'arrow-function').length).toBeGreaterThan(0);
    });
  });

  describe('MaxDepthVisitor', () => {
    it('should track maximum depth', () => {
      const sourceFile = project.createSourceFile(
        'depth.ts',
        `
        function level1() {
          function level2() {
            function level3() {
              function level4() {
                return 'deep';
              }
              return level4();
            }
            return level3();
          }
          return level2();
        }
        `
      );

      const visitor = new MaxDepthVisitor();
      visitor.visit(sourceFile);

      // Should have significant depth due to nested functions
      expect(visitor.getMaxDepth()).toBeGreaterThan(5);
    });

    it('should handle flat structure', () => {
      const sourceFile = project.createSourceFile(
        'flat.ts',
        `
        function func1() {}
        function func2() {}
        function func3() {}
        `
      );

      const visitor = new MaxDepthVisitor();
      visitor.visit(sourceFile);

      // Flat structure should have lower depth
      expect(visitor.getMaxDepth()).toBeLessThan(10);
    });
  });

  describe('Circular reference handling', () => {
    it('should not get stuck in circular references', () => {
      // Create a more complex structure that might have internal references
      const sourceFile = project.createSourceFile(
        'circular.ts',
        `
        class Node {
          value: number;
          next: Node | null;
          
          constructor(value: number) {
            this.value = value;
            this.next = null;
          }
          
          setNext(node: Node) {
            this.next = node;
          }
        }
        
        function createCircularList() {
          const node1 = new Node(1);
          const node2 = new Node(2);
          node1.setNext(node2);
          node2.setNext(node1); // circular reference
          return node1;
        }
        `
      );

      const visitor = new NodeCountVisitor();
      
      // Should complete without hanging
      expect(() => {
        visitor.visit(sourceFile);
      }).not.toThrow();
    });
  });

  describe('Complex real-world example', () => {
    it('should handle complex TypeScript code', () => {
      const sourceFile = project.createSourceFile(
        'complex.ts',
        `
        import { Injectable } from '@angular/core';
        
        interface User {
          id: number;
          name: string;
          email: string;
        }
        
        @Injectable()
        export class UserService {
          private users: User[] = [];
          
          constructor(private http: HttpClient) {}
          
          async getAllUsers(): Promise<User[]> {
            try {
              const response = await this.http.get<User[]>('/api/users').toPromise();
              this.users = response || [];
              return this.users;
            } catch (error) {
              console.error('Failed to fetch users:', error);
              return [];
            }
          }
          
          findUserById(id: number): User | undefined {
            return this.users.find(user => user.id === id);
          }
          
          updateUser(id: number, updates: Partial<User>): Promise<User> {
            return new Promise((resolve, reject) => {
              const user = this.findUserById(id);
              if (!user) {
                reject(new Error('User not found'));
                return;
              }
              
              Object.assign(user, updates);
              
              this.http.put(\`/api/users/\${id}\`, user).subscribe({
                next: (updated) => resolve(updated),
                error: (error) => reject(error),
              });
            });
          }
        }
        `
      );

      const countVisitor = new NodeCountVisitor();
      const nameVisitor = new FunctionNameCollector();
      const depthVisitor = new MaxDepthVisitor();

      const count = countVisitor.visit(sourceFile);
      const names = nameVisitor.visit(sourceFile) || [];
      depthVisitor.visit(sourceFile);

      // Should handle decorators, async/await, generics, etc.
      expect(count).toBeGreaterThan(10);
      expect(names).toContain('getAllUsers');
      expect(names).toContain('findUserById');
      expect(names).toContain('updateUser');
      expect(depthVisitor.getMaxDepth()).toBeGreaterThan(5);
    });
  });

  describe('Error handling', () => {
    it('should handle syntax errors gracefully', () => {
      // Note: ts-morph will parse this despite syntax errors
      const sourceFile = project.createSourceFile(
        'error.ts',
        `
        function broken( {
          // Missing closing parenthesis
          return 'error';
        }
        
        function valid() {
          return 'ok';
        }
        `,
        { overwrite: true }
      );

      const visitor = new FunctionNameCollector();
      
      // Should not throw, but might not collect all names
      expect(() => {
        visitor.visit(sourceFile);
      }).not.toThrow();
    });
  });
});