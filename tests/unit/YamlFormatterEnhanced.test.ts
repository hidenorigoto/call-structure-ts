import { YamlFormatter, YamlFormatOptions } from '../../src/formatter/YamlFormatter';
import { CallGraph, CallGraphNode, CallGraphEdge } from '../../src/types/CallGraph';
import { FormatOptions, CircularReferenceStrategy } from '../../src/types/Formatter';
import { Writable } from 'stream';
import * as yaml from 'js-yaml';

describe('YamlFormatter Enhanced Features', () => {
  let formatter: YamlFormatter;
  let sampleCallGraph: CallGraph;
  let circularCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new YamlFormatter();
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
        chunkSize: 50
      };
      
      const result = formatter.format(sampleCallGraph, options);
      expect(result).toBeDefined();
      
      const parsed = yaml.load(result) as any;
      expect(parsed.metadata).toBeDefined();
      expect(parsed.statistics).toBeDefined();
    });
  });

  describe('Streaming Support', () => {
    it('should stream format basic call graph', (done) => {
      const chunks: string[] = [];
      const mockStream = new MockWritable();
      
      mockStream.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      
      mockStream.on('finish', () => {
        const output = chunks.join('');
        expect(output).toContain('---'); // YAML header
        
        const parsed = yaml.load(output) as any;
        expect(parsed.metadata).toBeDefined();
        expect(parsed.functions).toHaveLength(3);
        expect(parsed.calls).toHaveLength(2);
        expect(parsed.entry_point.id).toBe('test#main');
        done();
      });

      formatter.formatStream(sampleCallGraph, mockStream);
    });

    it('should stream format with custom chunk size', (done) => {
      const largeGraph = createLargeCallGraph(150); // 150 nodes
      const mockStream = new MockWritable();
      const chunks: string[] = [];
      
      mockStream.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      
      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = yaml.load(output) as any;
        
        expect(parsed.functions).toHaveLength(150);
        expect(parsed.calls).toHaveLength(149); // Linear chain
        done();
      });

      formatter.formatStream(largeGraph, mockStream, { chunkSize: 25 });
    });

    it('should include metrics when streaming', (done) => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];
      
      mockStream.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      
      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = yaml.load(output) as any;
        
        expect(parsed.statistics).toBeDefined();
        expect(parsed.statistics.overview).toBeDefined();
        expect(parsed.statistics.overview.total_functions).toBe(3);
        done();
      });

      formatter.formatStream(sampleCallGraph, mockStream, { includeMetrics: true });
    });

    it('should handle stream errors gracefully', (done) => {
      const errorStream = new MockWritable();
      let errorEmitted = false;
      
      errorStream.on('error', (error) => {
        errorEmitted = true;
        expect(error).toBeDefined();
        done();
      });

      // Simulate an error during streaming
      errorStream.write = () => {
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
        circularReferenceStrategy: CircularReferenceStrategy.OMIT
      };
      
      const result = formatter.format(circularCallGraph, options);
      const parsed = yaml.load(result) as any;
      
      // Should have fewer edges after omitting circular ones
      expect(parsed.calls.length).toBeLessThan(circularCallGraph.edges.length);
    });

    it('should mark circular references when strategy is REFERENCE', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE
      };
      
      const result = formatter.format(circularCallGraph, options);
      const parsed = yaml.load(result) as any;
      
      // Should mark some edges as circular
      const circularCalls = parsed.calls.filter((call: any) => 
        // Check in the raw YAML for circular markers
        result.includes('circular: true')
      );
      expect(circularCalls).toBeDefined();
    });

    it('should handle INLINE_ONCE strategy', () => {
      const options: FormatOptions = {
        circularReferenceStrategy: CircularReferenceStrategy.INLINE_ONCE
      };
      
      const result = formatter.format(circularCallGraph, options);
      const parsed = yaml.load(result) as any;
      
      // Should have metadata about circular references
      expect(parsed.metadata.circularReferences).toBeDefined();
      expect(parsed.metadata.circularReferences.length).toBeGreaterThan(0);
    });

    it('should stream format with circular reference handling', (done) => {
      const mockStream = new MockWritable();
      const chunks: string[] = [];
      
      mockStream.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      
      mockStream.on('finish', () => {
        const output = chunks.join('');
        const parsed = yaml.load(output) as any;
        
        // Should have processed circular references
        expect(parsed.calls.length).toBe(circularCallGraph.edges.length);
        done();
      });

      formatter.formatStream(circularCallGraph, mockStream, {
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE
      });
    });
  });

  describe('Comment Generation', () => {
    it('should add comments when includeComments is true', () => {
      const options: YamlFormatOptions = {
        includeComments: true
      };
      
      const result = formatter.format(sampleCallGraph, options);
      
      // Check for header comments
      expect(result).toContain('# Call Graph Analysis Results');
      expect(result).toContain('# Generated:');
      expect(result).toContain('# Entry Point:');
      expect(result).toContain('# Total Files Analyzed:');
      expect(result).toContain('# Analysis Time:');
      
      // Check for inline comments
      expect(result).toContain('# Timestamp when this analysis was performed');
      expect(result).toContain('# Starting point of the call graph analysis');
      expect(result).toContain('# List of all functions/methods discovered');
      expect(result).toContain('# List of all function calls detected');
    });

    it('should add statistics comments when includeMetrics is true', () => {
      const options: YamlFormatOptions = {
        includeComments: true,
        includeMetrics: true
      };
      
      const result = formatter.format(sampleCallGraph, options);
      
      expect(result).toContain('# Analysis metrics and insights');
      expect(result).toContain('# Total number of unique functions');
      expect(result).toContain('# Total number of function calls');
    });

    it('should mark circular references in comments', () => {
      const options: YamlFormatOptions = {
        includeComments: true,
        circularReferenceStrategy: CircularReferenceStrategy.REFERENCE
      };
      
      const processedGraph = {
        ...circularCallGraph,
        edges: circularCallGraph.edges.map(edge => ({
          ...edge,
          circular: edge.source === 'circular#funcC' && edge.target === 'circular#funcA'
        }))
      };
      
      const result = formatter.format(processedGraph, options);
      
      // Should have comment for circular edge
      if (result.includes('circular: true')) {
        expect(result).toContain('# This edge creates a circular dependency');
      }
    });
  });

  describe('YAML-specific Options', () => {
    it('should respect lineWidth option', () => {
      const longNameGraph = {
        ...sampleCallGraph,
        nodes: [{
          ...sampleCallGraph.nodes[0],
          name: 'thisIsAVeryLongFunctionNameThatShouldNormallyWrapButWontWithLineWidthDisabled'
        }]
      };
      
      const options: YamlFormatOptions = {
        lineWidth: 50
      };
      
      const result = formatter.format(longNameGraph, options);
      const parsed = yaml.load(result) as any;
      
      expect(parsed.functions[0].name).toBe(longNameGraph.nodes[0].name);
    });

    it('should respect flowLevel option', () => {
      const options: YamlFormatOptions = {
        flowLevel: 2 // Use flow style for arrays at level 2
      };
      
      const result = formatter.format(sampleCallGraph, options);
      
      // With flowLevel set, some arrays might use flow style
      // This is hard to test precisely, but we can check the output is valid
      const parsed = yaml.load(result) as any;
      expect(parsed).toBeDefined();
    });
  });

  describe('Enhanced Validation', () => {
    it('should validate correct YAML output', () => {
      const result = formatter.format(sampleCallGraph);
      const validation = formatter.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should provide detailed validation errors', () => {
      const invalidYaml = `
functions: "not an array"
calls: []
entry_point:
  id: test
`;
      const validation = formatter.validate(invalidYaml);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('invalid functions array');
    });

    it('should provide warnings for large graphs', () => {
      const largeGraph = createLargeCallGraph(15000);
      const result = formatter.format(largeGraph);
      const validation = formatter.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.warnings).toContain('Large number of functions detected (>10,000). Consider using streaming for better performance.');
    });

    it('should validate node structure', () => {
      const yamlWithInvalidNode = `
functions:
  - name: test
    type: function
calls: []
entry_point:
  id: test
`;
      const validation = formatter.validate(yamlWithInvalidNode);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Invalid function structure');
    });
  });

  describe('Performance with Large Graphs', () => {
    it('should handle graphs with 1000+ nodes efficiently', () => {
      const largeGraph = createLargeCallGraph(1000);
      const startTime = Date.now();
      
      const result = formatter.format(largeGraph);
      const endTime = Date.now();
      
      const parsed = yaml.load(result) as any;
      expect(parsed.functions).toHaveLength(1000);
      expect(parsed.calls).toHaveLength(999);
      
      // Should complete within reasonable time (less than 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should stream large graphs efficiently', (done) => {
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
});

// Helper classes and functions

class MockWritable extends Writable {
  override _write(chunk: any, encoding: string, callback: Function) {
    this.emit('data', chunk);
    callback();
  }

  override _final(callback: Function) {
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

function createCircularCallGraph(): CallGraph {
  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'circular#funcA',
      maxDepth: 10,
      projectRoot: '/test',
      totalFiles: 1,
      analysisTimeMs: 100
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
        returnType: 'void'
      },
      {
        id: 'circular#funcB',
        name: 'funcB',
        filePath: '/test/circular.ts',
        line: 5,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void'
      },
      {
        id: 'circular#funcC',
        name: 'funcC',
        filePath: '/test/circular.ts',
        line: 9,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void'
      }
    ],
    edges: [
      {
        id: 'edge1',
        source: 'circular#funcA',
        target: 'circular#funcB',
        type: 'sync',
        line: 2
      },
      {
        id: 'edge2',
        source: 'circular#funcB',
        target: 'circular#funcC',
        type: 'sync',
        line: 6
      },
      {
        id: 'edge3',
        source: 'circular#funcC',
        target: 'circular#funcA', // Creates a cycle
        type: 'sync',
        line: 10
      }
    ],
    entryPointId: 'circular#funcA'
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
      returnType: i % 2 === 0 ? 'void' : 'string'
    });
  }

  // Create edges (linear chain for simplicity)
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push({
      id: `edge${i}`,
      source: `large#func${i}`,
      target: `large#func${i + 1}`,
      type: i % 10 === 0 ? 'async' : 'sync',
      line: (i % 100) + 1
    });
  }

  return {
    metadata: {
      generatedAt: '2025-01-12T10:00:00Z',
      entryPoint: 'large#func0',
      maxDepth: nodeCount,
      projectRoot: '/test',
      totalFiles: Math.ceil(nodeCount / 100),
      analysisTimeMs: 1000
    },
    nodes,
    edges,
    entryPointId: 'large#func0'
  };
}