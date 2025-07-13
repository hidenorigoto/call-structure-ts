import { Project } from 'ts-morph';
import { CallExpressionAnalyzer } from '../../src/analyzer/CallExpressionAnalyzer';
import { FunctionAnalyzer } from '../../src/analyzer/FunctionAnalyzer';
import { CallGraphEdge, CallGraphNode } from '../../src/types';

describe('CallExpressionAnalyzer Integration', () => {
  let callAnalyzer: CallExpressionAnalyzer;
  let functionAnalyzer: FunctionAnalyzer;
  let project: Project;

  beforeEach(() => {
    callAnalyzer = new CallExpressionAnalyzer();
    functionAnalyzer = new FunctionAnalyzer();
    project = new Project({ 
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 2, // ES2015
        module: 1, // CommonJS
        lib: ['es2015'],
      },
    });
  });

  describe('service class pattern', () => {
    it('should analyze service class with dependency injection', () => {
      const sourceFile = project.createSourceFile('UserService.ts', `
        export class Logger {
          log(message: string): void {
            console.log(message);
          }
          
          error(message: string): void {
            console.error(message);
          }
        }
        
        export class Database {
          async query(sql: string): Promise<any[]> {
            return [];
          }
          
          async execute(sql: string): Promise<void> {
            // execute query
          }
        }
        
        export class UserService {
          constructor(
            private logger: Logger,
            private db: Database
          ) {}
          
          async getUser(id: string): Promise<User | null> {
            this.logger.log(\`Fetching user \${id}\`);
            
            try {
              const results = await this.db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);
              return results[0] || null;
            } catch (error) {
              this.logger.error(\`Failed to fetch user: \${error}\`);
              throw error;
            }
          }
          
          async createUser(user: User): Promise<void> {
            this.logger.log(\`Creating user \${user.name}\`);
            await this.db.execute(\`INSERT INTO users VALUES (...)\`);
          }
        }
        
        interface User {
          id: string;
          name: string;
        }
      `);

      // First analyze functions to get node IDs
      const functions = functionAnalyzer.analyzeSourceFile(sourceFile);
      
      // Find the getUser method
      const getUserNode = functions.find(f => f.name === 'getUser');
      expect(getUserNode).toBeDefined();
      
      // Analyze calls from getUser
      const edges = callAnalyzer.analyzeSourceFile(sourceFile, getUserNode!.id);
      
      // Should find logger.log, db.query, logger.error calls
      const logCalls = edges.filter(e => e.target.includes('Logger.log'));
      const queryCalls = edges.filter(e => e.target.includes('Database.query'));
      const errorCalls = edges.filter(e => e.target.includes('Logger.error'));
      
      expect(logCalls.length).toBeGreaterThanOrEqual(1);
      expect(queryCalls.length).toBe(1);
      expect(errorCalls.length).toBe(1);
      
      // Query call should be async
      expect(queryCalls[0].type).toBe('async');
    });
  });

  describe('React component pattern', () => {
    it('should analyze React functional component with hooks', () => {
      const sourceFile = project.createSourceFile('TodoList.tsx', `
        import React, { useState, useEffect, useCallback } from 'react';
        
        interface Todo {
          id: string;
          text: string;
          done: boolean;
        }
        
        async function fetchTodos(): Promise<Todo[]> {
          const response = await fetch('/api/todos');
          return response.json();
        }
        
        function saveTodo(todo: Todo): Promise<void> {
          return fetch('/api/todos', {
            method: 'POST',
            body: JSON.stringify(todo)
          }).then(() => {});
        }
        
        export function TodoList() {
          const [todos, setTodos] = useState<Todo[]>([]);
          const [loading, setLoading] = useState(true);
          
          useEffect(() => {
            loadTodos();
          }, []);
          
          const loadTodos = useCallback(async () => {
            setLoading(true);
            try {
              const data = await fetchTodos();
              setTodos(data);
            } finally {
              setLoading(false);
            }
          }, []);
          
          const addTodo = useCallback(async (text: string) => {
            const newTodo: Todo = {
              id: Date.now().toString(),
              text,
              done: false
            };
            
            await saveTodo(newTodo);
            await loadTodos();
          }, [loadTodos]);
          
          return null; // JSX omitted for brevity
        }
      `);

      const functions = functionAnalyzer.analyzeSourceFile(sourceFile);
      
      // Find TodoList component
      const todoListNode = functions.find(f => f.name === 'TodoList');
      expect(todoListNode).toBeDefined();
      
      // Analyze calls from TodoList
      const todoListFunc = sourceFile.getFunction('TodoList');
      expect(todoListFunc).toBeDefined();
      const edges = callAnalyzer.analyzeNode(todoListFunc!, todoListNode!.id);
      
      // Should find internal function calls (not React hooks which are imported)
      const loadTodosCalls = edges.filter(e => e.target.includes('loadTodos'));
      const fetchTodosCalls = edges.filter(e => e.target.includes('fetchTodos'));
      const saveTodoCalls = edges.filter(e => e.target.includes('saveTodo'));
      
      // loadTodos is called in useEffect and in addTodo
      expect(loadTodosCalls.length).toBe(2);
      // fetchTodos is called in loadTodos callback
      expect(fetchTodosCalls.length).toBe(1);
      // saveTodo is called in addTodo callback
      expect(saveTodoCalls.length).toBe(1);
      
      // Note: setLoading and setTodos are from useState and won't be resolved as they're not declared functions
    });
  });

  describe('Express server pattern', () => {
    it('should analyze Express route handlers', () => {
      const sourceFile = project.createSourceFile('server.ts', `
        import express from 'express';
        import { authenticate } from './auth';
        import { validateRequest } from './validation';
        
        const app = express();
        
        function logRequest(req: any, res: any, next: any) {
          console.log(\`\${req.method} \${req.path}\`);
          next();
        }
        
        async function handleGetUsers(req: any, res: any) {
          try {
            const users = await getUsersFromDB();
            res.json(users);
          } catch (error) {
            res.status(500).json({ error: 'Internal error' });
          }
        }
        
        async function handleCreateUser(req: any, res: any) {
          const validation = validateRequest(req.body);
          if (!validation.valid) {
            return res.status(400).json({ errors: validation.errors });
          }
          
          const user = await createUserInDB(req.body);
          res.status(201).json(user);
        }
        
        async function getUsersFromDB() {
          // Mock implementation
          return [];
        }
        
        async function createUserInDB(data: any) {
          // Mock implementation
          return { id: '1', ...data };
        }
        
        // Route setup
        app.use(logRequest);
        app.use(authenticate);
        
        app.get('/users', handleGetUsers);
        app.post('/users', validateRequest, handleCreateUser);
        
        app.listen(3000);
      `);

      const functions = functionAnalyzer.analyzeSourceFile(sourceFile);
      
      // Analyze handleGetUsers
      const handleGetUsersNode = functions.find(f => f.name === 'handleGetUsers');
      expect(handleGetUsersNode).toBeDefined();
      
      const handleGetUsersFunc = sourceFile.getFunction('handleGetUsers');
      const getUsersEdges = callAnalyzer.analyzeNode(handleGetUsersFunc!, handleGetUsersNode!.id);
      
      // Should find getUsersFromDB, res.json, res.status calls
      const dbCall = getUsersEdges.find(e => e.target.includes('#getUsersFromDB'));
      expect(dbCall).toBeDefined();
      expect(dbCall!.type).toBe('async');
      
      // Analyze handleCreateUser
      const handleCreateUserNode = functions.find(f => f.name === 'handleCreateUser');
      const handleCreateUserFunc = sourceFile.getFunction('handleCreateUser');
      const createUserEdges = callAnalyzer.analyzeNode(handleCreateUserFunc!, handleCreateUserNode!.id);
      
      // Should find createUserInDB call (validateRequest is imported so won't be resolved)
      const createCall = createUserEdges.find(e => e.target.includes('#createUserInDB'));
      
      expect(createCall).toBeDefined();
      expect(createCall!.type).toBe('async');
      
      // Note: validateRequest is imported from another module, so it won't be resolved
    });
  });

  describe('event emitter pattern', () => {
    it('should analyze event-driven architecture', () => {
      const sourceFile = project.createSourceFile('EventSystem.ts', `
        import { EventEmitter } from 'events';
        
        export class OrderService extends EventEmitter {
          async createOrder(items: any[]): Promise<string> {
            const orderId = this.generateOrderId();
            
            // Process order
            await this.validateItems(items);
            await this.calculatePricing(items);
            
            // Emit events
            this.emit('orderCreated', { orderId, items });
            
            // Trigger async workflows
            this.processPayment(orderId).catch(err => {
              this.emit('paymentFailed', { orderId, error: err });
            });
            
            this.scheduleShipping(orderId).then(() => {
              this.emit('shippingScheduled', { orderId });
            });
            
            return orderId;
          }
          
          private generateOrderId(): string {
            return Date.now().toString();
          }
          
          private async validateItems(items: any[]): Promise<void> {
            // Validation logic
          }
          
          private async calculatePricing(items: any[]): Promise<number> {
            return items.reduce((sum, item) => sum + item.price, 0);
          }
          
          private async processPayment(orderId: string): Promise<void> {
            // Payment processing
          }
          
          private async scheduleShipping(orderId: string): Promise<void> {
            // Shipping logic
          }
        }
      `);

      const functions = functionAnalyzer.analyzeSourceFile(sourceFile);
      const createOrderNode = functions.find(f => f.name === 'createOrder');
      expect(createOrderNode).toBeDefined();
      
      const createOrderMethod = sourceFile.getClasses()[0].getMethod('createOrder');
      const edges = callAnalyzer.analyzeNode(createOrderMethod!, createOrderNode!.id);
      
      // Should find various method calls
      const generateCall = edges.find(e => e.target.includes('generateOrderId'));
      const validateCall = edges.find(e => e.target.includes('validateItems'));
      const calculateCall = edges.find(e => e.target.includes('calculatePricing'));
      const processPaymentCall = edges.find(e => e.target.includes('processPayment'));
      const scheduleShippingCall = edges.find(e => e.target.includes('scheduleShipping'));
      
      expect(generateCall).toBeDefined();
      expect(validateCall).toBeDefined();
      expect(calculateCall).toBeDefined();
      expect(processPaymentCall).toBeDefined();
      expect(scheduleShippingCall).toBeDefined();
      
      // Async calls
      expect(validateCall!.type).toBe('async');
      expect(calculateCall!.type).toBe('async');
      
      // Note: emit calls won't be resolved as emit is inherited from EventEmitter
      // We should find other method calls like processPayment, scheduleShipping
      const processPaymentCalls = edges.filter(e => e.target.includes('processPayment'));
      const scheduleShippingCalls = edges.filter(e => e.target.includes('scheduleShipping'));
      
      expect(processPaymentCalls.length).toBe(1);
      expect(scheduleShippingCalls.length).toBe(1);
    });
  });

  describe('recursive patterns', () => {
    it('should handle recursive function calls', () => {
      const sourceFile = project.createSourceFile('recursive.ts', `
        function factorial(n: number): number {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        
        async function processTree(node: TreeNode): Promise<void> {
          console.log(node.value);
          
          for (const child of node.children) {
            await processTree(child);
          }
        }
        
        function fibonacci(n: number): number {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        
        interface TreeNode {
          value: string;
          children: TreeNode[];
        }
      `);

      const functions = functionAnalyzer.analyzeSourceFile(sourceFile);
      
      // Analyze factorial
      const factorialNode = functions.find(f => f.name === 'factorial');
      const factorialFunc = sourceFile.getFunction('factorial');
      const factorialEdges = callAnalyzer.analyzeNode(factorialFunc!, factorialNode!.id);
      
      // Should find recursive call to factorial
      const recursiveCall = factorialEdges.find(e => e.target.includes('#factorial'));
      expect(recursiveCall).toBeDefined();
      expect(recursiveCall!.conditional).toBe(false); // Not inside if statement, it's in the return after if
      
      // Analyze processTree
      const processTreeNode = functions.find(f => f.name === 'processTree');
      const processTreeFunc = sourceFile.getFunction('processTree');
      const processTreeEdges = callAnalyzer.analyzeNode(processTreeFunc!, processTreeNode!.id);
      
      // Should find recursive processTree call (console.log is global and won't be resolved)
      const treeRecursiveCall = processTreeEdges.find(e => e.target.includes('#processTree'));
      
      expect(treeRecursiveCall).toBeDefined();
      expect(treeRecursiveCall!.type).toBe('async');
      expect(treeRecursiveCall!.conditional).toBe(true); // Inside for loop
      
      // Analyze fibonacci
      const fibNode = functions.find(f => f.name === 'fibonacci');
      const fibFunc = sourceFile.getFunction('fibonacci');
      const fibEdges = callAnalyzer.analyzeNode(fibFunc!, fibNode!.id);
      
      // Should find two recursive calls
      const fibCalls = fibEdges.filter(e => e.target.includes('#fibonacci'));
      expect(fibCalls).toHaveLength(2);
    });
  });

  describe('complex async patterns', () => {
    it('should analyze Promise.all and Promise.race patterns', () => {
      const sourceFile = project.createSourceFile('async-patterns.ts', `
        async function fetchUserData(userId: string) {
          return { id: userId, name: 'User' };
        }
        
        async function fetchUserPosts(userId: string) {
          return [{ id: '1', title: 'Post 1' }];
        }
        
        async function fetchUserComments(userId: string) {
          return [{ id: '1', text: 'Comment 1' }];
        }
        
        async function loadUserProfile(userId: string) {
          // Parallel fetching
          const [user, posts, comments] = await Promise.all([
            fetchUserData(userId),
            fetchUserPosts(userId),
            fetchUserComments(userId)
          ]);
          
          return { user, posts, comments };
        }
        
        async function getFirstAvailableServer() {
          const servers = ['server1', 'server2', 'server3'];
          
          return Promise.race(
            servers.map(server => checkServerHealth(server))
          );
        }
        
        async function checkServerHealth(server: string) {
          // Mock health check
          return { server, healthy: true };
        }
      `);

      const functions = functionAnalyzer.analyzeSourceFile(sourceFile);
      
      // Analyze loadUserProfile
      const loadProfileNode = functions.find(f => f.name === 'loadUserProfile');
      const loadProfileFunc = sourceFile.getFunction('loadUserProfile');
      const profileEdges = callAnalyzer.analyzeNode(loadProfileFunc!, loadProfileNode!.id);
      
      // Should find all three fetch calls
      const userDataCall = profileEdges.find(e => e.target.includes('#fetchUserData'));
      const postsCall = profileEdges.find(e => e.target.includes('#fetchUserPosts'));
      const commentsCall = profileEdges.find(e => e.target.includes('#fetchUserComments'));
      
      expect(userDataCall).toBeDefined();
      expect(postsCall).toBeDefined();
      expect(commentsCall).toBeDefined();
      
      // All should be async
      expect(userDataCall!.type).toBe('async');
      expect(postsCall!.type).toBe('async');
      expect(commentsCall!.type).toBe('async');
    });
  });
});