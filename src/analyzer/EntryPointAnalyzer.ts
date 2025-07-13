import { Project, SourceFile, Node } from 'ts-morph';
import { CallGraphAnalyzer } from './CallGraphAnalyzer';
import {
  CallGraph,
  EntryPointLocation,
  ProjectContext,
  CallGraphAnalysisOptions,
} from '../types/CallGraph';
import { logger } from '../utils/logger';
import { EntryPointFinder } from './EntryPointFinder';
import * as path from 'path';

export class EntryPointAnalyzer {
  private project: Project;
  private context: ProjectContext;
  private entryPointFinder: EntryPointFinder;

  constructor(context: ProjectContext) {
    this.context = context;
    const projectOptions: { skipAddingFilesFromTsConfig: boolean; tsConfigFilePath?: string } = {
      skipAddingFilesFromTsConfig: false,
    };

    if (context.tsConfigPath) {
      projectOptions.tsConfigFilePath = context.tsConfigPath;
    }

    this.project = new Project(projectOptions);
    this.entryPointFinder = new EntryPointFinder(this.project);
  }

  /**
   * Discover potential entry points in the project
   */
  async discoverEntryPoints(): Promise<EntryPointLocation[]> {
    const entryPoints: EntryPointLocation[] = [];
    const sourceFiles = this.getSourceFiles();

    logger.progress(`Discovering entry points in ${sourceFiles.length} files...`);

    for (const sourceFile of sourceFiles) {
      const fileEntryPoints = this.analyzeFileForEntryPoints(sourceFile);
      entryPoints.push(...fileEntryPoints);
    }

    logger.success(`Found ${entryPoints.length} potential entry points`);
    return entryPoints;
  }

  /**
   * Analyze multiple entry points and generate call graphs
   */
  async analyzeMultipleEntryPoints(
    entryPoints: string[],
    options: CallGraphAnalysisOptions = {}
  ): Promise<Map<string, CallGraph>> {
    const results = new Map<string, CallGraph>();
    const analyzer = new CallGraphAnalyzer(this.context, options);

    logger.progress(`Analyzing ${entryPoints.length} entry points...`);

    for (const entryPoint of entryPoints) {
      try {
        logger.debug(`Analyzing entry point: ${entryPoint}`);
        const callGraph = await analyzer.analyzeFromEntryPoint(entryPoint);
        results.set(entryPoint, callGraph);
        logger.debug(` Completed analysis for: ${entryPoint}`);
      } catch (error) {
        logger.warn(` Failed to analyze entry point ${entryPoint}:`, error);
        // Continue with other entry points
      }
    }

    logger.success(`Successfully analyzed ${results.size}/${entryPoints.length} entry points`);
    return results;
  }

  /**
   * Find entry points by pattern matching
   */
  async findEntryPointsByPattern(patterns: string[]): Promise<EntryPointLocation[]> {
    const entryPoints: EntryPointLocation[] = [];
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
  async findCommonEntryPoints(): Promise<{
    controllers: EntryPointLocation[];
    handlers: EntryPointLocation[];
    mainFunctions: EntryPointLocation[];
    exportedFunctions: EntryPointLocation[];
  }> {
    const sourceFiles = this.getSourceFiles();
    const controllers: EntryPointLocation[] = [];
    const handlers: EntryPointLocation[] = [];
    const mainFunctions: EntryPointLocation[] = [];
    const exportedFunctions: EntryPointLocation[] = [];

    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      const fileName = path.basename(filePath);

      // Controllers
      if (fileName.toLowerCase().includes('controller')) {
        const points = this.findControllerMethods(sourceFile);
        controllers.push(...points);
      }

      // Handlers
      if (fileName.toLowerCase().includes('handler') || fileName.toLowerCase().includes('route')) {
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
      exportedFunctions,
    };
  }

  /**
   * Validate if an entry point exists and is accessible
   */
  async validateEntryPoint(entryPoint: string): Promise<{
    isValid: boolean;
    error?: string;
    location?: EntryPointLocation;
  }> {
    try {
      const entryPointInfo = this.entryPointFinder.findEntryPoint(entryPoint);
      
      return {
        isValid: true,
        location: {
          filePath: entryPointInfo.file,
          functionName: entryPointInfo.name,
          className: entryPointInfo.className,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private analyzeFileForEntryPoints(sourceFile: SourceFile): EntryPointLocation[] {
    const entryPoints: EntryPointLocation[] = [];
    const filePath = sourceFile.getFilePath();

    // Find exported functions
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      const decl = declarations[0];
      if (Node.isFunctionDeclaration(decl)) {
        entryPoints.push({
          filePath,
          functionName: name,
          className: undefined,
          exportName: name,
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
          className: undefined,
        });
      }
    }

    // Find class methods
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const className = cls.getName();
      if (!className) continue;

      // Methods
      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        entryPoints.push({
          filePath,
          functionName: methodName,
          className,
          exportName: undefined,
        });
      }

      // Constructor
      const constructors = cls.getConstructors();
      if (constructors.length > 0) {
        entryPoints.push({
          filePath,
          functionName: 'constructor',
          className,
          exportName: undefined,
        });
      }
    }

    return entryPoints;
  }

  private findControllerMethods(sourceFile: SourceFile): EntryPointLocation[] {
    const entryPoints: EntryPointLocation[] = [];
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
        if (
          httpMethods.some(httpMethod => methodName.includes(httpMethod)) ||
          methodName.includes('handle') ||
          methodName.includes('create') ||
          methodName.includes('update') ||
          methodName.includes('remove') ||
          methodName.includes('list')
        ) {
          entryPoints.push({
            filePath,
            functionName: method.getName(),
            className,
          });
        }
      }
    }

    return entryPoints;
  }

  private findHandlerFunctions(sourceFile: SourceFile): EntryPointLocation[] {
    const entryPoints: EntryPointLocation[] = [];
    const filePath = sourceFile.getFilePath();

    // Look for exported functions that look like handlers
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      const decl = declarations[0];
      if (Node.isFunctionDeclaration(decl)) {
        const funcName = name.toLowerCase();
        if (
          funcName.includes('handler') ||
          funcName.includes('handle') ||
          funcName.includes('route') ||
          funcName.includes('middleware')
        ) {
          entryPoints.push({
            filePath,
            functionName: name,
            exportName: name,
          });
        }
      }
    }

    return entryPoints;
  }

  private findMainFunctions(sourceFile: SourceFile): EntryPointLocation[] {
    const entryPoints: EntryPointLocation[] = [];
    const filePath = sourceFile.getFilePath();

    // Look for main, start, init, bootstrap functions
    const mainPatterns = ['main', 'start', 'init', 'bootstrap', 'run', 'execute'];

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const name = func.getName();
      if (name && mainPatterns.includes(name.toLowerCase())) {
        entryPoints.push({
          filePath,
          functionName: name,
        });
      }
    }

    // Also check exported declarations
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      if (mainPatterns.includes(name.toLowerCase())) {
        const decl = declarations[0];
        if (Node.isFunctionDeclaration(decl)) {
          entryPoints.push({
            filePath,
            functionName: name,
            exportName: name,
          });
        }
      }
    }

    return entryPoints;
  }

  private findExportedFunctions(sourceFile: SourceFile): EntryPointLocation[] {
    const entryPoints: EntryPointLocation[] = [];
    const filePath = sourceFile.getFilePath();

    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      const decl = declarations[0];
      if (Node.isFunctionDeclaration(decl)) {
        entryPoints.push({
          filePath,
          functionName: name,
          className: undefined,
          exportName: name,
        });
      }
    }

    return entryPoints;
  }

  private getSourceFiles(): SourceFile[] {
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
          // Convert glob pattern to regex
          const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\./g, '\\.');
          const regex = new RegExp(regexPattern);
          return regex.test(filePath);
        });
        if (!isInSource) {
          return false;
        }
      }

      // Check exclude patterns
      if (this.context.excludePatterns.length > 0) {
        const isExcluded = this.context.excludePatterns.some(pattern => {
          if (pattern.startsWith('/') || pattern.endsWith('$')) {
            // Treat as regex pattern
            const regex = new RegExp(pattern);
            return regex.test(filePath);
          } else {
            // Treat as simple string inclusion
            return filePath.includes(pattern);
          }
        });
        if (isExcluded) {
          return false;
        }
      }

      return true;
    });
  }

}
