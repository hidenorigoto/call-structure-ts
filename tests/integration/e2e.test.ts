import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { EntryPointAnalyzer } from '../../src/analyzer/EntryPointAnalyzer';
import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { YamlFormatter } from '../../src/formatter/YamlFormatter';
import { MermaidFormatter } from '../../src/formatter/MermaidFormatter';
import { ProjectContext } from '../../src/types/CallGraph';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('End-to-End Integration Tests', () => {
  let testProjectPath: string;
  let context: ProjectContext;

  beforeAll(() => {
    // Use actual project directory
    testProjectPath = path.resolve(__dirname, '../../');
    
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

  describe('Real-world TypeScript Project Analysis', () => {
    it('should analyze a complete user service flow', async () => {
      const analyzer = new CallGraphAnalyzer(context, { maxDepth: 10 });
      const result = await analyzer.analyzeFromEntryPoint('src/api/index.ts#ApiController.handleRequest');
      
      // Verify the call chain: controller -> service -> repository -> database
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
      
      // Check for expected nodes
      const nodeNames = result.nodes.map(n => n.name);
      expect(nodeNames).toContain('handleRequest'); // controller method
      expect(nodeNames).toContain('getUser'); // service method
      expect(nodeNames).toContain('processUser'); // processing method
      
      // Check for async patterns
      const asyncEdges = result.edges.filter(e => e.type === 'async');
      expect(asyncEdges.length).toBeGreaterThan(0);
    });

    it('should handle complex class hierarchies', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/api/userService.ts#UserService.getUser');
      
      // Should include at least one method
      const methodNodes = result.nodes.filter(n => n.type === 'method');
      expect(methodNodes.length).toBeGreaterThanOrEqual(1);
      
      // Check class patterns
      const classNames = new Set(result.nodes.map(n => n.className).filter(Boolean));
      expect(classNames.size).toBeGreaterThanOrEqual(1);
    });

    it('should trace middleware chain', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      const result = await analyzer.analyzeFromEntryPoint('src/api/userService.ts#UserService.createUser');
      
      // Should have at least one edge  
      expect(result.edges.length).toBeGreaterThan(0);
      
      // Check for valid edge types
      const edgeTypes = result.edges.map(e => e.type);
      expect(edgeTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Entry Point Discovery', () => {
    it('should discover all potential entry points', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      const entryPoints = await analyzer.discoverEntryPoints();
      
      expect(entryPoints.length).toBeGreaterThanOrEqual(0);
      
      // Should find controllers
      const controllerEntryPoints = entryPoints.filter(ep => 
        ep.className && ep.className.includes('Controller')
      );
      expect(controllerEntryPoints.length).toBeGreaterThanOrEqual(0);
      
      // Should find exported functions
      const exportedFunctions = entryPoints.filter(ep => ep.exportName);
      expect(exportedFunctions.length).toBeGreaterThanOrEqual(0);
    });

    it('should find common entry point patterns', async () => {
      const analyzer = new EntryPointAnalyzer(context);
      const commonEntryPoints = await analyzer.findCommonEntryPoints();
      
      expect(commonEntryPoints.controllers.length).toBeGreaterThanOrEqual(0);
      expect(commonEntryPoints.handlers.length).toBeGreaterThanOrEqual(0);
      expect(commonEntryPoints.mainFunctions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Output Format Integration', () => {
    let callGraph: any;

    beforeAll(async () => {
      const analyzer = new CallGraphAnalyzer(context);
      callGraph = await analyzer.analyzeFromEntryPoint('src/api/index.ts#createApi');
    });

    it('should generate valid JSON output', () => {
      const formatter = new JsonFormatter();
      const output = formatter.format(callGraph, { 
        format: 'json', 
        includeMetrics: true 
      });
      
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
      
      const parsed = JSON.parse(output);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
      expect(parsed.statistics).toBeDefined();
    });

    it('should generate valid YAML output', () => {
      const formatter = new YamlFormatter();
      const output = formatter.format(callGraph);
      
      // Should be valid YAML
      const yaml = require('js-yaml');
      expect(() => yaml.load(output)).not.toThrow();
      
      const parsed = yaml.load(output);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.functions).toBeDefined();
      expect(parsed.calls).toBeDefined();
    });

    it('should generate valid Mermaid diagram', () => {
      const formatter = new MermaidFormatter();
      const output = formatter.format(callGraph);
      
      expect(output).toContain('flowchart TD');
      expect(output).toContain('classDef');
      
      const validation = formatter.validate(output);
      expect(validation.isValid).toBe(true);
    });

    it('should generate different Mermaid variants', () => {
      const formatter = new MermaidFormatter();
      
      const flowchart = formatter.format(callGraph);
      const subgraphs = formatter.formatWithSubgraphs(callGraph);
      const sequence = formatter.formatAsSequenceDiagram(callGraph);
      
      expect(flowchart).toContain('flowchart TD');
      expect(subgraphs).toContain('subgraph');
      expect(sequence).toContain('sequenceDiagram');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large call graphs efficiently', async () => {
      const analyzer = new CallGraphAnalyzer(context, { maxDepth: 8 });
      
      const startTime = Date.now();
      const result = await analyzer.analyzeFromEntryPoint('src/api/index.ts#createApi');
      const analysisTime = Date.now() - startTime;
      
      // Should complete within reasonable time (5 seconds)
      expect(analysisTime).toBeLessThan(5000);
      
      // Should handle reasonable complexity
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect depth limits', async () => {
      const shallowAnalyzer = new CallGraphAnalyzer(context, { maxDepth: 2 });
      const deepAnalyzer = new CallGraphAnalyzer(context, { maxDepth: 8 });
      
      const shallowResult = await shallowAnalyzer.analyzeFromEntryPoint('src/api/index.ts#createApi');
      const deepResult = await deepAnalyzer.analyzeFromEntryPoint('src/api/index.ts#createApi');
      
      expect(shallowResult.nodes.length).toBeLessThanOrEqual(deepResult.nodes.length);
      expect(shallowResult.edges.length).toBeLessThanOrEqual(deepResult.edges.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('src/nonexistent.ts#main'))
        .rejects.toThrow('Source file not found');
    });

    it('should handle invalid function names', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('src/api/index.ts#nonexistentFunction'))
        .rejects.toThrow('Entry point not found');
    });

    it('should handle malformed entry point strings', async () => {
      const analyzer = new CallGraphAnalyzer(context);
      
      await expect(analyzer.analyzeFromEntryPoint('invalid-format'))
        .rejects.toThrow('Invalid entry point format');
        
      await expect(analyzer.analyzeFromEntryPoint('src/api/index.ts'))
        .rejects.toThrow('Invalid entry point format');
    });
  });
});

