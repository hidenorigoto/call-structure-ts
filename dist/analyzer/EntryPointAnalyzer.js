"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryPointAnalyzer = void 0;
const ts_morph_1 = require("ts-morph");
const CallGraphAnalyzer_1 = require("./CallGraphAnalyzer");
const CallGraph_1 = require("../types/CallGraph");
const logger_1 = require("../utils/logger");
const path = __importStar(require("path"));
class EntryPointAnalyzer {
    constructor(context) {
        this.context = context;
        const projectOptions = {
            skipAddingFilesFromTsConfig: false
        };
        if (context.tsConfigPath) {
            projectOptions.tsConfigFilePath = context.tsConfigPath;
        }
        this.project = new ts_morph_1.Project(projectOptions);
    }
    /**
     * Discover potential entry points in the project
     */
    async discoverEntryPoints() {
        const entryPoints = [];
        const sourceFiles = this.getSourceFiles();
        logger_1.logger.progress(`Discovering entry points in ${sourceFiles.length} files...`);
        for (const sourceFile of sourceFiles) {
            const fileEntryPoints = this.analyzeFileForEntryPoints(sourceFile);
            entryPoints.push(...fileEntryPoints);
        }
        logger_1.logger.success(`Found ${entryPoints.length} potential entry points`);
        return entryPoints;
    }
    /**
     * Analyze multiple entry points and generate call graphs
     */
    async analyzeMultipleEntryPoints(entryPoints, options = {}) {
        const results = new Map();
        const analyzer = new CallGraphAnalyzer_1.CallGraphAnalyzer(this.context, options);
        logger_1.logger.progress(`Analyzing ${entryPoints.length} entry points...`);
        for (const entryPoint of entryPoints) {
            try {
                logger_1.logger.debug(`Analyzing entry point: ${entryPoint}`);
                const callGraph = await analyzer.analyzeFromEntryPoint(entryPoint);
                results.set(entryPoint, callGraph);
                logger_1.logger.debug(` Completed analysis for: ${entryPoint}`);
            }
            catch (error) {
                logger_1.logger.warn(` Failed to analyze entry point ${entryPoint}:`, error);
                // Continue with other entry points
            }
        }
        logger_1.logger.success(`Successfully analyzed ${results.size}/${entryPoints.length} entry points`);
        return results;
    }
    /**
     * Find entry points by pattern matching
     */
    async findEntryPointsByPattern(patterns) {
        const entryPoints = [];
        const sourceFiles = this.getSourceFiles();
        for (const sourceFile of sourceFiles) {
            const filePath = sourceFile.getFilePath();
            // Check if file matches any pattern
            const matchesPattern = patterns.some(pattern => {
                const regex = new RegExp(pattern);
                return regex.test(filePath);
            });
            if (matchesPattern) {
                const fileEntryPoints = this.analyzeFileForEntryPoints(sourceFile);
                entryPoints.push(...fileEntryPoints);
            }
        }
        return entryPoints;
    }
    /**
     * Find common entry point patterns (controllers, handlers, main functions)
     */
    async findCommonEntryPoints() {
        const sourceFiles = this.getSourceFiles();
        const controllers = [];
        const handlers = [];
        const mainFunctions = [];
        const exportedFunctions = [];
        for (const sourceFile of sourceFiles) {
            const filePath = sourceFile.getFilePath();
            const fileName = path.basename(filePath);
            // Controllers
            if (fileName.toLowerCase().includes('controller')) {
                const points = this.findControllerMethods(sourceFile);
                controllers.push(...points);
            }
            // Handlers
            if (fileName.toLowerCase().includes('handler') ||
                fileName.toLowerCase().includes('route')) {
                const points = this.findHandlerFunctions(sourceFile);
                handlers.push(...points);
            }
            // Main functions
            const mainPoints = this.findMainFunctions(sourceFile);
            mainFunctions.push(...mainPoints);
            // Exported functions
            const exportPoints = this.findExportedFunctions(sourceFile);
            exportedFunctions.push(...exportPoints);
        }
        return {
            controllers,
            handlers,
            mainFunctions,
            exportedFunctions
        };
    }
    /**
     * Validate if an entry point exists and is accessible
     */
    async validateEntryPoint(entryPoint) {
        try {
            const { filePath, functionName, className } = this.parseEntryPoint(entryPoint);
            // Check if file exists
            const sourceFile = this.project.getSourceFile(filePath);
            if (!sourceFile) {
                return {
                    isValid: false,
                    error: `Source file not found: ${filePath}`
                };
            }
            // Check if function/method exists
            const node = this.findEntryPointNode(sourceFile, functionName, className);
            if (!node) {
                return {
                    isValid: false,
                    error: `Function ${functionName}${className ? ` in class ${className}` : ''} not found in ${filePath}`
                };
            }
            return {
                isValid: true,
                location: {
                    filePath,
                    functionName,
                    className
                }
            };
        }
        catch (error) {
            return {
                isValid: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    analyzeFileForEntryPoints(sourceFile) {
        const entryPoints = [];
        const filePath = sourceFile.getFilePath();
        // Find exported functions
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
            const decl = declarations[0];
            if (ts_morph_1.Node.isFunctionDeclaration(decl)) {
                entryPoints.push({
                    filePath,
                    functionName: name,
                    className: undefined,
                    exportName: name
                });
            }
        }
        // Find top-level functions
        const functions = sourceFile.getFunctions();
        for (const func of functions) {
            const name = func.getName();
            if (name) {
                entryPoints.push({
                    filePath,
                    functionName: name,
                    className: undefined
                });
            }
        }
        // Find class methods
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
            const className = cls.getName();
            if (!className)
                continue;
            // Methods
            for (const method of cls.getMethods()) {
                const methodName = method.getName();
                entryPoints.push({
                    filePath,
                    functionName: methodName,
                    className,
                    exportName: undefined
                });
            }
            // Constructor
            const constructors = cls.getConstructors();
            if (constructors.length > 0) {
                entryPoints.push({
                    filePath,
                    functionName: 'constructor',
                    className,
                    exportName: undefined
                });
            }
        }
        return entryPoints;
    }
    findControllerMethods(sourceFile) {
        const entryPoints = [];
        const filePath = sourceFile.getFilePath();
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
            const className = cls.getName();
            if (!className || !className.toLowerCase().includes('controller')) {
                continue;
            }
            // Look for HTTP method-like methods
            const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
            for (const method of cls.getMethods()) {
                const methodName = method.getName().toLowerCase();
                // Check if method looks like an HTTP handler
                if (httpMethods.some(httpMethod => methodName.includes(httpMethod)) ||
                    methodName.includes('handle') ||
                    methodName.includes('create') ||
                    methodName.includes('update') ||
                    methodName.includes('remove') ||
                    methodName.includes('list')) {
                    entryPoints.push({
                        filePath,
                        functionName: method.getName(),
                        className
                    });
                }
            }
        }
        return entryPoints;
    }
    findHandlerFunctions(sourceFile) {
        const entryPoints = [];
        const filePath = sourceFile.getFilePath();
        // Look for exported functions that look like handlers
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
            const decl = declarations[0];
            if (ts_morph_1.Node.isFunctionDeclaration(decl)) {
                const funcName = name.toLowerCase();
                if (funcName.includes('handler') ||
                    funcName.includes('handle') ||
                    funcName.includes('route') ||
                    funcName.includes('middleware')) {
                    entryPoints.push({
                        filePath,
                        functionName: name,
                        exportName: name
                    });
                }
            }
        }
        return entryPoints;
    }
    findMainFunctions(sourceFile) {
        const entryPoints = [];
        const filePath = sourceFile.getFilePath();
        // Look for main, start, init, bootstrap functions
        const mainPatterns = ['main', 'start', 'init', 'bootstrap', 'run', 'execute'];
        const functions = sourceFile.getFunctions();
        for (const func of functions) {
            const name = func.getName();
            if (name && mainPatterns.includes(name.toLowerCase())) {
                entryPoints.push({
                    filePath,
                    functionName: name
                });
            }
        }
        // Also check exported declarations
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
            if (mainPatterns.includes(name.toLowerCase())) {
                const decl = declarations[0];
                if (ts_morph_1.Node.isFunctionDeclaration(decl)) {
                    entryPoints.push({
                        filePath,
                        functionName: name,
                        exportName: name
                    });
                }
            }
        }
        return entryPoints;
    }
    findExportedFunctions(sourceFile) {
        const entryPoints = [];
        const filePath = sourceFile.getFilePath();
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
            const decl = declarations[0];
            if (ts_morph_1.Node.isFunctionDeclaration(decl)) {
                entryPoints.push({
                    filePath,
                    functionName: name,
                    className: undefined,
                    exportName: name
                });
            }
        }
        return entryPoints;
    }
    getSourceFiles() {
        return this.project.getSourceFiles().filter(sf => {
            const filePath = sf.getFilePath();
            // Skip node_modules
            if (filePath.includes('node_modules')) {
                return false;
            }
            // Skip declaration files
            if (filePath.endsWith('.d.ts')) {
                return false;
            }
            // Check if file is in project source patterns
            if (this.context.sourcePatterns.length > 0) {
                const isInSource = this.context.sourcePatterns.some(pattern => {
                    const regex = new RegExp(pattern);
                    return regex.test(filePath);
                });
                if (!isInSource) {
                    return false;
                }
            }
            // Check exclude patterns
            if (this.context.excludePatterns.length > 0) {
                const isExcluded = this.context.excludePatterns.some(pattern => {
                    const regex = new RegExp(pattern);
                    return regex.test(filePath);
                });
                if (isExcluded) {
                    return false;
                }
            }
            return true;
        });
    }
    parseEntryPoint(entryPoint) {
        const [filePath, functionRef] = entryPoint.split('#');
        if (!filePath || !functionRef) {
            throw new CallGraph_1.CallGraphError(`Invalid entry point format: ${entryPoint}`, 'INVALID_ENTRY_POINT_FORMAT');
        }
        const parts = functionRef.split('.');
        if (parts.length === 1) {
            return { filePath, functionName: parts[0], className: undefined };
        }
        else if (parts.length === 2) {
            return { filePath, className: parts[0], functionName: parts[1] };
        }
        else {
            throw new CallGraph_1.CallGraphError(`Invalid function reference: ${functionRef}`, 'INVALID_FUNCTION_REFERENCE');
        }
    }
    findEntryPointNode(sourceFile, functionName, className) {
        if (className) {
            const classDecl = sourceFile.getClass(className);
            if (classDecl) {
                const method = classDecl.getMethod(functionName);
                if (method)
                    return method;
                if (functionName === 'constructor') {
                    const constructor = classDecl.getConstructors()[0];
                    if (constructor)
                        return constructor;
                }
            }
        }
        else {
            const func = sourceFile.getFunction(functionName);
            if (func)
                return func;
            // Check exported functions
            const exportedDeclarations = sourceFile.getExportedDeclarations();
            for (const [name, declarations] of exportedDeclarations) {
                if (name === functionName) {
                    const decl = declarations[0];
                    if (ts_morph_1.Node.isFunctionDeclaration(decl)) {
                        return decl;
                    }
                }
            }
        }
        return undefined;
    }
}
exports.EntryPointAnalyzer = EntryPointAnalyzer;
//# sourceMappingURL=EntryPointAnalyzer.js.map