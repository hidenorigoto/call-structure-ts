import { EntryPointAnalyzer } from '../../analyzer/EntryPointAnalyzer';
import { JsonFormatter } from '../../formatter/JsonFormatter';
import { YamlFormatter } from '../../formatter/YamlFormatter';
import { MermaidFormatter } from '../../formatter/MermaidFormatter';
import {
  CallGraphAnalysisOptions,
  OutputFormat,
  ProjectContext,
  CallGraphError,
} from '../../types/CallGraph';
import { PerformanceOptimizer } from '../../performance/PerformanceOptimizer';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface AnalyzeOptions {
  entry: string;
  output?: string;
  format: OutputFormat;
  maxDepth: string;
  includeNodeModules?: boolean;
  includeTests?: boolean;
  exclude?: string[];
  include?: string[];
  noCallbacks?: boolean;
  metrics?: boolean;
  tsconfig?: string;
  projectRoot: string;
  filterExternal?: boolean;
  parallel?: number;
  cache?: string;
  config?: string;
  progress?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate entry point format
    validateEntryPointFormat(options.entry);

    logger.progress(`Starting analysis of entry point: ${options.entry}`);

    // Create project context
    const context = createProjectContext(options);

    // Create analysis options
    createAnalysisOptions(options);

    // Validate entry point exists before analysis
    await validateEntryPoint(options.entry, context);

    // Perform analysis with performance optimizations
    const optimizer = new PerformanceOptimizer(
      context.tsConfigPath || path.join(context.rootPath, 'tsconfig.json'),
      {
        enableCache: options.cache !== 'false',
        cacheDir: options.cache === 'false' ? undefined : options.cache,
        enableParallel: options.parallel !== undefined && options.parallel > 0,
        concurrency: options.parallel,
        enableProgress: options.progress !== false,
        silent: options.quiet,
        maxDepth: parseInt(options.maxDepth, 10),
        includeExternal: !options.filterExternal,
      }
    );

    const callGraph = await optimizer.analyze(options.entry);

    // Format output
    const output = formatOutput(callGraph, options.format, {
      includeMetadata: true,
      includeMetrics: options.metrics,
      prettify: true,
    });

    // Save or display output
    if (options.output) {
      await saveOutput(output, options.output);
      const elapsed = Date.now() - startTime;
      logger.success(`Analysis complete. Results saved to: ${options.output} (${elapsed}ms)`);
    } else {
      console.log(output);
      const elapsed = Date.now() - startTime;
      logger.success(
        `Analysis completed in ${elapsed}ms. Found ${callGraph.nodes.length} nodes and ${callGraph.edges.length} edges.`
      );
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`Analysis failed after ${elapsed}ms:`, error);
    throw error;
  }
}

function validateEntryPointFormat(entry: string): void {
  if (!entry.includes('#')) {
    throw new CallGraphError(
      `Invalid entry point format: ${entry}. Expected "file#function" or "file#Class.method"`,
      'INVALID_ENTRY_POINT_FORMAT'
    );
  }

  const [filePath, functionPart] = entry.split('#');

  if (!filePath || !functionPart) {
    throw new CallGraphError(
      `Invalid entry point format: ${entry}. Expected "file#function" or "file#Class.method"`,
      'INVALID_ENTRY_POINT_FORMAT'
    );
  }

  // Validate file extension
  if (
    !filePath.endsWith('.ts') &&
    !filePath.endsWith('.tsx') &&
    !filePath.endsWith('.js') &&
    !filePath.endsWith('.jsx')
  ) {
    throw new CallGraphError(
      `Unsupported file type: ${filePath}. Supported types: .ts, .tsx, .js, .jsx`,
      'UNSUPPORTED_FILE_TYPE'
    );
  }
}

async function validateEntryPoint(entry: string, context: ProjectContext): Promise<void> {
  const [filePath] = entry.split('#');

  // Check if file exists
  const fullPath = path.resolve(context.rootPath, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new CallGraphError(
      `Source file not found: ${filePath}`,
      'SOURCE_FILE_NOT_FOUND',
      filePath
    );
  }

  // Validate entry point exists in file using EntryPointAnalyzer
  const analyzer = new EntryPointAnalyzer(context);
  const validation = await analyzer.validateEntryPoint(entry);

  if (!validation.isValid) {
    const [, functionName] = entry.split('#');
    throw new CallGraphError(
      `Entry point not found: ${functionName} in ${filePath}`,
      'ENTRY_POINT_NOT_FOUND',
      filePath
    );
  }
}

function createProjectContext(options: AnalyzeOptions): ProjectContext {
  const projectRoot = path.resolve(options.projectRoot || '.');
  let tsConfigPath = options.tsconfig;

  if (!tsConfigPath) {
    const defaultTsConfig = path.join(projectRoot, 'tsconfig.json');
    if (fs.existsSync(defaultTsConfig)) {
      tsConfigPath = defaultTsConfig;
    }
  }

  return {
    rootPath: projectRoot,
    tsConfigPath,
    packageJsonPath: path.join(projectRoot, 'package.json'),
    sourcePatterns: ['src/**/*.ts', 'lib/**/*.ts'],
    excludePatterns: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  };
}

function createAnalysisOptions(options: AnalyzeOptions): CallGraphAnalysisOptions {
  const analysisOptions: CallGraphAnalysisOptions = {
    maxDepth: parseInt(options.maxDepth) || 10,
    includeNodeModules: options.includeNodeModules || false,
    includeTestFiles: options.includeTests || false,
    followImports: true,
    analyzeCallbacks: !options.noCallbacks,
    collectMetrics: options.metrics || false,
  };

  if (options.exclude) {
    analysisOptions.excludePatterns = options.exclude.map((pattern: string) => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, '.*') // ** becomes .*
        .replace(/\*/g, '[^/]*') // * becomes [^/]*
        .replace(/\?/g, '.') // ? becomes .
        .replace(/\./g, '\\.'); // . becomes \.
      return new RegExp(regexPattern);
    });
  }

  if (options.include) {
    analysisOptions.includePatterns = options.include.map((pattern: string) => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, '.*') // ** becomes .*
        .replace(/\*/g, '[^/]*') // * becomes [^/]*
        .replace(/\?/g, '.') // ? becomes .
        .replace(/\./g, '\\.'); // . becomes \.
      return new RegExp(regexPattern);
    });
  }

  // Add support for filtering external calls
  if (options.filterExternal) {
    // Add common external library patterns to exclude
    const externalPatterns = [/node_modules/, /@types\//, /\.d\.ts$/];

    if (analysisOptions.excludePatterns) {
      analysisOptions.excludePatterns.push(...externalPatterns);
    } else {
      analysisOptions.excludePatterns = externalPatterns;
    }
  }

  return analysisOptions;
}

function formatOutput(callGraph: any, format: OutputFormat, options: any): string {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonFormatter().format(callGraph, { format: 'json', ...options });
    case 'yaml':
      return new YamlFormatter().format(callGraph, { format: 'yaml', ...options });
    case 'mermaid':
      return new MermaidFormatter().format(callGraph, { format: 'mermaid', ...options });
    default:
      throw new CallGraphError(`Unsupported output format: ${format}`, 'UNSUPPORTED_FORMAT');
  }
}

async function saveOutput(content: string, filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}
