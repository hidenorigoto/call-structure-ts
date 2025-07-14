import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { YamlFormatter } from '../../src/formatter/YamlFormatter';
import { MermaidFormatter, MermaidFormatOptions } from '../../src/formatter/MermaidFormatter';
import { CallGraph } from '../../src/types/CallGraph';
import { Writable } from 'stream';

// Helper functions
function createSampleCallGraph(): CallGraph {
  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'test#main',
      maxDepth: 10,
      projectRoot: '/test',
      totalFiles: 1,
      analysisTimeMs: 100,
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
        returnType: 'void',
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
        returnType: 'string',
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
        returnType: 'Promise<string>',
      },
    ],
    edges: [
      {
        id: 'edge1',
        source: 'test#main',
        target: 'test#helper',
        type: 'sync',
        line: 2,
        column: 2,
      },
      {
        id: 'edge2',
        source: 'test#main',
        target: 'test#asyncHelper',
        type: 'async',
        line: 3,
        column: 2,
      },
    ],
    entryPointId: 'test#main',
  };
}

function createCallGraphWithNodeTypes(): CallGraph {
  return {
    ...createSampleCallGraph(),
    nodes: [
      ...createSampleCallGraph().nodes,
      {
        id: 'test#MyClass.method',
        name: 'method',
        className: 'MyClass',
        filePath: '/test/src/test.ts',
        line: 15,
        column: 2,
        type: 'method',
        async: false,
        parameters: [],
        returnType: 'void',
      },
      {
        id: 'test#MyClass.constructor',
        name: 'constructor',
        className: 'MyClass',
        filePath: '/test/src/test.ts',
        line: 10,
        column: 2,
        type: 'constructor',
        async: false,
        parameters: [],
        returnType: 'MyClass',
      },
      {
        id: 'test#arrowFunc',
        name: 'arrowFunc',
        filePath: '/test/src/test.ts',
        line: 20,
        column: 0,
        type: 'arrow',
        async: false,
        parameters: [],
        returnType: 'void',
      },
    ],
  };
}

function createLargeCallGraph(): CallGraph {
  const nodes = [];
  const edges = [];

  for (let i = 0; i < 10; i++) {
    nodes.push({
      id: `test#func${i}`,
      name: `func${i}`,
      filePath: '/test/src/test.ts',
      line: i * 5,
      column: 0,
      type: 'function' as const,
      async: false,
      parameters: [],
      returnType: 'void',
    });

    if (i > 0) {
      edges.push({
        id: `edge${i}`,
        source: `test#func${i - 1}`,
        target: `test#func${i}`,
        type: 'sync' as const,
        line: i * 5 - 1,
        column: 2,
      });
    }
  }

  return {
    ...createSampleCallGraph(),
    nodes,
    edges,
    entryPointId: 'test#func0',
  };
}

function createCircularCallGraph(): CallGraph {
  const base = createSampleCallGraph();
  return {
    ...base,
    edges: [
      ...base.edges,
      {
        id: 'edge3',
        source: 'test#helper',
        target: 'test#main',
        type: 'sync',
        line: 6,
        column: 2,
      },
    ],
  };
}

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
        includeMetrics: true,
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const yamlParsed = require('js-yaml').load(yamlResult);

      expect(jsonParsed.nodes.length).toBe(yamlParsed.functions.length);
      expect(jsonParsed.edges.length).toBe(yamlParsed.calls.length);
      expect(jsonParsed.entryPointId).toBe(yamlParsed.entry_point.id);
    });
  });
});

describe('MermaidFormatter - Advanced Features', () => {
  let formatter: MermaidFormatter;
  let sampleCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new MermaidFormatter();
    sampleCallGraph = createSampleCallGraph();
  });

  it('should apply node styling for different node types', () => {
    const callGraphWithTypes = createCallGraphWithNodeTypes();
    const result = formatter.format(callGraphWithTypes);

    // Should have styling for method nodes
    expect(result).toContain('class ');
    expect(result).toContain('method;');

    // Should have styling for constructor nodes
    expect(result).toContain('constructor;');

    // Should have styling for arrow function nodes
    expect(result).toContain('arrowFunction;');

    // Should have styling for async nodes
    expect(result).toContain('asyncFunction;');
  });

  it('should format with custom options', () => {
    const options: MermaidFormatOptions = {
      direction: 'LR',
      theme: 'dark',
      showEdgeLabels: true,
      maxNodes: 10,
    };
    const result = formatter.format(sampleCallGraph, options);

    expect(result).toContain('flowchart LR');
    expect(result).toContain('%%{init:');
    expect(result).toContain('theme');
    expect(result).toContain('dark');
  });

  it('should handle clustering by module', () => {
    const options: MermaidFormatOptions = {
      clusterByModule: true,
    };
    const result = formatter.format(sampleCallGraph, options);

    expect(result).toContain('subgraph');
    expect(result).toContain('📁');
  });

  it('should generate sequence diagram', () => {
    const options: MermaidFormatOptions = {
      diagramType: 'sequence',
    };
    const result = formatter.format(sampleCallGraph, options);

    expect(result).toContain('sequenceDiagram');
    expect(result).toContain('participant');
  });

  it('should handle node limit', () => {
    const largeGraph = createLargeCallGraph();
    const options: MermaidFormatOptions = {
      maxNodes: 3,
    };
    const result = formatter.format(largeGraph, options);

    // Count nodes - should be limited
    const nodeMatches = result.match(/\w+\[.*?\]/g) || [];
    expect(nodeMatches.length).toBeLessThanOrEqual(3);
  });

  it('should handle circular references', () => {
    const circularGraph = createCircularCallGraph();
    const result = formatter.format(circularGraph, {
      circularReferenceStrategy: 'omit',
    });

    // Should successfully format without errors
    expect(result).toContain('flowchart');
    expect(result).toContain('main');
    expect(result).toContain('helper');
  });

  it('should format with themes', () => {
    const options: MermaidFormatOptions = {
      theme: 'dark',
    };
    const darkResult = formatter.format(sampleCallGraph, options);

    expect(darkResult).toContain('%%{init:');
    expect(darkResult).toContain('theme');
    expect(darkResult).toContain('dark');
  });
});

describe('JsonFormatter - Advanced Features', () => {
  let formatter: JsonFormatter;
  let sampleCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new JsonFormatter();
    sampleCallGraph = createSampleCallGraph();
  });

  it('should handle streaming format', () => {
    const chunks: string[] = [];
    const stream = {
      write: (chunk: string): boolean => {
        chunks.push(chunk);
        return true;
      },
      end: jest.fn(),
    };

    formatter.formatStream(sampleCallGraph, stream as unknown as Writable);

    expect(stream.end).toHaveBeenCalled();
    const result = chunks.join('');
    const parsed = JSON.parse(result);
    expect(parsed.nodes).toBeDefined();
  });

  it('should handle different schema formats', () => {
    // Test compact format
    const compactResult = formatter.formatWithSchema(sampleCallGraph, 'compact');
    const compactParsed = JSON.parse(compactResult);
    expect(compactParsed.n).toBeDefined();
    expect(compactParsed.e).toBeDefined();

    // Test simple format
    const simpleResult = formatter.formatWithSchema(sampleCallGraph, 'simple');
    const simpleParsed = JSON.parse(simpleResult);
    expect(simpleParsed.functions).toBeDefined();
    expect(simpleParsed.calls).toBeDefined();
  });

  it('should validate JSON output correctly', () => {
    // Test valid JSON
    const result = formatter.format(sampleCallGraph);
    const validation = formatter.validate(result);
    expect(validation.isValid).toBe(true);

    // Test invalid JSON
    const invalidJson = '{ invalid json';
    const invalidValidation = formatter.validate(invalidJson);
    expect(invalidValidation.isValid).toBe(false);
    expect(invalidValidation.error).toBeDefined();
  });

  it('should handle circular references with inline-once strategy', () => {
    const circularGraph = createCircularCallGraph();
    const result = formatter.format(circularGraph, {
      circularReferenceStrategy: 'inline-once',
    });

    const parsed = JSON.parse(result);
    expect(parsed.nodes).toBeDefined();
    expect(parsed.edges).toBeDefined();
    // Should handle circular references without error
  });

  it('should handle edge labels', () => {
    const graphWithLabels = {
      ...sampleCallGraph,
      edges: sampleCallGraph.edges.map(e => ({
        ...e,
        label: 'calls',
      })),
    };

    const result = formatter.format(graphWithLabels);
    const parsed = JSON.parse(result);

    expect(parsed.edges[0].label).toBe('calls');
  });
});

describe('YamlFormatter - Advanced Features', () => {
  let formatter: YamlFormatter;
  let sampleCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new YamlFormatter();
    sampleCallGraph = createSampleCallGraph();
  });

  it('should handle streaming format', () => {
    const chunks: string[] = [];
    const stream = {
      write: (chunk: string): boolean => {
        chunks.push(chunk);
        return true;
      },
      end: jest.fn(),
    };

    formatter.formatStream(sampleCallGraph, stream as unknown as Writable);

    expect(stream.end).toHaveBeenCalled();
    const result = chunks.join('');
    expect(result).toContain('metadata:');
    expect(result).toContain('functions:');
  });

  it('should format call tree correctly', () => {
    const result = formatter.formatAsCallTree(sampleCallGraph);

    expect(result).toContain('call_tree:');
    expect(result).toContain('function: main');
    expect(result).toContain('calls:');
    expect(result).toContain('- function: helper');
    expect(result).toContain('- function: asyncHelper');
  });

  it('should handle empty graph', () => {
    const emptyGraph: CallGraph = {
      nodes: [],
      edges: [],
      entryPointId: '',
      metadata: {
        generatedAt: new Date().toISOString(),
        entryPoint: '',
        maxDepth: 0,
        projectRoot: '',
        totalFiles: 0,
        analysisTimeMs: 0,
      },
    };

    const result = formatter.format(emptyGraph);
    expect(result).toContain('functions: []');
    expect(result).toContain('calls: []');
  });

  it('should include metrics when requested', () => {
    const result = formatter.format(sampleCallGraph, {
      includeMetrics: true,
    });

    expect(result).toContain('statistics:');
    expect(result).toContain('total_functions:');
    expect(result).toContain('total_calls:');
  });

  it('should handle invalid yaml', () => {
    const invalidYaml = 'invalid: yaml: structure:';
    const validation = formatter.validate(invalidYaml);

    expect(validation.isValid).toBe(false);
    expect(validation.error).toBeDefined();
  });
});

describe('Formatter Error Cases', () => {
  let sampleCallGraph: CallGraph;

  beforeEach(() => {
    sampleCallGraph = createSampleCallGraph();
  });

  it('should handle circular references in JsonFormatter', () => {
    const circularGraph = createCircularCallGraph();
    const formatter = new JsonFormatter();

    const result = formatter.format(circularGraph, {
      circularReferenceStrategy: 'omit',
    });

    const parsed = JSON.parse(result);
    expect(parsed.nodes).toBeDefined();
    expect(parsed.edges).toBeDefined();
  });

  it('should handle large graphs in MermaidFormatter', () => {
    const largeGraph = createLargeCallGraph();
    const formatter = new MermaidFormatter();

    const options: MermaidFormatOptions = {
      maxNodes: 5,
    };
    const result = formatter.format(largeGraph, options);

    // Should have limited nodes
    const nodeMatches = result.match(/\w+\[.*?\]/g) || [];
    expect(nodeMatches.length).toBeLessThanOrEqual(5);
  });

  it('should handle missing node names gracefully', () => {
    const graphWithMissingNames = {
      ...sampleCallGraph,
      nodes: [
        {
          ...sampleCallGraph.nodes[0],
          name: '',
        },
        ...sampleCallGraph.nodes.slice(1),
      ],
    };

    const jsonFormatter = new JsonFormatter();
    const result = jsonFormatter.format(graphWithMissingNames);
    const parsed = JSON.parse(result);

    expect(parsed.nodes[0].name).toBe('');
    expect(parsed.nodes[0].id).toBeDefined();
  });
});
