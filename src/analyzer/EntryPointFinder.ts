import { Project, SourceFile, Node } from 'ts-morph';
import { logger } from '../utils/logger';

export interface EntryPointInfo {
  node: Node;
  id: string;
  name: string;
  file: string;
  type: 'function' | 'method' | 'constructor' | 'getter' | 'setter' | 'arrow' | 'expression';
  isStatic?: boolean;
  className?: string;
}

export class EntryPointFinder {
  constructor(private project: Project) {}

  /**
   * Find entry point from a string like "file#function" or "file#Class.method"
   * 
   * @param entryPointStr - Entry point string in format "path/to/file.ts#functionName" or "path/to/file.ts#ClassName.methodName"
   * @returns EntryPointInfo with the found node and metadata
   * @throws Error if entry point is not found or format is invalid
   */
  findEntryPoint(entryPointStr: string): EntryPointInfo {
    const { filePath, functionName, className } = this.parseEntryPointString(entryPointStr);
    
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const node = className
      ? this.findClassMember(sourceFile, className, functionName)
      : this.findFunction(sourceFile, functionName);

    if (!node) {
      const location = className ? `${className}.${functionName}` : functionName;
      throw new Error(`Entry point not found: ${location} in ${filePath}`);
    }

    // Use the actual source file path, not the input path
    const actualFilePath = sourceFile.getFilePath();
    return this.createEntryPointInfo(node, actualFilePath, functionName, className);
  }

  /**
   * Parse entry point string
   * Examples:
   * - "src/index.ts#main"
   * - "src/services/UserService.ts#UserService.createUser"
   * - "src/utils.ts#calculateTotal" (without .ts extension)
   */
  private parseEntryPointString(str: string): {
    filePath: string;
    functionName: string;
    className?: string;
  } {
    const [filePath, identifier] = str.split('#');
    
    if (!filePath || !identifier) {
      throw new Error(`Invalid entry point format: ${str}. Expected "file#function" or "file#Class.method"`);
    }

    // Check if it's a class method (contains dot)
    if (identifier.includes('.')) {
      const parts = identifier.split('.');
      if (parts.length !== 2) {
        throw new Error(`Invalid class method format: ${identifier}. Expected "ClassName.methodName"`);
      }
      const [className, methodName] = parts;
      return { filePath, functionName: methodName, className };
    }

    return { filePath, functionName: identifier };
  }

  /**
   * Get source file with multiple resolution strategies
   */
  private getSourceFile(filePath: string): SourceFile | undefined {
    // Try exact path
    let sourceFile = this.project.getSourceFile(filePath);
    
    // Try with .ts extension if not present
    if (!sourceFile && !filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      sourceFile = this.project.getSourceFile(filePath + '.ts');
      if (!sourceFile) {
        sourceFile = this.project.getSourceFile(filePath + '.tsx');
      }
    }
    
    // Try relative to project root
    if (!sourceFile) {
      const sources = this.project.getSourceFiles();
      sourceFile = sources.find(sf => {
        const sfPath = sf.getFilePath();
        return sfPath.endsWith(filePath) || 
               sfPath.endsWith(filePath + '.ts') ||
               sfPath.endsWith(filePath + '.tsx');
      });
    }

    if (!sourceFile) {
      logger.debug(`Failed to find source file: ${filePath}`);
      logger.debug(`Tried paths: ${filePath}, ${filePath}.ts, ${filePath}.tsx`);
      logger.debug(`Available source files: ${this.project.getSourceFiles().length}`);
    }

    return sourceFile;
  }

  /**
   * Find a top-level function or variable with function value
   */
  private findFunction(sourceFile: SourceFile, functionName: string): Node | undefined {
    // Direct function declaration
    const func = sourceFile.getFunction(functionName);
    if (func) return func;

    // Variable declaration with arrow function or function expression
    const variableStatements = sourceFile.getVariableStatements();
    for (const varStatement of variableStatements) {
      for (const declaration of varStatement.getDeclarations()) {
        if (declaration.getName() === functionName) {
          const initializer = declaration.getInitializer();
          if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
            return initializer;
          }
        }
      }
    }

    // Exported declarations
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      if (name === functionName) {
        for (const decl of declarations) {
          if (Node.isFunctionDeclaration(decl)) {
            return decl;
          }
          // Check if it's a variable declaration with function
          if (Node.isVariableDeclaration(decl)) {
            const initializer = decl.getInitializer();
            if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
              return initializer;
            }
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Find a class member (method, constructor, getter, setter)
   */
  private findClassMember(
    sourceFile: SourceFile, 
    className: string, 
    memberName: string
  ): Node | undefined {
    const classDecl = sourceFile.getClass(className);
    if (!classDecl) {
      logger.debug(`Class ${className} not found in ${sourceFile.getFilePath()}`);
      return undefined;
    }

    // Special case for constructor
    if (memberName === 'constructor') {
      const constructors = classDecl.getConstructors();
      return constructors.length > 0 ? constructors[0] : undefined;
    }

    // Try instance method
    const method = classDecl.getMethod(memberName);
    if (method) return method;

    // Try static method
    const staticMethod = classDecl.getStaticMethod(memberName);
    if (staticMethod) return staticMethod;

    // Try getter
    const getter = classDecl.getGetAccessor(memberName);
    if (getter) return getter;

    // Try static getter
    const getters = classDecl.getGetAccessors();
    const staticGetter = getters.find(g => g.isStatic() && g.getName() === memberName);
    if (staticGetter) return staticGetter;

    // Try setter
    const setter = classDecl.getSetAccessor(memberName);
    if (setter) return setter;

    // Try static setter
    const setters = classDecl.getSetAccessors();
    const staticSetter = setters.find(s => s.isStatic() && s.getName() === memberName);
    if (staticSetter) return staticSetter;

    // Try property with function initializer
    const property = classDecl.getProperty(memberName);
    if (property) {
      const initializer = property.getInitializer();
      if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
        return initializer;
      }
    }

    // Try static property with function initializer
    const staticProperties = classDecl.getStaticProperties();
    const staticProperty = staticProperties.find(p => {
      // Only check PropertyDeclarations, not accessors
      if (Node.isPropertyDeclaration(p) && p.getName() === memberName) {
        return true;
      }
      return false;
    });
    if (staticProperty && Node.isPropertyDeclaration(staticProperty)) {
      const initializer = staticProperty.getInitializer();
      if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
        return initializer;
      }
    }

    return undefined;
  }

  /**
   * Create EntryPointInfo from a node
   */
  private createEntryPointInfo(
    node: Node,
    filePath: string,
    functionName: string,
    className?: string
  ): EntryPointInfo {
    const id = this.generateNodeId(node, filePath, functionName, className);
    const type = this.determineNodeType(node);
    const isStatic = this.isStaticMember(node);

    return {
      node,
      id,
      name: functionName,
      file: filePath,
      type,
      isStatic: className ? isStatic : undefined,
      className,
    };
  }

  /**
   * Generate a unique ID for the node
   */
  private generateNodeId(
    node: Node,
    filePath: string,
    functionName: string,
    className?: string
  ): string {
    if (className) {
      return `${filePath}#${className}.${functionName}`;
    }
    return `${filePath}#${functionName}`;
  }

  /**
   * Determine the type of the node
   */
  private determineNodeType(node: Node): EntryPointInfo['type'] {
    if (Node.isFunctionDeclaration(node)) return 'function';
    if (Node.isMethodDeclaration(node)) return 'method';
    if (Node.isConstructorDeclaration(node)) return 'constructor';
    if (Node.isGetAccessorDeclaration(node)) return 'getter';
    if (Node.isSetAccessorDeclaration(node)) return 'setter';
    if (Node.isArrowFunction(node)) return 'arrow';
    if (Node.isFunctionExpression(node)) return 'expression';
    return 'function'; // default
  }

  /**
   * Check if a class member is static
   */
  private isStaticMember(node: Node): boolean {
    if (Node.isMethodDeclaration(node)) return node.isStatic();
    if (Node.isPropertyDeclaration(node)) return node.isStatic();
    if (Node.isGetAccessorDeclaration(node)) return node.isStatic();
    if (Node.isSetAccessorDeclaration(node)) return node.isStatic();
    return false;
  }
}