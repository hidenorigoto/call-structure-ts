import { DotFormatter, DotFormatOptions } from '../../src/formatter/DotFormatter';
import { CallGraph } from '../../src/types/CallGraph';
import { Writable } from 'stream';

describe('DotFormatter', () => {
  let formatter: DotFormatter;
  let sampleCallGraph: CallGraph;

  beforeEach(() => {
    formatter = new DotFormatter();
    sampleCallGraph = createSampleCallGraph();
  });

  describe('format', () => {
    it('should generate valid DOT format output', () => {
      const result = formatter.format(sampleCallGraph);

      expect(result).toMatch(/^digraph CallGraph \{/);
      expect(result).toMatch(/\}$/);
      expect(result).toContain('rankdir=TB;');
      expect(result).toContain('compound=true;');
    });

    it('should include all nodes', () => {
      const result = formatter.format(sampleCallGraph);

      expect(result).toContain('"test#main"');
      expect(result).toContain('"test#helper"');
      expect(result).toContain('"test#asyncHelper"');
      expect(result).toContain('"test#TestClass.method"');
    });

    it('should include all edges', () => {
      const result = formatter.format(sampleCallGraph);

      expect(result).toContain('"test#main" -> "test#helper"');
      expect(result).toContain('"test#main" -> "test#asyncHelper"');
      expect(result).toContain('"test#helper" -> "test#TestClass.method"');
    });

    it('should apply node attributes correctly', () => {
      const result = formatter.format(sampleCallGraph);

      // Entry point should have special styling
      expect(result).toMatch(/"test#main" \[.*peripheries=2.*penwidth=2.*\]/);

      // Async functions should have filled style
      expect(result).toMatch(/"test#asyncHelper" \[.*style=filled.*fillcolor=lightblue.*\]/);

      // Methods should have box shape
      expect(result).toMatch(/"test#TestClass\.method" \[.*shape=box.*\]/);
    });

    it('should apply edge attributes correctly', () => {
      const result = formatter.format(sampleCallGraph);

      // Async edges should be dashed
      expect(result).toMatch(/"test#main" -> "test#asyncHelper" \[.*style=dashed.*color=blue.*\]/);

      // Sync edges should be solid
      expect(result).toMatch(/"test#main" -> "test#helper" \[.*style=solid.*\]/);
    });

    it('should escape labels properly', () => {
      const graphWithSpecialChars = createCallGraphWithSpecialCharacters();
      const result = formatter.format(graphWithSpecialChars);

      expect(result).toContain('function\\"with\\"quotes');
      expect(result).toContain('function\\\\with\\\\backslashes');
      expect(result).toContain('function\\nwith\\nnewlines');
      expect(result).not.toContain('unescaped"quote');
    });
  });

  describe('format options', () => {
    it('should respect rankdir option', () => {
      const options: DotFormatOptions = { rankdir: 'LR' };
      const result = formatter.format(sampleCallGraph, options);

      expect(result).toContain('rankdir=LR;');
    });

    it('should respect nodesep and ranksep options', () => {
      const options: DotFormatOptions = { nodesep: 0.5, ranksep: 1.0 };
      const result = formatter.format(sampleCallGraph, options);

      expect(result).toContain('nodesep=0.5;');
      expect(result).toContain('ranksep=1;');
    });

    it('should respect font options', () => {
      const options: DotFormatOptions = {
        fontname: 'Helvetica',
        fontsize: 14,
      };
      const result = formatter.format(sampleCallGraph, options);

      expect(result).toContain('fontname="Helvetica";');
      expect(result).toContain('fontsize=14;');
      expect(result).toContain('node [shape=box, fontname="Helvetica"];');
    });

    it('should support clustered layout', () => {
      const options: DotFormatOptions = { clustered: true };
      const result = formatter.format(sampleCallGraph, options);

      expect(result).toContain('subgraph cluster_');
      expect(result).toContain('label="test.ts"');
      expect(result).toContain('style=filled;');
      expect(result).toContain('color=lightgrey;');
    });

    it('should respect showAsync option', () => {
      const options: DotFormatOptions = { showAsync: false };
      const result = formatter.format(sampleCallGraph, options);

      expect(result).not.toContain('async asyncHelper');
    });

    it('should show edge labels when requested', () => {
      const options: DotFormatOptions = { showEdgeLabels: true };
      const result = formatter.format(sampleCallGraph, options);

      expect(result).toMatch(/label="async"/);
    });
  });

  describe('validate', () => {
    it('should validate correct DOT format', () => {
      const validDot = `digraph G {
        a -> b;
        b -> c;
      }`;

      const result = formatter.validate(validDot);
      expect(result.isValid).toBe(true);
    });

    it('should detect missing graph declaration', () => {
      const invalidDot = `a -> b;
        b -> c;
      }`;

      const result = formatter.validate(invalidDot);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing graph declaration');
    });

    it('should detect missing closing brace', () => {
      const invalidDot = `digraph G {
        a -> b;
        b -> c;`;

      const result = formatter.validate(invalidDot);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing closing brace');
    });

    it('should detect unbalanced quotes', () => {
      const invalidDot = `digraph G {
        "a -> b;
        b -> c;
      }`;

      const result = formatter.validate(invalidDot);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unbalanced quotes');
    });
  });

  describe('formatStream', () => {
    it('should stream output correctly', done => {
      const chunks: string[] = [];
      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      stream.on('finish', (): void => {
        const result = chunks.join('');
        expect(result).toMatch(/^digraph CallGraph \{/);
        expect(result).toMatch(/\}$/);
        done();
      });

      formatter.formatStream(sampleCallGraph, stream);
    });

    it('should handle stream errors', done => {
      const stream = new Writable({
        write() {
          throw new Error('Stream error');
        },
      });

      stream.on('error', (error): void => {
        expect(error.message).toBe('Stream error');
        done();
      });

      formatter.formatStream(sampleCallGraph, stream);
    });
  });
});

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
      {
        id: 'test#TestClass.method',
        name: 'method',
        className: 'TestClass',
        filePath: '/test/src/test.ts',
        line: 15,
        column: 2,
        type: 'method',
        async: false,
        static: false,
        visibility: 'public',
        parameters: [{ name: 'arg', type: 'string', optional: false }],
        returnType: 'void',
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
      {
        id: 'edge3',
        source: 'test#helper',
        target: 'test#TestClass.method',
        type: 'sync',
        line: 6,
        column: 4,
        conditional: true,
      },
    ],
    entryPointId: 'test#main',
  };
}

function createCallGraphWithSpecialCharacters(): CallGraph {
  const graph = createSampleCallGraph();
  graph.nodes[0].name = 'function"with"quotes';
  graph.nodes[1].name = 'function\\with\\backslashes';
  graph.nodes[2].name = 'function\nwith\nnewlines';
  return graph;
}
