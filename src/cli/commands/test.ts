import { CallGraphAnalyzer } from '../../analyzer/CallGraphAnalyzer';
import { StructureValidator } from '../../analyzer/StructureValidator';
import { mermaidToCallGraph } from '../../parser/MermaidVisitor';
import {
  CallGraphSpecification,
  CallGraphValidationResult,
  ProjectContext,
  CallGraphError,
  CallGraphAnalysisOptions,
} from '../../types/CallGraph';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface TestOptions {
  spec: string;
  target?: string;
  format?: 'text' | 'json';
  tsconfig?: string;
  projectRoot?: string;
  maxDepth?: string;
  verbose?: boolean;
}

export interface TestSpecification {
  name?: string;
  description?: string;
  entryPoint: {
    file: string;
    function: string;
  };
  requiredEdges: Array<{
    from: string;
    to: string;
    type: 'sync' | 'async' | 'callback' | 'constructor';
  }>;
  forbiddenEdges: Array<{
    from: string;
    to: string;
    type?: 'sync' | 'async' | 'callback' | 'constructor';
  }>;
  requiredNodes?: string[];
  forbiddenNodes?: string[];
  maxDepth?: number;
  maxComplexity?: number;
}

/**
 * Execute test command to validate code structure against specifications
 */
export async function testCommand(options: TestOptions): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.progress(`Loading test specification from: ${options.spec}`);
    
    // Load test specification
    const specification = await loadSpecification(options.spec);
    
    // Create project context
    const context = createProjectContext(options);
    
    // Create analysis options
    const analysisOptions = createAnalysisOptions(options);
    
    // Build entry point string
    const entryPoint = `${specification.entryPoint.file}#${specification.entryPoint.function}`;
    logger.progress(`Analyzing code structure from entry point: ${entryPoint}`);
    
    // Analyze actual code structure
    const analyzer = new CallGraphAnalyzer(context, analysisOptions);
    const actualGraph = await analyzer.analyzeFromEntryPoint(entryPoint);
    
    // Validate against specification
    logger.progress('Validating structure against specification...');
    const validator = new StructureValidator();
    const callGraphSpec = testSpecToCallGraphSpec(specification);
    const result = validator.validate(actualGraph, callGraphSpec);
    
    // Format and output results
    formatAndOutputResults(result, validator, options);
    
    const duration = Date.now() - startTime;
    
    if (result.isValid) {
      logger.success(` All tests passed in ${duration}ms`);
      process.exit(0);
    } else {
      logger.error(` Tests failed with ${result.errors.length} errors in ${duration}ms`);
      process.exit(1);
    }
    
  } catch (error) {
    handleError(error);
  }
}

/**
 * Load test specification from YAML or Mermaid file
 */
async function loadSpecification(specPath: string): Promise<TestSpecification> {
  const absolutePath = path.resolve(specPath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new CallGraphError(
      `Specification file not found: ${specPath}`,
      'SPEC_FILE_NOT_FOUND',
      specPath
    );
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const ext = path.extname(absolutePath).toLowerCase();
  
  switch (ext) {
    case '.yaml':
    case '.yml':
      return loadYamlSpecification(content, specPath);
      
    case '.mermaid':
    case '.mmd':
      return loadMermaidSpecification(content, specPath);
      
    default:
      throw new CallGraphError(
        `Unsupported specification format: ${ext}. Use .yaml, .yml, .mermaid, or .mmd`,
        'UNSUPPORTED_SPEC_FORMAT',
        specPath
      );
  }
}

/**
 * Load YAML specification
 */
function loadYamlSpecification(content: string, filePath: string): TestSpecification {
  try {
    const spec = yaml.load(content) as TestSpecification;
    
    // Validate required fields
    if (!spec.entryPoint || !spec.entryPoint.file || !spec.entryPoint.function) {
      throw new CallGraphError(
        'Invalid specification: missing entryPoint.file or entryPoint.function',
        'INVALID_SPEC_FORMAT',
        filePath
      );
    }
    
    // Set defaults
    spec.requiredEdges = spec.requiredEdges || [];
    spec.forbiddenEdges = spec.forbiddenEdges || [];
    spec.requiredNodes = spec.requiredNodes || [];
    spec.forbiddenNodes = spec.forbiddenNodes || [];
    
    return spec;
  } catch (error) {
    if (error instanceof CallGraphError) {
      throw error;
    }
    throw new CallGraphError(
      `Failed to parse YAML specification: ${error}`,
      'YAML_PARSE_ERROR',
      filePath
    );
  }
}

/**
 * Load Mermaid specification
 * Extracts test specification from a specially formatted Mermaid diagram
 */
function loadMermaidSpecification(content: string, filePath: string): TestSpecification {
  // Extract metadata from Mermaid comments
  const metadataMatch = content.match(/%%\s*test-spec\s*:\s*(.+?)\s*%%/);
  if (!metadataMatch) {
    throw new CallGraphError(
      'Mermaid specification must include test-spec metadata in comments',
      'MISSING_MERMAID_METADATA',
      filePath
    );
  }
  
  try {
    const metadata = yaml.load(metadataMatch[1]) as Partial<TestSpecification>;
    
    if (!metadata.entryPoint || !metadata.entryPoint.file || !metadata.entryPoint.function) {
      throw new CallGraphError(
        'Invalid Mermaid specification: missing entryPoint in metadata',
        'INVALID_MERMAID_METADATA',
        filePath
      );
    }
    
    // Parse the Mermaid diagram to extract structure
    const callGraph = mermaidToCallGraph(content);
    
    if (!callGraph) {
      throw new CallGraphError(
        'Failed to parse Mermaid diagram',
        'MERMAID_PARSE_ERROR',
        filePath
      );
    }
    
    // Build specification from parsed graph
    const spec: TestSpecification = {
      name: metadata.name,
      description: metadata.description,
      entryPoint: metadata.entryPoint,
      requiredEdges: [],
      forbiddenEdges: metadata.forbiddenEdges || [],
      requiredNodes: callGraph.nodes.map(n => n.name),
      forbiddenNodes: metadata.forbiddenNodes || [],
      maxDepth: metadata.maxDepth,
      maxComplexity: metadata.maxComplexity,
    };
    
    // Convert Mermaid edges to required edges
    for (const edge of callGraph.edges) {
      const sourceNode = callGraph.nodes.find(n => n.id === edge.source);
      const targetNode = callGraph.nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        spec.requiredEdges.push({
          from: sourceNode.name,
          to: targetNode.name,
          type: edge.type,
        });
      }
    }
    
    return spec;
  } catch (error) {
    if (error instanceof CallGraphError) {
      throw error;
    }
    throw new CallGraphError(
      `Failed to parse Mermaid specification: ${error}`,
      'MERMAID_SPEC_ERROR',
      filePath
    );
  }
}

/**
 * Convert test specification to CallGraphSpecification
 */
function testSpecToCallGraphSpec(testSpec: TestSpecification): CallGraphSpecification {
  return {
    entryPoint: testSpec.entryPoint.function,
    requiredEdges: testSpec.requiredEdges,
    forbiddenEdges: testSpec.forbiddenEdges,
    requiredNodes: testSpec.requiredNodes,
    forbiddenNodes: testSpec.forbiddenNodes,
    maxDepth: testSpec.maxDepth,
    maxComplexity: testSpec.maxComplexity,
  };
}

/**
 * Create project context from options
 */
function createProjectContext(options: TestOptions): ProjectContext {
  const projectRoot = path.resolve(options.projectRoot || '.');
  let tsConfigPath = options.tsconfig;
  
  if (!tsConfigPath) {
    const defaultTsConfig = path.join(projectRoot, 'tsconfig.json');
    if (fs.existsSync(defaultTsConfig)) {
      tsConfigPath = defaultTsConfig;
    }
  }
  
  const targetDir = options.target || 'src';
  
  return {
    rootPath: projectRoot,
    tsConfigPath,
    packageJsonPath: path.join(projectRoot, 'package.json'),
    sourcePatterns: [`${targetDir}/**/*.ts`],
    excludePatterns: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  };
}

/**
 * Create analysis options from test options
 */
function createAnalysisOptions(options: TestOptions): CallGraphAnalysisOptions {
  return {
    maxDepth: options.maxDepth ? parseInt(options.maxDepth, 10) : 10,
    includeNodeModules: false,
    includeTestFiles: false,
    followImports: true,
    analyzeCallbacks: true,
    collectMetrics: true,
  };
}

/**
 * Format and output validation results
 */
function formatAndOutputResults(
  result: CallGraphValidationResult,
  validator: StructureValidator,
  options: TestOptions
): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Default to text format
    const report = validator.generateReport(result);
    console.log(report);
    
    if (options.verbose && result.errors.length > 0) {
      console.log('\nDetailed Error Information:');
      console.log('=' .repeat(30));
      
      for (const error of result.errors) {
        console.log(`\nError Type: ${error.type}`);
        console.log(`Message: ${error.message}`);
        
        if (error.location) {
          console.log(`Location: ${error.location.file}:${error.location.line}`);
        }
        
        if (error.expected) {
          console.log(`Expected: ${JSON.stringify(error.expected)}`);
        }
        
        if (error.actual) {
          console.log(`Actual: ${JSON.stringify(error.actual)}`);
        }
      }
    }
  }
}

/**
 * Handle errors during test execution
 */
function handleError(error: unknown): void {
  if (error instanceof CallGraphError) {
    logger.error(`${error.code}: ${error.message}`);
    if (error.file) {
      console.log(`  File: ${error.file}${error.line ? `:${error.line}` : ''}`);
    }
  } else {
    logger.error('Unexpected error:', error);
  }
  
  process.exit(1);
}