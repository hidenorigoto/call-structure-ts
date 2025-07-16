import { ASTVisitor } from '../../src/analyzer/ASTVisitor';
import { Node } from 'ts-morph';

/**
 * Example visitor that counts different types of nodes in the AST
 *
 * This demonstrates how to extend the ASTVisitor base class to implement
 * custom analysis logic.
 */
export class NodeCountVisitor extends ASTVisitor<number> {
  protected visitFunctionDeclaration(node: Node): number {
    // Count this node (1) plus all children
    return 1 + this.visitChildren(node).reduce((a, b) => a + b, 0);
  }

  protected visitMethodDeclaration(node: Node): number {
    // Count this node (1) plus all children
    return 1 + this.visitChildren(node).reduce((a, b) => a + b, 0);
  }

  protected visitArrowFunction(node: Node): number {
    // Count this node (1) plus all children
    return 1 + this.visitChildren(node).reduce((a, b) => a + b, 0);
  }

  protected visitCallExpression(_node: Node): number {
    // Count only this node, not children (to avoid double counting)
    return 1;
  }

  protected visitNode(node: Node): number {
    // For other nodes, just count children
    return this.visitChildren(node).reduce((a, b) => a + b, 0);
  }

  protected override visitSourceFile(node: Node): number {
    // For source files, just count children
    return this.visitChildren(node).reduce((a, b) => a + b, 0);
  }
}

/**
 * Example visitor that collects function names
 */
export class FunctionNameCollector extends ASTVisitor<string[]> {
  protected visitFunctionDeclaration(node: Node): string[] {
    let name = 'anonymous';

    // Try different ways to get the function name
    if (Node.isFunctionDeclaration(node)) {
      name = node.getName() || 'anonymous';
    } else if (node.getSymbol()) {
      name = node.getSymbol()!.getName() || 'anonymous';
    }

    const childNames = this.visitChildren(node).flat();
    return [name, ...childNames];
  }

  protected visitMethodDeclaration(node: Node): string[] {
    let name = 'anonymous';

    if (Node.isMethodDeclaration(node)) {
      name = node.getName() || 'anonymous';
    } else if (node.getSymbol()) {
      name = node.getSymbol()!.getName() || 'anonymous';
    }

    const childNames = this.visitChildren(node).flat();
    return [name, ...childNames];
  }

  protected visitArrowFunction(node: Node): string[] {
    // Arrow functions are often anonymous
    const childNames = this.visitChildren(node).flat();
    return ['arrow-function', ...childNames];
  }

  protected visitCallExpression(_node: Node): string[] {
    // Don't collect call expressions
    return [];
  }

  protected visitNode(node: Node): string[] {
    // For other nodes, just collect from children
    return this.visitChildren(node).flat();
  }

  protected override visitFunctionExpression(node: Node): string[] {
    let name = 'anonymous';

    if (Node.isFunctionExpression(node)) {
      name = node.getName() || 'anonymous';
    }

    const childNames = this.visitChildren(node).flat();
    return [name, ...childNames];
  }

  protected override visitSourceFile(node: Node): string[] {
    // For source files, just collect from children
    return this.visitChildren(node).flat();
  }
}

/**
 * Example visitor that tracks maximum depth
 */
export class MaxDepthVisitor extends ASTVisitor<number> {
  private maxDepthSeen = 0;

  protected visitFunctionDeclaration(node: Node): number {
    this.updateMaxDepth();
    const childDepths = this.visitChildren(node);
    return Math.max(this.getCurrentDepth(), ...childDepths, 0);
  }

  protected visitMethodDeclaration(node: Node): number {
    this.updateMaxDepth();
    const childDepths = this.visitChildren(node);
    return Math.max(this.getCurrentDepth(), ...childDepths, 0);
  }

  protected visitArrowFunction(node: Node): number {
    this.updateMaxDepth();
    const childDepths = this.visitChildren(node);
    return Math.max(this.getCurrentDepth(), ...childDepths, 0);
  }

  protected visitCallExpression(_node: Node): number {
    this.updateMaxDepth();
    return this.getCurrentDepth();
  }

  protected visitNode(node: Node): number {
    this.updateMaxDepth();
    const childDepths = this.visitChildren(node);
    return Math.max(this.getCurrentDepth(), ...childDepths, 0);
  }

  protected override visitSourceFile(node: Node): number {
    this.updateMaxDepth();
    const childDepths = this.visitChildren(node);
    return Math.max(this.getCurrentDepth(), ...childDepths, 0);
  }

  // Override visitChildren to track depth at the right time
  protected override visitChildren(node: Node): number[] {
    const results: number[] = [];

    node.forEachChild(child => {
      // Increment depth before visiting child
      (this as unknown as { context: { depth: number } }).context.depth++;
      this.updateMaxDepth(); // Track depth after increment

      const result = this.visit(child);

      // Decrement depth after visiting child
      (this as unknown as { context: { depth: number } }).context.depth--;

      if (result !== undefined) {
        results.push(result);
      }
    });

    return results;
  }

  private updateMaxDepth(): void {
    this.maxDepthSeen = Math.max(this.maxDepthSeen, this.getCurrentDepth());
  }

  getMaxDepth(): number {
    return this.maxDepthSeen;
  }
}
