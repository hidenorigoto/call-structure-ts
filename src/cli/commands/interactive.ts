import inquirer from 'inquirer';
import autocompletePrompt from 'inquirer-autocomplete-prompt';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { Project } from 'ts-morph';
import { CallGraphAnalyzer } from '../../analyzer/CallGraphAnalyzer';
import { ProjectContext, OutputFormat } from '../../types/CallGraph';
import { logger } from '../../utils/logger';
import { JsonFormatter } from '../../formatter/JsonFormatter';
import { YamlFormatter } from '../../formatter/YamlFormatter';
import { MermaidFormatter } from '../../formatter/MermaidFormatter';
import { DotFormatter } from '../../formatter/DotFormatter';
import { testCommand } from './test';
import { analyzeBatchCommand } from './analyze-batch';

// Register autocomplete prompt
inquirer.registerPrompt('autocomplete', autocompletePrompt);

interface InteractiveOptions {
  projectRoot?: string;
  tsconfig?: string;
}

export async function interactiveCommand(options: InteractiveOptions): Promise<void> {
  console.clear();
  console.log('Welcome to Call Structure TS Interactive Mode!\n');

  // Set project root
  const projectRoot = path.resolve(options.projectRoot || '.');

  // Main interactive loop
  let shouldExit = false;
  while (!shouldExit) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔍 Analyze a function', value: 'analyze' },
          { name: '🧪 Test against specification', value: 'test' },
          { name: '📦 Batch analysis', value: 'batch' },
          { name: '📄 View recent results', value: 'recent' },
          { name: '❓ Help', value: 'help' },
          { name: '👋 Exit', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') {
      console.log('\nGoodbye! 👋\n');
      shouldExit = true;
      continue;
    }

    try {
      switch (action) {
        case 'analyze':
          await interactiveAnalyze(projectRoot, options.tsconfig);
          break;
        case 'test':
          await interactiveTest(projectRoot, options.tsconfig);
          break;
        case 'batch':
          await interactiveBatch(projectRoot);
          break;
        case 'recent':
          await viewRecentResults(projectRoot);
          break;
        case 'help':
          showHelp();
          break;
      }
    } catch (error) {
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Pause before showing menu again
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '\nPress Enter to continue...',
      },
    ]);

    console.clear();
  }
}

async function interactiveAnalyze(projectRoot: string, tsconfig?: string): Promise<void> {
  console.log('\n🔍 Function Analysis\n');

  // Get TypeScript files
  const spinner = ora('Scanning for TypeScript files...').start();
  const files = await getTypeScriptFiles(projectRoot);
  spinner.stop();

  if (files.length === 0) {
    console.log('❌ No TypeScript files found in the project.');
    return;
  }

  // Select file using autocomplete
  const { file } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'file',
      message: 'Select a TypeScript file:',
      source: async (_answers: unknown, input?: string): Promise<string[]> => {
        const filtered = files.filter(f => !input || f.toLowerCase().includes(input.toLowerCase()));
        return filtered.slice(0, 20); // Limit results for performance
      },
    },
  ]);

  // Get functions from file
  const functionsSpinner = ora('Analyzing file...').start();
  const functions = await getFunctionsFromFile(path.join(projectRoot, file));
  functionsSpinner.stop();

  if (functions.length === 0) {
    console.log('❌ No functions found in the selected file.');
    return;
  }

  // Select function
  const { func } = await inquirer.prompt([
    {
      type: 'list',
      name: 'func',
      message: 'Select a function to analyze:',
      choices: functions.map(f => ({
        name: `${f.name}${f.className ? ` (${f.className})` : ''}`,
        value: f,
      })),
    },
  ]);

  // Select output format
  const { format } = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Select output format:',
      choices: [
        { name: '📄 JSON', value: 'json' },
        { name: '📄 YAML', value: 'yaml' },
        { name: '📊 Mermaid diagram', value: 'mermaid' },
      ],
    },
  ]);

  // Analysis options
  const { maxDepth, includeMetrics } = await inquirer.prompt([
    {
      type: 'number',
      name: 'maxDepth',
      message: 'Maximum analysis depth:',
      default: 10,
      validate: (input: number) => input > 0 || 'Depth must be greater than 0',
    },
    {
      type: 'confirm',
      name: 'includeMetrics',
      message: 'Include metrics in output?',
      default: false,
    },
  ]);

  // Run analysis
  const analysisSpinner = ora('Analyzing function call graph...').start();

  try {
    // Create entry point string
    const entryPoint = func.className
      ? `${file}#${func.className}.${func.name}`
      : `${file}#${func.name}`;

    // Create project context
    const context: ProjectContext = {
      rootPath: projectRoot,
      tsConfigPath: tsconfig,
      packageJsonPath: path.join(projectRoot, 'package.json'),
      sourcePatterns: ['src/**/*.ts', 'lib/**/*.ts'],
      excludePatterns: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
    };

    // Create analyzer
    const analyzer = new CallGraphAnalyzer(context, { maxDepth });
    const callGraph = await analyzer.analyzeFromEntryPoint(entryPoint);

    analysisSpinner.succeed('Analysis complete!');

    // Format output
    const formatter = getFormatter(format as OutputFormat);
    const result = formatter.format(callGraph, {
      format: format as OutputFormat,
      includeMetadata: true,
      includeMetrics,
      prettify: true,
    });

    // Show preview
    console.log('\n📋 Preview:');
    const preview = result.substring(0, 500);
    console.log(preview + (result.length > 500 ? '\n...' : ''));

    // Save options
    const { shouldSave } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldSave',
        message: '\nSave to file?',
        default: true,
      },
    ]);

    if (shouldSave) {
      const { filename } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filename',
          message: 'Filename:',
          default: `${func.name}-callgraph.${format}`,
          validate: (input: string) => input.length > 0 || 'Filename cannot be empty',
        },
      ]);

      const outputPath = path.join(projectRoot, filename);
      fs.writeFileSync(outputPath, result, 'utf-8');
      console.log(`\n✅ Saved to ${outputPath}`);
    }
  } catch (error) {
    analysisSpinner.fail('Analysis failed');
    throw error;
  }
}

async function interactiveTest(projectRoot: string, tsconfig?: string): Promise<void> {
  console.log('\n🧪 Specification Testing\n');

  // Get specification files
  const spinner = ora('Scanning for specification files...').start();
  const specFiles = await getSpecificationFiles(projectRoot);
  spinner.stop();

  if (specFiles.length === 0) {
    console.log('❌ No specification files found (*.yaml, *.yml, *.mmd).');
    return;
  }

  // Select specification file
  const { specFile } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'specFile',
      message: 'Select a specification file:',
      source: async (_answers: unknown, input?: string): Promise<string[]> => {
        const filtered = specFiles.filter(
          f => !input || f.toLowerCase().includes(input.toLowerCase())
        );
        return filtered.slice(0, 20);
      },
    },
  ]);

  // Run test
  const testSpinner = ora('Running specification test...').start();

  try {
    await testCommand({
      spec: specFile,
      tsconfig,
      format: 'text', // Will print to console
    });

    testSpinner.succeed('Test complete!');
  } catch (error) {
    testSpinner.fail('Test failed');
    throw error;
  }
}

async function interactiveBatch(projectRoot: string): Promise<void> {
  console.log('\n📦 Batch Analysis\n');

  // Get config files
  const spinner = ora('Scanning for batch configuration files...').start();
  const configFiles = await getBatchConfigFiles(projectRoot);
  spinner.stop();

  if (configFiles.length === 0) {
    const { createNew } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createNew',
        message: 'No batch configuration files found. Create a new one?',
        default: true,
      },
    ]);

    if (createNew) {
      await createBatchConfig(projectRoot);
    }
    return;
  }

  // Select config file
  const { configFile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configFile',
      message: 'Select a batch configuration:',
      choices: [...configFiles, { name: '📝 Create new configuration', value: 'NEW' }],
    },
  ]);

  if (configFile === 'NEW') {
    await createBatchConfig(projectRoot);
    return;
  }

  // Get batch options
  const { outputDir, parallel, continueOnError } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: './results',
    },
    {
      type: 'number',
      name: 'parallel',
      message: 'Number of parallel analyses:',
      default: 4,
      validate: (input: number) => input > 0 || 'Must be greater than 0',
    },
    {
      type: 'confirm',
      name: 'continueOnError',
      message: 'Continue on error?',
      default: false,
    },
  ]);

  // Run batch analysis
  const batchSpinner = ora('Running batch analysis...').start();

  try {
    await analyzeBatchCommand({
      config: configFile,
      outputDir,
      parallel,
      continueOnError,
    });

    batchSpinner.succeed('Batch analysis complete!');
  } catch (error) {
    batchSpinner.fail('Batch analysis failed');
    throw error;
  }
}

async function viewRecentResults(projectRoot: string): Promise<void> {
  console.log('\n📄 Recent Results\n');

  const spinner = ora('Searching for result files...').start();
  const resultFiles = await getResultFiles(projectRoot);
  spinner.stop();

  if (resultFiles.length === 0) {
    console.log('❌ No result files found.');
    return;
  }

  // Sort by modification time (most recent first)
  const sortedFiles = resultFiles
    .map(file => ({
      path: file,
      mtime: fs.statSync(path.join(projectRoot, file)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .slice(0, 10); // Show only 10 most recent

  // Select file
  const { resultFile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'resultFile',
      message: 'Select a result file to view:',
      choices: sortedFiles.map(f => ({
        name: `${f.path} (${f.mtime.toLocaleString()})`,
        value: f.path,
      })),
    },
  ]);

  // Read and display file
  const content = fs.readFileSync(path.join(projectRoot, resultFile), 'utf-8');

  console.log('\n📋 Content:');
  console.log(content.substring(0, 1000));
  if (content.length > 1000) {
    console.log('\n... (truncated)');

    const { viewFull } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'viewFull',
        message: 'View full content?',
        default: false,
      },
    ]);

    if (viewFull) {
      console.log('\n' + content);
    }
  }
}

function showHelp(): void {
  console.log(`
📚 Call Structure TS Interactive Mode Help

🔍 Analyze a function
   - Select a TypeScript file from your project
   - Choose a function to analyze
   - Configure analysis options
   - View and save the call graph

🧪 Test against specification
   - Select a specification file (YAML or Mermaid)
   - Validate your code structure against the spec
   - View validation results

📦 Batch analysis
   - Select or create a batch configuration
   - Analyze multiple entry points at once
   - Configure parallel execution

📄 View recent results
   - Browse recently generated results
   - View file contents

💡 Tips:
   - Use arrow keys to navigate menus
   - Start typing to filter file lists
   - Press Ctrl+C to exit at any time
`);
}

// Helper functions

async function getTypeScriptFiles(projectRoot: string): Promise<string[]> {
  const pattern = path.join(projectRoot, '**/*.ts');
  const files = await glob(pattern, {
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts', '**/dist/**'],
    cwd: projectRoot,
  });

  return files.map(f => path.relative(projectRoot, f)).sort();
}

async function getFunctionsFromFile(
  filePath: string
): Promise<Array<{ name: string; className?: string }>> {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const functions: Array<{ name: string; className?: string }> = [];

  // Get all functions
  sourceFile.getFunctions().forEach(func => {
    const name = func.getName();
    if (name) {
      functions.push({ name });
    }
  });

  // Get all class methods
  sourceFile.getClasses().forEach(cls => {
    const className = cls.getName();
    if (className) {
      cls.getMethods().forEach(method => {
        const methodName = method.getName();
        if (methodName) {
          functions.push({ name: methodName, className });
        }
      });
    }
  });

  return functions;
}

async function getSpecificationFiles(projectRoot: string): Promise<string[]> {
  const patterns = ['**/*.yaml', '**/*.yml', '**/*.mmd'];
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(path.join(projectRoot, pattern), {
      ignore: ['**/node_modules/**', '**/dist/**'],
      cwd: projectRoot,
    });
    files.push(...matches);
  }

  return files.map(f => path.relative(projectRoot, f)).sort();
}

async function getBatchConfigFiles(projectRoot: string): Promise<string[]> {
  const patterns = ['**/batch*.yaml', '**/batch*.yml', '**/batch*.json'];
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(path.join(projectRoot, pattern), {
      ignore: ['**/node_modules/**', '**/dist/**'],
      cwd: projectRoot,
    });
    files.push(...matches);
  }

  return files.map(f => path.relative(projectRoot, f)).sort();
}

async function getResultFiles(projectRoot: string): Promise<string[]> {
  const patterns = [
    '**/*callgraph*.json',
    '**/*callgraph*.yaml',
    '**/*callgraph*.mmd',
    '**/results/**/*',
  ];
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(path.join(projectRoot, pattern), {
      ignore: ['**/node_modules/**', '**/dist/**'],
      cwd: projectRoot,
    });
    files.push(...matches);
  }

  return files.map(f => path.relative(projectRoot, f));
}

function getFormatter(
  format: OutputFormat
): JsonFormatter | YamlFormatter | MermaidFormatter | DotFormatter {
  switch (format) {
    case 'json':
      return new JsonFormatter();
    case 'yaml':
      return new YamlFormatter();
    case 'mermaid':
      return new MermaidFormatter();
    case 'dot':
      return new DotFormatter();
    default:
      return new JsonFormatter();
  }
}

async function createBatchConfig(projectRoot: string): Promise<void> {
  console.log('\n📝 Create Batch Configuration\n');

  const { format } = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Configuration format:',
      choices: ['YAML', 'JSON'],
    },
  ]);

  const config = {
    entry_points: [
      {
        file: 'src/example.ts',
        function: 'main',
        output: 'main-analysis.json',
      },
    ],
    common_options: {
      max_depth: 10,
      format: 'json',
    },
  };

  const { filename } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filename',
      message: 'Configuration filename:',
      default: `batch-config.${format.toLowerCase()}`,
    },
  ]);

  const filePath = path.join(projectRoot, filename);

  if (format === 'YAML') {
    const yaml = await import('js-yaml');
    fs.writeFileSync(filePath, yaml.dump(config), 'utf-8');
  } else {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  console.log(`\n✅ Created ${filePath}`);
  console.log('You can now edit this file to add more entry points.');
}
