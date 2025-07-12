"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGraphAnalyzer = void 0;
const ts_morph_1 = require("ts-morph");
const CallGraph_1 = require("../types/CallGraph");
const logger_1 = require("../utils/logger");
class CallGraphAnalyzer {
    constructor(context, options = {}) {
        this.visitedNodes = new Set();
        this.nodes = new Map();
        this.edges = [];
        this.currentDepth = 0;
        this.context = context;
        this.options = {
            maxDepth: options.maxDepth ?? 10,
            includeNodeModules: options.includeNodeModules ?? false,
            includeTestFiles: options.includeTestFiles ?? false,
            excludePatterns: options.excludePatterns ?? [/\.test\.ts$/, /\.spec\.ts$/, /node_modules/],
            includePatterns: options.includePatterns ?? [],
            followImports: options.followImports ?? true,
            analyzeCallbacks: options.analyzeCallbacks ?? true,
            collectMetrics: options.collectMetrics ?? false
        };
        const projectOptions = {
            skipAddingFilesFromTsConfig: false
        };
        if (context.tsConfigPath) {
            projectOptions.tsConfigFilePath = context.tsConfigPath;
        }
        this.project = new ts_morph_1.Project(projectOptions);
        logger_1.logger.debug(`Initialized CallGraphAnalyzer with context:`, context);
    }
    async analyzeFromEntryPoint(entryPoint) {
        const startTime = Date.now();
        logger_1.logger.progress(`Starting analysis from entry point: ${entryPoint}`);
        try {
            // Reset state
            this.visitedNodes.clear();
            this.nodes.clear();
            this.edges = [];
            this.currentDepth = 0;
            // Parse entry point
            const { filePath, functionName, className } = this.parseEntryPoint(entryPoint);
            // Find and analyze entry point
            const sourceFile = this.getSourceFile(filePath);
            const entryNode = this.findEntryPointNode(sourceFile, functionName, className);
            if (!entryNode) {
                throw new CallGraph_1.CallGraphError(`Entry point not found: ${functionName}${className ? ` in class ${className}` : ''}`, 'ENTRY_POINT_NOT_FOUND', filePath);
            }
            const entryNodeId = this.generateNodeId(entryNode);
            logger_1.logger.debug(`Found entry point node: ${entryNodeId}`);
            // Perform analysis
            await this.analyzeNode(entryNode, 0);
            const analysisTime = Date.now() - startTime;
            logger_1.logger.success(`Analysis completed in ${analysisTime}ms. Found ${this.nodes.size} nodes and ${this.edges.length} edges.`);
            // Build result
            const metadata = {
                generatedAt: new Date().toISOString(),
                entryPoint: entryPoint,
                maxDepth: this.options.maxDepth,
                projectRoot: this.context.rootPath,
                tsConfigPath: this.context.tsConfigPath || undefined,
                totalFiles: this.project.getSourceFiles().length,
                analysisTimeMs: analysisTime
            };
            return {
                metadata,
                nodes: Array.from(this.nodes.values()),
                edges: this.edges,
                entryPointId: entryNodeId
            };
        }
        catch (error) {
            const analysisTime = Date.now() - startTime;
            logger_1.logger.error(`Analysis failed after ${analysisTime}ms:`, error);
            throw error;
        }
    }
    parseEntryPoint(entryPoint) {
        // Support formats:
        // - "path/to/file.ts#functionName"
        // - "path/to/file.ts#ClassName.methodName"
        const [filePath, functionRef] = entryPoint.split('#');
        if (!filePath || !functionRef) {
            throw new CallGraph_1.CallGraphError(`Invalid entry point format: ${entryPoint}. Expected format: "path/to/file.ts#functionName" or "path/to/file.ts#ClassName.methodName"`, 'INVALID_ENTRY_POINT_FORMAT');
        }
        const parts = functionRef.split('.');
        if (parts.length === 1) {
            return { filePath, functionName: parts[0], className: undefined };
        }
        else if (parts.length === 2) {
            return { filePath, className: parts[0], functionName: parts[1] };
        }
        else {
            throw new CallGraph_1.CallGraphError(`Invalid function reference: ${functionRef}. Expected format: "functionName" or "ClassName.methodName"`, 'INVALID_FUNCTION_REFERENCE');
        }
    }
    getSourceFile(filePath) {
        const sourceFile = this.project.getSourceFile(filePath);
        if (!sourceFile) {
            throw new CallGraph_1.CallGraphError(`Source file not found: ${filePath}`, 'SOURCE_FILE_NOT_FOUND', filePath);
        }
        return sourceFile;
    }
    findEntryPointNode(sourceFile, functionName, className) {
        if (className) {
            // Look for class method
            const classDecl = sourceFile.getClass(className);
            if (classDecl) {
                const method = classDecl.getMethod(functionName) ||
                    classDecl.getGetAccessor(functionName) ||
                    classDecl.getSetAccessor(functionName);
                if (method)
                    return method;
                // Check constructor
                if (functionName === 'constructor') {
                    const constructor = classDecl.getConstructors()[0];
                    if (constructor)
                        return constructor;
                }
            }
        }
        else {
            // Look for top-level function
            const func = sourceFile.getFunction(functionName);
            if (func)
                return func;
            // Look for exported functions
            const exportedDeclarations = sourceFile.getExportedDeclarations();
            for (const [name, declarations] of exportedDeclarations) {
                if (name === functionName) {
                    const decl = declarations[0];
                    if (this.isFunctionLikeNode(decl)) {
                        return decl;
                    }
                }
            }
            // Look for variable declarations with function expressions or arrow functions
            const variableStatements = sourceFile.getVariableStatements();
            for (const varStatement of variableStatements) {
                for (const declaration of varStatement.getDeclarations()) {
                    if (declaration.getName() === functionName) {
                        const initializer = declaration.getInitializer();
                        if (initializer && this.isFunctionLikeNode(initializer)) {
                            return initializer;
                        }
                    }
                }
            }
        }
        return undefined;
    }
    async analyzeNode(node, depth) {
        if (depth >= this.options.maxDepth) {
            logger_1.logger.debug(`Reached max depth ${this.options.maxDepth}, stopping analysis`);
            return;
        }
        const nodeId = this.generateNodeId(node);
        if (this.visitedNodes.has(nodeId)) {
            logger_1.logger.debug(`Node already visited: ${nodeId}`);
            return;
        }
        this.visitedNodes.add(nodeId);
        this.currentDepth = Math.max(this.currentDepth, depth);
        // Extract node information
        const nodeInfo = this.extractNodeInfo(node);
        if (nodeInfo) {
            this.nodes.set(nodeId, nodeInfo);
            logger_1.logger.debug(`Added node: ${nodeInfo.name} (${nodeInfo.type})`);
        }
        // Find all call expressions in this node
        const callExpressions = this.findCallExpressions(node);
        logger_1.logger.debug(`Found ${callExpressions.length} call expressions in ${nodeId}`);
        for (const callExpr of callExpressions) {
            await this.analyzeCallExpression(callExpr, nodeId, depth + 1);
        }
        // Analyze callbacks if enabled
        if (this.options.analyzeCallbacks) {
            await this.analyzeCallbacks(node, nodeId, depth + 1);
        }
    }
    async analyzeCallExpression(callExpr, sourceNodeId, depth) {
        try {
            const targetNode = this.resolveCallTarget(callExpr);
            if (!targetNode) {
                logger_1.logger.debug(`Could not resolve call target for expression at line ${callExpr.getStartLineNumber()}`);
                return;
            }
            if (this.shouldSkipNode(targetNode)) {
                logger_1.logger.debug(`Skipping external node: ${this.generateNodeId(targetNode)}`);
                return;
            }
            const targetNodeId = this.generateNodeId(targetNode);
            // Create edge
            const edge = {
                id: `${sourceNodeId}->${targetNodeId}-${this.edges.length}`,
                source: sourceNodeId,
                target: targetNodeId,
                type: this.determineCallType(callExpr),
                line: callExpr.getStartLineNumber(),
                column: callExpr.getStart() - callExpr.getStartLinePos(),
                argumentTypes: this.extractArgumentTypes(callExpr)
            };
            this.edges.push(edge);
            logger_1.logger.debug(`Added edge: ${edge.source} -> ${edge.target} (${edge.type})`);
            // Recursively analyze target
            await this.analyzeNode(targetNode, depth);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to analyze call expression at line ${callExpr.getStartLineNumber()}:`, error);
        }
    }
    resolveCallTarget(callExpr) {
        const expression = callExpr.getExpression();
        // Direct function call: functionName()
        if (ts_morph_1.Node.isIdentifier(expression)) {
            return this.resolveIdentifierTarget(expression);
        }
        // Property access: obj.method()
        if (ts_morph_1.Node.isPropertyAccessExpression(expression)) {
            return this.resolvePropertyAccessTarget(expression);
        }
        // TODO: Handle other cases like computed property access, etc.
        return undefined;
    }
    resolveIdentifierTarget(identifier) {
        const symbol = identifier.getSymbol();
        if (!symbol)
            return undefined;
        const declarations = symbol.getDeclarations();
        if (declarations.length === 0)
            return undefined;
        const declaration = declarations[0];
        if (!declaration)
            return undefined;
        // If it's a variable declaration, check if it has a function initializer
        if (ts_morph_1.Node.isVariableDeclaration(declaration)) {
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
    resolvePropertyAccessTarget(propAccess) {
        const nameNode = propAccess.getNameNode();
        const objectExpr = propAccess.getExpression();
        // Get the type of the object being accessed
        const objectType = objectExpr.getType();
        const methodSymbol = objectType.getProperty(nameNode.getText());
        if (!methodSymbol)
            return undefined;
        const declarations = methodSymbol.getDeclarations();
        if (declarations.length === 0)
            return undefined;
        return declarations[0];
    }
    findCallExpressions(node) {
        return node.getDescendantsOfKind(ts_morph_1.SyntaxKind.CallExpression);
    }
    async analyzeCallbacks(node, parentNodeId, depth) {
        // Find arrow functions
        const arrowFunctions = node.getDescendantsOfKind(ts_morph_1.SyntaxKind.ArrowFunction);
        for (const arrow of arrowFunctions) {
            await this.analyzeCallbackFunction(arrow, parentNodeId, 'callback', depth);
        }
        // Find function expressions
        const functionExpressions = node.getDescendantsOfKind(ts_morph_1.SyntaxKind.FunctionExpression);
        for (const funcExpr of functionExpressions) {
            await this.analyzeCallbackFunction(funcExpr, parentNodeId, 'callback', depth);
        }
    }
    async analyzeCallbackFunction(callbackNode, parentNodeId, edgeType, depth) {
        const callbackNodeId = this.generateNodeId(callbackNode);
        // Create edge from parent to callback
        const edge = {
            id: `${parentNodeId}->${callbackNodeId}-${this.edges.length}`,
            source: parentNodeId,
            target: callbackNodeId,
            type: edgeType,
            line: callbackNode.getStartLineNumber(),
            column: callbackNode.getStart() - callbackNode.getStartLinePos()
        };
        this.edges.push(edge);
        // Analyze the callback function
        await this.analyzeNode(callbackNode, depth);
    }
    extractNodeInfo(node) {
        const sourceFile = node.getSourceFile();
        const filePath = sourceFile.getFilePath();
        if (ts_morph_1.Node.isFunctionDeclaration(node)) {
            return {
                id: this.generateNodeId(node),
                name: node.getName() || 'anonymous',
                filePath,
                line: node.getStartLineNumber(),
                column: node.getStart() - node.getStartLinePos(),
                type: 'function',
                async: node.isAsync(),
                parameters: this.extractParameters(node),
                returnType: node.getReturnType().getText()
            };
        }
        if (ts_morph_1.Node.isMethodDeclaration(node)) {
            const classDecl = node.getParent();
            const className = ts_morph_1.Node.isClassDeclaration(classDecl) ? classDecl.getName() : undefined;
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
                ...(className && { className })
            };
        }
        if (ts_morph_1.Node.isArrowFunction(node)) {
            return {
                id: this.generateNodeId(node),
                name: 'arrow-function',
                filePath,
                line: node.getStartLineNumber(),
                column: node.getStart() - node.getStartLinePos(),
                type: 'arrow',
                async: node.isAsync(),
                parameters: this.extractParameters(node),
                returnType: node.getReturnType().getText()
            };
        }
        if (ts_morph_1.Node.isFunctionExpression(node)) {
            return {
                id: this.generateNodeId(node),
                name: node.getName() || 'function-expression',
                filePath,
                line: node.getStartLineNumber(),
                column: node.getStart() - node.getStartLinePos(),
                type: 'function',
                async: node.isAsync(),
                parameters: this.extractParameters(node),
                returnType: node.getReturnType().getText()
            };
        }
        if (ts_morph_1.Node.isConstructorDeclaration(node)) {
            const classDecl = node.getParent();
            const className = ts_morph_1.Node.isClassDeclaration(classDecl) ? classDecl.getName() : undefined;
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
                ...(className && { className })
            };
        }
        return undefined;
    }
    extractParameters(node) {
        return node.getParameters().map(param => {
            const defaultValue = param.getInitializer()?.getText();
            return {
                name: param.getName(),
                type: param.getType().getText(),
                optional: param.isOptional(),
                ...(defaultValue && { defaultValue })
            };
        });
    }
    getVisibility(node) {
        if (node.hasModifier(ts_morph_1.SyntaxKind.PrivateKeyword))
            return 'private';
        if (node.hasModifier(ts_morph_1.SyntaxKind.ProtectedKeyword))
            return 'protected';
        return 'public';
    }
    determineCallType(callExpr) {
        // Check if it's awaited
        const parent = callExpr.getParent();
        if (parent && ts_morph_1.Node.isAwaitExpression(parent)) {
            return 'async';
        }
        // Check for Promise methods
        const expression = callExpr.getExpression();
        if (ts_morph_1.Node.isPropertyAccessExpression(expression)) {
            const methodName = expression.getName();
            if (['then', 'catch', 'finally'].includes(methodName)) {
                return 'async';
            }
        }
        // Check if it's a constructor call
        if (ts_morph_1.Node.isNewExpression(callExpr.getParent())) {
            return 'constructor';
        }
        return 'sync';
    }
    extractArgumentTypes(callExpr) {
        return callExpr.getArguments().map(arg => arg.getType().getText());
    }
    generateNodeId(node) {
        const sourceFile = node.getSourceFile();
        const filePath = sourceFile.getFilePath();
        const start = node.getStart();
        if (ts_morph_1.Node.isFunctionDeclaration(node) || ts_morph_1.Node.isMethodDeclaration(node)) {
            const name = node.getName();
            const parent = node.getParent();
            if (ts_morph_1.Node.isClassDeclaration(parent)) {
                return `${filePath}#${parent.getName()}.${name}`;
            }
            return `${filePath}#${name}`;
        }
        if (ts_morph_1.Node.isConstructorDeclaration(node)) {
            const parent = node.getParent();
            if (ts_morph_1.Node.isClassDeclaration(parent)) {
                return `${filePath}#${parent.getName()}.constructor`;
            }
        }
        return `${filePath}#${start}`;
    }
    isFunctionLikeNode(node) {
        return ts_morph_1.Node.isFunctionDeclaration(node) ||
            ts_morph_1.Node.isMethodDeclaration(node) ||
            ts_morph_1.Node.isArrowFunction(node) ||
            ts_morph_1.Node.isFunctionExpression(node) ||
            ts_morph_1.Node.isConstructorDeclaration(node) ||
            ts_morph_1.Node.isGetAccessorDeclaration(node) ||
            ts_morph_1.Node.isSetAccessorDeclaration(node);
    }
    shouldSkipNode(node) {
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
    isTestFile(filePath) {
        return /\.(test|spec)\.(ts|js)$/.test(filePath) ||
            filePath.includes('/__tests__/') ||
            filePath.includes('/test/') ||
            filePath.includes('/tests/');
    }
}
exports.CallGraphAnalyzer = CallGraphAnalyzer;
//# sourceMappingURL=CallGraphAnalyzer.js.map