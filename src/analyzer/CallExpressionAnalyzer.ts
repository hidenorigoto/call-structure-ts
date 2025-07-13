import {
  CallExpression,
  Node,
  SourceFile,
  PropertyAccessExpression,
  Identifier,
  NewExpression,
  Symbol as TsSymbol,
} from 'ts-morph';
import { CallGraphEdge } from '../types';
import { ASTVisitor } from './ASTVisitor';
import { logger } from '../utils/logger';

/**
 * Analyzer for extracting call expressions and creating call graph edges.
 * 
 * This analyzer extends the ASTVisitor base class to traverse TypeScript AST
 * and collect information about all function/method calls including:
 * - Direct function calls
 * - Method calls  
 * - Constructor calls (new expressions)
 * - Async/await calls
 * - Callback invocations
 * 
 * @example
 * ```typescript
 * const analyzer = new CallExpressionAnalyzer();
 * const edges = analyzer.analyzeSourceFile(sourceFile, 'source-node-id');
 * ```
 */
export class CallExpressionAnalyzer extends ASTVisitor<CallGraphEdge[]> {
  private sourceNodeId: string = '';
  private edgeCounter: number = 0;

  /**
   * Analyze a source file and extract all call expressions as edges
   * 
   * @param sourceFile The source file to analyze
   * @param sourceNodeId The ID of the source node (caller)
   * @returns Array of CallGraphEdge representing calls found
   */
  analyzeSourceFile(sourceFile: SourceFile, sourceNodeId: string): CallGraphEdge[] {
    this.sourceNodeId = sourceNodeId;
    this.edgeCounter = 0;
    const result = this.visit(sourceFile) || [];
    return result;
  }

  /**
   * Analyze a specific node and extract call expressions within it
   * 
   * @param node The node to analyze (e.g., a function or method)
   * @param sourceNodeId The ID of the source node (caller)
   * @returns Array of CallGraphEdge representing calls found
   */
  analyzeNode(node: Node, sourceNodeId: string): CallGraphEdge[] {
    this.sourceNodeId = sourceNodeId;
    this.edgeCounter = 0;
    const result = this.visit(node) || [];
    return result;
  }

  /**
   * Analyze a single call expression
   * 
   * @param callExpr The call expression to analyze
   * @returns CallGraphEdge or null if call cannot be resolved
   */
  analyzeCallExpression(callExpr: CallExpression): CallGraphEdge | null {
    try {
      const targetId = this.resolveCallTarget(callExpr);
      if (!targetId) {
        logger.debug(`Could not resolve call target at line ${callExpr.getStartLineNumber()}: ${callExpr.getText().substring(0, 50)}`);
        return null;
      }

      const edge: CallGraphEdge = {
        id: this.generateEdgeId(targetId),
        source: this.sourceNodeId,
        target: targetId,
        type: this.determineCallType(callExpr),
        line: callExpr.getStartLineNumber(),
        column: callExpr.getStart() - callExpr.getStartLinePos(),
        argumentTypes: this.extractArgumentTypes(callExpr),
        conditional: this.isConditionalCall(callExpr),
      };

      logger.debug(`Created edge: ${edge.source} -> ${edge.target} (${edge.type})`);
      return edge;
    } catch (error) {
      logger.error(`Error analyzing call expression: ${error}`);
      return null;
    }
  }

  /**
   * Visit a call expression node
   */
  protected visitCallExpression(node: Node): CallGraphEdge[] {
    const results: CallGraphEdge[] = [];
    
    if (Node.isCallExpression(node)) {
      const edge = this.analyzeCallExpression(node);
      if (edge) {
        results.push(edge);
      }
    }
    
    // Continue visiting children
    const childResults = this.visitChildren(node).flat();
    return [...results, ...childResults];
  }

  /**
   * Override the dispatch to ensure we handle all node types
   */
  protected override dispatchVisit(node: Node): CallGraphEdge[] | undefined {
    // Handle call expressions explicitly
    if (Node.isCallExpression(node)) {
      return this.visitCallExpression(node);
    }
    
    // Handle new expressions explicitly
    if (Node.isNewExpression(node)) {
      return this.visitNewExpression(node);
    }
    
    // Let parent handle other known types
    return super.dispatchVisit(node);
  }

  /**
   * Visit a new expression (constructor call)
   */
  protected visitNewExpression(node: Node): CallGraphEdge[] {
    const results: CallGraphEdge[] = [];
    
    if (Node.isNewExpression(node)) {
      const targetId = this.resolveConstructorTarget(node);
      if (targetId) {
        const edge: CallGraphEdge = {
          id: this.generateEdgeId(targetId),
          source: this.sourceNodeId,
          target: targetId,
          type: 'constructor',
          line: node.getStartLineNumber(),
          column: node.getStart() - node.getStartLinePos(),
          argumentTypes: this.extractArgumentTypes(node),
        };
        results.push(edge);
      }
    }
    
    // Continue visiting children
    const childResults = this.visitChildren(node).flat();
    return [...results, ...childResults];
  }

  /**
   * Visit any other node
   */
  protected visitNode(node: Node): CallGraphEdge[] {
    // Check if it's a new expression
    if (Node.isNewExpression(node)) {
      return this.visitNewExpression(node);
    }
    
    // Just continue traversing children
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit source file
   */
  protected override visitSourceFile(node: Node): CallGraphEdge[] {
    // Continue traversing children
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit function declaration
   */
  protected visitFunctionDeclaration(node: Node): CallGraphEdge[] {
    // Continue traversing children to find calls inside
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit method declaration
   */
  protected visitMethodDeclaration(node: Node): CallGraphEdge[] {
    // Continue traversing children to find calls inside
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit arrow function
   */
  protected visitArrowFunction(node: Node): CallGraphEdge[] {
    // Continue traversing children to find calls inside
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit function expression
   */
  protected override visitFunctionExpression(node: Node): CallGraphEdge[] {
    // Continue traversing children to find calls inside
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Resolve the target of a call expression to a node ID
   */
  private resolveCallTarget(callExpr: CallExpression): string | null {
    const expression = callExpr.getExpression();
    
    // Direct function call: functionName()
    if (Node.isIdentifier(expression)) {
      return this.resolveIdentifierTarget(expression);
    }
    
    // Property access: obj.method()
    if (Node.isPropertyAccessExpression(expression)) {
      return this.resolvePropertyAccessTarget(expression);
    }
    
    // Element access: obj['method']()
    if (Node.isElementAccessExpression(expression)) {
      return this.resolveElementAccessTarget(expression);
    }
    
    // Call expression: getFunction()()
    if (Node.isCallExpression(expression)) {
      // For higher-order functions, we track the outer call
      return this.resolveCallTarget(expression);
    }
    
    return null;
  }

  /**
   * Resolve constructor target for new expressions
   */
  private resolveConstructorTarget(newExpr: NewExpression): string | null {
    const expression = newExpr.getExpression();
    
    if (Node.isIdentifier(expression)) {
      const symbol = expression.getSymbol();
      if (!symbol) return null;
      
      const declarations = symbol.getDeclarations();
      for (const decl of declarations) {
        if (Node.isClassDeclaration(decl)) {
          const filePath = decl.getSourceFile().getFilePath();
          const className = decl.getName();
          return `${filePath}#${className}.constructor`;
        }
      }
    }
    
    return null;
  }

  /**
   * Resolve identifier to a target node ID
   */
  private resolveIdentifierTarget(identifier: Identifier): string | null {
    const symbol = identifier.getSymbol();
    if (!symbol) return null;
    
    const declarations = symbol.getDeclarations();
    if (declarations.length === 0) return null;
    
    const declaration = declarations[0];
    
    // Handle variable declarations with function initializers
    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      if (initializer && this.isFunctionLikeNode(initializer)) {
        return this.generateNodeIdForDeclaration(initializer);
      }
      // Also handle variable declarations with function types
      const name = declaration.getName();
      if (name) {
        const filePath = declaration.getSourceFile().getFilePath();
        return `${filePath}#${name}`;
      }
    }
    
    // Handle function declarations
    if (Node.isFunctionDeclaration(declaration)) {
      return this.generateNodeIdForDeclaration(declaration);
    }
    
    // Handle imported symbols
    if (Node.isImportSpecifier(declaration) || Node.isImportClause(declaration)) {
      return this.resolveImportedSymbol(symbol);
    }
    
    // Handle parameter declarations (e.g., callback parameters)
    if (Node.isParameterDeclaration(declaration)) {
      const parent = declaration.getParent();
      if (parent) {
        const filePath = declaration.getSourceFile().getFilePath();
        return `${filePath}#parameter-${declaration.getStart()}`;
      }
    }
    
    return null;
  }

  /**
   * Resolve property access to a target node ID
   */
  private resolvePropertyAccessTarget(propAccess: PropertyAccessExpression): string | null {
    const propertyName = propAccess.getName();
    const objectExpr = propAccess.getExpression();
    
    // Get the type of the object
    const objectType = objectExpr.getType();
    const propertySymbol = objectType.getProperty(propertyName);
    
    if (!propertySymbol) return null;
    
    const declarations = propertySymbol.getDeclarations();
    if (declarations.length === 0) return null;
    
    const declaration = declarations[0];
    
    // Handle method declarations
    if (Node.isMethodDeclaration(declaration)) {
      const classDecl = declaration.getParent();
      if (Node.isClassDeclaration(classDecl)) {
        const filePath = declaration.getSourceFile().getFilePath();
        const className = classDecl.getName();
        return `${filePath}#${className}.${propertyName}`;
      }
    }
    
    // Handle property declarations with function values
    if (Node.isPropertyDeclaration(declaration) || Node.isPropertySignature(declaration)) {
      const initializer = declaration.getInitializer?.();
      if (initializer && this.isFunctionLikeNode(initializer)) {
        return this.generateNodeIdForDeclaration(initializer);
      }
    }
    
    return null;
  }

  /**
   * Resolve element access (e.g., obj['method']) to a target node ID
   */
  private resolveElementAccessTarget(elementAccess: Node): string | null {
    if (!Node.isElementAccessExpression(elementAccess)) return null;
    
    const argumentExpression = elementAccess.getArgumentExpression();
    if (!argumentExpression) return null;
    
    // Only handle string literals for now
    if (Node.isStringLiteral(argumentExpression)) {
      const propertyName = argumentExpression.getLiteralValue();
      const objectExpr = elementAccess.getExpression();
      const objectType = objectExpr.getType();
      const propertySymbol = objectType.getProperty(propertyName);
      
      if (propertySymbol) {
        const declarations = propertySymbol.getDeclarations();
        if (declarations.length > 0) {
          return this.generateNodeIdForDeclaration(declarations[0]);
        }
      }
    }
    
    return null;
  }

  /**
   * Resolve imported symbols to their source
   */
  private resolveImportedSymbol(_symbol: TsSymbol): string | null {
    // For now, return null for external imports
    // This could be extended to follow imports if needed
    return null;
  }

  /**
   * Generate node ID for a declaration
   */
  private generateNodeIdForDeclaration(node: Node): string {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();
    
    if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
      const name = node.getName();
      const parent = node.getParent();
      
      if (Node.isClassDeclaration(parent)) {
        return `${filePath}#${parent.getName()}.${name}`;
      }
      return `${filePath}#${name}`;
    }
    
    // For other nodes, use position-based ID
    const start = node.getStart();
    return `${filePath}#${start}`;
  }

  /**
   * Generate unique edge ID
   */
  private generateEdgeId(targetId: string): string {
    const id = `${this.sourceNodeId}->${targetId}-${this.edgeCounter}`;
    this.edgeCounter++;
    return id;
  }

  /**
   * Determine the type of call (sync, async, callback, constructor)
   */
  private determineCallType(callExpr: CallExpression): CallGraphEdge['type'] {
    // Check if parent is await expression
    const parent = callExpr.getParent();
    if (parent && Node.isAwaitExpression(parent)) {
      return 'async';
    }
    
    // Check if it's a promise method
    const expression = callExpr.getExpression();
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName();
      if (['then', 'catch', 'finally'].includes(methodName)) {
        return 'async';
      }
    }
    
    // Check if call is used as a callback argument
    const callParent = callExpr.getParent();
    if (callParent && Node.isCallExpression(callParent)) {
      const args = callParent.getArguments();
      if (args.some(arg => arg === callExpr)) {
        return 'callback';
      }
    }
    
    // Check return type for Promise
    try {
      const returnType = callExpr.getReturnType();
      if (returnType.getText().includes('Promise')) {
        return 'async';
      }
      
      // Also check the symbol's type
      const expression = callExpr.getExpression();
      if (Node.isIdentifier(expression)) {
        const symbol = expression.getSymbol();
        if (symbol) {
          const symbolType = symbol.getTypeAtLocation(expression);
          if (symbolType.getText().includes('Promise')) {
            return 'async';
          }
        }
      }
    } catch (error) {
      // Type checking might fail for some expressions
    }
    
    return 'sync';
  }

  /**
   * Extract argument types from call expression
   */
  private extractArgumentTypes(callExpr: CallExpression | NewExpression): string[] {
    try {
      return callExpr.getArguments().map(arg => {
        const type = arg.getType();
        return type.getText();
      });
    } catch (error) {
      logger.debug('Failed to extract argument types:', error);
      return [];
    }
  }

  /**
   * Check if call is conditional (inside if, ternary, etc.)
   */
  private isConditionalCall(callExpr: CallExpression): boolean {
    let current: Node | undefined = callExpr.getParent();
    
    while (current) {
      if (Node.isIfStatement(current) || 
          Node.isConditionalExpression(current) ||
          Node.isCaseClause(current)) {
        return true;
      }
      
      // Stop at function boundaries
      if (this.isFunctionLikeNode(current)) {
        break;
      }
      
      current = current.getParent();
    }
    
    return false;
  }

  /**
   * Check if node is function-like
   */
  private isFunctionLikeNode(node: Node): boolean {
    return (
      Node.isFunctionDeclaration(node) ||
      Node.isMethodDeclaration(node) ||
      Node.isArrowFunction(node) ||
      Node.isFunctionExpression(node) ||
      Node.isConstructorDeclaration(node) ||
      Node.isGetAccessorDeclaration(node) ||
      Node.isSetAccessorDeclaration(node)
    );
  }

  /**
   * Override getNodeId to provide better unique identification
   */
  protected override getNodeId(node: Node): string {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();
    const start = node.getStart();
    const kind = node.getKindName();
    
    // For source files, use a special identifier
    if (Node.isSourceFile(node)) {
      return `${filePath}:SourceFile`;
    }
    
    // For other nodes, include the kind to ensure uniqueness
    return `${filePath}:${kind}:${start}`;
  }
}