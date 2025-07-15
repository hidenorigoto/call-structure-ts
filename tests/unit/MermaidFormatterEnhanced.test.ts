import { MermaidFormatter, MermaidFormatOptions } from '../../src/formatter/MermaidFormatter';
import { CallGraph, CallGraphNode, CallGraphEdge } from '../../src/types/CallGraph';
import { FormatOptions, CircularReferenceStrategy } from '../../src/types/Formatter';
import { Writable } from 'stream';

describe('MermaidFormatter Enhanced Features', () => {
  let formatter: MermaidFormatter;
  let sampleCallGraph: CallGraph;
  let circularCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new MermaidFormatter();
    sampleCallGraph = createSampleCallGraph();
    circularCallGraph = createCircularCallGraph();
  });

  describe('Formatter Interface Compliance', () => {
    it('should implement Formatter interface correctly', () => {
      expect(typeof formatter.format).toBe('function');
      expect(typeof formatter.formatStream).toBe('function');
      expect(typeof formatter.validate).toBe('function');
    });

    it('should accept FormatOptions correctly', () => {
      const options: FormatOptions = {
        includeMetadata: true,
        includeMetrics: true,
        prettify: true,
        maxDepth: 5,
        filterExternal: true,
        circularReferenceStrategy: CircularReferenceStrategy.OMIT,
        chunkSize: 50,
      };

      const result = formatter.format(sampleCallGraph, options);
      expect(result).toBeDefined();
      expect(result).toContain('flowchart');
    });
  });

  describe('MermaidFormatOptions', () => {
    it('should respect direction option', () => {
      const options: MermaidFormatOptions = {
        direction: 'LR',
      };

      const result = formatter.format(sampleCallGraph, options);
      expect(result).toContain('flowchart LR');
    });

    it('should apply theme when specified', () => {
      const options: MermaidFormatOptions = {
        theme: 'dark',
      };

      const result = formatter.format(sampleCallGraph, options);
      expect(result).toContain("%%{init: {'theme':'dark'}}%%");
    });

    it('should cluster by module when enabled', () => {
      const options: MermaidFormatOptions = {
        clusterByModule: true,
      };

      const result = formatter.format(sampleCallGraph, options);
      expect(result).toContain('subgraph');
      expect(result).toContain('📁');
      expect(result).toContain('end');
    });

    it('should limit nodes when maxNodes is set', () => {
      const largeGraph = createLargeCallGraph(20);
      const options: MermaidFormatOptions = {
        maxNodes: 10,
      };

      const result = formatter.format(largeGraph, options);

      // Count node definitions (lines with shapes like (), [], etc.)
      const nodeMatches = result.match(/\w+[([\]{>]/g) || [];
      expect(nodeMatches.length).toBeLessThanOrEqual(10);
    });

    it('should hide edge labels when showEdgeLabels is false', () => {
      const options: MermaidFormatOptions = {
        showEdgeLabels: false,
      };

      const result = formatter.format(sampleCallGraph, options);

      // Should not contain edge labels like |"await"| or |"2x"|
      expect(result).not.toContain('|"');
    });

    it('should generate sequence diagram when diagramType is sequence', () => {
      const options: MermaidFormatOptions = {
        diagramType: 'sequence',
      };

      const result = formatter.format(sampleCallGraph, options);
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('participant');
      expect(result).toContain('->>');
    });
  });

  describe('Streaming Support', () => {
    it('should stream format basic call graph', done => {
      const chunks: string[] = [];
      const mockStream = new MockWritable();

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).toContain('flowchart TD');
        expect(output).toContain('main');
        expect(output).toContain('helper');
        expect(output).toContain('-->');
        done();
      });

      formatter.formatStream(sampleCallGraph, mockStream);
    });

    it('should stream with custom chunk size', done => {
      const largeGraph = createLargeCallGraph(150);
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).toContain('flowchart TD');

        // Should have all nodes
        for (let i = 0; i < 150; i++) {
          expect(output).toContain(`func${i}`);
        }
        done();
      });

      formatter.formatStream(largeGraph, mockStream, { chunkSize: 25 });
    });

    it('should stream flowchart with theme', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).toContain("%%{init: {'theme':'forest'}}%%");
        expect(output).toContain('flowchart LR');
        done();
      });

      const options: MermaidFormatOptions = {
        theme: 'forest',
        direction: 'LR',
      };
      formatter.formatStream(sampleCallGraph, mockStream, options);
    });

    it('should stream subgraph diagram', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).toContain('subgraph');
        expect(output).toContain('📁');
        done();
      });

      const options: MermaidFormatOptions = { clusterByModule: true };
      formatter.formatStream(sampleCallGraph, mockStream, options);
    });

    it('should stream sequence diagram', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).toContain('sequenceDiagram');
        expect(output).toContain('participant Entry as Entry Point');
        done();
      });

      const options: MermaidFormatOptions = { diagramType: 'sequence' };
      formatter.formatStream(sampleCallGraph, mockStream, options);
    });

    it('should handle stream errors gracefully', done => {
      const errorStream = new MockWritable();

      errorStream.on('error', error => {
        expect(error).toBeDefined();
        done();
      });

      // Simulate an error during streaming
      errorStream.write = (): boolean => {
        throw new Error('Stream write error');
      };

      formatter.formatStream(sampleCallGraph, errorStream);
    });
  });

  describe('Circular Reference Handling', () => {
    it('should detect cycles in call graph', () => {
      const cycles = (formatter as any).detectCycles(circularCallGraph);
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('circular#funcA');
    });

    it('should omit circular references when strategy is OMIT', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.OMIT,
      };

      const result = formatter.format(circularCallGraph, options);

      // Should have fewer edges - the circular one should be omitted
      const edgeCount = (result.match(/-->/g) || []).length;
      expect(edgeCount).toBeLessThan(circularCallGraph.edges.length);
    });

    it('should mark circular references when strategy is REFERENCE', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE,
      };

      const result = formatter.format(circularCallGraph, options);

      // Should have all edges
      const edgeCount = (result.match(/-->/g) || []).length;
      expect(edgeCount).toBe(circularCallGraph.edges.length);
    });

    it('should handle INLINE_ONCE strategy', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.INLINE_ONCE,
      };

      const result = formatter.format(circularCallGraph, options);

      // For Mermaid, INLINE_ONCE just returns the graph as-is
      // since Mermaid handles cycles naturally
      const edgeCount = (result.match(/-->/g) || []).length;
      expect(edgeCount).toBe(circularCallGraph.edges.length);
    });

    it('should stream format with circular reference handling', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');

        // With OMIT strategy, should have fewer edges
        const edgeCount = (output.match(/-->/g) || []).length;
        expect(edgeCount).toBeLessThan(circularCallGraph.edges.length);
        done();
      });

      formatter.formatStream(circularCallGraph, mockStream, {
        circularReferenceStrategy: CircularReferenceStrategy.OMIT,
      });
    });
  });

  describe('Node Limiting', () => {
    it('should prioritize connected nodes when limiting', () => {
      const graph = createComplexGraph();
      const options: MermaidFormatOptions = {
        maxNodes: 5,
      };

      const result = formatter.format(graph, options);

      // Should always include entry point
      expect(result).toContain('hub');

      // Should include highly connected nodes
      expect(result).toContain('connector1');
      expect(result).toContain('connector2');
    });

    it('should maintain edge consistency when limiting nodes', () => {
      const graph = createLargeCallGraph(20);
      const options: MermaidFormatOptions = {
        maxNodes: 10,
      };

      const result = formatter.format(graph, options);

      // Extract node IDs from the result
      const nodeMatches = result.match(/(\w+)[([\]{>]/g) || [];
      const nodeIds = new Set(nodeMatches.map(m => m.slice(0, -1)));

      // All edges should connect existing nodes
      const edgeMatches = result.match(/(\w+)\s*-->\s*(\w+)/g) || [];
      edgeMatches.forEach(edge => {
        const [source, target] = edge.split(/\s*-->\s*/);
        if (!source.includes('class') && !source.includes('classDef')) {
          expect(nodeIds.has(source) || nodeIds.has(target)).toBe(true);
        }
      });
    });
  });

  describe('Enhanced Validation', () => {
    it('should validate correct Mermaid output', () => {
      const result = formatter.format(sampleCallGraph);
      const validation = formatter.validate(result);

      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should validate sequence diagrams', () => {
      const result = formatter.formatAsSequenceDiagram(sampleCallGraph);
      const validation = formatter.validate(result);

      expect(validation.isValid).toBe(true);
    });

    it('should validate subgraph diagrams', () => {
      const result = formatter.formatWithSubgraphs(sampleCallGraph);
      const validation = formatter.validate(result);

      expect(validation.isValid).toBe(true);
    });

    it('should detect invalid diagram type', () => {
      const validation = formatter.validate('invalid diagram');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Invalid diagram type');
    });

    it('should detect invalid syntax', () => {
      const invalidMermaid = `flowchart TD
    A[Node A]
    B Node B]
    A --> B`;

      const validation = formatter.validate(invalidMermaid);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Invalid syntax');
    });
  });

  describe('Performance with Large Graphs', () => {
    it('should handle graphs with 1000+ nodes efficiently', () => {
      const largeGraph = createLargeCallGraph(1000);
      const startTime = Date.now();

      const result = formatter.format(largeGraph);
      const endTime = Date.now();

      expect(result).toContain('flowchart');

      // Should complete within reasonable time (less than 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should stream large graphs efficiently', done => {
      const largeGraph = createLargeCallGraph(5000);
      const mockStream = new MockWritable();
      const startTime = Date.now();

      mockStream.on('finish', () => {
        const endTime = Date.now();
        // Should complete streaming within reasonable time
        expect(endTime - startTime).toBeLessThan(5000);
        done();
      });

      formatter.formatStream(largeGraph, mockStream, { chunkSize: 50 });
    });
  });

  describe('Special Characters and Edge Cases', () => {
    it('should handle special characters in node names', () => {
      const specialGraph: CallGraph = {
        ...sampleCallGraph,
        nodes: [
          {
            id: 'test#func-with-dash',
            name: 'func-with-dash',
            filePath: '/test/special.ts',
            line: 1,
            type: 'function',
            async: false,
            parameters: [],
            returnType: 'void',
          },
          {
            id: 'test#func_with_underscore',
            name: 'func_with_underscore',
            filePath: '/test/special.ts',
            line: 5,
            type: 'function',
            async: false,
            parameters: [],
            returnType: 'void',
          },
          {
            id: 'test#func.with.dots',
            name: 'func.with.dots',
            filePath: '/test/special.ts',
            line: 9,
            type: 'function',
            async: false,
            parameters: [],
            returnType: 'void',
          },
        ],
        edges: [],
      };

      const result = formatter.format(specialGraph);
      const validation = formatter.validate(result);

      expect(validation.isValid).toBe(true);
      expect(result).toContain('func_with_dash');
      expect(result).toContain('func_with_underscore');
      expect(result).toContain('func_with_dots');
    });

    it('should handle empty node names', () => {
      const emptyNameGraph: CallGraph = {
        ...sampleCallGraph,
        nodes: [
          {
            ...sampleCallGraph.nodes[0],
            name: '',
          },
        ],
      };

      const result = formatter.format(emptyNameGraph);
      expect(result).toContain('node_0'); // Should use fallback name
    });

    it('should handle nodes with numeric names', () => {
      const numericGraph: CallGraph = {
        ...sampleCallGraph,
        nodes: [
          {
            ...sampleCallGraph.nodes[0],
            name: '123function',
          },
        ],
      };

      const result = formatter.format(numericGraph);
      expect(result).toContain('n_123function'); // Should prefix with letter
    });
  });
});

// Helper classes and functions

class MockWritable extends Writable {
  override _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
    this.emit('data', chunk);
    callback();
  }

  override _final(callback: (error?: Error | null) => void): void {
    this.emit('finish');
    callback();
  }
}

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

function createCircularCallGraph(): CallGraph {
  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'circular#funcA',
      maxDepth: 10,
      projectRoot: '/test',
      totalFiles: 1,
      analysisTimeMs: 100,
    },
    nodes: [
      {
        id: 'circular#funcA',
        name: 'funcA',
        filePath: '/test/circular.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      },
      {
        id: 'circular#funcB',
        name: 'funcB',
        filePath: '/test/circular.ts',
        line: 5,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      },
      {
        id: 'circular#funcC',
        name: 'funcC',
        filePath: '/test/circular.ts',
        line: 9,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      },
    ],
    edges: [
      {
        id: 'edge1',
        source: 'circular#funcA',
        target: 'circular#funcB',
        type: 'sync',
        line: 2,
      },
      {
        id: 'edge2',
        source: 'circular#funcB',
        target: 'circular#funcC',
        type: 'sync',
        line: 6,
      },
      {
        id: 'edge3',
        source: 'circular#funcC',
        target: 'circular#funcA', // Creates a cycle
        type: 'sync',
        line: 10,
      },
    ],
    entryPointId: 'circular#funcA',
  };
}

function createLargeCallGraph(nodeCount: number): CallGraph {
  const nodes: CallGraphNode[] = [];
  const edges: CallGraphEdge[] = [];

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `large#func${i}`,
      name: `func${i}`,
      filePath: `/test/large${Math.floor(i / 100)}.ts`,
      line: (i % 100) + 1,
      type: 'function',
      async: i % 10 === 0, // Every 10th function is async
      parameters: [],
      returnType: i % 2 === 0 ? 'void' : 'string',
    });
  }

  // Create edges (linear chain for simplicity)
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push({
      id: `edge${i}`,
      source: `large#func${i}`,
      target: `large#func${i + 1}`,
      type: i % 10 === 0 ? 'async' : 'sync',
      line: (i % 100) + 1,
    });
  }

  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'large#func0',
      maxDepth: nodeCount,
      projectRoot: '/test',
      totalFiles: Math.ceil(nodeCount / 100),
      analysisTimeMs: 1000,
    },
    nodes,
    edges,
    entryPointId: 'large#func0',
  };
}

function createComplexGraph(): CallGraph {
  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'complex#hub',
      maxDepth: 10,
      projectRoot: '/test',
      totalFiles: 3,
      analysisTimeMs: 200,
    },
    nodes: [
      // Hub node - highly connected
      {
        id: 'complex#hub',
        name: 'hub',
        filePath: '/test/hub.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      },
      // Connector nodes - medium connectivity
      {
        id: 'complex#connector1',
        name: 'connector1',
        filePath: '/test/connectors.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      },
      {
        id: 'complex#connector2',
        name: 'connector2',
        filePath: '/test/connectors.ts',
        line: 10,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      },
      // Leaf nodes - low connectivity
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `complex#leaf${i}`,
        name: `leaf${i}`,
        filePath: '/test/leaves.ts',
        line: i * 5 + 1,
        type: 'function' as const,
        async: false,
        parameters: [],
        returnType: 'void',
      })),
    ],
    edges: [
      // Hub connects to connectors
      {
        id: 'hub-c1',
        source: 'complex#hub',
        target: 'complex#connector1',
        type: 'sync',
        line: 5,
      },
      {
        id: 'hub-c2',
        source: 'complex#hub',
        target: 'complex#connector2',
        type: 'sync',
        line: 6,
      },
      // Connectors connect to leaves
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `c1-l${i}`,
        source: 'complex#connector1',
        target: `complex#leaf${i}`,
        type: 'sync' as const,
        line: i + 2,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `c2-l${i + 5}`,
        source: 'complex#connector2',
        target: `complex#leaf${i + 5}`,
        type: 'sync' as const,
        line: i + 12,
      })),
    ],
    entryPointId: 'complex#hub',
  };
}
