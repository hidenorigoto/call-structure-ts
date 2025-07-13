import {
  FunctionDeclaration,
  FunctionExpression,
  ArrowFunction,
  MethodDeclaration,
  Node,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';
import { CallGraphNode, CallGraphParameter } from '../types';
import { ASTVisitor } from './ASTVisitor';
import { logger } from '../utils/logger';

/**
 * Analyzer for extracting function declarations and metadata from TypeScript code.
 * 
 * This analyzer extends the ASTVisitor base class to traverse TypeScript AST
 * and collect information about all function-like constructs including:
 * - Function declarations
 * - Function expressions
 * - Arrow functions
 * - Class methods
 * 
 * @example
 * ```typescript
 * const analyzer = new FunctionAnalyzer();
 * const functions = analyzer.analyzeSourceFile(sourceFile);
 * ```
 */
export class FunctionAnalyzer extends ASTVisitor<CallGraphNode[]> {
  /**
   * Analyze a source file and extract all function declarations
   * 
   * @param sourceFile The source file to analyze
   * @returns Array of CallGraphNode representing functions found
   */
  analyzeSourceFile(sourceFile: SourceFile): CallGraphNode[] {
    const result = this.visit(sourceFile) || [];
    return result;
  }

  /**
   * Analyze a single function declaration
   * 
   * @param func The function declaration to analyze
   * @returns CallGraphNode or null if function should be skipped
   */
  analyzeFunctionDeclaration(func: FunctionDeclaration): CallGraphNode | null {
    try {
      const name = func.getName();
      if (!name) {
        logger.debug('Skipping anonymous function declaration');
        return null;
      }

      const sourceFile = func.getSourceFile();
      const isAsync = func.isAsync();
      const isExported = func.isExported();

      logger.debug(`Analyzing function: ${name} (async: ${isAsync}, exported: ${isExported})`);

      return {
        id: this.generateFunctionId(func),
        name,
        filePath: sourceFile.getFilePath(),
        line: func.getStartLineNumber(),
        column: func.getStart() - func.getStartLinePos(),
        type: 'function',
        async: isAsync,
        parameters: this.extractParameters(func),
        returnType: this.getFunctionReturnType(func),
      };
    } catch (error) {
      logger.error(`Error analyzing function declaration: ${error}`);
      return null;
    }
  }

  /**
   * Visit a function declaration node
   */
  protected visitFunctionDeclaration(node: Node): CallGraphNode[] {
    const results: CallGraphNode[] = [];
    
    if (Node.isFunctionDeclaration(node)) {
      const funcNode = this.analyzeFunctionDeclaration(node);
      if (funcNode) {
        results.push(funcNode);
      }
    }
    
    // Continue visiting children
    const childResults = this.visitChildren(node).flat();
    return [...results, ...childResults];
  }

  /**
   * Visit a function expression node
   */
  protected override visitFunctionExpression(node: Node): CallGraphNode[] {
    const results: CallGraphNode[] = [];
    
    if (Node.isFunctionExpression(node)) {
      const sourceFile = node.getSourceFile();
      const name = node.getName() || 'anonymous-function-expression';
      
      const funcNode: CallGraphNode = {
        id: this.generateNodeId(node),
        name,
        filePath: sourceFile.getFilePath(),
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'function',
        async: node.isAsync(),
        parameters: this.extractParameters(node),
        returnType: node.getReturnType().getText(),
      };
      
      results.push(funcNode);
    }
    
    // Continue visiting children
    const childResults = this.visitChildren(node).flat();
    return [...results, ...childResults];
  }

  /**
   * Visit an arrow function node
   */
  protected visitArrowFunction(node: Node): CallGraphNode[] {
    const results: CallGraphNode[] = [];
    
    if (Node.isArrowFunction(node)) {
      const sourceFile = node.getSourceFile();
      
      const funcNode: CallGraphNode = {
        id: this.generateNodeId(node),
        name: 'arrow-function',
        filePath: sourceFile.getFilePath(),
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'arrow',
        async: node.isAsync(),
        parameters: this.extractParameters(node),
        returnType: node.getReturnType().getText(),
      };
      
      results.push(funcNode);
    }
    
    // Continue visiting children
    const childResults = this.visitChildren(node).flat();
    return [...results, ...childResults];
  }

  /**
   * Visit a method declaration node
   */
  protected visitMethodDeclaration(node: Node): CallGraphNode[] {
    const results: CallGraphNode[] = [];
    
    if (Node.isMethodDeclaration(node)) {
      const sourceFile = node.getSourceFile();
      const classDecl = node.getParent();
      const className = Node.isClassDeclaration(classDecl) ? classDecl.getName() : undefined;
      
      const funcNode: CallGraphNode = {
        id: this.generateNodeId(node),
        name: node.getName(),
        filePath: sourceFile.getFilePath(),
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'method',
        async: node.isAsync(),
        static: node.isStatic(),
        visibility: this.getVisibility(node),
        parameters: this.extractParameters(node),
        returnType: node.getReturnType().getText(),
        ...(className && { className }),
      };
      
      results.push(funcNode);
    }
    
    // Continue visiting children
    const childResults = this.visitChildren(node).flat();
    return [...results, ...childResults];
  }

  /**
   * Visit a call expression (not needed for function extraction)
   */
  protected visitCallExpression(node: Node): CallGraphNode[] {
    // We don't extract functions from call expressions, just visit children
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit any other node
   */
  protected visitNode(node: Node): CallGraphNode[] {
    // Just continue traversing children
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit source file
   */
  protected override visitSourceFile(node: Node): CallGraphNode[] {
    // Continue traversing children
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Generate unique ID for a function declaration
   */
  private generateFunctionId(func: FunctionDeclaration): string {
    const name = func.getName() || 'anonymous';
    const filePath = func.getSourceFile().getFilePath();
    
    // For exported functions, use fully qualified name
    if (func.isExported()) {
      return `${filePath}#${name}`;
    }
    
    // For local functions, include line number for uniqueness
    const line = func.getStartLineNumber();
    return `${filePath}#${name}:${line}`;
  }

  /**
   * Generate unique ID for any node
   */
  private generateNodeId(node: Node): string {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();
    const start = node.getStart();
    return `${filePath}#${start}`;
  }

  /**
   * Extract function parameter information
   */
  private extractParameters(
    func: FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration
  ): CallGraphParameter[] {
    return func.getParameters().map(param => {
      const defaultValue = param.getInitializer()?.getText();
      return {
        name: param.getName(),
        type: param.getType().getText(),
        optional: param.isOptional(),
        ...(defaultValue && { defaultValue }),
      };
    });
  }

  /**
   * Get function return type
   */
  private getFunctionReturnType(
    func: FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration
  ): string {
    return func.getReturnType().getText();
  }

  /**
   * Get method visibility
   */
  private getVisibility(method: MethodDeclaration): 'public' | 'private' | 'protected' {
    if (method.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
    if (method.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
    return 'public';
  }

  /**
   * Check if function has specific decorators
   */
  getFunctionDecorators(func: FunctionDeclaration | MethodDeclaration): string[] {
    if (Node.isMethodDeclaration(func)) {
      return func.getDecorators().map((dec: any) => dec.getName());
    }
    // FunctionDeclaration doesn't support decorators in current TypeScript
    return [];
  }
}