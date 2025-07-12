import { ASTVisitor, VisitorContext } from '../../src/analyzer/ASTVisitor';
import { Node, SyntaxKind, SourceFile } from 'ts-morph';

// Mock visitor for testing
class TestVisitor extends ASTVisitor<string> {
  protected visitFunctionDeclaration(node: Node): string {
    return `function:${node.getKindName()}`;
  }

  protected visitMethodDeclaration(node: Node): string {
    return `method:${node.getKindName()}`;
  }

  protected visitArrowFunction(node: Node): string {
    return `arrow:${node.getKindName()}`;
  }

  protected visitCallExpression(node: Node): string {
    return `call:${node.getKindName()}`;
  }

  protected visitNode(node: Node): string {
    return `node:${node.getKindName()}`;
  }

  // Expose context for testing
  getContext(): VisitorContext {
    return this.context;
  }
}

// Mock node helper
function createMockNode(kind: SyntaxKind, options: {
  sourceFile?: SourceFile;
  start?: number;
  kindName?: string;
  children?: Node[];
} = {}): Node {
  const mockNode = {
    getKind: jest.fn(() => kind),
    getKindName: jest.fn(() => options.kindName || SyntaxKind[kind]),
    getSourceFile: jest.fn(() => options.sourceFile || createMockSourceFile()),
    getStart: jest.fn(() => options.start || 0),
    forEachChild: jest.fn((callback: (child: Node) => void) => {
      (options.children || []).forEach(callback);
    }),
  } as unknown as Node;
  
  return mockNode;
}

// Mock source file helper
function createMockSourceFile(filePath: string = '/test/file.ts'): SourceFile {
  const mockSourceFile = {
    getKind: jest.fn(() => SyntaxKind.SourceFile),
    getKindName: jest.fn(() => 'SourceFile'),
    getSourceFile: jest.fn(function() { return mockSourceFile; }),
    getStart: jest.fn(() => 0),
    forEachChild: jest.fn((callback: (child: Node) => void) => {}),
    getFilePath: jest.fn(() => filePath),
  } as unknown as SourceFile;
  
  return mockSourceFile;
}

// Mock the static method
jest.mock('ts-morph', () => ({
  ...jest.requireActual('ts-morph'),
  Node: {
    isSourceFile: jest.fn(),
  },
}));

describe('ASTVisitor', () => {
  let visitor: TestVisitor;

  beforeEach(() => {
    visitor = new TestVisitor();
    jest.clearAllMocks();
  });

  describe('visit', () => {
    it('should dispatch to correct visitor method for function declaration', () => {
      const node = createMockNode(SyntaxKind.FunctionDeclaration);
      const result = visitor.visit(node);
      
      expect(result).toBe('function:FunctionDeclaration');
    });

    it('should dispatch to correct visitor method for method declaration', () => {
      const node = createMockNode(SyntaxKind.MethodDeclaration);
      const result = visitor.visit(node);
      
      expect(result).toBe('method:MethodDeclaration');
    });

    it('should dispatch to correct visitor method for arrow function', () => {
      const node = createMockNode(SyntaxKind.ArrowFunction);
      const result = visitor.visit(node);
      
      expect(result).toBe('arrow:ArrowFunction');
    });

    it('should dispatch to correct visitor method for call expression', () => {
      const node = createMockNode(SyntaxKind.CallExpression);
      const result = visitor.visit(node);
      
      expect(result).toBe('call:CallExpression');
    });

    it('should dispatch to visitNode for unknown node types', () => {
      const node = createMockNode(SyntaxKind.Block);
      const result = visitor.visit(node);
      
      expect(result).toBe('node:Block');
    });

    it('should update currentFile when visiting source file', () => {
      const sourceFile = createMockSourceFile('/test/source.ts');
      
      // Mock Node.isSourceFile for this test
      (Node.isSourceFile as any) = jest.fn((node: any) => node === sourceFile);
      
      visitor.visit(sourceFile);
      
      expect(visitor.getContext().currentFile).toBe(sourceFile);
    });

    it('should detect circular references', () => {
      const node = createMockNode(SyntaxKind.FunctionDeclaration, {
        start: 100,
      });

      // First visit should succeed
      const result1 = visitor.visit(node);
      expect(result1).toBe('function:FunctionDeclaration');

      // Simulate circular reference by keeping node in visited set
      visitor.getContext().visited.add(visitor['getNodeId'](node));
      
      // Second visit should return undefined
      const result2 = visitor.visit(node);
      expect(result2).toBeUndefined();
    });

    it('should clean up visited set after visit', () => {
      const node = createMockNode(SyntaxKind.FunctionDeclaration);
      
      visitor.visit(node);
      
      // After visit completes, node should not be in visited set
      expect(visitor.getContext().visited.size).toBe(0);
    });
  });

  describe('visitChildren', () => {
    it('should visit all child nodes', () => {
      const child1 = createMockNode(SyntaxKind.CallExpression);
      const child2 = createMockNode(SyntaxKind.ArrowFunction);
      const parent = createMockNode(SyntaxKind.Block, {
        children: [child1, child2],
      });

      const results = visitor['visitChildren'](parent);
      
      expect(results).toEqual(['call:CallExpression', 'arrow:ArrowFunction']);
    });

    it('should track depth correctly', () => {
      // Create nested nodes with proper parent-child relationships
      const grandchild = createMockNode(SyntaxKind.CallExpression);
      const child = createMockNode(SyntaxKind.ArrowFunction, {
        children: [grandchild],
      });
      const parent = createMockNode(SyntaxKind.FunctionDeclaration, {
        children: [child],
      });

      // Create a visitor that tracks depth and visits children
      class DepthTrackingVisitor extends TestVisitor {
        depths: Map<string, number> = new Map();

        protected override visitCallExpression(node: Node): string {
          this.depths.set('call', this.getCurrentDepth());
          return super.visitCallExpression(node);
        }

        protected override visitArrowFunction(node: Node): string {
          this.depths.set('arrow', this.getCurrentDepth());
          this.visitChildren(node);
          return super.visitArrowFunction(node);
        }

        protected override visitFunctionDeclaration(node: Node): string {
          this.depths.set('function', this.getCurrentDepth());
          this.visitChildren(node);
          return super.visitFunctionDeclaration(node);
        }
      }

      const depthVisitor = new DepthTrackingVisitor();
      depthVisitor.visit(parent);

      // Check depths: function at 0, arrow at 1, call at 2
      expect(depthVisitor.depths.get('function')).toBe(0);
      expect(depthVisitor.depths.get('arrow')).toBe(1);
      expect(depthVisitor.depths.get('call')).toBe(2);
    });

    it('should filter out undefined results', () => {
      // Create a visitor that returns undefined for some nodes
      class FilteringVisitor extends ASTVisitor<string> {
        protected visitFunctionDeclaration(node: Node): string | undefined {
          return undefined;
        }
        protected visitMethodDeclaration(node: Node): string | undefined {
          return 'method';
        }
        protected visitArrowFunction(node: Node): string | undefined {
          return undefined;
        }
        protected visitCallExpression(node: Node): string | undefined {
          return 'call';
        }
        protected visitNode(node: Node): string | undefined {
          return this.visitChildren(node)[0];
        }
      }

      const child1 = createMockNode(SyntaxKind.FunctionDeclaration);
      const child2 = createMockNode(SyntaxKind.MethodDeclaration);
      const child3 = createMockNode(SyntaxKind.ArrowFunction);
      const child4 = createMockNode(SyntaxKind.CallExpression);
      const parent = createMockNode(SyntaxKind.Block, {
        children: [child1, child2, child3, child4],
      });

      const filteringVisitor = new FilteringVisitor();
      const results = filteringVisitor['visitChildren'](parent);
      
      // Should only include non-undefined results
      expect(results).toEqual(['method', 'call']);
    });
  });

  describe('getNodeId', () => {
    it('should generate unique IDs for different nodes', () => {
      const sourceFile = createMockSourceFile('/test/file.ts');
      const node1 = createMockNode(SyntaxKind.FunctionDeclaration, {
        sourceFile,
        start: 100,
      });
      const node2 = createMockNode(SyntaxKind.FunctionDeclaration, {
        sourceFile,
        start: 200,
      });

      const id1 = visitor['getNodeId'](node1);
      const id2 = visitor['getNodeId'](node2);

      expect(id1).toBe('/test/file.ts:100');
      expect(id2).toBe('/test/file.ts:200');
      expect(id1).not.toBe(id2);
    });

    it('should generate same ID for same node', () => {
      const node = createMockNode(SyntaxKind.FunctionDeclaration, {
        start: 150,
      });

      const id1 = visitor['getNodeId'](node);
      const id2 = visitor['getNodeId'](node);

      expect(id1).toBe(id2);
    });
  });

  describe('optional visitor methods', () => {
    it('should delegate optional methods to visitNode by default', () => {
      const functionExpr = createMockNode(SyntaxKind.FunctionExpression);
      const constructor = createMockNode(SyntaxKind.Constructor);
      const classDecl = createMockNode(SyntaxKind.ClassDeclaration);
      
      expect(visitor.visit(functionExpr)).toBe('node:FunctionExpression');
      expect(visitor.visit(constructor)).toBe('node:Constructor');
      expect(visitor.visit(classDecl)).toBe('node:ClassDeclaration');
    });

    it('should allow overriding optional visitor methods', () => {
      class ExtendedVisitor extends TestVisitor {
        protected override visitFunctionExpression(node: Node): string {
          return 'custom:function-expression';
        }

        protected override visitClassDeclaration(node: Node): string {
          return 'custom:class';
        }
      }

      const extVisitor = new ExtendedVisitor();
      const functionExpr = createMockNode(SyntaxKind.FunctionExpression);
      const classDecl = createMockNode(SyntaxKind.ClassDeclaration);

      expect(extVisitor.visit(functionExpr)).toBe('custom:function-expression');
      expect(extVisitor.visit(classDecl)).toBe('custom:class');
    });
  });

  describe('context accessors', () => {
    it('should provide access to current depth', () => {
      expect(visitor['getCurrentDepth']()).toBe(0);
      
      visitor.getContext().depth = 5;
      expect(visitor['getCurrentDepth']()).toBe(5);
    });

    it('should provide access to current file', () => {
      expect(visitor['getCurrentFile']()).toBeUndefined();
      
      const sourceFile = createMockSourceFile('/test/current.ts');
      visitor.getContext().currentFile = sourceFile;
      
      expect(visitor['getCurrentFile']()).toBe(sourceFile);
    });
  });
});