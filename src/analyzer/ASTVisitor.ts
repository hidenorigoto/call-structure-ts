import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import { logger } from '../utils/logger';

/**
 * Context maintained during AST traversal
 */
export interface VisitorContext {
  /** Current source file being visited */
  currentFile: SourceFile;
  /** Current depth in the AST */
  depth: number;
  /** Set of visited node IDs to detect circular references */
  visited: Set<string>;
  /** Performance metrics */
  metrics: {
    nodesVisited: number;
    maxDepth: number;
    startTime: number;
    skipCounts: Map<SyntaxKind, number>;
  };
}

/**
 * Abstract base class for implementing the visitor pattern on TypeScript AST nodes.
 *
 * This class provides the foundation for traversing and analyzing TypeScript AST
 * using ts-morph. Subclasses should implement the abstract methods to define
 * specific behavior for different node types.
 *
 * @template T The return type of visitor methods
 *
 * @example
 * ```typescript
 * class NodeCountVisitor extends ASTVisitor<number> {
 *   protected visitFunctionDeclaration(node: Node): number {
 *     return 1 + this.visitChildren(node).reduce((a, b) => a + b, 0);
 *   }
 *   // ... implement other abstract methods
 * }
 * ```
 */
export abstract class ASTVisitor<T> {
  protected context: VisitorContext;

  constructor() {
    this.context = {
      currentFile: undefined as unknown as SourceFile,
      depth: 0,
      visited: new Set<string>(),
      metrics: {
        nodesVisited: 0,
        maxDepth: 0,
        startTime: 0,
        skipCounts: new Map<SyntaxKind, number>(),
      },
    };
  }

  /**
   * Visit a node and its children
   *
   * This method handles:
   * - Circular reference detection
   * - Context management
   * - Dispatching to specific visitor methods
   *
   * @param node The node to visit
   * @returns The result of visiting this node, or undefined
   */
  visit(node: Node): T | undefined {
    const nodeId = this.getNodeId(node);

    // Performance optimization: Skip uninteresting nodes early
    if (this.shouldSkipNode(node)) {
      const syntaxKind = node.getKind();
      const currentCount = this.context.metrics.skipCounts.get(syntaxKind) || 0;
      this.context.metrics.skipCounts.set(syntaxKind, currentCount + 1);
      return undefined;
    }

    // Update metrics
    this.context.metrics.nodesVisited++;
    if (this.context.depth > this.context.metrics.maxDepth) {
      this.context.metrics.maxDepth = this.context.depth;
    }

    // Check if already visited (circular reference)
    if (this.context.visited.has(nodeId)) {
      logger.debug(`Circular reference detected: ${nodeId}`);
      return undefined;
    }

    this.context.visited.add(nodeId);

    try {
      // Update context
      if (Node.isSourceFile(node)) {
        this.context.currentFile = node;
      }

      // Dispatch to specific visitor method
      return this.dispatchVisit(node);
    } finally {
      this.context.visited.delete(nodeId);
    }
  }

  /**
   * Dispatch visit to specific node type handler
   *
   * This method routes nodes to the appropriate visitor method based on their type.
   * Subclasses can override this to add support for additional node types.
   *
   * @param node The node to dispatch
   * @returns The result of visiting this node
   */
  protected dispatchVisit(node: Node): T | undefined {
    switch (node.getKind()) {
      case SyntaxKind.FunctionDeclaration:
        return this.visitFunctionDeclaration(node);
      case SyntaxKind.MethodDeclaration:
        return this.visitMethodDeclaration(node);
      case SyntaxKind.ArrowFunction:
        return this.visitArrowFunction(node);
      case SyntaxKind.CallExpression:
        return this.visitCallExpression(node);
      case SyntaxKind.FunctionExpression:
        return this.visitFunctionExpression(node);
      case SyntaxKind.Constructor:
        return this.visitConstructor(node);
      case SyntaxKind.GetAccessor:
        return this.visitGetAccessor(node);
      case SyntaxKind.SetAccessor:
        return this.visitSetAccessor(node);
      case SyntaxKind.ClassDeclaration:
        return this.visitClassDeclaration(node);
      case SyntaxKind.InterfaceDeclaration:
        return this.visitInterfaceDeclaration(node);
      case SyntaxKind.VariableDeclaration:
        return this.visitVariableDeclaration(node);
      case SyntaxKind.PropertyAccessExpression:
        return this.visitPropertyAccessExpression(node);
      case SyntaxKind.Identifier:
        return this.visitIdentifier(node);
      case SyntaxKind.SourceFile:
        return this.visitSourceFile(node);
      default:
        return this.visitNode(node);
    }
  }

  /**
   * Get unique identifier for a node
   *
   * @param node The node to identify
   * @returns A unique string identifier for the node
   */
  protected getNodeId(node: Node): string {
    const sourceFile = node.getSourceFile();
    const start = node.getStart();
    return `${sourceFile.getFilePath()}:${start}`;
  }

  /**
   * Visit children of a node
   *
   * This method traverses all child nodes, managing depth tracking
   * and collecting results.
   *
   * @param node The node whose children to visit
   * @returns Array of results from visiting children
   */
  protected visitChildren(node: Node): T[] {
    const results: T[] = [];

    node.forEachChild(child => {
      this.context.depth++;
      const result = this.visit(child);
      this.context.depth--;

      if (result !== undefined) {
        results.push(result);
      }
    });

    return results;
  }

  /**
   * Get the current traversal depth
   *
   * @returns The current depth in the AST
   */
  protected getCurrentDepth(): number {
    return this.context.depth;
  }

  /**
   * Get the current source file being visited
   *
   * @returns The current source file, or undefined if not in a source file
   */
  protected getCurrentFile(): SourceFile | undefined {
    return this.context.currentFile;
  }

  // Abstract methods to be implemented by subclasses
  protected abstract visitFunctionDeclaration(node: Node): T | undefined;
  protected abstract visitMethodDeclaration(node: Node): T | undefined;
  protected abstract visitArrowFunction(node: Node): T | undefined;
  protected abstract visitCallExpression(node: Node): T | undefined;
  protected abstract visitNode(node: Node): T | undefined;

  // Optional methods that can be overridden by subclasses
  protected visitFunctionExpression(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitConstructor(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitGetAccessor(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitSetAccessor(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitClassDeclaration(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitInterfaceDeclaration(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitVariableDeclaration(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitPropertyAccessExpression(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitIdentifier(node: Node): T | undefined {
    return this.visitNode(node);
  }

  protected visitSourceFile(node: Node): T | undefined {
    return this.visitNode(node);
  }

  /**
   * Performance optimization: Skip nodes that are not relevant for analysis
   *
   * @param node The node to check
   * @returns True if the node should be skipped
   */
  protected shouldSkipNode(node: Node): boolean {
    const kind = node.getKind();

    // Skip commonly uninteresting nodes for performance
    switch (kind) {
      case SyntaxKind.WhitespaceTrivia:
      case SyntaxKind.NewLineTrivia:
      case SyntaxKind.SingleLineCommentTrivia:
      case SyntaxKind.MultiLineCommentTrivia:
      case SyntaxKind.SemicolonToken:
      case SyntaxKind.CommaToken:
      case SyntaxKind.OpenBraceToken:
      case SyntaxKind.CloseBraceToken:
      case SyntaxKind.OpenParenToken:
      case SyntaxKind.CloseParenToken:
      case SyntaxKind.OpenBracketToken:
      case SyntaxKind.CloseBracketToken:
      case SyntaxKind.DotToken:
      case SyntaxKind.ColonToken:
      case SyntaxKind.QuestionToken:
      case SyntaxKind.ExclamationToken:
      case SyntaxKind.EndOfFileToken:
        return true;
      default:
        return false;
    }
  }

  /**
   * Get performance metrics for the current analysis
   *
   * @returns Performance metrics object
   */
  public getMetrics(): VisitorContext['metrics'] {
    return { ...this.context.metrics };
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.context.metrics = {
      nodesVisited: 0,
      maxDepth: 0,
      startTime: Date.now(),
      skipCounts: new Map<SyntaxKind, number>(),
    };
  }

  /**
   * Start timing for performance measurement
   */
  public startTiming(): void {
    this.context.metrics.startTime = Date.now();
  }

  /**
   * Get elapsed time since start
   *
   * @returns Elapsed time in milliseconds
   */
  public getElapsedTime(): number {
    return Date.now() - this.context.metrics.startTime;
  }
}
