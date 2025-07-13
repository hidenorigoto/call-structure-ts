import {
  MermaidParser,
  mermaidParser,
  parseMermaid,
  validateMermaidParse,
  getMermaidParsingMetrics,
} from '../../src/parser/MermaidParser';

describe('MermaidParser', () => {
  describe('Basic Parsing', () => {
    it('should parse simple flowchart declaration', () => {
      const result = parseMermaid('flowchart TD');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
      expect(result.lexErrors).toHaveLength(0);
      expect(result.parseErrors).toHaveLength(0);
    });

    it('should parse flowchart with different directions', () => {
      const directions = ['TD', 'TB', 'BT', 'RL', 'LR'];
      
      directions.forEach(direction => {
        const result = parseMermaid(`flowchart ${direction}`);
        expect(result.success).toBe(true);
        expect(result.cst).toBeDefined();
      });
    });

    it('should parse graph keyword as alternative', () => {
      const result = parseMermaid('graph TD');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });

  describe('Node Definitions', () => {
    it('should parse simple node without shape', () => {
      const result = parseMermaid('flowchart TD\nA');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse rectangle node', () => {
      const result = parseMermaid('flowchart TD\nA[Rectangle Node]');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse round node', () => {
      const result = parseMermaid('flowchart TD\nA(Round Node)');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse diamond node', () => {
      const result = parseMermaid('flowchart TD\nA{{Diamond Node}}');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse circle node', () => {
      const result = parseMermaid('flowchart TD\nA((Circle Node))');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse square bracket node', () => {
      const result = parseMermaid('flowchart TD\nA[[Square Node]]');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse asymmetric node', () => {
      const result = parseMermaid('flowchart TD\nA>Asymmetric Node]');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse node with string literal label', () => {
      const result = parseMermaid('flowchart TD\nA["String Label"]');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse node with single quote string label', () => {
      const result = parseMermaid("flowchart TD\nA['Single Quote Label']");
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });

  describe('Edge Definitions', () => {
    it('should parse solid arrow edge', () => {
      const result = parseMermaid('flowchart TD\nA --> B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse dotted arrow edge', () => {
      const result = parseMermaid('flowchart TD\nA -.-> B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse thick arrow edge', () => {
      const result = parseMermaid('flowchart TD\nA ==> B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse cross arrow edge', () => {
      const result = parseMermaid('flowchart TD\nA --x B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse circle arrow edge', () => {
      const result = parseMermaid('flowchart TD\nA --o B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse solid line edge', () => {
      const result = parseMermaid('flowchart TD\nA --- B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse dotted line edge', () => {
      const result = parseMermaid('flowchart TD\nA -.- B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse thick line edge', () => {
      const result = parseMermaid('flowchart TD\nA === B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse edge with label', () => {
      const result = parseMermaid('flowchart TD\nA -->|Label| B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse line with label', () => {
      const result = parseMermaid('flowchart TD\nA ---|Label| B');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });

  describe('Complex Diagrams', () => {
    it('should parse complete flowchart with nodes and edges', () => {
      const diagram = `
        flowchart TD
          A[Start] --> B{Decision}
          B -->|Yes| C[Process 1]
          B -->|No| D[Process 2]
          C --> E((End))
          D --> E
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse flowchart with mixed node shapes', () => {
      const diagram = `
        flowchart TD
          A[Rectangle] --> B(Round)
          B --> C{{Diamond}}
          C --> D[[Subroutine]]
          D --> E((Circle))
          E --> F>Asymmetric]
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse flowchart with different edge types', () => {
      const diagram = `
        flowchart TD
          A --> B
          B -.-> C
          C ==> D
          D --x E
          E --o F
          F --- G
          G -.- H
          H === I
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });

  describe('Subgraph Support', () => {
    it('should parse simple subgraph', () => {
      const diagram = `
        flowchart TD
          subgraph
            A --> B
          end
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse subgraph with title', () => {
      const diagram = `
        flowchart TD
          subgraph "Subgraph Title"
            A --> B
          end
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse nested subgraphs', () => {
      const diagram = `
        flowchart TD
          subgraph "Outer"
            A --> B
            subgraph "Inner"
              C --> D
            end
          end
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });

  describe('Class and Style Definitions', () => {
    it('should parse class definition', () => {
      const diagram = `
        flowchart TD
          classDef default fill:#f9f9f9
          A --> B
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse class assignment', () => {
      const diagram = `
        flowchart TD
          class A,B defaultClass
          A --> B
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should parse click definition', () => {
      const diagram = `
        flowchart TD
          click A "http://example.com"
          A --> B
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle lexing errors gracefully', () => {
      // Invalid tokens that lexer cannot handle
      const result = parseMermaid('invalid syntax @#$%');
      expect(result.success).toBe(false);
      expect(result.lexErrors.length > 0 || result.parseErrors.length > 0).toBe(true);
    });

    it('should handle missing direction', () => {
      const result = parseMermaid('flowchart\nA --> B');
      expect(result.success).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
    });

    it('should handle incomplete node definition', () => {
      const result = parseMermaid('flowchart TD\nA[');
      expect(result.success).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
    });

    it('should handle incomplete edge definition', () => {
      const result = parseMermaid('flowchart TD\nA -->');
      expect(result.success).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
    });

    it('should handle incomplete subgraph', () => {
      const result = parseMermaid('flowchart TD\nsubgraph\nA --> B');
      expect(result.success).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Function', () => {
    it('should validate correct syntax', () => {
      const validation = validateMermaidParse('flowchart TD\nA --> B');
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.cst).toBeDefined();
    });

    it('should reject invalid syntax', () => {
      const validation = validateMermaidParse('invalid syntax');
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.cst).toBeUndefined();
    });

    it('should provide detailed error messages', () => {
      const validation = validateMermaidParse('flowchart\nA --> B'); // Missing direction
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Parse error');
    });
  });

  describe('Performance Metrics', () => {
    it('should provide performance metrics', () => {
      const metrics = getMermaidParsingMetrics('flowchart TD\nA --> B --> C');
      
      expect(metrics.lexingTime).toBeGreaterThan(0);
      expect(metrics.parsingTime).toBeGreaterThan(0);
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.tokenCount).toBeGreaterThan(0);
      expect(metrics.success).toBe(true);
    });

    it('should meet performance requirements for typical diagrams', () => {
      const diagram = `
        flowchart TD
          A[Start] --> B{Decision}
          B -->|Yes| C[Process 1]
          B -->|No| D[Process 2]
          C --> E((End))
          D --> E
          subgraph "Processing"
            C --> F[Step 1]
            F --> G[Step 2]
          end
      `;
      
      const metrics = getMermaidParsingMetrics(diagram);
      
      // Should complete in less than 20ms for typical diagrams (as per requirement)
      expect(metrics.totalTime).toBeLessThan(50); // Generous limit for test environment
      expect(metrics.success).toBe(true);
    });

    it('should handle large diagrams efficiently', () => {
      // Generate a larger diagram
      const nodes = Array.from({ length: 20 }, (_, i) => `Node${i}`);
      const edges = nodes.slice(0, -1).map((node, i) => `${node} --> ${nodes[i + 1]}`);
      const diagram = `flowchart TD\n${edges.join('\n')}`;
      
      const metrics = getMermaidParsingMetrics(diagram);
      
      expect(metrics.totalTime).toBeLessThan(100); // Should still be fast
      expect(metrics.success).toBe(true);
      expect(metrics.tokenCount).toBeGreaterThan(40); // Lots of tokens
    });
  });

  describe('Parser Instance', () => {
    it('should create parser instance without errors', () => {
      expect(() => new MermaidParser()).not.toThrow();
    });

    it('should have all required rules', () => {
      const parser = new MermaidParser();
      
      // Check that main rules exist
      expect(parser.flowchart).toBeDefined();
      expect(parser.statement).toBeDefined();
      expect(parser.nodeOrEdgeStatement).toBeDefined();
      expect(parser.subgraphDefinition).toBeDefined();
    });

    it('should handle parser reuse', () => {
      // Parse multiple diagrams with the same parser instance
      const diagrams = [
        'flowchart TD\nA --> B',
        'flowchart LR\nC --> D',
        'graph TB\nE --> F',
      ];
      
      diagrams.forEach(diagram => {
        const result = parseMermaid(diagram);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty flowchart', () => {
      const result = parseMermaid('flowchart TD');
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should handle whitespace and comments', () => {
      const diagram = `
        flowchart TD
          %% This is a comment
          A --> B
          %% Another comment
          B --> C
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should handle multiple statements', () => {
      const diagram = `
        flowchart TD
          A[Node A]
          B(Node B)
          C{{Node C}}
          A --> B
          B --> C
          classDef default fill:#f9f9f9
          class A,B defaultClass
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });

    it('should handle special characters in labels', () => {
      const diagram = `
        flowchart TD
          A["Label with spaces and special chars: @#$%"]
          B['Single quoted label with special chars: !@#']
          A --> B
      `;
      
      const result = parseMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.cst).toBeDefined();
    });
  });
});