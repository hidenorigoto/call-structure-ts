import { Project } from 'ts-morph';
import { FunctionAnalyzer } from '../../src/analyzer/FunctionAnalyzer';

describe('FunctionAnalyzer Integration Tests', () => {
  let analyzer: FunctionAnalyzer;
  let project: Project;

  beforeEach(() => {
    analyzer = new FunctionAnalyzer();
    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
        strict: true,
      },
    });
  });

  describe('Real-world code patterns', () => {
    it('should analyze a complete service class', () => {
      const sourceFile = project.createSourceFile(
        'user-service.ts',
        `
        import { Injectable } from '@angular/core';
        import { HttpClient } from '@angular/common/http';
        import { Observable } from 'rxjs';

        interface User {
          id: number;
          name: string;
          email: string;
        }

        @Injectable()
        export class UserService {
          constructor(private http: HttpClient) {}

          async getAllUsers(): Promise<User[]> {
            try {
              const response = await this.http.get<User[]>('/api/users').toPromise();
              return response || [];
            } catch (error) {
              console.error('Failed to fetch users:', error);
              return [];
            }
          }

          findUserById(id: number): Observable<User> {
            return this.http.get<User>(\`/api/users/\${id}\`);
          }

          private validateUser(user: Partial<User>): boolean {
            return !!(user.name && user.email);
          }

          createUser(userData: Partial<User>): Promise<User> {
            return new Promise((resolve, reject) => {
              if (!this.validateUser(userData)) {
                reject(new Error('Invalid user data'));
                return;
              }

              this.http.post<User>('/api/users', userData).subscribe({
                next: (user) => resolve(user),
                error: (error) => reject(error),
              });
            });
          }

          static getInstance(): UserService {
            return new UserService({} as HttpClient);
          }
        }
        `
      );

      const functions = analyzer.analyzeSourceFile(sourceFile);

      // Should find all methods
      expect(functions.length).toBeGreaterThanOrEqual(5);

      // Check specific methods
      const getAllUsers = functions.find(f => f.name === 'getAllUsers');
      const findUserById = functions.find(f => f.name === 'findUserById');
      const validateUser = functions.find(f => f.name === 'validateUser');
      const createUser = functions.find(f => f.name === 'createUser');
      const getInstance = functions.find(f => f.name === 'getInstance');

      expect(getAllUsers).toBeDefined();
      expect(getAllUsers!.async).toBe(true);
      expect(getAllUsers!.type).toBe('method');
      expect(getAllUsers!.className).toBe('UserService');

      expect(findUserById).toBeDefined();
      expect(findUserById!.parameters).toHaveLength(1);
      expect(findUserById!.parameters[0].name).toBe('id');

      expect(validateUser).toBeDefined();
      expect(validateUser!.visibility).toBe('private');

      expect(createUser).toBeDefined();
      expect(createUser!.parameters).toHaveLength(1);

      expect(getInstance).toBeDefined();
      expect(getInstance!.static).toBe(true);
    });

    it('should analyze utility functions and helpers', () => {
      const sourceFile = project.createSourceFile(
        'utils.ts',
        `
        // String utilities
        export function capitalize(str: string): string {
          return str.charAt(0).toUpperCase() + str.slice(1);
        }

        export function camelCase(str: string): string {
          return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
        }

        // Array utilities
        export function chunk<T>(array: T[], size: number): T[][] {
          const chunks: T[][] = [];
          for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
          }
          return chunks;
        }

        export const debounce = <T extends (...args: any[]) => any>(
          func: T,
          wait: number
        ): ((...args: Parameters<T>) => void) => {
          let timeoutId: NodeJS.Timeout;
          return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), wait);
          };
        };

        // Async utilities
        export async function retry<T>(
          fn: () => Promise<T>,
          maxAttempts: number = 3,
          delay: number = 1000
        ): Promise<T> {
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              return await fn();
            } catch (error) {
              if (attempt === maxAttempts) {
                throw error;
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          throw new Error('Max attempts reached');
        }

        // Higher-order function
        export function memoize<T extends (...args: any[]) => any>(fn: T): T {
          const cache = new Map();
          return ((...args: any[]) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) {
              return cache.get(key);
            }
            const result = fn(...args);
            cache.set(key, result);
            return result;
          }) as T;
        }
        `
      );

      const functions = analyzer.analyzeSourceFile(sourceFile);

      // Should find all exported functions and arrow functions
      expect(functions.length).toBeGreaterThanOrEqual(6);

      // Check regular functions
      const capitalize = functions.find(f => f.name === 'capitalize');
      const chunk = functions.find(f => f.name === 'chunk');
      const retry = functions.find(f => f.name === 'retry');
      const memoize = functions.find(f => f.name === 'memoize');

      expect(capitalize).toBeDefined();
      expect(capitalize!.type).toBe('function');

      expect(chunk).toBeDefined();
      expect(chunk!.parameters).toHaveLength(2);

      expect(retry).toBeDefined();
      expect(retry!.async).toBe(true);
      expect(retry!.parameters).toHaveLength(3);

      expect(memoize).toBeDefined();

      // Check arrow functions
      const arrowFunctions = functions.filter(f => f.type === 'arrow');
      expect(arrowFunctions.length).toBeGreaterThan(0);
    });

    it('should analyze React component with hooks', () => {
      const sourceFile = project.createSourceFile(
        'user-profile.tsx',
        `
        import React, { useState, useEffect, useCallback, useMemo } from 'react';

        interface User {
          id: number;
          name: string;
          email: string;
        }

        interface UserProfileProps {
          userId: number;
          onUserUpdate?: (user: User) => void;
        }

        export function UserProfile({ userId, onUserUpdate }: UserProfileProps) {
          const [user, setUser] = useState<User | null>(null);
          const [loading, setLoading] = useState(true);
          const [error, setError] = useState<string | null>(null);

          const fetchUser = useCallback(async (id: number) => {
            try {
              setLoading(true);
              const response = await fetch(\`/api/users/\${id}\`);
              if (!response.ok) {
                throw new Error('User not found');
              }
              const userData = await response.json();
              setUser(userData);
              onUserUpdate?.(userData);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setLoading(false);
            }
          }, [onUserUpdate]);

          useEffect(() => {
            fetchUser(userId);
          }, [userId, fetchUser]);

          const handleUpdateProfile = useCallback(async (updates: Partial<User>) => {
            if (!user) return;

            try {
              const response = await fetch(\`/api/users/\${user.id}\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...user, ...updates }),
              });
              
              if (!response.ok) {
                throw new Error('Failed to update user');
              }
              
              const updatedUser = await response.json();
              setUser(updatedUser);
              onUserUpdate?.(updatedUser);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Update failed');
            }
          }, [user, onUserUpdate]);

          const displayName = useMemo(() => {
            return user ? \`\${user.name} (\${user.email})\` : 'Loading...';
          }, [user]);

          if (loading) return <div>Loading...</div>;
          if (error) return <div>Error: {error}</div>;
          if (!user) return <div>User not found</div>;

          return (
            <div>
              <h1>{displayName}</h1>
              <button onClick={() => handleUpdateProfile({ name: 'Updated Name' })}>
                Update Name
              </button>
            </div>
          );
        }

        export default UserProfile;
        `
      );

      const functions = analyzer.analyzeSourceFile(sourceFile);

      // Should find the main component function and arrow functions
      expect(functions.length).toBeGreaterThan(0);

      const userProfileComponent = functions.find(f => f.name === 'UserProfile');
      expect(userProfileComponent).toBeDefined();
      expect(userProfileComponent!.type).toBe('function');
      expect(userProfileComponent!.parameters).toHaveLength(1);

      // Should find arrow functions used in hooks
      const arrowFunctions = functions.filter(f => f.type === 'arrow');
      expect(arrowFunctions.length).toBeGreaterThan(0);
    });

    it('should analyze Node.js Express server', () => {
      const sourceFile = project.createSourceFile(
        'server.ts',
        `
        import express, { Request, Response, NextFunction } from 'express';
        import cors from 'cors';

        const app = express();
        const PORT = process.env.PORT || 3000;

        // Middleware
        app.use(cors());
        app.use(express.json());

        // Logging middleware
        const logRequest = (req: Request, res: Response, next: NextFunction): void => {
          console.log(\`\${req.method} \${req.path} - \${new Date().toISOString()}\`);
          next();
        };

        app.use(logRequest);

        // Route handlers
        app.get('/health', (req: Request, res: Response) => {
          res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });

        app.get('/api/users', async (req: Request, res: Response) => {
          try {
            // Simulate database call
            const users = await getUsersFromDatabase();
            res.json(users);
          } catch (error) {
            res.status(500).json({ error: 'Failed to fetch users' });
          }
        });

        app.post('/api/users', async (req: Request, res: Response) => {
          try {
            const { name, email } = req.body;
            
            if (!name || !email) {
              return res.status(400).json({ error: 'Name and email are required' });
            }

            const newUser = await createUser({ name, email });
            res.status(201).json(newUser);
          } catch (error) {
            res.status(500).json({ error: 'Failed to create user' });
          }
        });

        // Error handling middleware
        app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
          console.error('Error:', error);
          res.status(500).json({ error: 'Internal server error' });
        });

        // Helper functions
        async function getUsersFromDatabase(): Promise<any[]> {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 100);
          });
        }

        async function createUser(userData: { name: string; email: string }): Promise<any> {
          return new Promise(resolve => {
            setTimeout(() => resolve({ id: Date.now(), ...userData }), 100);
          });
        }

        function startServer(): void {
          app.listen(PORT, () => {
            console.log(\`Server running on port \${PORT}\`);
          });
        }

        // Start the server
        if (require.main === module) {
          startServer();
        }

        export { app, startServer };
        `
      );

      const functions = analyzer.analyzeSourceFile(sourceFile);

      // Should find various function types
      expect(functions.length).toBeGreaterThan(0);

      // Check helper functions
      const getUsersFromDatabase = functions.find(f => f.name === 'getUsersFromDatabase');
      const createUser = functions.find(f => f.name === 'createUser');
      const startServer = functions.find(f => f.name === 'startServer');

      expect(getUsersFromDatabase).toBeDefined();
      expect(getUsersFromDatabase!.async).toBe(true);

      expect(createUser).toBeDefined();
      expect(createUser!.async).toBe(true);
      expect(createUser!.parameters).toHaveLength(1);

      expect(startServer).toBeDefined();
      expect(startServer!.async).toBe(false);

      // Should find arrow functions used as middleware and route handlers
      const arrowFunctions = functions.filter(f => f.type === 'arrow');
      expect(arrowFunctions.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases with real code', () => {
    it('should handle complex generic constraints', () => {
      const sourceFile = project.createSourceFile(
        'generics.ts',
        `
        interface Serializable {
          serialize(): string;
        }

        interface Repository<T extends Serializable> {
          save(item: T): Promise<T>;
          findById(id: string): Promise<T | null>;
        }

        class BaseEntity implements Serializable {
          constructor(public id: string) {}
          
          serialize(): string {
            return JSON.stringify(this);
          }
        }

        function createRepository<T extends BaseEntity>(
          entityClass: new (id: string) => T
        ): Repository<T> {
          return {
            async save(item: T): Promise<T> {
              // Save logic here
              return item;
            },
            
            async findById(id: string): Promise<T | null> {
              // Find logic here
              return new entityClass(id);
            }
          };
        }

        async function processEntities<T extends BaseEntity>(
          entities: T[],
          processor: (entity: T) => Promise<void>
        ): Promise<void> {
          for (const entity of entities) {
            await processor(entity);
          }
        }
        `
      );

      const functions = analyzer.analyzeSourceFile(sourceFile);

      expect(functions.length).toBeGreaterThan(0);

      const createRepository = functions.find(f => f.name === 'createRepository');
      const processEntities = functions.find(f => f.name === 'processEntities');
      const serialize = functions.find(f => f.name === 'serialize');

      expect(createRepository).toBeDefined();
      expect(processEntities).toBeDefined();
      expect(processEntities!.async).toBe(true);
      expect(serialize).toBeDefined();
    });

    it('should handle decorators and metadata', () => {
      const sourceFile = project.createSourceFile(
        'decorators.ts',
        `
        function Controller(path: string) {
          return function (target: any) {
            target.prototype.basePath = path;
          };
        }

        function Get(path: string) {
          return function (target: any, propertyKey: string) {
            // Decorator logic
          };
        }

        function Inject(token: string) {
          return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
            // Dependency injection logic
          };
        }

        @Controller('/api/users')
        class UserController {
          constructor(@Inject('UserService') private userService: any) {}

          @Get('/')
          async getAllUsers(): Promise<any[]> {
            return this.userService.findAll();
          }

          @Get('/:id')
          async getUserById(id: string): Promise<any> {
            return this.userService.findById(id);
          }
        }
        `
      );

      const functions = analyzer.analyzeSourceFile(sourceFile);

      expect(functions.length).toBeGreaterThan(0);

      // Check decorator functions
      const controller = functions.find(f => f.name === 'Controller');
      const get = functions.find(f => f.name === 'Get');
      const inject = functions.find(f => f.name === 'Inject');

      expect(controller).toBeDefined();
      expect(get).toBeDefined();
      expect(inject).toBeDefined();

      // Check decorated methods
      const getAllUsers = functions.find(f => f.name === 'getAllUsers');
      const getUserById = functions.find(f => f.name === 'getUserById');

      expect(getAllUsers).toBeDefined();
      expect(getAllUsers!.async).toBe(true);
      expect(getUserById).toBeDefined();
      expect(getUserById!.parameters).toHaveLength(1);
    });
  });
});