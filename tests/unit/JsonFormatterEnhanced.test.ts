import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { CallGraph, CallGraphNode, CallGraphEdge } from '../../src/types/CallGraph';
import { FormatOptions, CircularReferenceStrategy } from '../../src/types/Formatter';
import { Writable } from 'stream';

describe('JsonFormatter Enhanced Features', () => {
  let formatter: JsonFormatter;
  let sampleCallGraph: CallGraph;
  let circularCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new JsonFormatter();
    sampleCallGraph = createSampleCallGraph();
    circularCallGraph = createCircularCallGraph();
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
        const parsed = JSON.parse(output);

        expect(parsed.metadata).toBeDefined();
        expect(parsed.nodes).toHaveLength(3);
        expect(parsed.edges).toHaveLength(2);
        expect(parsed.entryPointId).toBe('test#main');
        done();
      });

      formatter.formatStream(sampleCallGraph, mockStream);
    });

    it('should stream format with custom chunk size', done => {
      const largeGraph = createLargeCallGraph(150); // 150 nodes
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = JSON.parse(output);

        expect(parsed.nodes).toHaveLength(150);
        expect(parsed.edges).toHaveLength(149); // Linear chain
        done();
      });

      formatter.formatStream(largeGraph, mockStream, { chunkSize: 25 });
    });

    it('should stream format without prettification', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).not.toContain('\n');
        expect(output).not.toContain('  '); // No indentation

        const parsed = JSON.parse(output);
        expect(parsed.nodes).toHaveLength(3);
        done();
      });

      formatter.formatStream(sampleCallGraph, mockStream, { prettify: false });
    });

    it('should include metrics when streaming', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = JSON.parse(output);

        expect(parsed.statistics).toBeDefined();
        expect(parsed.statistics.overview).toBeDefined();
        expect(parsed.statistics.overview.totalNodes).toBe(3);
        done();
      });

      formatter.formatStream(sampleCallGraph, mockStream, { includeMetrics: true });
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
      expect(cycles[0]).toContain('circular#funcB');
    });

    it('should omit circular references when strategy is OMIT', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.OMIT,
      };

      const result = formatter.format(circularCallGraph, options);
      const parsed = JSON.parse(result);

      // Should have fewer edges after omitting circular ones
      expect(parsed.edges.length).toBeLessThan(circularCallGraph.edges.length);
    });

    it('should replace circular references when strategy is REFERENCE', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE,
      };

      const result = formatter.format(circularCallGraph, options);
      const parsed = JSON.parse(result);

      // Should mark some edges as circular
      const circularEdges = parsed.edges.filter((edge: any) => edge.circular);
      expect(circularEdges.length).toBeGreaterThan(0);
      expect(circularEdges[0]).toHaveProperty('targetRef');
    });

    it('should inline once when strategy is INLINE_ONCE', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.INLINE_ONCE,
      };

      const result = formatter.format(circularCallGraph, options);
      const parsed = JSON.parse(result);

      // Should have metadata about circular references
      expect(parsed.metadata.circularReferences).toBeDefined();
      expect(parsed.metadata.circularReferences.length).toBeGreaterThan(0);
    });

    it('should stream format with circular reference handling', done => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = JSON.parse(output);

        // Should have processed circular references
        const circularEdges = parsed.edges.filter((edge: any) => edge.circular);
        expect(circularEdges.length).toBeGreaterThan(0);
        done();
      });

      formatter.formatStream(circularCallGraph, mockStream, {
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE,
      });
    });
  });

  describe('Performance with Large Graphs', () => {
    it('should handle graphs with 1000+ nodes efficiently', () => {
      const largeGraph = createLargeCallGraph(1000);
      const startTime = Date.now();

      const result = formatter.format(largeGraph);
      const endTime = Date.now();

      const parsed = JSON.parse(result);
      expect(parsed.nodes).toHaveLength(1000);
      expect(parsed.edges).toHaveLength(999);

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

    it('should handle graphs with 10,000+ nodes via streaming', done => {
      const veryLargeGraph = createLargeCallGraph(10000);
      const mockStream = new MockWritable();
      const chunks: string[] = [];

      mockStream.on('data', chunk => {
        chunks.push(chunk.toString());
      });

      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = JSON.parse(output);

        expect(parsed.nodes).toHaveLength(10000);
        expect(parsed.edges).toHaveLength(9999);
        done();
      });

      // Use smaller chunk size for very large graphs
      formatter.formatStream(veryLargeGraph, mockStream, { chunkSize: 100 });
    }, 10000); // 10 second timeout for this test
  });

  describe('Enhanced Validation', () => {
    it('should validate enhanced JSON output', () => {
      const options: FormatOptions = {
        includeMetrics: true,
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE,
      };

      const result = formatter.format(circularCallGraph, options);
      const validation = formatter.validate(result);

      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should provide detailed validation errors', () => {
      const invalidJson = '{ "nodes": "not an array", "edges": [] }';
      const validation = formatter.validate(invalidJson);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('invalid nodes array');
    });
  });

  describe('Interface Compliance', () => {
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

      const parsed = JSON.parse(result);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.statistics).toBeDefined();
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
