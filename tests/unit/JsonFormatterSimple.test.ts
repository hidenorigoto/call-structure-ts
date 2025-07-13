import { JsonFormatter } from '../../src/formatter/JsonFormatter';
import { CallGraph } from '../../src/types/CallGraph';
import { FormatOptions, CircularReferenceStrategy } from '../../src/types/Formatter';
import { Writable } from 'stream';

describe('JsonFormatter Enhanced - Simple Tests', () => {
  let formatter: JsonFormatter;
  let sampleGraph: CallGraph;

  beforeEach(() => {
    formatter = new JsonFormatter();
    sampleGraph = {
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
          type: 'function',
          async: false,
          parameters: [],
          returnType: 'void'
        }
      ],
      edges: [],
      entryPointId: 'test#main'
    };
  });

  describe('Interface Compliance', () => {
    it('should implement Formatter interface', () => {
      expect(typeof formatter.format).toBe('function');
      expect(typeof formatter.formatStream).toBe('function');
      expect(typeof formatter.validate).toBe('function');
    });

    it('should accept new FormatOptions', () => {
      const options: FormatOptions = {
        includeMetadata: true,
        includeMetrics: false,
        prettify: true,
        circularReferenceStrategy: CircularReferenceStrategy.OMIT
      };

      const result = formatter.format(sampleGraph, options);
      expect(result).toBeDefined();
      
      const parsed = JSON.parse(result);
      expect(parsed.metadata).toBeDefined();
    });
  });

  describe('Basic Streaming', () => {
    it('should stream format basic graph', (done) => {
      let output = '';
      const mockStream = new Writable({
        write(chunk: any, encoding: any, callback: any) {
          output += chunk.toString();
          callback();
        }
      });

      mockStream.on('finish', () => {
        try {
          const parsed = JSON.parse(output);
          expect(parsed.nodes).toHaveLength(1);
          expect(parsed.entryPointId).toBe('test#main');
          done();
        } catch (error) {
          done(error);
        }
      });

      formatter.formatStream(sampleGraph, mockStream);
    });
  });

  describe('Circular Reference Detection', () => {
    it('should detect simple cycles', () => {
      const circularGraph: CallGraph = {
        ...sampleGraph,
        nodes: [
          { id: 'a', name: 'funcA', filePath: '/test.ts', line: 1, type: 'function' as const, async: false, parameters: [], returnType: 'void' },
          { id: 'b', name: 'funcB', filePath: '/test.ts', line: 2, type: 'function' as const, async: false, parameters: [], returnType: 'void' }
        ],
        edges: [
          { id: 'edge1', source: 'a', target: 'b', type: 'sync' as const, line: 1 },
          { id: 'edge2', source: 'b', target: 'a', type: 'sync' as const, line: 2 }
        ]
      };

      const cycles = (formatter as any).detectCycles(circularGraph);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should handle circular references with OMIT strategy', () => {
      const circularGraph: CallGraph = {
        ...sampleGraph,
        nodes: [
          { id: 'a', name: 'funcA', filePath: '/test.ts', line: 1, type: 'function' as const, async: false, parameters: [], returnType: 'void' },
          { id: 'b', name: 'funcB', filePath: '/test.ts', line: 2, type: 'function' as const, async: false, parameters: [], returnType: 'void' }
        ],
        edges: [
          { id: 'edge1', source: 'a', target: 'b', type: 'sync' as const, line: 1 },
          { id: 'edge2', source: 'b', target: 'a', type: 'sync' as const, line: 2 }
        ]
      };

      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.OMIT
      };

      const result = formatter.format(circularGraph, options);
      const parsed = JSON.parse(result);
      
      // Should have fewer edges after omitting circular ones
      expect(parsed.edges.length).toBeLessThan(circularGraph.edges.length);
    });
  });

  describe('Performance', () => {
    it('should handle moderately large graphs', () => {
      const largeGraph = createLargeGraph(100);
      const startTime = Date.now();
      
      const result = formatter.format(largeGraph);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      
      const parsed = JSON.parse(result);
      expect(parsed.nodes).toHaveLength(100);
    });
  });
});

function createLargeGraph(nodeCount: number): CallGraph {
  const nodes = [];
  const edges = [];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node${i}`,
      name: `func${i}`,
      filePath: `/test/file${Math.floor(i / 10)}.ts`,
      line: i + 1,
      type: 'function' as const,
      async: false,
      parameters: [],
      returnType: 'void'
    });

    if (i > 0) {
      edges.push({
        id: `edge${i}`,
        source: `node${i - 1}`,
        target: `node${i}`,
        type: 'sync' as const,
        line: i
      });
    }
  }

  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'node0',
      maxDepth: nodeCount,
      projectRoot: '/test',
      totalFiles: Math.ceil(nodeCount / 10),
      analysisTimeMs: 100
    },
    nodes,
    edges,
    entryPointId: 'node0'
  };
}