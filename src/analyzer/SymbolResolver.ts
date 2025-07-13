import {
  Symbol as TsSymbol,
  Node,
  Identifier,
  PropertyAccessExpression,
  Project,
  SourceFile,
} from 'ts-morph';
import { logger } from '../utils/logger';

/**
 * Symbol resolver for tracking function calls across modules.
 * 
 * This class provides comprehensive symbol resolution capabilities including:
 * - Resolving identifiers to their declarations
 * - Handling import statements and module resolution
 * - Supporting namespace and type alias resolution
 * - Generating fully qualified names for consistent node identification
 * 
 * @example
 * ```typescript
 * const resolver = new SymbolResolver(project);
 * const declaration = resolver.resolveIdentifier(identifier);
 * const fullyQualifiedName = resolver.getFullyQualifiedName(declaration);
 * ```
 */
export class SymbolResolver {
  private resolutionCache = new Map<string, Node | null>();
  private moduleCache = new Map<string, SourceFile>();

  constructor(private project: Project) {}

  /**
   * Resolve an identifier to its declaration
   * 
   * @param identifier The identifier node to resolve
   * @returns The declaration node or undefined if not found
   */
  resolveIdentifier(identifier: Identifier): Node | undefined {
    const cacheKey = `id:${identifier.getSourceFile().getFilePath()}:${identifier.getStart()}`;
    
    if (this.resolutionCache.has(cacheKey)) {
      const cached = this.resolutionCache.get(cacheKey);
      return cached || undefined;
    }

    try {
      const symbol = identifier.getSymbol();
      if (!symbol) {
        logger.debug(`No symbol found for identifier: ${identifier.getText()}`);
        this.resolutionCache.set(cacheKey, null);
        return undefined;
      }

      const resolved = this.resolveSymbol(symbol);
      this.resolutionCache.set(cacheKey, resolved || null);
      return resolved;
    } catch (error) {
      logger.debug(`Error resolving identifier ${identifier.getText()}:`, error);
      this.resolutionCache.set(cacheKey, null);
      return undefined;
    }
  }

  /**
   * Resolve a property access expression (e.g., obj.method)
   * 
   * @param propAccess The property access expression to resolve
   * @returns The declaration node or undefined if not found
   */
  resolvePropertyAccess(propAccess: PropertyAccessExpression): Node | undefined {
    const cacheKey = `prop:${propAccess.getSourceFile().getFilePath()}:${propAccess.getStart()}`;
    
    if (this.resolutionCache.has(cacheKey)) {
      const cached = this.resolutionCache.get(cacheKey);
      return cached || undefined;
    }

    try {
      const expression = propAccess.getExpression();
      const propertyName = propAccess.getName();

      // Get the type of the object
      const objectType = expression.getType();
      const propertySymbol = objectType.getProperty(propertyName);

      if (!propertySymbol) {
        logger.debug(`Property ${propertyName} not found on type ${objectType.getText()}`);
        this.resolutionCache.set(cacheKey, null);
        return undefined;
      }

      const resolved = this.resolveSymbol(propertySymbol);
      this.resolutionCache.set(cacheKey, resolved || null);
      return resolved;
    } catch (error) {
      logger.debug(`Error resolving property access ${propAccess.getText()}:`, error);
      this.resolutionCache.set(cacheKey, null);
      return undefined;
    }
  }

  /**
   * Resolve a symbol to its declaration node
   * 
   * @param symbol The symbol to resolve
   * @returns The declaration node or undefined if not found
   */
  private resolveSymbol(symbol: TsSymbol): Node | undefined {
    const declarations = symbol.getDeclarations();
    if (declarations.length === 0) {
      return undefined;
    }

    // Handle imported symbols first
    const importedSymbol = this.resolveImportedSymbol(symbol);
    if (importedSymbol) {
      return this.resolveSymbol(importedSymbol);
    }

    // Return the first declaration (primary declaration)
    return declarations[0];
  }

  /**
   * Resolve symbols that are imported from other modules
   * 
   * @param symbol The symbol to check for imports
   * @returns The original symbol from the source module or undefined
   */
  private resolveImportedSymbol(symbol: TsSymbol): TsSymbol | undefined {
    try {
      const declarations = symbol.getDeclarations();
      
      for (const decl of declarations) {
        // Check if this is an import specifier (named import)
        if (Node.isImportSpecifier(decl)) {
          // Get the actual symbol being imported
          const aliasedSymbol = symbol.getAliasedSymbol();
          if (aliasedSymbol) {
            return aliasedSymbol;
          }
        }
        
        // Check if this is an import clause (default import)
        if (Node.isImportClause(decl)) {
          const aliasedSymbol = symbol.getAliasedSymbol();
          if (aliasedSymbol) {
            return aliasedSymbol;
          }
        }
        
        // Check if this is a namespace import
        if (Node.isNamespaceImport(decl)) {
          // For namespace imports, we don't resolve further as the symbol
          // represents the namespace itself
          return undefined;
        }
      }

      return undefined;
    } catch (error) {
      logger.debug('Error resolving imported symbol:', error);
      return undefined;
    }
  }

  /**
   * Find an exported symbol in a module
   * 
   * @param moduleSymbol The module symbol to search in
   * @param exportName The name of the export to find
   * @returns The exported symbol or undefined if not found
   */
  private findExportedSymbol(
    moduleSymbol: TsSymbol,
    exportName: string
  ): TsSymbol | undefined {
    try {
      const exports = moduleSymbol.getExports();
      
      // Look for the specific export name
      for (const exportSymbol of exports) {
        const name = exportSymbol.getName();
        if (name === exportName) {
          return exportSymbol;
        }
      }

      // Check for default export
      if (exportName === 'default') {
        for (const exportSymbol of exports) {
          if (exportSymbol.getName() === 'default') {
            return exportSymbol;
          }
        }
      }

      return undefined;
    } catch (error) {
      logger.debug(`Error finding exported symbol ${exportName}:`, error);
      return undefined;
    }
  }

  /**
   * Get the fully qualified name for a node
   * 
   * @param node The node to generate a name for
   * @returns A fully qualified name string
   */
  getFullyQualifiedName(node: Node): string {
    const sourceFile = node.getSourceFile();
    const filePath = sourceFile.getFilePath();

    // Function declaration
    if (Node.isFunctionDeclaration(node)) {
      const name = node.getName() || 'anonymous';
      return `${filePath}#${name}`;
    }

    // Method declaration
    if (Node.isMethodDeclaration(node)) {
      const parent = node.getParent();
      if (Node.isClassDeclaration(parent)) {
        const className = parent.getName() || 'AnonymousClass';
        const methodName = node.getName();
        const isStatic = node.isStatic();
        
        if (isStatic) {
          return `${filePath}#${className}.${methodName}`;
        } else {
          return `${filePath}#${className}::${methodName}`;
        }
      }
      return `${filePath}#${node.getName()}`;
    }
    
    // Constructor declaration
    if (Node.isConstructorDeclaration(node)) {
      const parent = node.getParent();
      if (Node.isClassDeclaration(parent)) {
        const className = parent.getName() || 'AnonymousClass';
        return `${filePath}#${className}.constructor`;
      }
      return `${filePath}#constructor`;
    }
    
    // Getter/Setter declarations
    if (Node.isGetAccessorDeclaration(node) || Node.isSetAccessorDeclaration(node)) {
      const parent = node.getParent();
      const accessorType = Node.isGetAccessorDeclaration(node) ? 'get' : 'set';
      const name = node.getName();
      
      if (Node.isClassDeclaration(parent)) {
        const className = parent.getName() || 'AnonymousClass';
        const isStatic = node.isStatic();
        
        if (isStatic) {
          return `${filePath}#${className}.${accessorType}:${name}`;
        } else {
          return `${filePath}#${className}::${accessorType}:${name}`;
        }
      }
      return `${filePath}#${accessorType}:${name}`;
    }

    // Variable declaration with function initializer
    if (Node.isVariableDeclaration(node)) {
      const name = node.getName();
      const initializer = node.getInitializer();
      
      if (initializer && this.isFunctionLikeNode(initializer)) {
        return `${filePath}#${name}`;
      }
      
      return `${filePath}#${name}`;
    }

    // Arrow function or function expression
    if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
      // Try to find the parent variable declaration
      const parent = node.getParent();
      if (Node.isVariableDeclaration(parent)) {
        const name = parent.getName();
        return `${filePath}#${name}`;
      }
      
      // Fallback to line-based naming
      const line = node.getStartLineNumber();
      return `${filePath}#anonymous:${line}`;
    }

    // Class declaration
    if (Node.isClassDeclaration(node)) {
      const name = node.getName() || 'AnonymousClass';
      return `${filePath}#${name}`;
    }

    // Fallback for unknown node types
    const line = node.getStartLineNumber();
    const kind = node.getKindName();
    return `${filePath}#${kind}:${line}`;
  }

  /**
   * Resolve a module path to get the source file
   * 
   * @param importPath The import path to resolve
   * @param fromFile The file that contains the import
   * @returns The resolved source file or undefined
   */
  resolveModulePath(importPath: string, fromFile: string): SourceFile | undefined {
    const cacheKey = `module:${fromFile}:${importPath}`;
    
    if (this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey);
    }

    try {
      // Use ts-morph's built-in module resolution
      const sourceFile = this.project.getSourceFile(fromFile);
      if (!sourceFile) return undefined;

      // Find the import declaration
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (moduleSpecifier === importPath) {
          try {
            const resolvedModule = importDecl.getModuleSpecifierSourceFile();
            if (resolvedModule) {
              this.moduleCache.set(cacheKey, resolvedModule);
              return resolvedModule;
            }
          } catch (error) {
            // Module resolution failed, continue to next
            logger.debug(`Failed to resolve module ${importPath}:`, error);
          }
        }
      }

      return undefined;
    } catch (error) {
      logger.debug(`Error resolving module path ${importPath} from ${fromFile}:`, error);
      return undefined;
    }
  }

  /**
   * Check if a node represents a function-like construct
   * 
   * @param node The node to check
   * @returns True if the node is function-like
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
   * Clear the internal caches
   * 
   * This method can be called to free memory when the resolver
   * is no longer needed or when the project structure changes.
   */
  clearCache(): void {
    this.resolutionCache.clear();
    this.moduleCache.clear();
  }

  /**
   * Get cache statistics for debugging
   * 
   * @returns Object with cache size information
   */
  getCacheStats(): { resolutionCacheSize: number; moduleCacheSize: number } {
    return {
      resolutionCacheSize: this.resolutionCache.size,
      moduleCacheSize: this.moduleCache.size,
    };
  }
}