import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe.skip('CLI End-to-End Workflows', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const tempDir = path.join(__dirname, '../fixtures/temp-e2e');
  const workflowDir = path.join(tempDir, 'workflow');

  function runCli(args: string): { stdout: string; stderr: string; code: number } {
    try {
      const stdout = execSync(`node ${cliPath} ${args} 2>&1`, {
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' },
        cwd: path.join(__dirname, '../../'), // Run from project root
      });
      return { stdout, stderr: '', code: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.status || 1,
      };
    }
  }

  beforeAll(() => {
    // Build the project
    execSync('npm run build', { stdio: 'ignore' });

    // Create temp directories
    [tempDir, workflowDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean workflow directory
    const files = fs.readdirSync(workflowDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(workflowDir, file));
    });
  });

  describe('Complete Analysis Workflow', () => {
    it('should complete full workflow: discover -> validate -> analyze -> test', () => {
      // Step 1: Discover entry points
      const discoverResult = runCli(
        `discover --controllers --handlers --output ${workflowDir}/discovered.json`
      );
      expect(discoverResult.code).toBe(0);

      const discovered = JSON.parse(fs.readFileSync(`${workflowDir}/discovered.json`, 'utf-8'));
      expect(discovered.entryPoints.length).toBeGreaterThan(0);

      // Step 2: Validate discovered entry points
      const validateResult = runCli(
        `validate --from-file ${workflowDir}/discovered.json --output ${workflowDir}/validation.json --format json`
      );
      expect(validateResult.code).toBe(0);

      const validation = JSON.parse(fs.readFileSync(`${workflowDir}/validation.json`, 'utf-8'));
      const validEntryPoints = validation.results.filter((r: any) => r.valid);
      expect(validEntryPoints.length).toBeGreaterThan(0);

      // Step 3: Analyze the first valid entry point
      const firstEntry = validEntryPoints[0].entryPoint;
      const analyzeResult = runCli(
        `analyze --entry "${firstEntry}" --output ${workflowDir}/analysis.json --include-metrics --quiet`
      );
      expect(analyzeResult.code).toBe(0);

      const analysis = JSON.parse(fs.readFileSync(`${workflowDir}/analysis.json`, 'utf-8'));
      expect(analysis.nodes.length).toBeGreaterThan(0);
      expect(analysis.metrics).toBeDefined();

      // Step 4: Create a test specification based on the analysis
      const testSpec = {
        entry_point: firstEntry,
        required_edges: analysis.edges.slice(0, 2).map((e: any) => ({
          from: e.source,
          to: e.target,
        })),
        forbidden_edges: [],
      };
      fs.writeFileSync(`${workflowDir}/test-spec.yaml`, yaml.dump(testSpec));

      // Step 5: Test against the specification
      const testResult = runCli(`test --spec ${workflowDir}/test-spec.yaml`);
      expect(testResult.code).toBe(0);
      expect(testResult.stdout).toContain('Test PASSED');
    });
  });

  describe('Batch Analysis Workflow', () => {
    it('should analyze multiple entry points in batch', () => {
      // Step 1: Discover entry points
      const discoverResult = runCli(
        `discover --exports --include "src/simple.ts" --output ${workflowDir}/discovered.json`
      );
      expect(discoverResult.code).toBe(0);

      const discovered = JSON.parse(fs.readFileSync(`${workflowDir}/discovered.json`, 'utf-8'));

      // Step 2: Create batch configuration from discovered entry points
      const batchConfig = {
        entry_points: discovered.entryPoints.slice(0, 3).map((ep: any, index: number) => ({
          file: ep.filePath,
          function: ep.name,
          output: `analysis-${index}.json`,
        })),
        common_options: {
          max_depth: 5,
          include_metrics: true,
          filter_external: true,
        },
      };
      fs.writeFileSync(`${workflowDir}/batch-config.yaml`, yaml.dump(batchConfig));

      // Step 3: Run batch analysis
      const batchResult = runCli(
        `analyze-batch --config ${workflowDir}/batch-config.yaml --output-dir ${workflowDir}/batch-output`
      );
      expect(batchResult.code).toBe(0);

      // Step 4: Verify all outputs were created
      const batchOutputDir = `${workflowDir}/batch-output`;
      expect(fs.existsSync(`${batchOutputDir}/analysis-0.json`)).toBe(true);
      expect(fs.existsSync(`${batchOutputDir}/batch-report.json`)).toBe(true);

      // Step 5: Generate combined report
      const report = JSON.parse(fs.readFileSync(`${batchOutputDir}/batch-report.json`, 'utf-8'));
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.successful).toBeGreaterThan(0);
    });
  });

  describe('CI/CD Integration Workflow', () => {
    it('should support CI-friendly output and exit codes', () => {
      // Create a specification that will fail
      const failingSpec = {
        entry_point: 'src/simple.ts#main',
        required_edges: [{ from: 'src/simple.ts#main', to: 'src/simple.ts#nonExistentFunction' }],
        forbidden_edges: [],
      };
      fs.writeFileSync(`${workflowDir}/failing-spec.yaml`, yaml.dump(failingSpec));

      // Test should fail with proper exit code
      const testResult = runCli(`test --spec ${workflowDir}/failing-spec.yaml --ci`);
      expect(testResult.code).toBe(1);
      expect(testResult.stdout).toContain('Missing required edge');

      // Create a passing specification
      const passingSpec = {
        entry_point: 'src/simple.ts#main',
        required_edges: [],
        forbidden_edges: [],
      };
      fs.writeFileSync(`${workflowDir}/passing-spec.yaml`, yaml.dump(passingSpec));

      // Test should pass
      const passResult = runCli(`test --spec ${workflowDir}/passing-spec.yaml --ci`);
      expect(passResult.code).toBe(0);
    });

    it('should generate machine-readable reports for CI', () => {
      // Analyze with CI-friendly output
      const result = runCli(
        `analyze --entry "src/simple.ts#main" --output ${workflowDir}/ci-analysis.json --format json --quiet --ci`
      );

      expect(result.code).toBe(0);

      // Output should be valid JSON without extra console output
      const content = fs.readFileSync(`${workflowDir}/ci-analysis.json`, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.generatedAt).toBeDefined();
      expect(parsed.metadata.ciMode).toBe(true);
    });
  });

  describe('Documentation Generation Workflow', () => {
    it('should generate documentation from analysis', () => {
      // Step 1: Analyze a module
      const analyzeResult = runCli(
        `analyze --entry "src/simple.ts#main" --output ${workflowDir}/analysis.json --include-metrics --quiet`
      );
      expect(analyzeResult.code).toBe(0);

      // Step 2: Generate Mermaid diagram
      const mermaidResult = runCli(
        `analyze --entry "src/simple.ts#main" --output ${workflowDir}/diagram.mmd --format mermaid --quiet`
      );
      expect(mermaidResult.code).toBe(0);

      const mermaidContent = fs.readFileSync(`${workflowDir}/diagram.mmd`, 'utf-8');
      expect(mermaidContent).toContain('flowchart');
      expect(mermaidContent).toContain('main');

      // Step 3: Generate YAML documentation
      const yamlResult = runCli(
        `analyze --entry "src/simple.ts#main" --output ${workflowDir}/structure.yaml --format yaml --quiet`
      );
      expect(yamlResult.code).toBe(0);

      const yamlContent = fs.readFileSync(`${workflowDir}/structure.yaml`, 'utf-8');
      const yamlParsed = yaml.load(yamlContent) as any;
      expect(yamlParsed.nodes).toBeDefined();
      expect(yamlParsed.edges).toBeDefined();

      // Step 4: Create a markdown report combining all outputs
      const report = `# Call Graph Analysis Report

## Entry Point
- File: src/simple.ts
- Function: main

## Metrics
${JSON.stringify(JSON.parse(fs.readFileSync(`${workflowDir}/analysis.json`, 'utf-8')).metrics, null, 2)}

## Diagram
\`\`\`mermaid
${mermaidContent}
\`\`\`

## Structure
\`\`\`yaml
${yamlContent}
\`\`\`
`;

      fs.writeFileSync(`${workflowDir}/report.md`, report);
      expect(fs.existsSync(`${workflowDir}/report.md`)).toBe(true);
    });
  });

  describe('Project Migration Workflow', () => {
    it('should analyze differences between versions', () => {
      // Simulate analyzing two versions of the same function
      // For this test, we'll analyze the same function twice as a simulation

      // Step 1: Analyze "old version"
      const oldResult = runCli(
        `analyze --entry "src/simple.ts#main" --output ${workflowDir}/old-version.json --quiet`
      );
      expect(oldResult.code).toBe(0);

      // Step 2: Analyze "new version" (same for simulation)
      const newResult = runCli(
        `analyze --entry "src/simple.ts#main" --output ${workflowDir}/new-version.json --quiet`
      );
      expect(newResult.code).toBe(0);

      // Step 3: Compare the two versions
      const oldAnalysis = JSON.parse(fs.readFileSync(`${workflowDir}/old-version.json`, 'utf-8'));
      const newAnalysis = JSON.parse(fs.readFileSync(`${workflowDir}/new-version.json`, 'utf-8'));

      // Create a simple comparison
      const comparison = {
        oldVersion: {
          nodes: oldAnalysis.nodes.length,
          edges: oldAnalysis.edges.length,
        },
        newVersion: {
          nodes: newAnalysis.nodes.length,
          edges: newAnalysis.edges.length,
        },
        changes: {
          nodesDiff: newAnalysis.nodes.length - oldAnalysis.nodes.length,
          edgesDiff: newAnalysis.edges.length - oldAnalysis.edges.length,
        },
      };

      fs.writeFileSync(`${workflowDir}/comparison.json`, JSON.stringify(comparison, null, 2));
      expect(fs.existsSync(`${workflowDir}/comparison.json`)).toBe(true);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle partial failures gracefully', () => {
      // Create a batch config with some invalid entries
      const mixedConfig = {
        entry_points: [
          { file: 'src/simple.ts', function: 'main', output: 'valid-1.json' },
          { file: 'src/nonexistent.ts', function: 'foo', output: 'invalid-1.json' },
          { file: 'src/simple.ts', function: 'helper', output: 'valid-2.json' },
          { file: 'src/simple.ts', function: 'nonexistent', output: 'invalid-2.json' },
        ],
        common_options: {
          max_depth: 3,
        },
      };
      fs.writeFileSync(`${workflowDir}/mixed-batch.yaml`, yaml.dump(mixedConfig));

      // Run with continue-on-error
      const result = runCli(
        `analyze-batch --config ${workflowDir}/mixed-batch.yaml --output-dir ${workflowDir}/mixed-output --continue-on-error`
      );
      expect(result.code).toBe(0);

      // Check that valid analyses completed
      expect(fs.existsSync(`${workflowDir}/mixed-output/valid-1.json`)).toBe(true);
      expect(fs.existsSync(`${workflowDir}/mixed-output/valid-2.json`)).toBe(true);

      // Invalid ones should not exist
      expect(fs.existsSync(`${workflowDir}/mixed-output/invalid-1.json`)).toBe(false);
      expect(fs.existsSync(`${workflowDir}/mixed-output/invalid-2.json`)).toBe(false);

      // Batch report should show partial success
      const report = JSON.parse(
        fs.readFileSync(`${workflowDir}/mixed-output/batch-report.json`, 'utf-8')
      );
      expect(report.summary.successful).toBe(2);
      expect(report.summary.failed).toBe(2);
    });
  });

  describe('Interactive Workflow', () => {
    it('should support step-by-step analysis', () => {
      // Step 1: Quick discovery with limited scope
      const quickDiscover = runCli(`discover --exports --include "src/simple.ts" --format list`);
      expect(quickDiscover.code).toBe(0);

      const entryPoints = quickDiscover.stdout
        .split('\n')
        .filter(line => line.includes('#'))
        .filter(line => !line.includes('test'));

      expect(entryPoints.length).toBeGreaterThan(0);

      // Step 2: Validate first entry point with details
      const firstEntry = entryPoints[0].trim();
      const validateResult = runCli(`validate --entry "${firstEntry}" --details`);
      expect(validateResult.code).toBe(0);
      expect(validateResult.stdout).toContain('Entry point is valid');

      // Step 3: Quick analysis with limited depth
      const quickAnalysis = runCli(`analyze --entry "${firstEntry}" --max-depth 1 --format yaml`);
      expect(quickAnalysis.code).toBe(0);
      expect(quickAnalysis.stdout).toContain('nodes:');

      // Step 4: Deep analysis if needed
      const deepAnalysis = runCli(
        `analyze --entry "${firstEntry}" --max-depth 10 --output ${workflowDir}/deep-analysis.json --quiet`
      );
      expect(deepAnalysis.code).toBe(0);

      const analysis = JSON.parse(fs.readFileSync(`${workflowDir}/deep-analysis.json`, 'utf-8'));
      expect(analysis.nodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance Testing Workflow', () => {
    it('should analyze performance characteristics', () => {
      // Run analysis multiple times to gather timing data
      const timings: number[] = [];
      const runs = 3;

      for (let i = 0; i < runs; i++) {
        const start = Date.now();
        const result = runCli(
          `analyze --entry "src/simple.ts#main" --output ${workflowDir}/perf-${i}.json --quiet`
        );
        const duration = Date.now() - start;

        expect(result.code).toBe(0);
        timings.push(duration);

        // Also check the reported analysis time
        const analysis = JSON.parse(fs.readFileSync(`${workflowDir}/perf-${i}.json`, 'utf-8'));
        expect(analysis.metadata.analysisTimeMs).toBeDefined();
      }

      // Calculate statistics
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);

      const perfReport = {
        runs,
        timings,
        statistics: {
          average: avgTime,
          min: minTime,
          max: maxTime,
          variance: maxTime - minTime,
        },
      };

      fs.writeFileSync(
        `${workflowDir}/performance-report.json`,
        JSON.stringify(perfReport, null, 2)
      );

      // Performance should be reasonable
      expect(avgTime).toBeLessThan(5000); // 5 seconds max average
    });
  });
});
