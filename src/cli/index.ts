#!/usr/bin/env node

import { Command } from 'commander';
import { CallGraphAnalyzer } from '../analyzer/CallGraphAnalyzer';
import { EntryPointAnalyzer } from '../analyzer/EntryPointAnalyzer';
import { JsonFormatter } from '../formatter/JsonFormatter';
import { YamlFormatter } from '../formatter/YamlFormatter';
import { MermaidFormatter } from '../formatter/MermaidFormatter';
import {
  CallGraphAnalysisOptions,
  OutputFormat,
  ProjectContext,
  CallGraphError,
} from '../types/CallGraph';
import { logger, LogLevel } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const program = new Command();

// Global options
program
  .name('call-structure')
  .description('Analyze TypeScript function call structures')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Disable all output except errors')
  .option('--debug', 'Enable debug logging')
  .hook('preAction', thisCommand => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (opts.verbose) {
      logger.setLevel(LogLevel.INFO);
    } else if (opts.quiet) {
      logger.setLevel(LogLevel.ERROR);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze call graph from an entry point')
  .requiredOption(
    '-e, --entry <entry>',
    'Entry point (format: "path/to/file.ts#functionName" or "path/to/file.ts#ClassName.methodName")'
  )
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format (json, yaml, mermaid)', 'json')
  .option('-d, --max-depth <depth>', 'Maximum analysis depth', '10')
  .option('--include-node-modules', 'Include node_modules in analysis')
  .option('--include-tests', 'Include test files in analysis')
  .option('--exclude <patterns...>', 'Exclude patterns (regex)')
  .option('--include <patterns...>', 'Include patterns (regex)')
  .option('--no-callbacks', 'Skip callback function analysis')
  .option('--metrics', 'Include analysis metrics')
  .option('--tsconfig <path>', 'Path to tsconfig.json')
  .option('--project-root <path>', 'Project root directory', '.')
  .action(async options => {
    try {
      await analyzeCommand(options);
    } catch (error) {
      handleError(error);
    }
  });

// Discover command
program
  .command('discover')
  .description('Discover potential entry points in the project')
  .option('-p, --pattern <patterns...>', 'File patterns to search (regex)')
  .option('--controllers', 'Find controller methods')
  .option('--handlers', 'Find handler functions')
  .option('--main', 'Find main functions')
  .option('--exported', 'Find exported functions')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format (json, yaml)', 'json')
  .option('--tsconfig <path>', 'Path to tsconfig.json')
  .option('--project-root <path>', 'Project root directory', '.')
  .action(async options => {
    try {
      await discoverCommand(options);
    } catch (error) {
      handleError(error);
    }
  });

// Batch command
program
  .command('batch')
  .description('Analyze multiple entry points')
  .requiredOption('-c, --config <file>', 'Batch configuration file (JSON or YAML)')
  .option('-o, --output-dir <dir>', 'Output directory', './analysis-results')
  .option('--parallel <count>', 'Number of parallel analyses', '1')
  .action(async options => {
    try {
      await batchCommand(options);
    } catch (error) {
      handleError(error);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate entry point existence')
  .requiredOption('-e, --entry <entry>', 'Entry point to validate')
  .option('--tsconfig <path>', 'Path to tsconfig.json')
  .option('--project-root <path>', 'Project root directory', '.')
  .action(async options => {
    try {
      await validateCommand(options);
    } catch (error) {
      handleError(error);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Interactive mode for analysis')
  .option('--tsconfig <path>', 'Path to tsconfig.json')
  .option('--project-root <path>', 'Project root directory', '.')
  .action(async options => {
    try {
      await interactiveCommand(options);
    } catch (error) {
      handleError(error);
    }
  });

async function analyzeCommand(options: any): Promise<void> {
  logger.progress(`Starting analysis of entry point: ${options.entry}`);

  // Create project context
  const context = createProjectContext(options);

  // Create analysis options
  const analysisOptions = createAnalysisOptions(options);

  // Perform analysis
  const analyzer = new CallGraphAnalyzer(context, analysisOptions);
  const callGraph = await analyzer.analyzeFromEntryPoint(options.entry);

  // Format output
  const output = formatOutput(callGraph, options.format, {
    includeMetadata: true,
    includeMetrics: options.metrics,
    prettify: true,
  });

  // Save or display output
  if (options.output) {
    await saveOutput(output, options.output);
    logger.success(`Analysis complete. Results saved to: ${options.output}`);
  } else {
    console.log(output);
  }
}

async function discoverCommand(options: any): Promise<void> {
  logger.progress('Discovering entry points...');

  const context = createProjectContext(options);
  const analyzer = new EntryPointAnalyzer(context);

  let entryPoints;

  if (options.pattern) {
    entryPoints = await analyzer.findEntryPointsByPattern(options.pattern);
  } else if (options.controllers || options.handlers || options.main || options.exported) {
    const commonEntryPoints = await analyzer.findCommonEntryPoints();
    entryPoints = [];

    if (options.controllers) entryPoints.push(...commonEntryPoints.controllers);
    if (options.handlers) entryPoints.push(...commonEntryPoints.handlers);
    if (options.main) entryPoints.push(...commonEntryPoints.mainFunctions);
    if (options.exported) entryPoints.push(...commonEntryPoints.exportedFunctions);
  } else {
    entryPoints = await analyzer.discoverEntryPoints();
  }

  logger.success(`Found ${entryPoints.length} entry points`);

  // Format output
  const output =
    options.format === 'yaml'
      ? formatEntryPointsAsYaml(entryPoints)
      : JSON.stringify({ entryPoints }, null, 2);

  // Save or display output
  if (options.output) {
    await saveOutput(output, options.output);
    logger.success(`Entry points saved to: ${options.output}`);
  } else {
    console.log(output);
  }
}

async function batchCommand(options: any): Promise<void> {
  logger.progress(`Loading batch configuration from: ${options.config}`);

  // Load configuration
  const configContent = fs.readFileSync(options.config, 'utf-8');
  const config =
    options.config.endsWith('.yaml') || options.config.endsWith('.yml')
      ? yaml.load(configContent)
      : JSON.parse(configContent);

  if (!config.entryPoints || !Array.isArray(config.entryPoints)) {
    throw new CallGraphError(
      'Invalid batch configuration: missing entryPoints array',
      'INVALID_CONFIG'
    );
  }

  // Create output directory
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  // Process entry points
  const parallelCount = parseInt(options.parallel) || 1;
  const entryPoints = config.entryPoints;

  logger.progress(`Processing ${entryPoints.length} entry points (parallel: ${parallelCount})`);

  for (let i = 0; i < entryPoints.length; i += parallelCount) {
    const batch = entryPoints.slice(i, i + parallelCount);

    await Promise.all(
      batch.map(async (entryPointConfig: any) => {
        try {
          const context = createProjectContext({
            projectRoot: config.projectRoot || '.',
            tsconfig: config.tsconfig,
          });

          const analysisOptions = {
            ...config.analysisOptions,
            maxDepth: entryPointConfig.maxDepth || config.maxDepth || 10,
          };

          const analyzer = new CallGraphAnalyzer(context, analysisOptions);
          const entryPoint = `${entryPointConfig.file}#${entryPointConfig.function}`;

          if (entryPointConfig.className) {
            entryPoint.replace(
              `#${entryPointConfig.function}`,
              `#${entryPointConfig.className}.${entryPointConfig.function}`
            );
          }

          const callGraph = await analyzer.analyzeFromEntryPoint(entryPoint);

          const outputFile = path.join(
            options.outputDir,
            entryPointConfig.output || `${entryPointConfig.function}.json`
          );
          const output = formatOutput(callGraph, entryPointConfig.format || 'json', {
            includeMetadata: true,
            includeMetrics: config.includeMetrics,
            prettify: true,
          });

          await saveOutput(output, outputFile);
          logger.debug(` Completed: ${entryPoint} -> ${outputFile}`);
        } catch (error) {
          logger.warn(` Failed: ${entryPointConfig.file}#${entryPointConfig.function}`, error);
        }
      })
    );
  }

  logger.success(`Batch analysis complete. Results in: ${options.outputDir}`);
}

async function validateCommand(options: any): Promise<void> {
  const context = createProjectContext(options);
  const analyzer = new EntryPointAnalyzer(context);

  logger.progress(`Validating entry point: ${options.entry}`);

  const result = await analyzer.validateEntryPoint(options.entry);

  if (result.isValid) {
    logger.success(' Entry point is valid');
    if (result.location) {
      console.log(`  File: ${result.location.filePath}`);
      console.log(`  Function: ${result.location.functionName}`);
      if (result.location.className) {
        console.log(`  Class: ${result.location.className}`);
      }
    }
  } else {
    logger.error(' Entry point is invalid');
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    process.exit(1);
  }
}

async function interactiveCommand(_options: any): Promise<void> {
  // This would require additional dependencies like inquirer
  // For now, just show a message
  console.log('Interactive mode is not yet implemented.');
  console.log('Use the analyze command with specific entry points.');
  console.log('Example: call-structure analyze -e "src/index.ts#main" -f mermaid');
}

function createProjectContext(options: any): ProjectContext {
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

function createAnalysisOptions(options: any): CallGraphAnalysisOptions {
  const analysisOptions: CallGraphAnalysisOptions = {
    maxDepth: parseInt(options.maxDepth) || 10,
    includeNodeModules: options.includeNodeModules || false,
    includeTestFiles: options.includeTests || false,
    followImports: true,
    analyzeCallbacks: !options.noCallbacks,
    collectMetrics: options.metrics || false,
  };

  if (options.exclude) {
    analysisOptions.excludePatterns = options.exclude.map((pattern: string) => new RegExp(pattern));
  }

  if (options.include) {
    analysisOptions.includePatterns = options.include.map((pattern: string) => new RegExp(pattern));
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

function formatEntryPointsAsYaml(entryPoints: any[]): string {
  return yaml.dump({ entryPoints }, { indent: 2 });
}

async function saveOutput(content: string, filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

function handleError(error: any): void {
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

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
