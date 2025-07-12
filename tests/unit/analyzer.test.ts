import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { EntryPointAnalyzer } from '../../src/analyzer/EntryPointAnalyzer';
import { ProjectContext, CallGraphAnalysisOptions } from '../../src/types/CallGraph';
import * as fs from 'fs';
import * as path from 'path';

describe('CallGraphAnalyzer', () => {
  let testProjectPath: string;
  let context: ProjectContext;

  beforeAll(() => {
    // Create a temporary test project
    testProjectPath = path.join(__dirname, '../fixtures/test-project');
    setupTestProject();
    
    context = {
      rootPath: testProjectPath,
      tsConfigPath: path.join(testProjectPath, 'tsconfig.json'),
      sourcePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules/**', '**/*.test.ts']
    };
  });

  afterAll(() => {
    // Clean up test project
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('Basic Analysis', () => {
    it('should analyze a simple function call', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/simple.ts#main');
      
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.entryPointId).toBe('src/simple.ts#main');
      
      const mainNode = result.nodes.find(n => n.name === 'main');
      const helperNode = result.nodes.find(n => n.name === 'helper');
      
      expect(mainNode).toBeDefined();
      expect(helperNode).toBeDefined();
      expect(mainNode?.type).toBe('function');
      expect(helperNode?.type).toBe('function');
    });

    it('should handle async functions', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/async.ts#asyncMain');
      
      const asyncEdges = result.edges.filter(e => e.type === 'async');
      expect(asyncEdges.length).toBeGreaterThan(0);
      
      const asyncNodes = result.nodes.filter(n => n.async);
      expect(asyncNodes.length).toBeGreaterThan(0);
    });

    it('should handle class methods', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/class.ts#TestClass.process');
      
      const methodNodes = result.nodes.filter(n => n.type === 'method');
      expect(methodNodes.length).toBeGreaterThan(0);
      
      const processNode = result.nodes.find(n => n.name === 'process');
      expect(processNode?.className).toBe('TestClass');
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid entry points gracefully', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('src/nonexistent.ts#missing'))
        .rejects.toThrow('Source file not found');
        
      await expect(analyzer.analyzeFromEntryPoint('src/simple.ts#nonexistent'))
        .rejects.toThrow('Entry point not found');
    });

    it('should respect max depth option', async () => {
      const options: CallGraphAnalysisOptions = { maxDepth: 2 };
      const analyzer = new CallGraphAnalyzer(context, options);
      
      const result = await analyzer.analyzeFromEntryPoint('src/deep.ts#level1');
      
      // Should not include nodes deeper than maxDepth
      const deepestNodes = result.nodes.filter(n => n.name.includes('level4'));
      expect(deepestNodes).toHaveLength(0);
    });

    it('should handle circular dependencies', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/circular.ts#funcA');
      
      // Should complete without infinite loop
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
    });
  });

  describe('Analysis Options', () => {
    it('should exclude test files by default', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/withTests.ts#main');
      
      const testFileNodes = result.nodes.filter(n => n.filePath.includes('.test.'));
      expect(testFileNodes).toHaveLength(0);
    });

    it('should include test files when option is enabled', async () => {
      const options: CallGraphAnalysisOptions = { includeTestFiles: true };
      const analyzer = new CallGraphAnalyzer(context, options);
      
      const result = await analyzer.analyzeFromEntryPoint('src/withTests.ts#main');
      
      const testFileNodes = result.nodes.filter(n => n.filePath.includes('.test.'));
      expect(testFileNodes.length).toBeGreaterThan(0);
    });
  });
});

describe('EntryPointAnalyzer', () => {
  let testProjectPath: string;
  let context: ProjectContext;

  beforeAll(() => {
    testProjectPath = path.join(__dirname, '../fixtures/test-project');
    context = {
      rootPath: testProjectPath,
      tsConfigPath: path.join(testProjectPath, 'tsconfig.json'),
      sourcePatterns: ['src/**/*.ts'],
      excludePatterns: ['node_modules/**']
    };
  });

  describe('Entry Point Discovery', () => {
    it('should discover entry points in project', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      const entryPoints = await analyzer.discoverEntryPoints();
      
      expect(entryPoints.length).toBeGreaterThan(0);
      
      const mainEntryPoint = entryPoints.find(ep => ep.functionName === 'main');
      expect(mainEntryPoint).toBeDefined();
    });

    it('should find common entry point patterns', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      const commonEntryPoints = await analyzer.findCommonEntryPoints();
      
      expect(commonEntryPoints.mainFunctions.length).toBeGreaterThan(0);
      expect(commonEntryPoints.exportedFunctions.length).toBeGreaterThan(0);
    });

    it('should validate entry points', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      
      const validResult = await analyzer.validateEntryPoint('src/simple.ts#main');
      expect(validResult.isValid).toBe(true);
      
      const invalidResult = await analyzer.validateEntryPoint('src/simple.ts#nonexistent');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });
});

function setupTestProject(): void {
  const testProjectPath = path.join(__dirname, '../fixtures/test-project');
  
  // Create directory structure
  fs.mkdirSync(path.join(testProjectPath, 'src'), { recursive: true });
  
  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      strict: true,
      esModuleInterop: true
    },
    include: ['src/**/*']
  };
  fs.writeFileSync(
    path.join(testProjectPath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // Create test source files
  
  // Simple function example
  fs.writeFileSync(
    path.join(testProjectPath, 'src/simple.ts'),
    `
export function main(): void {
  helper();
}

function helper(): string {
  return 'hello';
}
`
  );

  // Async function example
  fs.writeFileSync(
    path.join(testProjectPath, 'src/async.ts'),
    `
export async function asyncMain(): Promise<void> {
  const result = await asyncHelper();
  syncHelper(result);
}

async function asyncHelper(): Promise<string> {
  return Promise.resolve('async result');
}

function syncHelper(data: string): void {
  console.log(data);
}
`
  );

  // Class method example
  fs.writeFileSync(
    path.join(testProjectPath, 'src/class.ts'),
    `
export class TestClass {
  process(): void {
    this.validate();
    this.execute();
  }

  private validate(): boolean {
    return true;
  }

  private execute(): void {
    // implementation
  }
}
`
  );

  // Deep nesting example
  fs.writeFileSync(
    path.join(testProjectPath, 'src/deep.ts'),
    `
export function level1(): void {
  level2();
}

function level2(): void {
  level3();
}

function level3(): void {
  level4();
}

function level4(): void {
  level5();
}

function level5(): void {
  // deep function
}
`
  );

  // Circular dependency example
  fs.writeFileSync(
    path.join(testProjectPath, 'src/circular.ts'),
    `
export function funcA(): void {
  funcB();
}

function funcB(): void {
  funcC();
}

function funcC(): void {
  funcA(); // circular reference
}
`
  );

  // Example with test file
  fs.writeFileSync(
    path.join(testProjectPath, 'src/withTests.ts'),
    `
export function main(): void {
  utils();
}

function utils(): void {
  // implementation
}
`
  );

  fs.writeFileSync(
    path.join(testProjectPath, 'src/withTests.test.ts'),
    `
import { main } from './withTests';

function testMain(): void {
  main();
}

export { testMain };
`
  );
}