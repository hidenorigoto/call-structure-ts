import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { YamlFormatter } from '../../src/formatter/YamlFormatter';
import { MermaidFormatter } from '../../src/formatter/MermaidFormatter';
import { CallGraph } from '../../src/types/CallGraph';

describe('Formatters', () => {
  let sampleCallGraph: CallGraph;

  beforeEach(() => {
    sampleCallGraph = createSampleCallGraph();
  });

  describe('JsonFormatter', () => {
    let formatter: JsonFormatter;

    beforeEach(() => {
      formatter = new JsonFormatter();
    });

    it('should format basic call graph', () => {
      const result = formatter.format(sampleCallGraph);
      const parsed = JSON.parse(result);
      
      expect(parsed.metadata).toBeDefined();
      expect(parsed.nodes).toHaveLength(3);
      expect(parsed.edges).toHaveLength(2);
      expect(parsed.entryPointId).toBe('test#main');
    });

    it('should include metrics when requested', () => {
      const result = formatter.format(sampleCallGraph, {
        format: 'json',
        includeMetrics: true
      });
      const parsed = JSON.parse(result);
      
      expect(parsed.statistics).toBeDefined();
      expect(parsed.statistics.overview).toBeDefined();
      expect(parsed.statistics.overview.totalNodes).toBe(3);
      expect(parsed.statistics.overview.totalEdges).toBe(2);
    });

    it('should format in compact mode', () => {
      const result = formatter.formatWithSchema(sampleCallGraph, 'compact');
      const parsed = JSON.parse(result);
      
      expect(parsed.n).toBeDefined(); // nodes array
      expect(parsed.e).toBeDefined(); // edges array
      expect(parsed.meta).toBeDefined();
    });

    it('should format in simple mode', () => {
      const result = formatter.formatWithSchema(sampleCallGraph, 'simple');
      const parsed = JSON.parse(result);
      
      expect(parsed.functions).toBeDefined();
      expect(parsed.calls).toBeDefined();
      expect(parsed.entryPoint).toBe('test#main');
    });

    it('should validate JSON output', () => {
      const result = formatter.format(sampleCallGraph);
      const validation = formatter.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should detect invalid JSON', () => {
      const invalidJson = '{ "invalid": json }';
      const validation = formatter.validate(invalidJson);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('YamlFormatter', () => {
    let formatter: YamlFormatter;

    beforeEach(() => {
      formatter = new YamlFormatter();
    });

    it('should format basic call graph', () => {
      const result = formatter.format(sampleCallGraph);
      
      expect(result).toContain('metadata:');
      expect(result).toContain('functions:');
      expect(result).toContain('calls:');
      expect(result).toContain('entry_point:');
    });

    it('should format as call tree', () => {
      const result = formatter.formatAsCallTree(sampleCallGraph);
      
      expect(result).toContain('call_tree:');
      expect(result).toContain('function: main');
      expect(result).toContain('calls:');
    });

    it('should format as test specification', () => {
      const result = formatter.formatAsTestSpec(sampleCallGraph);
      
      expect(result).toContain('test_specification:');
      expect(result).toContain('required_functions:');
      expect(result).toContain('required_calls:');
      expect(result).toContain('constraints:');
    });

    it('should parse specification back', () => {
      const spec = formatter.formatAsTestSpec(sampleCallGraph);
      const parsed = formatter.parseSpecification(spec);
      
      expect(parsed.entryPoint).toBe('test#main');
      expect(parsed.requiredFunctions).toBeDefined();
      expect(parsed.requiredCalls).toBeDefined();
    });

    it('should validate YAML output', () => {
      const result = formatter.format(sampleCallGraph);
      const validation = formatter.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });
  });

  describe('MermaidFormatter', () => {
    let formatter: MermaidFormatter;

    beforeEach(() => {
      formatter = new MermaidFormatter();
    });

    it('should format basic call graph', () => {
      const result = formatter.format(sampleCallGraph);
      
      expect(result).toContain('flowchart TD');
      expect(result).toContain('main');
      expect(result).toContain('helper');
      expect(result).toContain('-->');
    });

    it('should include styling', () => {
      const result = formatter.format(sampleCallGraph);
      
      expect(result).toContain('classDef');
      expect(result).toContain('class ');
      expect(result).toContain('entryPoint');
    });

    it('should format with subgraphs', () => {
      const result = formatter.formatWithSubgraphs(sampleCallGraph);
      
      expect(result).toContain('subgraph');
      expect(result).toContain('📁');
      expect(result).toContain('end');
    });

    it('should format as sequence diagram', () => {
      const result = formatter.formatAsSequenceDiagram(sampleCallGraph);
      
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('participant');
      expect(result).toContain('->>');
    });

    it('should validate Mermaid syntax', () => {
      const result = formatter.format(sampleCallGraph);
      const validation = formatter.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should detect invalid Mermaid syntax', () => {
      const invalidMermaid = 'invalid mermaid syntax';
      const validation = formatter.validate(invalidMermaid);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('Cross-format compatibility', () => {
    it('should maintain data consistency across formats', () => {
      const jsonFormatter = new JsonFormatter();
      const yamlFormatter = new YamlFormatter();
      
      const jsonResult = jsonFormatter.format(sampleCallGraph);
      const yamlResult = yamlFormatter.format(sampleCallGraph);
      
      const jsonParsed = JSON.parse(jsonResult);
      const yamlParsed = require('js-yaml').load(yamlResult);
      
      expect(jsonParsed.nodes.length).toBe(yamlParsed.functions.length);
      expect(jsonParsed.edges.length).toBe(yamlParsed.calls.length);
      expect(jsonParsed.entryPointId).toBe(yamlParsed.entry_point.id);
    });
  });
});

function createSampleCallGraph(): CallGraph {
  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'test#main',
      maxDepth: 10,
      projectRoot: '/test',
      totalFiles: 1,
      analysisTimeMs: 100
    },
    nodes: [
      {
        id: 'test#main',
        name: 'main',
        filePath: '/test/src/test.ts',
        line: 1,
        column: 0,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void'
      },
      {
        id: 'test#helper',
        name: 'helper',
        filePath: '/test/src/test.ts',
        line: 5,
        column: 0,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'string'
      },
      {
        id: 'test#asyncHelper',
        name: 'asyncHelper',
        filePath: '/test/src/test.ts',
        line: 9,
        column: 0,
        type: 'function',
        async: true,
        parameters: [],
        returnType: 'Promise<string>'
      }
    ],
    edges: [
      {
        id: 'edge1',
        source: 'test#main',
        target: 'test#helper',
        type: 'sync',
        line: 2,
        column: 2
      },
      {
        id: 'edge2',
        source: 'test#main',
        target: 'test#asyncHelper',
        type: 'async',
        line: 3,
        column: 2
      }
    ],
    entryPointId: 'test#main'
  };
}