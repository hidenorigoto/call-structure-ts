import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { CallGraphError, OutputFormat, ProjectContext, CallGraph } from '../../types/CallGraph';
import { FormatOptions } from '../../types/Formatter';
import { PerformanceOptimizer } from '../../performance/PerformanceOptimizer';
import { logger } from '../../utils/logger';
import { JsonFormatter } from '../../formatter/JsonFormatter';
import { YamlFormatter } from '../../formatter/YamlFormatter';
import { MermaidFormatter } from '../../formatter/MermaidFormatter';

export interface BatchOptions {
  config: string;
  outputDir: string;
  parallel: number;
  continueOnError?: boolean;
}

export interface BatchConfig {
  entry_points: Array<{
    file: string;
    function: string;
    className?: string;
    output: string;
    options?: {
      maxDepth?: number;
      format?: string;
      includeMetrics?: boolean;
      excludePatterns?: string[];
      includePatterns?: string[];
    };
  }>;
  common_options?: {
    max_depth?: number;
    format?: string;
    exclude_patterns?: string[];
    include_patterns?: string[];
    includeMetrics?: boolean;
    tsconfig?: string;
    projectRoot?: string;
  };
}

interface AnalysisResult {
  entryPoint: string;
  outputFile: string;
  success: boolean;
  error?: Error;
  callGraph?: CallGraph;
  duration?: number;
}

export async function analyzeBatchCommand(options: BatchOptions): Promise<void> {
  const startTime = Date.now();

  logger.progress(`Loading batch configuration from: ${options.config}`);

  // Load and validate configuration
  const config = await loadBatchConfig(options.config);

  // Create output directory
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const results: AnalysisResult[] = [];
  const totalEntryPoints = config.entry_points.length;

  logger.progress(
    `Processing ${totalEntryPoints} entry points with concurrency: ${options.parallel}`
  );

  // Process entry points in batches
  for (let i = 0; i < totalEntryPoints; i += options.parallel) {
    const batch = config.entry_points.slice(i, i + options.parallel);
    const batchNumber = Math.floor(i / options.parallel) + 1;
    const totalBatches = Math.ceil(totalEntryPoints / options.parallel);

    logger.info(`Processing batch ${batchNumber}/${totalBatches}`);

    const batchResults = await Promise.all(
      batch.map(async entryPointConfig => {
        const entryPoint = formatEntryPoint(entryPointConfig);
        const result: AnalysisResult = {
          entryPoint,
          outputFile: path.join(options.outputDir, entryPointConfig.output),
          success: false,
        };

        try {
          const analysisStartTime = Date.now();
          result.callGraph = await analyzeEntryPoint(entryPointConfig, config.common_options);
          result.duration = Date.now() - analysisStartTime;

          // Generate output
          const format =
            entryPointConfig.options?.format || config.common_options?.format || 'json';
          const output = formatOutput(result.callGraph, format as OutputFormat, {
            includeMetadata: true,
            includeMetrics:
              entryPointConfig.options?.includeMetrics ??
              config.common_options?.includeMetrics ??
              false,
            prettify: true,
          });

          await saveOutput(output, result.outputFile);
          result.success = true;

          logger.success(
            `✓ Completed: ${entryPoint} -> ${result.outputFile} (${result.duration}ms)`
          );
        } catch (error) {
          result.error = error as Error;
          logger.error(`✗ Failed: ${entryPoint} - ${result.error.message}`);

          if (!options.continueOnError) {
            throw error;
          }
        }

        return result;
      })
    );

    results.push(...batchResults);
  }

  // Generate combined report
  await generateCombinedReport(results, options.outputDir);

  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  logger.success(`
Batch analysis complete in ${duration}ms
  Total: ${totalEntryPoints}
  Success: ${successCount}
  Failed: ${failureCount}
  Output: ${options.outputDir}
  `);

  // Exit with error code if any analyses failed and continueOnError is false
  if (failureCount > 0 && !options.continueOnError) {
    process.exit(1);
  }
}

async function loadBatchConfig(configPath: string): Promise<BatchConfig> {
  if (!fs.existsSync(configPath)) {
    throw new CallGraphError(
      `Batch configuration file not found: ${configPath}`,
      'CONFIG_FILE_NOT_FOUND'
    );
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const ext = path.extname(configPath).toLowerCase();

  let config: BatchConfig;
  try {
    if (ext === '.yaml' || ext === '.yml') {
      config = yaml.load(content) as BatchConfig;
    } else if (ext === '.json') {
      config = JSON.parse(content) as BatchConfig;
    } else {
      throw new CallGraphError(
        `Unsupported configuration format: ${ext}. Use .yaml, .yml, or .json`,
        'UNSUPPORTED_CONFIG_FORMAT'
      );
    }
  } catch (error) {
    if (error instanceof CallGraphError) {
      throw error;
    }
    throw new CallGraphError(`Failed to parse batch configuration: ${error}`, 'CONFIG_PARSE_ERROR');
  }

  // Validate configuration structure
  if (!config.entry_points || !Array.isArray(config.entry_points)) {
    throw new CallGraphError(
      'Invalid batch configuration: missing or invalid entry_points array',
      'INVALID_CONFIG'
    );
  }

  if (config.entry_points.length === 0) {
    throw new CallGraphError(
      'Invalid batch configuration: entry_points array is empty',
      'INVALID_CONFIG'
    );
  }

  // Validate each entry point
  config.entry_points.forEach((ep: BatchConfig['entry_points'][0], index: number) => {
    if (!ep.file || !ep.function) {
      throw new CallGraphError(
        `Invalid entry point at index ${index}: missing file or function`,
        'INVALID_CONFIG'
      );
    }
    if (!ep.output) {
      throw new CallGraphError(
        `Invalid entry point at index ${index}: missing output filename`,
        'INVALID_CONFIG'
      );
    }
  });

  return config as BatchConfig;
}

function formatEntryPoint(config: BatchConfig['entry_points'][0]): string {
  if (config.className) {
    return `${config.file}#${config.className}.${config.function}`;
  }
  return `${config.file}#${config.function}`;
}

async function analyzeEntryPoint(
  entryPointConfig: BatchConfig['entry_points'][0],
  commonOptions?: BatchConfig['common_options']
): Promise<CallGraph> {
  // Create project context
  const context: ProjectContext = {
    rootPath: path.resolve(commonOptions?.projectRoot || '.'),
    tsConfigPath: commonOptions?.tsconfig,
    packageJsonPath: path.join(path.resolve(commonOptions?.projectRoot || '.'), 'package.json'),
    sourcePatterns: ['src/**/*.ts', 'lib/**/*.ts'],
    excludePatterns: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  };

  // Merge analysis options
  const analysisOptions: Record<string, unknown> = {
    maxDepth: entryPointConfig.options?.maxDepth || commonOptions?.max_depth || 10,
    includeNodeModules: false,
    skipCallbacks: false,
  };

  // Handle exclude patterns
  const excludePatterns = [
    ...(entryPointConfig.options?.excludePatterns || []),
    ...(commonOptions?.exclude_patterns || []),
  ];

  if (excludePatterns.length > 0) {
    analysisOptions.excludePatterns = excludePatterns.map(p => {
      try {
        return new RegExp(p);
      } catch {
        // If it's not a valid regex, treat it as a glob pattern
        // Convert glob to regex (simple conversion)
        const regexPattern = p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
        return new RegExp(regexPattern);
      }
    });
  }

  // Handle include patterns
  const includePatterns = [
    ...(entryPointConfig.options?.includePatterns || []),
    ...(commonOptions?.include_patterns || []),
  ];

  if (includePatterns.length > 0) {
    analysisOptions.includePatterns = includePatterns.map(p => {
      try {
        return new RegExp(p);
      } catch {
        // If it's not a valid regex, treat it as a glob pattern
        const regexPattern = p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
        return new RegExp(regexPattern);
      }
    });
  }

  const optimizer = new PerformanceOptimizer(
    context.tsConfigPath || path.join(context.rootPath, 'tsconfig.json'),
    {
      enableCache: true,
      enableParallel: true,
      enableProgress: false, // Disable progress for batch operations
      maxDepth: analysisOptions.maxDepth as number,
      includeExternal:
        Array.isArray(analysisOptions.includePatterns) &&
        analysisOptions.includePatterns.length > 0,
    }
  );

  const entryPoint = formatEntryPoint(entryPointConfig);
  return await optimizer.analyze(entryPoint);
}

function formatOutput(callGraph: CallGraph, format: OutputFormat, options: FormatOptions): string {
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

async function generateCombinedReport(results: AnalysisResult[], outputDir: string): Promise<void> {
  const reportPath = path.join(outputDir, 'batch-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
    },
    results: results.map(r => ({
      entryPoint: r.entryPoint,
      outputFile: r.outputFile,
      success: r.success,
      duration: r.duration,
      error: r.error
        ? {
            message: r.error.message,
            code: (r.error as CallGraphError).code || 'UNKNOWN_ERROR',
          }
        : undefined,
      metrics:
        r.success && r.callGraph
          ? {
              nodes: r.callGraph.nodes?.length || 0,
              edges: r.callGraph.edges?.length || 0,
              maxDepth: r.callGraph.metadata?.maxDepth || 0,
            }
          : undefined,
    })),
  };

  const jsonReport = JSON.stringify(report, null, 2);
  fs.writeFileSync(reportPath, jsonReport, 'utf-8');

  logger.info(`Combined report saved to: ${reportPath}`);
}
