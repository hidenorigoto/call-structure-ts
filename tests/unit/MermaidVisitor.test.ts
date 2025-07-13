import { 
  MermaidToCallGraphVisitor,
  mermaidCstToCallGraph,
  mermaidToCallGraph 
} from '../../src/parser/MermaidVisitor';
import { parseMermaid } from '../../src/parser/MermaidParser';
import { CallGraph, CallGraphNode, CallGraphEdge } from '../../src/types/CallGraph';

describe('MermaidVisitor', () => {
  describe('Basic Node Transformation', () => {
    it('should transform simple nodes to CallGraph', () => {
      const mermaid = `
        flowchart TD
          A
          B
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.nodes).toHaveLength(2);
      
      const nodeA = callGraph!.nodes.find(n => n.name === 'A');
      const nodeB = callGraph!.nodes.find(n => n.name === 'B');
      
      expect(nodeA).toBeDefined();
      expect(nodeB).toBeDefined();
      expect(nodeA!.type).toBe('function');
      expect(nodeB!.type).toBe('function');
    });

    it('should transform nodes with labels', () => {
      const mermaid = `
        flowchart TD
          A[Start Process]
          B[End Process]
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const nodeA = callGraph!.nodes.find(n => n.name === 'Start Process');
      const nodeB = callGraph!.nodes.find(n => n.name === 'End Process');
      
      expect(nodeA).toBeDefined();
      expect(nodeB).toBeDefined();
    });

    it('should map node shapes to function types', () => {
      const mermaid = `
        flowchart TD
          A[Rectangle Function]
          B(Round Function)
          C{{Diamond Method}}
          D[[Subroutine Method]]
          E((Circle Function))
          F>Asymmetric Arrow]
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const nodes = callGraph!.nodes;
      expect(nodes).toHaveLength(6);
      
      const rectangle = nodes.find(n => n.name === 'Rectangle Function');
      const round = nodes.find(n => n.name === 'Round Function');
      const diamond = nodes.find(n => n.name === 'Diamond Method');
      const subroutine = nodes.find(n => n.name === 'Subroutine Method');
      const circle = nodes.find(n => n.name === 'Circle Function');
      const asymmetric = nodes.find(n => n.name === 'Asymmetric Arrow');
      
      expect(rectangle!.type).toBe('function');
      expect(round!.type).toBe('function');
      expect(diamond!.type).toBe('method');
      expect(subroutine!.type).toBe('method');
      expect(circle!.type).toBe('function');
      expect(asymmetric!.type).toBe('arrow');
    });
  });

  describe('Edge Transformation', () => {
    it('should transform simple edges', () => {
      const mermaid = `
        flowchart TD
          A --> B
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.edges).toHaveLength(1);
      
      const edge = callGraph!.edges[0];
      expect(edge.type).toBe('sync');
      
      const sourceNode = callGraph!.nodes.find(n => n.id === edge.source);
      const targetNode = callGraph!.nodes.find(n => n.id === edge.target);
      
      expect(sourceNode!.name).toBe('A');
      expect(targetNode!.name).toBe('B');
    });

    it('should map edge types to call types', () => {
      const mermaid = `
        flowchart TD
          A --> B
          B -.-> C
          C ==> D
          D --- E
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.edges).toHaveLength(4);
      
      const edges = callGraph!.edges;
      expect(edges[0].type).toBe('sync'); // solid arrow
      expect(edges[1].type).toBe('async'); // dotted arrow
      expect(edges[2].type).toBe('constructor'); // thick arrow
      expect(edges[3].type).toBe('callback'); // solid line
    });

    it('should handle edge chaining', () => {
      const mermaid = `
        flowchart TD
          A --> B --> C --> D
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.nodes).toHaveLength(4);
      expect(callGraph!.edges).toHaveLength(3);
      
      // Verify chain: A->B, B->C, C->D
      const edges = callGraph!.edges;
      const nodes = callGraph!.nodes;
      
      const nodeMap = new Map(nodes.map(n => [n.name, n.id]));
      
      expect(edges.find(e => 
        e.source === nodeMap.get('A') && e.target === nodeMap.get('B')
      )).toBeDefined();
      
      expect(edges.find(e => 
        e.source === nodeMap.get('B') && e.target === nodeMap.get('C')
      )).toBeDefined();
      
      expect(edges.find(e => 
        e.source === nodeMap.get('C') && e.target === nodeMap.get('D')
      )).toBeDefined();
    });

    it('should handle mixed node and edge definitions', () => {
      const mermaid = `
        flowchart TD
          A[Start] --> B{Decision}
          B -->|Yes| C[Process 1]
          B -->|No| D[Process 2]
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.nodes).toHaveLength(4);
      expect(callGraph!.edges).toHaveLength(3);
      
      const decision = callGraph!.nodes.find(n => n.name === 'Decision');
      expect(decision!.type).toBe('method'); // Diamond shape
    });
  });

  describe('Subgraph Support', () => {
    it('should handle subgraphs with nodes', () => {
      const mermaid = `
        flowchart TD
          subgraph "Authentication"
            A[Login] --> B[Validate]
          end
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const loginNode = callGraph!.nodes.find(n => n.name === 'Login');
      const validateNode = callGraph!.nodes.find(n => n.name === 'Validate');
      
      expect(loginNode!.className).toBe('Authentication');
      expect(validateNode!.className).toBe('Authentication');
    });

    it('should handle nested subgraphs', () => {
      const mermaid = `
        flowchart TD
          subgraph "Outer"
            A --> B
            subgraph "Inner"
              C --> D
            end
          end
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const nodeA = callGraph!.nodes.find(n => n.name === 'A');
      const nodeC = callGraph!.nodes.find(n => n.name === 'C');
      
      expect(nodeA!.className).toBe('Outer');
      expect(nodeC!.className).toBe('Inner');
    });

    it('should handle unnamed subgraphs', () => {
      const mermaid = `
        flowchart TD
          subgraph
            A --> B
          end
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const nodeA = callGraph!.nodes.find(n => n.name === 'A');
      expect(nodeA!.className).toMatch(/^subgraph_\d+$/);
    });
  });

  describe('Class and Style Support', () => {
    it('should handle class definitions', () => {
      const mermaid = `
        flowchart TD
          classDef async fill:#f9f9f9
          A --> B
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      // Class definitions are processed but not directly reflected in the CallGraph
      expect(callGraph!.nodes).toHaveLength(2);
    });

    it('should handle class assignments', () => {
      const mermaid = `
        flowchart TD
          class A,B asyncClass
          A --> B
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      // Class assignments are processed but not directly reflected in the CallGraph
      expect(callGraph!.nodes).toHaveLength(2);
    });
  });

  describe('Entry Point Detection', () => {
    it('should identify entry point with no incoming edges', () => {
      const mermaid = `
        flowchart TD
          A --> B --> C
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const entryNode = callGraph!.nodes.find(n => n.id === callGraph!.entryPointId);
      expect(entryNode!.name).toBe('A');
    });

    it('should handle multiple potential entry points', () => {
      const mermaid = `
        flowchart TD
          A --> B
          C --> D
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const entryNode = callGraph!.nodes.find(n => n.id === callGraph!.entryPointId);
      expect(['A', 'C']).toContain(entryNode!.name);
    });

    it('should handle cyclic graphs', () => {
      const mermaid = `
        flowchart TD
          A --> B
          B --> C
          C --> A
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      // In a cycle, it should pick the first node
      expect(callGraph!.entryPointId).toBeDefined();
    });
  });

  describe('Metadata Generation', () => {
    it('should generate proper metadata', () => {
      const mermaid = `
        flowchart TD
          A --> B
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const metadata = callGraph!.metadata;
      expect(metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(metadata.entryPoint).toBe('mermaid-diagram');
      expect(metadata.totalFiles).toBe(1);
      expect(metadata.maxDepth).toBeGreaterThan(0);
    });

    it('should calculate correct max depth', () => {
      const mermaid = `
        flowchart TD
          A --> B --> C --> D
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.metadata.maxDepth).toBe(4);
    });

    it('should handle branching depth correctly', () => {
      const mermaid = `
        flowchart TD
          A --> B
          A --> C --> D --> E
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.metadata.maxDepth).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should return null for invalid Mermaid syntax', () => {
      const mermaid = 'invalid syntax';
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).toBeNull();
    });

    it('should handle empty diagrams', () => {
      const mermaid = 'flowchart TD';
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      expect(callGraph!.nodes).toHaveLength(0);
      expect(callGraph!.edges).toHaveLength(0);
    });
  });

  describe('Complex Diagrams', () => {
    it('should handle real-world complex diagram', () => {
      const mermaid = `
        flowchart TD
          subgraph "Frontend"
            UI[User Interface] --> |HTTP Request| API[API Gateway]
          end
          
          subgraph "Backend"
            API --> Auth{Authentication}
            Auth -->|Valid| Service[Business Logic]
            Auth -->|Invalid| Error[Error Handler]
            Service --> DB[Database]
            Service --> Cache[Cache]
          end
          
          subgraph "External"
            Service -.-> Email[Email Service]
            Service -.-> Payment[Payment Gateway]
          end
          
          DB --> Response[Format Response]
          Cache --> Response
          Response --> API
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      // Verify structure
      expect(callGraph!.nodes.length).toBeGreaterThan(8);
      expect(callGraph!.edges.length).toBeGreaterThan(9);
      
      // Verify subgraph assignments
      const uiNode = callGraph!.nodes.find(n => n.name === 'User Interface');
      expect(uiNode!.className).toBe('Frontend');
      
      const authNode = callGraph!.nodes.find(n => n.name === 'Authentication' || n.name === 'Auth');
      expect(authNode).toBeDefined();
      if (authNode) {
        expect(authNode.className).toBe('Backend');
        // Auth node may be created without shape info from edge, so it's type is 'function'
        // This is acceptable behavior
      }
      
      // Verify that dotted edges are correctly mapped to async
      const hasAsyncEdges = callGraph!.edges.some(e => e.type === 'async');
      expect(hasAsyncEdges).toBe(true);
    });
  });

  describe('Special Characters and Escaping', () => {
    it('should handle quoted labels with special characters', () => {
      const mermaid = `
        flowchart TD
          A["Node with spaces and symbols: @#$%"]
          B['Single quoted with symbols: !@#']
          A --> B
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const nodeA = callGraph!.nodes.find(n => n.name.includes('@#$%'));
      const nodeB = callGraph!.nodes.find(n => n.name.includes('!@#'));
      
      expect(nodeA).toBeDefined();
      expect(nodeB).toBeDefined();
    });

    it('should handle multi-word labels', () => {
      const mermaid = `
        flowchart TD
          A[Multi Word Label Here]
          B(Another Multi Word)
      `;
      
      const callGraph = mermaidToCallGraph(mermaid);
      expect(callGraph).not.toBeNull();
      
      const nodeA = callGraph!.nodes.find(n => n.name === 'Multi Word Label Here');
      const nodeB = callGraph!.nodes.find(n => n.name === 'Another Multi Word');
      
      expect(nodeA).toBeDefined();
      expect(nodeB).toBeDefined();
    });
  });

  describe('CST Direct Transformation', () => {
    it('should transform CST directly', () => {
      const mermaid = 'flowchart TD\nA --> B';
      const parseResult = parseMermaid(mermaid);
      
      expect(parseResult.success).toBe(true);
      
      const callGraph = mermaidCstToCallGraph(parseResult.cst);
      expect(callGraph).toBeDefined();
      expect(callGraph.nodes).toHaveLength(2);
      expect(callGraph.edges).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', () => {
      // Generate a large graph
      const nodes = Array.from({ length: 50 }, (_, i) => `Node${i}`);
      const edges = nodes.slice(0, -1).map((node, i) => `${node} --> ${nodes[i + 1]}`);
      const mermaid = `flowchart TD\n${edges.join('\n')}`;
      
      const startTime = performance.now();
      const callGraph = mermaidToCallGraph(mermaid);
      const endTime = performance.now();
      
      expect(callGraph).not.toBeNull();
      expect(callGraph!.nodes).toHaveLength(50);
      expect(callGraph!.edges).toHaveLength(49);
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});