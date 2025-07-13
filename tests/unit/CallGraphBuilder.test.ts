import { CallGraphBuilder, GraphFilterOptions, TraversalOptions } from '../../src/analyzer/CallGraphBuilder';
import { CallGraphNode, CallGraphEdge, CallGraphMetadata } from '../../src/types';

describe('CallGraphBuilder', () => {
  let builder: CallGraphBuilder;

  beforeEach(() => {
    builder = new CallGraphBuilder();
  });

  describe('Node Management', () => {
    const createTestNode = (id: string, name = 'testFunction'): CallGraphNode => ({
      id,
      name,
      filePath: '/test/file.ts',
      line: 10,
      type: 'function',
      async: false,
      parameters: [],
      returnType: 'void',
    });

    it('should add a node successfully', () => {
      const node = createTestNode('node1');
      
      builder.addNode(node);
      
      expect(builder.hasNode('node1')).toBe(true);
      expect(builder.getNodeCount()).toBe(1);
      expect(builder.getNode('node1')).toEqual(node);
    });

    it('should prevent duplicate nodes', () => {
      const node1 = createTestNode('node1', 'func1');
      const node2 = createTestNode('node1', 'func2'); // Same ID, different name
      
      builder.addNode(node1);
      builder.addNode(node2);
      
      expect(builder.getNodeCount()).toBe(1);
      expect(builder.getNode('node1')?.name).toBe('func1'); // Original preserved
    });

    it('should validate node properties', () => {
      expect(() => {
        builder.addNode({} as CallGraphNode);
      }).toThrow('Node must have a valid string id');

      expect(() => {
        builder.addNode({
          id: 'test',
          name: '',
          filePath: '',
          line: 0,
          type: 'function',
          async: false,
          parameters: [],
          returnType: 'void',
        });
      }).toThrow('Invalid node: missing required properties');
    });

    it('should handle different node types', () => {
      const functionNode = createTestNode('func1');
      const methodNode: CallGraphNode = {
        ...createTestNode('method1', 'testMethod'),
        type: 'method',
        className: 'TestClass',
      };
      const constructorNode: CallGraphNode = {
        ...createTestNode('ctor1', 'constructor'),
        type: 'constructor',
        className: 'TestClass',
      };

      builder.addNode(functionNode);
      builder.addNode(methodNode);
      builder.addNode(constructorNode);

      expect(builder.getNodeCount()).toBe(3);
      expect(builder.getNode('method1')?.type).toBe('method');
      expect(builder.getNode('ctor1')?.type).toBe('constructor');
    });
  });

  describe('Edge Management', () => {
    const createTestEdge = (id: string, source: string, target: string): CallGraphEdge => ({
      id,
      source,
      target,
      type: 'sync',
      line: 15,
    });

    beforeEach(() => {
      // Add some test nodes
      builder.addNode({
        id: 'node1',
        name: 'func1',
        filePath: '/test/file1.ts',
        line: 10,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });
      builder.addNode({
        id: 'node2',
        name: 'func2',
        filePath: '/test/file2.ts',
        line: 20,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });
    });

    it('should add an edge successfully', () => {
      const edge = createTestEdge('edge1', 'node1', 'node2');
      
      builder.addEdge(edge);
      
      expect(builder.hasEdge('edge1')).toBe(true);
      expect(builder.getEdgeCount()).toBe(1);
      expect(builder.getEdge('edge1')).toEqual(edge);
    });

    it('should prevent duplicate edges', () => {
      const edge1 = createTestEdge('edge1', 'node1', 'node2');
      const edge2 = createTestEdge('edge1', 'node1', 'node2');
      
      builder.addEdge(edge1);
      builder.addEdge(edge2);
      
      expect(builder.getEdgeCount()).toBe(1);
    });

    it('should validate edge properties', () => {
      expect(() => {
        builder.addEdge({} as CallGraphEdge);
      }).toThrow('Edge must have a valid string id');

      expect(() => {
        builder.addEdge({
          id: 'edge1',
          source: '',
          target: 'node1',
          type: 'sync',
          line: 10,
        });
      }).toThrow('Edge must have valid source and target node IDs');
    });

    it('should create placeholder nodes for missing targets', () => {
      const edge = createTestEdge('edge1', 'node1', 'nonexistent');
      
      builder.addEdge(edge);
      
      expect(builder.hasNode('nonexistent')).toBe(true);
      expect(builder.getNode('nonexistent')?.name).toBe('placeholder');
    });

    it('should handle different edge types', () => {
      const syncEdge = createTestEdge('sync1', 'node1', 'node2');
      const asyncEdge: CallGraphEdge = {
        ...createTestEdge('async1', 'node1', 'node2'),
        type: 'async',
      };
      
      builder.addEdge(syncEdge);
      builder.addEdge(asyncEdge);
      
      expect(builder.getEdgeCount()).toBe(2);
      expect(builder.getEdge('async1')?.type).toBe('async');
    });
  });

  describe('Graph Building', () => {
    beforeEach(() => {
      builder.addNode({
        id: 'main',
        name: 'main',
        filePath: '/src/main.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });
      builder.addEdge({
        id: 'call1',
        source: 'main',
        target: 'helper',
        type: 'sync',
        line: 5,
      });
    });

    it('should build a complete call graph', () => {
      const graph = builder.build('main');
      
      expect(graph.metadata).toBeDefined();
      expect(graph.nodes).toHaveLength(2); // main + placeholder helper
      expect(graph.edges).toHaveLength(1);
      expect(graph.entryPointId).toBe('main');
    });

    it('should include metadata in built graph', () => {
      const customMetadata: Partial<CallGraphMetadata> = {
        maxDepth: 5,
        projectRoot: '/custom/root',
      };
      
      builder.setMetadata(customMetadata);
      const graph = builder.build();
      
      expect(graph.metadata.maxDepth).toBe(5);
      expect(graph.metadata.projectRoot).toBe('/custom/root');
      expect(graph.metadata.generatedAt).toBeDefined();
    });

    it('should handle empty graph', () => {
      const emptyBuilder = new CallGraphBuilder();
      const graph = emptyBuilder.build();
      
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
      expect(graph.metadata.totalFiles).toBe(0);
    });
  });

  describe('Circular Dependency Detection', () => {
    beforeEach(() => {
      // Create nodes
      ['A', 'B', 'C', 'D'].forEach(id => {
        builder.addNode({
          id,
          name: `func${id}`,
          filePath: `/test/${id}.ts`,
          line: 10,
          type: 'function',
          async: false,
          parameters: [],
          returnType: 'void',
        });
      });
    });

    it('should detect simple circular dependency', () => {
      // A -> B -> A
      builder.addEdge({
        id: 'AB',
        source: 'A',
        target: 'B',
        type: 'sync',
        line: 5,
      });
      builder.addEdge({
        id: 'BA',
        source: 'B',
        target: 'A',
        type: 'sync',
        line: 10,
      });

      const cycles = builder.detectCycles();
      
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('A');
      expect(cycles[0]).toContain('B');
    });

    it('should detect complex circular dependency', () => {
      // A -> B -> C -> A
      builder.addEdge({
        id: 'AB',
        source: 'A',
        target: 'B',
        type: 'sync',
        line: 5,
      });
      builder.addEdge({
        id: 'BC',
        source: 'B',
        target: 'C',
        type: 'sync',
        line: 10,
      });
      builder.addEdge({
        id: 'CA',
        source: 'C',
        target: 'A',
        type: 'sync',
        line: 15,
      });

      const cycles = builder.detectCycles();
      
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('A');
      expect(cycles[0]).toContain('B');
      expect(cycles[0]).toContain('C');
    });

    it('should handle graph with no cycles', () => {
      // A -> B -> C (no cycle)
      builder.addEdge({
        id: 'AB',
        source: 'A',
        target: 'B',
        type: 'sync',
        line: 5,
      });
      builder.addEdge({
        id: 'BC',
        source: 'B',
        target: 'C',
        type: 'sync',
        line: 10,
      });

      const cycles = builder.detectCycles();
      
      expect(cycles).toHaveLength(0);
    });

    it('should detect multiple separate cycles', () => {
      // A -> B -> A and C -> D -> C
      builder.addEdge({
        id: 'AB',
        source: 'A',
        target: 'B',
        type: 'sync',
        line: 5,
      });
      builder.addEdge({
        id: 'BA',
        source: 'B',
        target: 'A',
        type: 'sync',
        line: 10,
      });
      builder.addEdge({
        id: 'CD',
        source: 'C',
        target: 'D',
        type: 'sync',
        line: 15,
      });
      builder.addEdge({
        id: 'DC',
        source: 'D',
        target: 'C',
        type: 'sync',
        line: 20,
      });

      const cycles = builder.detectCycles();
      
      expect(cycles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Graph Traversal', () => {
    beforeEach(() => {
      // Create a test graph: A -> B -> C, A -> D
      ['A', 'B', 'C', 'D'].forEach(id => {
        builder.addNode({
          id,
          name: `func${id}`,
          filePath: `/test/${id}.ts`,
          line: 10,
          type: 'function',
          async: false,
          parameters: [],
          returnType: 'void',
        });
      });

      builder.addEdge({
        id: 'AB',
        source: 'A',
        target: 'B',
        type: 'sync',
        line: 5,
      });
      builder.addEdge({
        id: 'BC',
        source: 'B',
        target: 'C',
        type: 'sync',
        line: 10,
      });
      builder.addEdge({
        id: 'AD',
        source: 'A',
        target: 'D',
        type: 'sync',
        line: 15,
      });
    });

    it('should perform DFS traversal correctly', () => {
      const visited = builder.traverseDFS('A');
      
      expect(visited).toContain('A');
      expect(visited).toContain('B');
      expect(visited).toContain('C');
      expect(visited).toContain('D');
      expect(visited[0]).toBe('A'); // Should start with A
    });

    it('should perform BFS traversal correctly', () => {
      const visited = builder.traverseBFS('A');
      
      expect(visited).toContain('A');
      expect(visited).toContain('B');
      expect(visited).toContain('C');
      expect(visited).toContain('D');
      expect(visited[0]).toBe('A'); // Should start with A
    });

    it('should respect max depth in traversal', () => {
      const options: TraversalOptions = { maxDepth: 1 };
      
      const dfsVisited = builder.traverseDFS('A', options);
      const bfsVisited = builder.traverseBFS('A', options);
      
      expect(dfsVisited).toContain('A');
      expect(dfsVisited.length).toBeLessThanOrEqual(3); // A + direct children
      expect(bfsVisited).toContain('A');
      expect(bfsVisited.length).toBeLessThanOrEqual(3);
    });

    it('should call visit callbacks during traversal', () => {
      const visitedNodes: string[] = [];
      const visitedEdges: string[] = [];
      
      const options: TraversalOptions = {
        visitedCallback: (nodeId) => visitedNodes.push(nodeId),
        edgeCallback: (edge) => visitedEdges.push(edge.id),
      };
      
      builder.traverseDFS('A', options);
      
      expect(visitedNodes.length).toBeGreaterThan(0);
      expect(visitedEdges.length).toBeGreaterThan(0);
    });

    it('should handle traversal from non-existent node', () => {
      const visited = builder.traverseDFS('nonexistent');
      
      expect(visited).toHaveLength(0);
    });
  });

  describe('Subgraph Extraction', () => {
    beforeEach(() => {
      // Create test nodes with different types and file patterns
      builder.addNode({
        id: 'main',
        name: 'main',
        filePath: '/src/main.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });
      builder.addNode({
        id: 'helper',
        name: 'helper',
        filePath: '/src/utils/helper.ts',
        line: 5,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'string',
      });
      builder.addNode({
        id: 'service',
        name: 'processData',
        filePath: '/src/services/processor.ts',
        line: 10,
        type: 'method',
        async: true,
        parameters: [],
        returnType: 'Promise<void>',
        className: 'DataProcessor',
      });

      builder.addEdge({
        id: 'main-helper',
        source: 'main',
        target: 'helper',
        type: 'sync',
        line: 2,
      });
      builder.addEdge({
        id: 'main-service',
        source: 'main',
        target: 'service',
        type: 'async',
        line: 3,
      });
    });

    it('should extract subgraph with depth limit', () => {
      const subgraph = builder.getSubgraph('main', 1);
      
      expect(subgraph.nodes.length).toBeGreaterThan(0);
      expect(subgraph.entryPointId).toBe('main');
      expect(subgraph.metadata.maxDepth).toBe(1);
    });

    it('should filter nodes by type', () => {
      const filterOptions: GraphFilterOptions = {
        nodeTypes: ['function'],
      };
      
      const subgraph = builder.getSubgraph('main', 10, filterOptions);
      const methodNodes = subgraph.nodes.filter(n => n.type === 'method');
      
      expect(methodNodes).toHaveLength(0); // Should exclude method nodes
    });

    it('should filter nodes by file pattern', () => {
      // Start from helper node which matches the pattern
      const filterOptions: GraphFilterOptions = {
        filePatterns: [/\/src\/utils\//],
      };
      
      const subgraph = builder.getSubgraph('helper', 10, filterOptions);
      
      // Helper node should be included since it matches the pattern
      const helperNode = subgraph.nodes.find(n => n.id === 'helper');
      expect(helperNode).toBeDefined();
      expect(helperNode?.filePath).toMatch(/\/src\/utils\//);
      
      // Main and service nodes should be excluded as they don't match pattern
      const mainNode = subgraph.nodes.find(n => n.id === 'main');
      const serviceNode = subgraph.nodes.find(n => n.id === 'service');
      expect(mainNode).toBeUndefined();
      expect(serviceNode).toBeUndefined();
    });

    it('should exclude nodes by pattern', () => {
      const filterOptions: GraphFilterOptions = {
        excludePatterns: [/\/services\//],
      };
      
      const subgraph = builder.getSubgraph('main', 10, filterOptions);
      const serviceNodes = subgraph.nodes.filter(n => n.filePath.includes('/services/'));
      
      expect(serviceNodes).toHaveLength(0);
    });

    it('should filter edges by type', () => {
      const filterOptions: GraphFilterOptions = {
        edgeTypes: ['sync'],
      };
      
      const subgraph = builder.getSubgraph('main', 10, filterOptions);
      const asyncEdges = subgraph.edges.filter(e => e.type === 'async');
      
      expect(asyncEdges).toHaveLength(0); // Should exclude async edges
    });
  });

  describe('Metrics Calculation', () => {
    beforeEach(() => {
      // Create a more complex graph for metrics testing
      ['A', 'B', 'C', 'D', 'E'].forEach((id, index) => {
        builder.addNode({
          id,
          name: `func${id}`,
          filePath: `/test/file${index}.ts`,
          line: 10,
          type: 'function',
          async: index % 2 === 0, // Alternate async/sync
          parameters: [],
          returnType: 'void',
        });
      });

      // Create edges: A->B, A->C, B->D, C->D, D->E
      [
        ['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E']
      ].forEach(([source, target], index) => {
        builder.addEdge({
          id: `edge${index}`,
          source,
          target,
          type: 'sync',
          line: 5 + index,
        });
      });
    });

    it('should calculate basic metrics correctly', () => {
      const metrics = builder.getMetrics();
      
      expect(metrics.totalFunctions).toBe(5);
      expect(metrics.totalCalls).toBe(5);
      expect(metrics.asyncFunctions).toBe(3); // A, C, E are async
      expect(metrics.maxDepth).toBeGreaterThan(0);
    });

    it('should calculate fan-out and fan-in correctly', () => {
      const metrics = builder.getMetrics();
      
      expect(metrics.averageFanOut).toBeGreaterThan(0);
      expect(metrics.averageFanIn).toBeGreaterThan(0);
    });

    it('should identify hotspots correctly', () => {
      const metrics = builder.getMetrics();
      
      expect(metrics.hotspots).toBeDefined();
      expect(metrics.hotspots.length).toBeGreaterThan(0);
      
      // D should be a hotspot (called by both B and C)
      const hotspot = metrics.hotspots.find(h => h.nodeId === 'D');
      expect(hotspot).toBeDefined();
      expect(hotspot?.callCount).toBe(2);
    });

    it('should calculate complexity metrics', () => {
      const metrics = builder.getMetrics();
      
      expect(metrics.complexity.cyclomaticComplexity).toBeGreaterThan(0);
      expect(metrics.complexity.cognitiveComplexity).toBeGreaterThanOrEqual(0);
    });

    it('should detect circular dependencies in metrics', () => {
      // Add a cycle: E -> A
      builder.addEdge({
        id: 'cycle',
        source: 'E',
        target: 'A',
        type: 'sync',
        line: 20,
      });

      const metrics = builder.getMetrics();
      
      expect(metrics.circularDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      builder.addNode({
        id: 'test1',
        name: 'testFunc',
        filePath: '/test/file.ts',
        line: 10,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });
    });

    it('should clear all data', () => {
      builder.addEdge({
        id: 'edge1',
        source: 'test1',
        target: 'test2',
        type: 'sync',
        line: 5,
      });

      expect(builder.getNodeCount()).toBeGreaterThan(0);
      expect(builder.getEdgeCount()).toBeGreaterThan(0);

      builder.clear();

      expect(builder.getNodeCount()).toBe(0);
      expect(builder.getEdgeCount()).toBe(0);
    });

    it('should provide accurate counts', () => {
      expect(builder.getNodeCount()).toBe(1);
      expect(builder.getEdgeCount()).toBe(0);

      builder.addEdge({
        id: 'edge1',
        source: 'test1',
        target: 'test2',
        type: 'sync',
        line: 5,
      });

      expect(builder.getNodeCount()).toBe(2); // Including placeholder
      expect(builder.getEdgeCount()).toBe(1);
    });

    it('should check node and edge existence', () => {
      expect(builder.hasNode('test1')).toBe(true);
      expect(builder.hasNode('nonexistent')).toBe(false);
      expect(builder.hasEdge('nonexistent')).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large graphs efficiently', () => {
      const startTime = Date.now();
      const nodeCount = 1000;
      
      // Create 1000 nodes
      for (let i = 0; i < nodeCount; i++) {
        builder.addNode({
          id: `node${i}`,
          name: `func${i}`,
          filePath: `/test/file${i % 10}.ts`, // 10 different files
          line: i % 100 + 1,
          type: 'function',
          async: i % 3 === 0,
          parameters: [],
          returnType: 'void',
        });
      }

      // Create edges to form a chain
      for (let i = 0; i < nodeCount - 1; i++) {
        builder.addEdge({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`,
          type: 'sync',
          line: 5,
        });
      }

      const buildTime = Date.now();
      const graph = builder.build('node0');
      const endTime = Date.now();

      expect(graph.nodes).toHaveLength(nodeCount);
      expect(graph.edges).toHaveLength(nodeCount - 1);
      
      // Performance assertions
      expect(buildTime - startTime).toBeLessThan(5000); // Build should take < 5s
      expect(endTime - buildTime).toBeLessThan(1000); // Graph creation should take < 1s
    }, 10000); // 10 second timeout for this test

    it('should handle cycle detection on large graphs', () => {
      const nodeCount = 100;
      
      // Create nodes in a large cycle
      for (let i = 0; i < nodeCount; i++) {
        builder.addNode({
          id: `node${i}`,
          name: `func${i}`,
          filePath: `/test/file.ts`,
          line: i + 1,
          type: 'function',
          async: false,
          parameters: [],
          returnType: 'void',
        });
      }

      // Create cycle: node0 -> node1 -> ... -> node99 -> node0
      for (let i = 0; i < nodeCount; i++) {
        builder.addEdge({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${(i + 1) % nodeCount}`,
          type: 'sync',
          line: 5,
        });
      }

      const startTime = Date.now();
      const cycles = builder.detectCycles();
      const endTime = Date.now();

      expect(cycles.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1s
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed nodes gracefully', () => {
      expect(() => {
        builder.addNode({
          id: null as any,
          name: 'test',
          filePath: '/test.ts',
          line: 1,
          type: 'function',
          async: false,
          parameters: [],
          returnType: 'void',
        });
      }).toThrow();
    });

    it('should handle malformed edges gracefully', () => {
      expect(() => {
        builder.addEdge({
          id: 'test',
          source: null as any,
          target: 'test',
          type: 'sync',
          line: 1,
        });
      }).toThrow();
    });

    it('should handle traversal of disconnected components', () => {
      // Add isolated nodes
      builder.addNode({
        id: 'isolated1',
        name: 'isolated1',
        filePath: '/test1.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });
      builder.addNode({
        id: 'isolated2',
        name: 'isolated2',
        filePath: '/test2.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void',
      });

      const visited = builder.traverseDFS('isolated1');
      expect(visited).toEqual(['isolated1']); // Should only visit the starting node
    });
  });
});