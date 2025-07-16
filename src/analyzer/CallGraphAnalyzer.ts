import {
  Project,
  Node,
  SyntaxKind,
  CallExpression,
  FunctionDeclaration,
  MethodDeclaration,
  ArrowFunction,
  FunctionExpression,
  ConstructorDeclaration,
  PropertyAccessExpression,
  Identifier,
} from 'ts-morph';
import * as path from 'path';
import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
  CallGraphAnalysisOptions,
  CallGraphMetadata,
  CallGraphError,
  ProjectContext,
} from '../types/CallGraph';
import { logger } from '../utils/logger';
import { ProjectLoader } from './ProjectLoader';
import { EntryPointFinder, EntryPointInfo } from './EntryPointFinder';

export class CallGraphAnalyzer {
  private project: Project;
  private projectLoader: ProjectLoader;
  private entryPointFinder: EntryPointFinder;
  private context: ProjectContext;
  private options: Required<CallGraphAnalysisOptions>;
  private visitedNodes = new Set<string>();
  private nodes = new Map<string, CallGraphNode>();
  private edges: CallGraphEdge[] = [];
  private currentDepth = 0;

  constructor(context: ProjectContext, options: CallGraphAnalysisOptions = {}) {
    this.context = context;
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      includeNodeModules: options.includeNodeModules ?? false,
      includeTestFiles: options.includeTestFiles ?? false,
      excludePatterns: options.excludePatterns ?? [/\.test\.ts$/, /\.spec\.ts$/, /node_modules/],
      includePatterns: options.includePatterns ?? [],
      followImports: options.followImports ?? true,
      analyzeCallbacks: options.analyzeCallbacks ?? true,
      collectMetrics: options.collectMetrics ?? false,
    };

    // Use ProjectLoader instead of creating Project directly
    this.projectLoader = new ProjectLoader();

    // Load project synchronously in constructor for backward compatibility
    // In a real implementation, this should be async
    const projectOptions: { skipAddingFilesFromTsConfig: boolean; tsConfigFilePath?: string } = {
      skipAddingFilesFromTsConfig: false,
    };

    if (context.tsConfigPath) {
      projectOptions.tsConfigFilePath = context.tsConfigPath;
    }

    // For now, keep direct Project creation for backward compatibility
    // TODO: Refactor to use async initialization
    this.project = new Project(projectOptions);

    // If no tsconfig is provided, add source files manually
    if (!context.tsConfigPath) {
      const sourcePatterns = context.sourcePatterns || ['src/**/*.ts', 'src/**/*.tsx'];
      const excludePatterns = context.excludePatterns || [
        'node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ];

      // Add source files using glob patterns
      this.project.addSourceFilesAtPaths([
        ...sourcePatterns.map(pattern => path.join(context.rootPath, pattern)),
        ...excludePatterns.map(pattern => '!' + path.join(context.rootPath, pattern)),
      ]);
    }

    this.entryPointFinder = new EntryPointFinder(this.project);

    logger.debug(`Initialized CallGraphAnalyzer with context:`, context);
  }

  async analyzeFromEntryPoint(entryPoint: string): Promise<CallGraph> {
    const startTime = Date.now();
    logger.progress(`Starting analysis from entry point: ${entryPoint}`);

    try {
      // Reset state
      this.visitedNodes.clear();
      this.nodes.clear();
      this.edges = [];
      this.currentDepth = 0;

      // Use EntryPointFinder to find the entry point
      let entryPointInfo: EntryPointInfo;
      try {
        entryPointInfo = this.entryPointFinder.findEntryPoint(entryPoint);
      } catch (error) {
        // Convert to CallGraphError for backward compatibility
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Source file not found')) {
          const filePath = entryPoint.split('#')[0];
          throw new CallGraphError(message, 'SOURCE_FILE_NOT_FOUND', filePath);
        } else if (message.includes('Entry point not found')) {
          const filePath = entryPoint.split('#')[0];
          throw new CallGraphError(message, 'ENTRY_POINT_NOT_FOUND', filePath);
        } else if (message.includes('Invalid entry point format')) {
          throw new CallGraphError(message, 'INVALID_ENTRY_POINT_FORMAT');
        }
        throw error;
      }

      const entryNode = entryPointInfo.node;
      const entryNodeId = this.generateNodeId(entryNode);

      logger.debug(`Found entry point node: ${entryNodeId}`);

      // Perform analysis
      await this.analyzeNode(entryNode, 0);

      const analysisTime = Date.now() - startTime;

      // Collect performance metrics
      const performanceMetrics = {
        analysisTime,
        totalNodes: this.nodes.size,
        totalEdges: this.edges.length,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        filesAnalyzed: this.project.getSourceFiles().length,
        nodesPerSecond: Math.round(this.nodes.size / (analysisTime / 1000)),
        averageDepth: this.calculateAverageDepth(),
      };

      logger.success(
        `Analysis completed in ${analysisTime}ms. Found ${this.nodes.size} nodes and ${this.edges.length} edges.`
      );

      // Log performance metrics in debug mode
      if (logger.getLevel() === 0) {
        // LogLevel.DEBUG
        logger.debug('Performance metrics:', performanceMetrics);
      }

      // Build result
      const metadata: CallGraphMetadata = {
        generatedAt: new Date().toISOString(),
        entryPoint: entryPoint,
        maxDepth: this.options.maxDepth,
        projectRoot: this.context.rootPath,
        tsConfigPath: this.context.tsConfigPath || undefined,
        totalFiles: this.project.getSourceFiles().length,
        analysisTimeMs: analysisTime,
        performance: performanceMetrics,
      };

      return {
        metadata,
        nodes: Array.from(this.nodes.values()),
        edges: this.edges,
        entryPointId: entryNodeId,
      };
    } catch (error) {
      const analysisTime = Date.now() - startTime;
      logger.error(`Analysis failed after ${analysisTime}ms:`, error);
      throw error;
    }
  }

  private async analyzeNode(node: Node, depth: number): Promise<void> {
    if (depth >= this.options.maxDepth) {
      logger.debug(`Reached max depth ${this.options.maxDepth}, stopping analysis`);
      return;
    }

    const nodeId = this.generateNodeId(node);
    if (this.visitedNodes.has(nodeId)) {
      logger.debug(`Node already visited: ${nodeId}`);
      return;
    }

    this.visitedNodes.add(nodeId);
    this.currentDepth = Math.max(this.currentDepth, depth);

    // Extract node information
    const nodeInfo = this.extractNodeInfo(node);
    if (nodeInfo) {
      this.nodes.set(nodeId, nodeInfo);
      logger.debug(`Added node: ${nodeInfo.name} (${nodeInfo.type})`);
    }

    // Find all call expressions in this node
    const callExpressions = this.findCallExpressions(node);
    logger.debug(`Found ${callExpressions.length} call expressions in ${nodeId}`);

    for (const callExpr of callExpressions) {
      await this.analyzeCallExpression(callExpr, nodeId, depth + 1);
    }

    // Analyze callbacks if enabled
    if (this.options.analyzeCallbacks) {
      await this.analyzeCallbacks(node, nodeId, depth + 1);
    }
  }

  private async analyzeCallExpression(
    callExpr: CallExpression,
    sourceNodeId: string,
    depth: number
  ): Promise<void> {
    try {
      const targetNode = this.resolveCallTarget(callExpr);
      if (!targetNode) {
        logger.debug(
          `Could not resolve call target for expression at line ${callExpr.getStartLineNumber()}`
        );
        return;
      }

      if (this.shouldSkipNode(targetNode)) {
        logger.debug(`Skipping external node: ${this.generateNodeId(targetNode)}`);
        return;
      }

      const targetNodeId = this.generateNodeId(targetNode);

      // Create edge
      const edge: CallGraphEdge = {
        id: `${sourceNodeId}->${targetNodeId}-${this.edges.length}`,
        source: sourceNodeId,
        target: targetNodeId,
        type: this.determineCallType(callExpr),
        line: callExpr.getStartLineNumber(),
        column: callExpr.getStart() - callExpr.getStartLinePos(),
        argumentTypes: this.extractArgumentTypes(callExpr),
      };

      this.edges.push(edge);
      logger.debug(`Added edge: ${edge.source} -> ${edge.target} (${edge.type})`);

      // Recursively analyze target
      await this.analyzeNode(targetNode, depth);
    } catch (error) {
      logger.warn(
        `Failed to analyze call expression at line ${callExpr.getStartLineNumber()}:`,
        error
      );
    }
  }

  private resolveCallTarget(callExpr: CallExpression): Node | undefined {
    const expression = callExpr.getExpression();

    // Direct function call: functionName()
    if (Node.isIdentifier(expression)) {
      return this.resolveIdentifierTarget(expression);
    }

    // Property access: obj.method()
    if (Node.isPropertyAccessExpression(expression)) {
      return this.resolvePropertyAccessTarget(expression);
    }

    // TODO: Handle other cases like computed property access, etc.

    return undefined;
  }

  private resolveIdentifierTarget(identifier: Identifier): Node | undefined {
    const symbol = identifier.getSymbol();
    if (!symbol) return undefined;

    const declarations = symbol.getDeclarations();
    if (declarations.length === 0) return undefined;

    const declaration = declarations[0];
    if (!declaration) return undefined;

    // If it's a variable declaration, check if it has a function initializer
    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      if (initializer && this.isFunctionLikeNode(initializer)) {
        return initializer;
      }
    }

    // If it's already a function-like node
    if (this.isFunctionLikeNode(declaration)) {
      return declaration;
    }

    return undefined;
  }

  private resolvePropertyAccessTarget(propAccess: PropertyAccessExpression): Node | undefined {
    const nameNode = propAccess.getNameNode();
    const objectExpr = propAccess.getExpression();

    // Get the type of the object being accessed
    const objectType = objectExpr.getType();
    const methodSymbol = objectType.getProperty(nameNode.getText());

    if (!methodSymbol) return undefined;

    const declarations = methodSymbol.getDeclarations();
    if (declarations.length === 0) return undefined;

    return declarations[0];
  }

  private findCallExpressions(node: Node): CallExpression[] {
    return node.getDescendantsOfKind(SyntaxKind.CallExpression);
  }

  private async analyzeCallbacks(node: Node, parentNodeId: string, depth: number): Promise<void> {
    // Find arrow functions
    const arrowFunctions = node.getDescendantsOfKind(SyntaxKind.ArrowFunction);
    for (const arrow of arrowFunctions) {
      await this.analyzeCallbackFunction(arrow, parentNodeId, 'callback', depth);
    }

    // Find function expressions
    const functionExpressions = node.getDescendantsOfKind(SyntaxKind.FunctionExpression);
    for (const funcExpr of functionExpressions) {
      await this.analyzeCallbackFunction(funcExpr, parentNodeId, 'callback', depth);
    }
  }

  private async analyzeCallbackFunction(
    callbackNode: Node,
    parentNodeId: string,
    edgeType: CallGraphEdge['type'],
    depth: number
  ): Promise<void> {
    const callbackNodeId = this.generateNodeId(callbackNode);

    // Create edge from parent to callback
    const edge: CallGraphEdge = {
      id: `${parentNodeId}->${callbackNodeId}-${this.edges.length}`,
      source: parentNodeId,
      target: callbackNodeId,
      type: edgeType,
      line: callbackNode.getStartLineNumber(),
      column: callbackNode.getStart() - callbackNode.getStartLinePos(),
    };

    this.edges.push(edge);

    // Analyze the callback function
    await this.analyzeNode(callbackNode, depth);
  }

  private extractNodeInfo(node: Node): CallGraphNode | undefined {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();

    if (Node.isFunctionDeclaration(node)) {
      return {
        id: this.generateNodeId(node),
        name: node.getName() || 'anonymous',
        filePath,
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'function',
        async: node.isAsync(),
        parameters: this.extractParameters(node),
        returnType: node.getReturnType().getText(),
      };
    }

    if (Node.isMethodDeclaration(node)) {
      const classDecl = node.getParent();
      const className = Node.isClassDeclaration(classDecl) ? classDecl.getName() : undefined;
      return {
        id: this.generateNodeId(node),
        name: node.getName(),
        filePath,
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
    }

    if (Node.isArrowFunction(node)) {
      return {
        id: this.generateNodeId(node),
        name: 'arrow-function',
        filePath,
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'arrow',
        async: node.isAsync(),
        parameters: this.extractParameters(node),
        returnType: node.getReturnType().getText(),
      };
    }

    if (Node.isFunctionExpression(node)) {
      return {
        id: this.generateNodeId(node),
        name: node.getName() || 'function-expression',
        filePath,
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'function',
        async: node.isAsync(),
        parameters: this.extractParameters(node),
        returnType: node.getReturnType().getText(),
      };
    }

    if (Node.isConstructorDeclaration(node)) {
      const classDecl = node.getParent();
      const className = Node.isClassDeclaration(classDecl) ? classDecl.getName() : undefined;
      return {
        id: this.generateNodeId(node),
        name: 'constructor',
        filePath,
        line: node.getStartLineNumber(),
        column: node.getStart() - node.getStartLinePos(),
        type: 'constructor',
        async: false,
        parameters: this.extractParameters(node),
        returnType: 'void',
        ...(className && { className }),
      };
    }

    return undefined;
  }

  private extractParameters(
    node:
      | FunctionDeclaration
      | MethodDeclaration
      | ArrowFunction
      | FunctionExpression
      | ConstructorDeclaration
  ): CallGraphNode['parameters'] {
    return node.getParameters().map(param => {
      const defaultValue = param.getInitializer()?.getText();
      return {
        name: param.getName(),
        type: param.getType().getText(),
        optional: param.isOptional(),
        ...(defaultValue && { defaultValue }),
      };
    });
  }

  private getVisibility(node: MethodDeclaration): 'public' | 'private' | 'protected' {
    if (node.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
    if (node.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
    return 'public';
  }

  private determineCallType(callExpr: CallExpression): CallGraphEdge['type'] {
    // Check if it's awaited
    const parent = callExpr.getParent();
    if (parent && Node.isAwaitExpression(parent)) {
      return 'async';
    }

    // Check for Promise methods
    const expression = callExpr.getExpression();
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName();
      if (['then', 'catch', 'finally'].includes(methodName)) {
        return 'async';
      }
    }

    // Check if it's a constructor call
    if (Node.isNewExpression(callExpr.getParent())) {
      return 'constructor';
    }

    return 'sync';
  }

  private extractArgumentTypes(callExpr: CallExpression): string[] {
    return callExpr.getArguments().map(arg => arg.getType().getText());
  }

  private generateNodeId(node: Node): string {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();
    const start = node.getStart();

    if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
      const name = node.getName();
      const parent = node.getParent();

      if (Node.isClassDeclaration(parent)) {
        return `${filePath}#${parent.getName()}.${name}`;
      }
      return `${filePath}#${name}`;
    }

    if (Node.isConstructorDeclaration(node)) {
      const parent = node.getParent();
      if (Node.isClassDeclaration(parent)) {
        return `${filePath}#${parent.getName()}.constructor`;
      }
    }

    return `${filePath}#${start}`;
  }

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

  private shouldSkipNode(node: Node): boolean {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();

    // Skip node_modules unless explicitly included
    if (!this.options.includeNodeModules && filePath.includes('node_modules')) {
      return true;
    }

    // Skip test files unless explicitly included
    if (!this.options.includeTestFiles && this.isTestFile(filePath)) {
      return true;
    }

    // Check exclude patterns
    for (const pattern of this.options.excludePatterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }

    // Check include patterns (if any)
    if (this.options.includePatterns.length > 0) {
      const isIncluded = this.options.includePatterns.some(pattern => pattern.test(filePath));
      if (!isIncluded) {
        return true;
      }
    }

    return false;
  }

  private isTestFile(filePath: string): boolean {
    return (
      /\.(test|spec)\.(ts|js)$/.test(filePath) ||
      filePath.includes('/__tests__/') ||
      filePath.includes('/test/') ||
      filePath.includes('/tests/')
    );
  }

  /**
   * Calculate average depth of call graph nodes
   *
   * @returns Average depth of analyzed nodes
   */
  private calculateAverageDepth(): number {
    if (this.nodes.size === 0) {
      return 0;
    }

    let totalDepth = 0;
    let nodeCount = 0;

    for (const [nodeId] of this.nodes) {
      // Calculate depth based on incoming edges
      const incomingEdges = this.edges.filter(edge => edge.target === nodeId);
      const depth = incomingEdges.length;
      totalDepth += depth;
      nodeCount++;
    }

    return nodeCount > 0 ? totalDepth / nodeCount : 0;
  }
}
