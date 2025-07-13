import {
  MethodDeclaration,
  ClassDeclaration,
  ConstructorDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
  Node,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';
import { CallGraphNode, CallGraphParameter } from '../types';
import { ASTVisitor } from './ASTVisitor';
import { logger } from '../utils/logger';

/**
 * Analyzer for extracting method declarations and metadata from TypeScript classes.
 * 
 * This analyzer extends the ASTVisitor base class to traverse TypeScript AST
 * and collect information about all method-like constructs including:
 * - Instance methods
 * - Static methods
 * - Constructors
 * - Getters and setters
 * 
 * @example
 * ```typescript
 * const analyzer = new MethodAnalyzer();
 * const methods = analyzer.analyzeSourceFile(sourceFile);
 * ```
 */
export class MethodAnalyzer extends ASTVisitor<CallGraphNode[]> {
  /**
   * Analyze a source file and extract all method declarations
   * 
   * @param sourceFile The source file to analyze
   * @returns Array of CallGraphNode representing methods found
   */
  analyzeSourceFile(sourceFile: SourceFile): CallGraphNode[] {
    const result = this.visit(sourceFile) || [];
    return result;
  }

  /**
   * Analyze all methods in a class declaration
   * 
   * @param classDecl The class declaration to analyze
   * @returns Array of CallGraphNode representing methods in the class
   */
  analyzeClassDeclaration(classDecl: ClassDeclaration): CallGraphNode[] {
    const methods: CallGraphNode[] = [];
    const className = classDecl.getName() || 'AnonymousClass';

    logger.debug(`Analyzing class methods for: ${className}`);

    // All methods (including static and instance)
    classDecl.getMethods().forEach(method => {
      const node = this.analyzeMethodDeclaration(method, className);
      if (node) methods.push(node);
    });

    // Constructor
    const constructors = classDecl.getConstructors();
    if (constructors.length > 0) {
      const node = this.analyzeConstructor(constructors[0], className);
      if (node) methods.push(node);
    }

    // Getters (including static)
    classDecl.getGetAccessors().forEach(getter => {
      const node = this.analyzeAccessor(getter, className);
      if (node) methods.push(node);
    });

    // Setters (including static)
    classDecl.getSetAccessors().forEach(setter => {
      const node = this.analyzeAccessor(setter, className);
      if (node) methods.push(node);
    });

    logger.debug(`Found ${methods.length} methods in class ${className}`);
    return methods;
  }

  /**
   * Analyze a single method declaration
   * 
   * @param method The method declaration to analyze
   * @param className The name of the containing class
   * @returns CallGraphNode or null if method should be skipped
   */
  analyzeMethodDeclaration(method: MethodDeclaration, className: string): CallGraphNode | null {
    try {
      const name = method.getName();
      const isStatic = method.isStatic();
      const isAsync = method.isAsync();
      const visibility = this.getMethodVisibility(method);
      const parameters = this.extractParameters(method);
      const returnType = this.getReturnType(method);

      logger.debug(`Analyzing method: ${className}.${name} (${visibility}, static: ${isStatic}, async: ${isAsync})`);

      return {
        id: this.generateMethodId(method, className),
        name: name,
        filePath: method.getSourceFile().getFilePath(),
        line: method.getStartLineNumber(),
        column: method.getStart() - method.getStartLinePos(),
        type: 'method',
        async: isAsync,
        static: isStatic,
        visibility: visibility,
        parameters: parameters,
        returnType: returnType,
        className: className,
      };
    } catch (error) {
      logger.error(`Error analyzing method in class ${className}:`, error);
      return null;
    }
  }

  /**
   * Analyze a constructor declaration
   * 
   * @param ctor The constructor declaration to analyze
   * @param className The name of the containing class
   * @returns CallGraphNode representing the constructor
   */
  analyzeConstructor(ctor: ConstructorDeclaration, className: string): CallGraphNode | null {
    try {
      const parameters = this.extractParameters(ctor);
      const visibility = this.getConstructorVisibility(ctor);

      logger.debug(`Analyzing constructor for class: ${className} (${visibility})`);

      return {
        id: this.generateConstructorId(ctor, className),
        name: 'constructor',
        filePath: ctor.getSourceFile().getFilePath(),
        line: ctor.getStartLineNumber(),
        column: ctor.getStart() - ctor.getStartLinePos(),
        type: 'constructor',
        async: false,
        static: false,
        visibility: visibility,
        parameters: parameters,
        returnType: 'void',
        className: className,
      };
    } catch (error) {
      logger.error(`Error analyzing constructor for class ${className}:`, error);
      return null;
    }
  }

  /**
   * Analyze a getter or setter accessor
   * 
   * @param accessor The getter or setter declaration to analyze
   * @param className The name of the containing class
   * @returns CallGraphNode representing the accessor
   */
  analyzeAccessor(
    accessor: GetAccessorDeclaration | SetAccessorDeclaration, 
    className: string
  ): CallGraphNode | null {
    try {
      const name = accessor.getName();
      const isStatic = accessor.isStatic();
      const visibility = this.getAccessorVisibility(accessor);
      const parameters = this.extractParameters(accessor);
      const returnType = this.getReturnType(accessor);
      const accessorType = Node.isGetAccessorDeclaration(accessor) ? 'getter' : 'setter';

      logger.debug(`Analyzing ${accessorType}: ${className}.${name} (${visibility}, static: ${isStatic})`);

      return {
        id: this.generateAccessorId(accessor, className),
        name: name,
        filePath: accessor.getSourceFile().getFilePath(),
        line: accessor.getStartLineNumber(),
        column: accessor.getStart() - accessor.getStartLinePos(),
        type: 'accessor',
        async: false,
        static: isStatic,
        visibility: visibility,
        parameters: parameters,
        returnType: returnType,
        className: className,
      };
    } catch (error) {
      logger.error(`Error analyzing accessor ${accessor.getName()} in class ${className}:`, error);
      return null;
    }
  }

  /**
   * Visit a class declaration
   */
  protected override visitClassDeclaration(node: Node): CallGraphNode[] {
    if (Node.isClassDeclaration(node)) {
      return this.analyzeClassDeclaration(node);
    }
    return [];
  }

  /**
   * Visit source file
   */
  protected override visitSourceFile(node: Node): CallGraphNode[] {
    const childResults = this.visitChildren(node).flat();
    return childResults;
  }

  /**
   * Visit function declaration - not relevant for method analysis
   */
  protected visitFunctionDeclaration(node: Node): CallGraphNode[] | undefined {
    // MethodAnalyzer focuses on class methods, so we skip function declarations
    // but still visit children in case there are classes inside
    const childResults = this.visitChildren(node).flat();
    return childResults.length > 0 ? childResults : undefined;
  }

  /**
   * Visit method declaration - handled by class visitor
   */
  protected visitMethodDeclaration(_node: Node): CallGraphNode[] | undefined {
    // Methods are handled when visiting their parent class
    // This avoids double processing
    return undefined;
  }

  /**
   * Visit arrow function - not relevant for method analysis
   */
  protected visitArrowFunction(_node: Node): CallGraphNode[] | undefined {
    // Arrow functions are not class methods
    return undefined;
  }

  /**
   * Visit call expression - not relevant for method analysis
   */
  protected visitCallExpression(_node: Node): CallGraphNode[] | undefined {
    // Call expressions are not method declarations
    return undefined;
  }

  /**
   * Visit any other node - delegate to children
   */
  protected visitNode(node: Node): CallGraphNode[] | undefined {
    // Check if this is a class expression (anonymous class)
    if (Node.isClassExpression(node)) {
      const className = node.getName() || 'AnonymousClass';
      
      // Convert to a pseudo class declaration for analysis
      const methods: CallGraphNode[] = [];
      
      // All methods (including static and instance)
      node.getMethods().forEach(method => {
        const methodNode = this.analyzeMethodDeclaration(method, className);
        if (methodNode) methods.push(methodNode);
      });

      // Constructor
      const constructors = node.getConstructors();
      if (constructors.length > 0) {
        const ctorNode = this.analyzeConstructor(constructors[0], className);
        if (ctorNode) methods.push(ctorNode);
      }

      // Getters
      node.getGetAccessors().forEach(getter => {
        const getterNode = this.analyzeAccessor(getter, className);
        if (getterNode) methods.push(getterNode);
      });

      // Setters
      node.getSetAccessors().forEach(setter => {
        const setterNode = this.analyzeAccessor(setter, className);
        if (setterNode) methods.push(setterNode);
      });
      
      if (methods.length > 0) {
        return methods;
      }
    }
    
    const childResults = this.visitChildren(node).flat();
    return childResults.length > 0 ? childResults : undefined;
  }

  /**
   * Generate unique ID for a method
   */
  private generateMethodId(method: MethodDeclaration, className: string): string {
    const name = method.getName();
    const filePath = method.getSourceFile().getFilePath();
    const isStatic = method.isStatic();
    
    if (isStatic) {
      return `${filePath}#${className}.${name}`;
    }
    
    return `${filePath}#${className}::${name}`;
  }

  /**
   * Generate unique ID for a constructor
   */
  private generateConstructorId(ctor: ConstructorDeclaration, className: string): string {
    const filePath = ctor.getSourceFile().getFilePath();
    return `${filePath}#${className}.constructor`;
  }

  /**
   * Generate unique ID for an accessor
   */
  private generateAccessorId(
    accessor: GetAccessorDeclaration | SetAccessorDeclaration, 
    className: string
  ): string {
    const name = accessor.getName();
    const filePath = accessor.getSourceFile().getFilePath();
    const isStatic = accessor.isStatic();
    const accessorType = Node.isGetAccessorDeclaration(accessor) ? 'get' : 'set';
    
    if (isStatic) {
      return `${filePath}#${className}.${accessorType}:${name}`;
    }
    
    return `${filePath}#${className}::${accessorType}:${name}`;
  }

  /**
   * Get method visibility
   */
  private getMethodVisibility(method: MethodDeclaration): 'public' | 'private' | 'protected' {
    if (method.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
    if (method.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
    return 'public';
  }

  /**
   * Get constructor visibility
   */
  private getConstructorVisibility(ctor: ConstructorDeclaration): 'public' | 'private' | 'protected' {
    if (ctor.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
    if (ctor.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
    return 'public';
  }

  /**
   * Get accessor visibility
   */
  private getAccessorVisibility(
    accessor: GetAccessorDeclaration | SetAccessorDeclaration
  ): 'public' | 'private' | 'protected' {
    if (accessor.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
    if (accessor.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
    return 'public';
  }

  /**
   * Extract parameters from a method-like node
   */
  private extractParameters(
    node: MethodDeclaration | ConstructorDeclaration | GetAccessorDeclaration | SetAccessorDeclaration
  ): CallGraphParameter[] {
    try {
      return node.getParameters().map(param => {
        const defaultValue = param.getInitializer()?.getText();
        // Note: Parameters with default values are not considered optional in TypeScript
        // unless they have the ? modifier
        const isOptional = param.hasQuestionToken();
        return {
          name: param.getName(),
          type: param.getType().getText(),
          optional: isOptional,
          ...(defaultValue && { defaultValue }),
        };
      });
    } catch (error) {
      logger.debug('Failed to extract parameters:', error);
      return [];
    }
  }

  /**
   * Get return type of a method-like node
   */
  private getReturnType(
    node: MethodDeclaration | GetAccessorDeclaration | SetAccessorDeclaration
  ): string {
    try {
      return node.getReturnType().getText();
    } catch (error) {
      logger.debug('Failed to extract return type:', error);
      return 'unknown';
    }
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