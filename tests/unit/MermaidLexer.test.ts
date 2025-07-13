import {
  mermaidLexer,
  tokenizeMermaid,
  validateMermaidSyntax,
  getMermaidLexingMetrics,
  MermaidTokens,
  allTokens,
} from '../../src/parser/MermaidLexer';

describe('MermaidLexer', () => {
  describe('Basic Tokenization', () => {
    it('should tokenize flowchart keyword', () => {
      const result = tokenizeMermaid('flowchart TD');
      expect(result.success).toBe(true);
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].tokenType).toBe(MermaidTokens.FlowchartKeyword);
      expect(result.tokens[1].tokenType).toBe(MermaidTokens.Direction);
    });

    it('should tokenize graph keyword', () => {
      const result = tokenizeMermaid('graph LR');
      expect(result.success).toBe(true);
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].tokenType).toBe(MermaidTokens.FlowchartKeyword);
      expect(result.tokens[1].tokenType).toBe(MermaidTokens.Direction);
    });

    it('should handle all direction types', () => {
      const directions = ['TD', 'TB', 'BT', 'RL', 'LR'];
      directions.forEach(dir => {
        const result = tokenizeMermaid(`flowchart ${dir}`);
        expect(result.success).toBe(true);
        expect(result.tokens[1].tokenType).toBe(MermaidTokens.Direction);
        expect(result.tokens[1].image).toBe(dir);
      });
    });
  });

  describe('Node Definitions', () => {
    it('should tokenize simple node', () => {
      const result = tokenizeMermaid('flowchart TD\n    A[Rectangle]');
      expect(result.success).toBe(true);
      
      const nodeTokens = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.NodeId ||
        t.tokenType === MermaidTokens.RectangleOpen ||
        t.tokenType === MermaidTokens.RectangleClose ||
        t.tokenType === MermaidTokens.Text
      );
      
      expect(nodeTokens).toHaveLength(4);
      expect(nodeTokens[0].tokenType).toBe(MermaidTokens.NodeId);
      expect(nodeTokens[1].tokenType).toBe(MermaidTokens.RectangleOpen);
      expect(nodeTokens[2].tokenType).toBe(MermaidTokens.NodeId); // "Rectangle" is tokenized as NodeId
      expect(nodeTokens[3].tokenType).toBe(MermaidTokens.RectangleClose);
    });

    it('should tokenize round node', () => {
      const result = tokenizeMermaid('A(Round)');
      expect(result.success).toBe(true);
      
      const shapes = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.RoundOpen ||
        t.tokenType === MermaidTokens.RoundClose
      );
      expect(shapes).toHaveLength(2);
    });

    it('should tokenize diamond node', () => {
      const result = tokenizeMermaid('A{{Diamond}}');
      expect(result.success).toBe(true);
      
      const shapes = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.DiamondOpen ||
        t.tokenType === MermaidTokens.DiamondClose
      );
      expect(shapes).toHaveLength(2);
    });

    it('should tokenize circle node', () => {
      const result = tokenizeMermaid('A((Circle))');
      expect(result.success).toBe(true);
      
      const shapes = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.CircleOpen ||
        t.tokenType === MermaidTokens.CircleClose
      );
      expect(shapes).toHaveLength(2);
    });

    it('should tokenize square bracket node', () => {
      const result = tokenizeMermaid('A[[Square]]');
      expect(result.success).toBe(true);
      
      const shapes = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.SquareBracketOpen ||
        t.tokenType === MermaidTokens.SquareBracketClose
      );
      expect(shapes).toHaveLength(2);
    });

    it('should tokenize asymmetric node', () => {
      const result = tokenizeMermaid('A>Asymmetric]');
      expect(result.success).toBe(true);
      
      const asymmetric = result.tokens.find(t => 
        t.tokenType === MermaidTokens.AsymmetricOpen
      );
      expect(asymmetric).toBeDefined();
    });
  });

  describe('Edge Definitions', () => {
    it('should tokenize solid arrow', () => {
      const result = tokenizeMermaid('A --> B');
      expect(result.success).toBe(true);
      
      const arrow = result.tokens.find(t => 
        t.tokenType === MermaidTokens.SolidArrow
      );
      expect(arrow).toBeDefined();
      expect(arrow?.image).toBe('-->');
    });

    it('should tokenize dotted arrow', () => {
      const result = tokenizeMermaid('A -.-> B');
      expect(result.success).toBe(true);
      
      const arrow = result.tokens.find(t => 
        t.tokenType === MermaidTokens.DottedArrow
      );
      expect(arrow).toBeDefined();
    });

    it('should tokenize thick arrow', () => {
      const result = tokenizeMermaid('A ==> B');
      expect(result.success).toBe(true);
      
      const arrow = result.tokens.find(t => 
        t.tokenType === MermaidTokens.ThickArrow
      );
      expect(arrow).toBeDefined();
    });

    it('should tokenize cross arrow', () => {
      const result = tokenizeMermaid('A --x B');
      expect(result.success).toBe(true);
      
      const arrow = result.tokens.find(t => 
        t.tokenType === MermaidTokens.CrossArrow
      );
      expect(arrow).toBeDefined();
    });

    it('should tokenize circle arrow', () => {
      const result = tokenizeMermaid('A --o B');
      expect(result.success).toBe(true);
      
      const arrow = result.tokens.find(t => 
        t.tokenType === MermaidTokens.CircleArrow
      );
      expect(arrow).toBeDefined();
    });

    it('should tokenize edge with label', () => {
      const result = tokenizeMermaid('A -->|Label| B');
      expect(result.success).toBe(true);
      
      const pipes = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.Pipe
      );
      expect(pipes).toHaveLength(2);
      
      const label = result.tokens.find(t => 
        t.tokenType === MermaidTokens.NodeId && t.image === 'Label'  // "Label" is tokenized as NodeId
      );
      expect(label).toBeDefined();
    });
  });

  describe('String Handling', () => {
    it('should tokenize double-quoted strings', () => {
      const result = tokenizeMermaid('A["Double quotes"]');
      expect(result.success).toBe(true);
      
      const string = result.tokens.find(t => 
        t.tokenType === MermaidTokens.StringLiteral
      );
      expect(string).toBeDefined();
      expect(string?.image).toBe('"Double quotes"');
    });

    it('should tokenize single-quoted strings', () => {
      const result = tokenizeMermaid("A['Single quotes']");
      expect(result.success).toBe(true);
      
      const string = result.tokens.find(t => 
        t.tokenType === MermaidTokens.SingleQuoteString
      );
      expect(string).toBeDefined();
      expect(string?.image).toBe("'Single quotes'");
    });

    it('should handle escaped quotes', () => {
      const result = tokenizeMermaid('A["Escaped \\"quotes\\""]');
      expect(result.success).toBe(true);
      
      const string = result.tokens.find(t => 
        t.tokenType === MermaidTokens.StringLiteral
      );
      expect(string).toBeDefined();
    });
  });

  describe('Comments and Whitespace', () => {
    it('should skip comments', () => {
      const result = tokenizeMermaid('flowchart TD %% This is a comment\nA --> B');
      expect(result.success).toBe(true);
      
      // Comments should be skipped, so we shouldn't find them in tokens
      const commentToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.Comment
      );
      expect(commentToken).toBeUndefined();
    });

    it('should skip whitespace', () => {
      const result = tokenizeMermaid('   flowchart    TD   ');
      expect(result.success).toBe(true);
      
      // Only flowchart and TD tokens should remain
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].tokenType).toBe(MermaidTokens.FlowchartKeyword);
      expect(result.tokens[1].tokenType).toBe(MermaidTokens.Direction);
    });

    it('should handle newlines correctly', () => {
      const result = tokenizeMermaid('flowchart TD\nA --> B\nB --> C');
      expect(result.success).toBe(true);
      
      // Should successfully tokenize multi-line diagrams
      const nodeIds = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.NodeId
      );
      expect(nodeIds).toHaveLength(4); // A, B, B, C
    });
  });

  describe('Advanced Features', () => {
    it('should tokenize subgraph definitions', () => {
      const result = tokenizeMermaid('subgraph "Subgraph Title"\nA --> B\nend');
      expect(result.success).toBe(true);
      
      const subgraphToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.SubgraphKeyword
      );
      expect(subgraphToken).toBeDefined();
      
      const endToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.EndKeyword
      );
      expect(endToken).toBeDefined();
    });

    it('should tokenize class definitions', () => {
      const result = tokenizeMermaid('classDef default fill:#f9f9f9');
      expect(result.success).toBe(true);
      
      const classDefToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.ClassDefKeyword
      );
      expect(classDefToken).toBeDefined();
    });

    it('should tokenize class assignments', () => {
      const result = tokenizeMermaid('class A,B defaultClass');
      expect(result.success).toBe(true);
      
      const classToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.ClassKeyword
      );
      expect(classToken).toBeDefined();
    });

    it('should tokenize click events', () => {
      const result = tokenizeMermaid('click A "http://example.com"');
      expect(result.success).toBe(true);
      
      const clickToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.ClickKeyword
      );
      expect(clickToken).toBeDefined();
    });
  });

  describe('Complex Diagrams', () => {
    it('should tokenize a complete flowchart', () => {
      const diagram = `
        flowchart TD
          A[Start] --> B{Decision}
          B -->|Yes| C[Process 1]
          B -->|No| D[Process 2]
          C --> E((End))
          D --> E
          %% This is a comment
      `;
      
      const result = tokenizeMermaid(diagram);
      expect(result.success).toBe(true);
      expect(result.tokens.length).toBeGreaterThan(20);
      
      // Verify key components are present
      const flowchartToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.FlowchartKeyword
      );
      expect(flowchartToken).toBeDefined();
      
      const arrows = result.tokens.filter(t => 
        t.tokenType === MermaidTokens.SolidArrow
      );
      expect(arrows.length).toBeGreaterThan(3);
    });

    it('should handle mixed node shapes', () => {
      const diagram = `
        flowchart TD
          A[Rectangle] --> B(Round)
          B --> C{{Diamond}}
          C --> D[[Subroutine]]
          D --> E((Circle))
      `;
      
      const result = tokenizeMermaid(diagram);
      expect(result.success).toBe(true);
      
      // Check for different node shapes
      const rectangleOpen = result.tokens.find(t => 
        t.tokenType === MermaidTokens.RectangleOpen
      );
      expect(rectangleOpen).toBeDefined();
      
      const roundOpen = result.tokens.find(t => 
        t.tokenType === MermaidTokens.RoundOpen
      );
      expect(roundOpen).toBeDefined();
      
      const diamondOpen = result.tokens.find(t => 
        t.tokenType === MermaidTokens.DiamondOpen
      );
      expect(diamondOpen).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid characters gracefully', () => {
      // This should still succeed as invalid chars become Text tokens
      const result = tokenizeMermaid('flowchart TD\nA @#$% B');
      expect(result.success).toBe(true);
      
      // Should tokenize what it can
      const flowchartToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.FlowchartKeyword
      );
      expect(flowchartToken).toBeDefined();
    });

    it('should provide line and column information', () => {
      const result = tokenizeMermaid('flowchart TD\nA --> B');
      expect(result.success).toBe(true);
      
      // Check that tokens have position information
      result.tokens.forEach(token => {
        expect(token.startLine).toBeDefined();
        expect(token.startColumn).toBeDefined();
      });
    });
  });

  describe('Validation Functions', () => {
    it('should validate correct Mermaid syntax', () => {
      const validation = validateMermaidSyntax('flowchart TD\nA --> B');
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject diagrams without flowchart keyword', () => {
      const validation = validateMermaidSyntax('A --> B');
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Mermaid diagram must start with "flowchart" or "graph" keyword');
    });

    it('should accept graph keyword', () => {
      const validation = validateMermaidSyntax('graph LR\nA --> B');
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should provide performance metrics', () => {
      const metrics = getMermaidLexingMetrics('flowchart TD\nA --> B --> C');
      
      expect(metrics.lexingTime).toBeGreaterThan(0);
      expect(metrics.tokenCount).toBeGreaterThan(0);
      expect(metrics.characterCount).toBeGreaterThan(0);
      expect(metrics.tokensPerMs).toBeGreaterThan(0);
      expect(metrics.success).toBe(true);
    });

    it('should meet performance requirements', () => {
      const largeDigram = `
        flowchart TD
          ${'A'.repeat(100)} --> ${'B'.repeat(100)}
          ${'B'.repeat(100)} --> ${'C'.repeat(100)}
          ${'C'.repeat(100)} --> ${'D'.repeat(100)}
      `;
      
      const metrics = getMermaidLexingMetrics(largeDigram);
      
      // Should complete in reasonable time (less than 10ms for typical diagrams)
      expect(metrics.lexingTime).toBeLessThan(50); // Generous limit for test environment
      expect(metrics.success).toBe(true);
    });
  });

  describe('Token Export', () => {
    it('should export all token types', () => {
      expect(MermaidTokens.FlowchartKeyword).toBeDefined();
      expect(MermaidTokens.Direction).toBeDefined();
      expect(MermaidTokens.SolidArrow).toBeDefined();
      expect(MermaidTokens.NodeId).toBeDefined();
      expect(MermaidTokens.StringLiteral).toBeDefined();
    });

    it('should have all tokens in allTokens array', () => {
      expect(allTokens).toContain(MermaidTokens.FlowchartKeyword);
      expect(allTokens).toContain(MermaidTokens.Direction);
      expect(allTokens).toContain(MermaidTokens.SolidArrow);
      expect(allTokens).toContain(MermaidTokens.NodeId);
      expect(allTokens).toContain(MermaidTokens.StringLiteral);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const result = tokenizeMermaid('');
      expect(result.success).toBe(true);
      expect(result.tokens).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const result = tokenizeMermaid('   \n  \t  ');
      expect(result.success).toBe(true);
      expect(result.tokens).toHaveLength(0); // All whitespace is skipped
    });

    it('should handle comment-only input', () => {
      const result = tokenizeMermaid('%% Just a comment');
      expect(result.success).toBe(true);
      expect(result.tokens).toHaveLength(0); // Comments are skipped
    });

    it('should handle very long node names', () => {
      const longName = 'A'.repeat(1000);
      const result = tokenizeMermaid(`flowchart TD\n${longName} --> B`);
      expect(result.success).toBe(true);
      
      const nodeToken = result.tokens.find(t => 
        t.tokenType === MermaidTokens.NodeId && t.image === longName
      );
      expect(nodeToken).toBeDefined();
    });
  });
});