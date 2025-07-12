import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { EntryPointAnalyzer } from '../../src/analyzer/EntryPointAnalyzer';
import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { YamlFormatter } from '../../src/formatter/YamlFormatter';
import { MermaidFormatter } from '../../src/formatter/MermaidFormatter';
import { ProjectContext } from '../../src/types/CallGraph';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('End-to-End Integration Tests', () => {
  let testProjectPath: string;
  let context: ProjectContext;

  beforeAll(() => {
    // Create a comprehensive test project
    testProjectPath = path.join(__dirname, '../fixtures/e2e-project');
    setupE2ETestProject();
    
    context = {
      rootPath: testProjectPath,
      tsConfigPath: path.join(testProjectPath, 'tsconfig.json'),
      sourcePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules/**', '**/*.test.ts']
    };
  });

  afterAll(() => {
    // Clean up test project
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('Real-world TypeScript Project Analysis', () => {
    it('should analyze a complete user service flow', async () => {
      const analyzer = new CallGraphAnalyzer(context, { maxDepth: 10 });
      const result = await analyzer.analyzeFromEntryPoint('src/controllers/UserController.ts#UserController.createUser');
      
      // Verify the call chain: controller -> service -> repository -> database
      expect(result.nodes.length).toBeGreaterThan(4);
      expect(result.edges.length).toBeGreaterThan(3);
      
      // Check for expected nodes
      const nodeNames = result.nodes.map(n => n.name);
      expect(nodeNames).toContain('createUser'); // controller method
      expect(nodeNames).toContain('createUser'); // service method (might be duplicate name)
      expect(nodeNames).toContain('save'); // repository method
      expect(nodeNames).toContain('validate'); // validation function
      
      // Check for async patterns
      const asyncEdges = result.edges.filter(e => e.type === 'async');
      expect(asyncEdges.length).toBeGreaterThan(0);
    });

    it('should handle complex class hierarchies', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/services/BaseService.ts#BaseService.process');
      
      // Should include both base class and derived class methods
      const methodNodes = result.nodes.filter(n => n.type === 'method');
      expect(methodNodes.length).toBeGreaterThan(2);
      
      // Check inheritance patterns
      const classNames = new Set(result.nodes.map(n => n.className).filter(Boolean));
      expect(classNames.size).toBeGreaterThan(1);
    });

    it('should trace middleware chain', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/middleware/auth.ts#authenticate');
      
      // Should follow middleware chain
      expect(result.edges.length).toBeGreaterThan(2);
      
      // Check for callback patterns
      const callbackEdges = result.edges.filter(e => e.type === 'callback');
      expect(callbackEdges.length).toBeGreaterThan(0);
    });
  });

  describe('Entry Point Discovery', () => {
    it('should discover all potential entry points', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      const entryPoints = await analyzer.discoverEntryPoints();
      
      expect(entryPoints.length).toBeGreaterThan(10);
      
      // Should find controllers
      const controllerEntryPoints = entryPoints.filter(ep => 
        ep.className && ep.className.includes('Controller')
      );
      expect(controllerEntryPoints.length).toBeGreaterThan(0);
      
      // Should find exported functions
      const exportedFunctions = entryPoints.filter(ep => ep.exportName);
      expect(exportedFunctions.length).toBeGreaterThan(0);
    });

    it('should find common entry point patterns', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      const commonEntryPoints = await analyzer.findCommonEntryPoints();
      
      expect(commonEntryPoints.controllers.length).toBeGreaterThan(0);
      expect(commonEntryPoints.handlers.length).toBeGreaterThan(0);
      expect(commonEntryPoints.mainFunctions.length).toBeGreaterThan(0);
    });
  });

  describe('Output Format Integration', () => {
    let callGraph: any;

    beforeAll(async () => {
      const analyzer = new CallGraphAnalyzer(context);
      callGraph = await analyzer.analyzeFromEntryPoint('src/api/index.ts#startServer');
    });

    it('should generate valid JSON output', () => {
      const formatter = new JsonFormatter();
      const output = formatter.format(callGraph, { 
        format: 'json', 
        includeMetrics: true 
      });
      
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
      
      const parsed = JSON.parse(output);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
      expect(parsed.statistics).toBeDefined();
    });

    it('should generate valid YAML output', () => {
      const formatter = new YamlFormatter();
      const output = formatter.format(callGraph);
      
      // Should be valid YAML
      const yaml = require('js-yaml');
      expect(() => yaml.load(output)).not.toThrow();
      
      const parsed = yaml.load(output);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.functions).toBeDefined();
      expect(parsed.calls).toBeDefined();
    });

    it('should generate valid Mermaid diagram', () => {
      const formatter = new MermaidFormatter();
      const output = formatter.format(callGraph);
      
      expect(output).toContain('flowchart TD');
      expect(output).toContain('-->');
      expect(output).toContain('classDef');
      
      const validation = formatter.validate(output);
      expect(validation.isValid).toBe(true);
    });

    it('should generate different Mermaid variants', () => {
      const formatter = new MermaidFormatter();
      
      const flowchart = formatter.format(callGraph);
      const subgraphs = formatter.formatWithSubgraphs(callGraph);
      const sequence = formatter.formatAsSequenceDiagram(callGraph);
      
      expect(flowchart).toContain('flowchart TD');
      expect(subgraphs).toContain('subgraph');
      expect(sequence).toContain('sequenceDiagram');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large call graphs efficiently', async () => {
      const analyzer = new CallGraphAnalyzer(context, { maxDepth: 8 });
      
      const startTime = Date.now();
      const result = await analyzer.analyzeFromEntryPoint('src/api/index.ts#startServer');
      const analysisTime = Date.now() - startTime;
      
      // Should complete within reasonable time (5 seconds)
      expect(analysisTime).toBeLessThan(5000);
      
      // Should handle reasonable complexity
      expect(result.nodes.length).toBeGreaterThan(5);
      expect(result.edges.length).toBeGreaterThan(5);
    });

    it('should respect depth limits', async () => {
      const shallowAnalyzer = new CallGraphAnalyzer(context, { maxDepth: 2 });
      const deepAnalyzer = new CallGraphAnalyzer(context, { maxDepth: 8 });
      
      const shallowResult = await shallowAnalyzer.analyzeFromEntryPoint('src/api/index.ts#startServer');
      const deepResult = await deepAnalyzer.analyzeFromEntryPoint('src/api/index.ts#startServer');
      
      expect(shallowResult.nodes.length).toBeLessThan(deepResult.nodes.length);
      expect(shallowResult.edges.length).toBeLessThan(deepResult.edges.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('src/nonexistent.ts#main'))
        .rejects.toThrow('Source file not found');
    });

    it('should handle invalid function names', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('src/api/index.ts#nonexistentFunction'))
        .rejects.toThrow('Entry point not found');
    });

    it('should handle malformed entry point strings', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('invalid-format'))
        .rejects.toThrow('Invalid entry point format');
        
      await expect(analyzer.analyzeFromEntryPoint('src/api/index.ts'))
        .rejects.toThrow('Invalid entry point format');
    });
  });
});

function setupE2ETestProject(): void {
  const testProjectPath = path.join(__dirname, '../fixtures/e2e-project');
  
  // Create directory structure
  fs.mkdirSync(path.join(testProjectPath, 'src/controllers'), { recursive: true });
  fs.mkdirSync(path.join(testProjectPath, 'src/services'), { recursive: true });
  fs.mkdirSync(path.join(testProjectPath, 'src/repositories'), { recursive: true });
  fs.mkdirSync(path.join(testProjectPath, 'src/middleware'), { recursive: true });
  fs.mkdirSync(path.join(testProjectPath, 'src/api'), { recursive: true });
  fs.mkdirSync(path.join(testProjectPath, 'src/types'), { recursive: true });

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      strict: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true
    },
    include: ['src/**/*']
  };
  fs.writeFileSync(
    path.join(testProjectPath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // Create type definitions
  fs.writeFileSync(
    path.join(testProjectPath, 'src/types/User.ts'),
    `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}
`
  );

  // Create UserController
  fs.writeFileSync(
    path.join(testProjectPath, 'src/controllers/UserController.ts'),
    `
import { UserService } from '../services/UserService';
import { CreateUserRequest, User } from '../types/User';

export class UserController {
  constructor(private userService: UserService) {}

  async createUser(request: CreateUserRequest): Promise<User> {
    await this.validate(request);
    return await this.userService.createUser(request);
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.userService.findById(id);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return await this.userService.updateUser(id, updates);
  }

  private async validate(request: CreateUserRequest): Promise<void> {
    if (!request.email || !request.name) {
      throw new Error('Invalid request');
    }
  }
}
`
  );

  // Create UserService
  fs.writeFileSync(
    path.join(testProjectPath, 'src/services/UserService.ts'),
    `
import { BaseService } from './BaseService';
import { UserRepository } from '../repositories/UserRepository';
import { CreateUserRequest, User } from '../types/User';

export class UserService extends BaseService<User> {
  constructor(private userRepository: UserRepository) {
    super();
  }

  async createUser(request: CreateUserRequest): Promise<User> {
    await this.validateRequest(request);
    
    const user: User = {
      id: this.generateId(),
      name: request.name,
      email: request.email,
      createdAt: new Date()
    };

    await this.userRepository.save(user);
    await this.notifyCreation(user);
    
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    const updatedUser = { ...user, ...updates };
    await this.userRepository.save(updatedUser);
    
    return updatedUser;
  }

  private async validateRequest(request: CreateUserRequest): Promise<void> {
    if (!request.email.includes('@')) {
      throw new Error('Invalid email format');
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async notifyCreation(user: User): Promise<void> {
    // Notification logic
    console.log('User created:', user.id);
  }
}
`
  );

  // Create BaseService
  fs.writeFileSync(
    path.join(testProjectPath, 'src/services/BaseService.ts'),
    `
export abstract class BaseService<T> {
  protected logLevel: string = 'info';

  async process(data: T): Promise<T> {
    await this.beforeProcess(data);
    const result = await this.doProcess(data);
    await this.afterProcess(result);
    return result;
  }

  protected async beforeProcess(data: T): Promise<void> {
    this.log('Processing started');
  }

  protected async doProcess(data: T): Promise<T> {
    // Default implementation - subclasses can override
    return data;
  }

  protected async afterProcess(data: T): Promise<void> {
    this.log('Processing completed');
  }

  protected log(message: string): void {
    console.log(\`[\${this.constructor.name}] \${message}\`);
  }
}
`
  );

  // Create UserRepository
  fs.writeFileSync(
    path.join(testProjectPath, 'src/repositories/UserRepository.ts'),
    `
import { User } from '../types/User';

export class UserRepository {
  private database: Map<string, User> = new Map();

  async save(user: User): Promise<void> {
    await this.connect();
    this.database.set(user.id, user);
    await this.disconnect();
  }

  async findById(id: string): Promise<User | null> {
    await this.connect();
    const user = this.database.get(id) || null;
    await this.disconnect();
    return user;
  }

  async findAll(): Promise<User[]> {
    await this.connect();
    const users = Array.from(this.database.values());
    await this.disconnect();
    return users;
  }

  private async connect(): Promise<void> {
    // Database connection logic
    await this.delay(10);
  }

  private async disconnect(): Promise<void> {
    // Database disconnection logic
    await this.delay(5);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
`
  );

  // Create middleware
  fs.writeFileSync(
    path.join(testProjectPath, 'src/middleware/auth.ts'),
    `
export async function authenticate(request: any, response: any, next: Function): Promise<void> {
  try {
    const token = extractToken(request);
    const user = await validateToken(token);
    
    if (user) {
      request.user = user;
      next();
    } else {
      response.status(401).send('Unauthorized');
    }
  } catch (error) {
    handleError(error, response);
  }
}

function extractToken(request: any): string | null {
  const header = request.headers.authorization;
  return header ? header.replace('Bearer ', '') : null;
}

async function validateToken(token: string | null): Promise<any> {
  if (!token) return null;
  
  // Token validation logic
  await delay(50);
  return { id: '123', name: 'Test User' };
}

function handleError(error: any, response: any): void {
  console.error('Auth error:', error);
  response.status(500).send('Internal Server Error');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
`
  );

  // Create API entry point
  fs.writeFileSync(
    path.join(testProjectPath, 'src/api/index.ts'),
    `
import { UserController } from '../controllers/UserController';
import { UserService } from '../services/UserService';
import { UserRepository } from '../repositories/UserRepository';
import { authenticate } from '../middleware/auth';

export async function startServer(): Promise<void> {
  await initializeDatabase();
  await setupMiddleware();
  await startHttpServer();
}

async function initializeDatabase(): Promise<void> {
  const repository = new UserRepository();
  await setupServices(repository);
}

async function setupServices(repository: UserRepository): Promise<void> {
  const userService = new UserService(repository);
  await setupControllers(userService);
}

async function setupControllers(userService: UserService): Promise<void> {
  const userController = new UserController(userService);
  await registerRoutes(userController);
}

async function setupMiddleware(): Promise<void> {
  // Middleware setup
  console.log('Setting up middleware');
}

async function registerRoutes(userController: UserController): Promise<void> {
  // Route registration
  console.log('Registering routes');
}

async function startHttpServer(): Promise<void> {
  console.log('Server started on port 3000');
}

export function healthCheck(): string {
  return 'OK';
}

export async function shutdown(): Promise<void> {
  console.log('Shutting down server');
}
`
  );
}