import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { EntryPointAnalyzer } from '../../src/analyzer/EntryPointAnalyzer';
import { ProjectContext, CallGraphAnalysisOptions } from '../../src/types/CallGraph';
import * as path from 'path';

describe('CallGraphAnalyzer', () => {
  let context: ProjectContext;

  beforeAll(() => {
    // Use actual project directory instead of fixtures
    const testProjectPath = path.resolve(__dirname, '../../');
    
    context = {
      rootPath: testProjectPath,
      tsConfigPath: path.join(testProjectPath, 'tsconfig.json'),
      sourcePatterns: [],
      excludePatterns: ['node_modules', '\\.test\\.ts$', '\\.spec\\.ts$']
    };
  });

  afterAll(() => {
    // No cleanup needed for actual project directory
  });

  describe('Basic Analysis', () => {
    it('should analyze a simple function call', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      const callGraph = await analyzer.analyzeFromEntryPoint('src/simple.ts#main');
      
      expect(callGraph.nodes.length).toBeGreaterThan(1);
      expect(callGraph.edges.length).toBeGreaterThan(0);
      expect(callGraph.entryPointId).toContain('main');
      expect(callGraph.metadata).toBeDefined();
    });

    it('should analyze async function calls', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      const callGraph = await analyzer.analyzeFromEntryPoint('src/async.ts#asyncMain');
      
      expect(callGraph.nodes.length).toBeGreaterThan(1);
      expect(callGraph.edges.length).toBeGreaterThan(0);
      
      const asyncEdges = callGraph.edges.filter(edge => edge.type === 'async');
      expect(asyncEdges.length).toBeGreaterThan(0);
    });

    it('should respect max depth option', async () => {
      const options: CallGraphAnalysisOptions = {
        maxDepth: 2
      };
      
      const analyzer = new CallGraphAnalyzer(context, options);
      const callGraph = await analyzer.analyzeFromEntryPoint('src/simple.ts#main');
      
      expect(callGraph.metadata.maxDepth).toBe(2);
    });

    it('should handle invalid entry points', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('nonexistent.ts#main'))
        .rejects.toThrow('Source file not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle functions with no calls', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      const callGraph = await analyzer.analyzeFromEntryPoint('src/simple.ts#helper');
      
      expect(callGraph.nodes.length).toBe(1);
      expect(callGraph.edges.length).toBe(0);
    });

    it('should collect metrics when enabled', async () => {
      const options: CallGraphAnalysisOptions = {
        collectMetrics: true
      };
      
      const analyzer = new CallGraphAnalyzer(context, options);
      const callGraph = await analyzer.analyzeFromEntryPoint('src/simple.ts#main');
      
      expect(callGraph.metadata.analysisTimeMs).toBeGreaterThan(0);
    });
  });

  describe('EntryPointAnalyzer', () => {
    it('should discover entry points', async () => {
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
    });
  });
});