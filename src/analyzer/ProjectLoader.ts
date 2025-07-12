import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

/**
 * ProjectLoader - Handles loading and managing TypeScript projects using ts-morph
 * 
 * This class provides a robust way to load TypeScript projects with proper error handling
 * and tsconfig.json discovery. It automatically searches for tsconfig.json files up the
 * directory tree if not explicitly provided.
 * 
 * @example
 * ```typescript
 * const loader = new ProjectLoader();
 * 
 * // Load with explicit tsconfig path
 * const project = await loader.loadProject('/path/to/tsconfig.json');
 * 
 * // Auto-discover tsconfig.json
 * const project = await loader.loadProject();
 * 
 * // Get source files
 * const sourceFiles = loader.getSourceFiles();
 * 
 * // Find specific file
 * const file = loader.getSourceFile('src/index.ts');
 * ```
 */
export class ProjectLoader {
  private project: Project | null = null;

  /**
   * Load a TypeScript project from tsconfig.json
   * 
   * @param tsconfigPath - Optional path to tsconfig.json. Can be:
   *   - Full path to tsconfig.json file
   *   - Path to directory containing tsconfig.json
   *   - Undefined to auto-discover from current working directory
   * @returns Promise<Project> - The loaded ts-morph Project instance
   * @throws Error if tsconfig.json is not found, invalid, or project has no source files
   */
  async loadProject(tsconfigPath?: string): Promise<Project> {
    try {
      // Find tsconfig.json
      const configPath = this.findTsConfig(tsconfigPath);
      logger.debug(`Loading project from: ${configPath}`);

      // Validate tsconfig.json exists and is readable
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        // Try to parse to check if it's valid JSON
        JSON.parse(configContent);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Invalid tsconfig.json at ${configPath}: ${error.message}`);
        }
        throw new Error(`Cannot read tsconfig.json at ${configPath}: ${error}`);
      }

      // Create ts-morph project
      try {
        this.project = new Project({
          tsConfigFilePath: configPath,
          skipAddingFilesFromTsConfig: false,
        });
      } catch (error) {
        throw new Error(`Failed to create ts-morph project: ${error}`);
      }

      // Validate project
      const sourceFiles = this.project.getSourceFiles();
      if (sourceFiles.length === 0) {
        throw new Error(
          'No source files found in project. Check your tsconfig.json includes/excludes settings.'
        );
      }

      // Check for common issues
      const diagnostics = this.project.getPreEmitDiagnostics();
      const errorDiagnostics = diagnostics.filter(d => d.getCategory() === 1); // Error category
      
      if (errorDiagnostics.length > 0) {
        logger.warn(`Found ${errorDiagnostics.length} TypeScript errors in project`);
        // Log first few errors for debugging
        errorDiagnostics.slice(0, 3).forEach(diag => {
          const message = diag.getMessageText();
          const file = diag.getSourceFile();
          if (file) {
            logger.debug(`TS Error in ${file.getFilePath()}: ${message}`);
          } else {
            logger.debug(`TS Error: ${message}`);
          }
        });
      }

      logger.success(`Loaded ${sourceFiles.length} source files`);
      return this.project;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load project', error as Error);
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('Cannot find module')) {
        throw new Error(
          `${errorMessage}. Make sure to run 'npm install' or 'yarn install' first.`
        );
      }
      
      throw error;
    }
  }

  /**
   * Find tsconfig.json file by searching up the directory tree
   */
  private findTsConfig(providedPath?: string): string {
    if (providedPath) {
      const resolvedPath = path.resolve(providedPath);
      
      // Check if it's a directory or file
      if (fs.existsSync(resolvedPath)) {
        const stats = fs.statSync(resolvedPath);
        if (stats.isDirectory()) {
          // If directory, look for tsconfig.json inside
          const tsConfigInDir = path.join(resolvedPath, 'tsconfig.json');
          if (fs.existsSync(tsConfigInDir)) {
            return tsConfigInDir;
          }
          throw new Error(`No tsconfig.json found in directory: ${resolvedPath}`);
        } else {
          // If file, use it directly
          return resolvedPath;
        }
      }
      throw new Error(`Path does not exist: ${providedPath}`);
    }

    // Search up the directory tree from current working directory
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const tsConfigPath = path.join(currentDir, 'tsconfig.json');
      if (fs.existsSync(tsConfigPath)) {
        return tsConfigPath;
      }
      currentDir = path.dirname(currentDir);
    }

    // Check root directory as last resort
    const rootTsConfig = path.join(root, 'tsconfig.json');
    if (fs.existsSync(rootTsConfig)) {
      return rootTsConfig;
    }

    throw new Error('Could not find tsconfig.json in current directory or any parent directory');
  }

  /**
   * Get the loaded project
   */
  getProject(): Project {
    if (!this.project) {
      throw new Error('Project not loaded. Call loadProject() first.');
    }
    return this.project;
  }

  /**
   * Get source file by path
   */
  getSourceFile(filePath: string): SourceFile | undefined {
    const project = this.getProject();
    
    // Normalize the file path
    const normalizedPath = path.normalize(filePath);
    
    // Try exact path
    let sourceFile = project.getSourceFile(normalizedPath);
    
    // Try absolute path
    if (!sourceFile && !path.isAbsolute(normalizedPath)) {
      const absolutePath = path.resolve(normalizedPath);
      sourceFile = project.getSourceFile(absolutePath);
    }
    
    // Try relative to current working directory
    if (!sourceFile) {
      const cwdRelative = path.relative(process.cwd(), normalizedPath);
      sourceFile = project.getSourceFile(cwdRelative);
    }
    
    // Try searching by filename
    if (!sourceFile) {
      const fileName = path.basename(normalizedPath);
      const allSourceFiles = project.getSourceFiles();
      sourceFile = allSourceFiles.find(sf => 
        path.basename(sf.getFilePath()) === fileName
      );
    }

    return sourceFile;
  }
  
  /**
   * Get all source files in the project
   */
  getSourceFiles(): SourceFile[] {
    return this.getProject().getSourceFiles();
  }
  
  /**
   * Get the tsconfig file path
   */
  getTsConfigPath(): string | undefined {
    if (!this.project) return undefined;
    
    const compilerOptions = this.project.getCompilerOptions();
    const configFilePath = compilerOptions.configFilePath;
    
    if (typeof configFilePath === 'string') {
      return configFilePath;
    }
    
    return undefined;
  }
}