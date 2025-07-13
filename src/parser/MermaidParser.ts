import { CstParser } from 'chevrotain';
import {
  allTokens,
  MermaidTokens,
  tokenizeMermaid,
} from './MermaidLexer';

/**
 * Mermaid Parser using Chevrotain for building Concrete Syntax Trees (CST)
 * 
 * Supports:
 * - Flowchart declarations and directions
 * - Node definitions with various shapes and labels
 * - Edge definitions with different arrow styles and labels
 * - Subgraph definitions
 * - Class and style definitions
 * - Error recovery for robust parsing
 */
export class MermaidParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: 'full',
      maxLookahead: 3,
    });
    
    this.performSelfAnalysis();
  }

  /**
   * Main entry point: flowchart declaration
   */
  public flowchart = this.RULE('flowchart', () => {
    this.CONSUME(MermaidTokens.FlowchartKeyword);
    this.CONSUME(MermaidTokens.Direction);
    this.MANY(() => this.SUBRULE(this.statement));
  });

  /**
   * Statement can be a node, edge, subgraph, or class definition
   */
  public statement = this.RULE('statement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.nodeOrEdgeStatement) },
      { ALT: () => this.SUBRULE(this.subgraphDefinition) },
      { ALT: () => this.SUBRULE(this.classDefinition) },
      { ALT: () => this.SUBRULE(this.classAssignment) },
      { ALT: () => this.SUBRULE(this.clickDefinition) },
    ]);
  });

  /**
   * Node or edge statement - handles complex Mermaid syntax including chains
   */
  public nodeOrEdgeStatement = this.RULE('nodeOrEdgeStatement', () => {
    // Always starts with a NodeId
    this.CONSUME(MermaidTokens.NodeId, { LABEL: 'first' });
    
    // Check if there's a node shape definition
    this.OPTION(() => this.SUBRULE(this.nodeShape));
    
    // Allow chaining multiple edges: A --> B --> C
    this.MANY(() => {
      this.SUBRULE2(this.edgeType);
      this.CONSUME2(MermaidTokens.NodeId, { LABEL: 'target' });
      
      // The target might also have a shape
      this.OPTION2(() => this.SUBRULE3(this.nodeShape));
    });
  });


  /**
   * Node shape with label content
   */
  public nodeShape = this.RULE('nodeShape', () => {
    this.OR([
      // Rectangle [text]
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.RectangleOpen);
          this.SUBRULE(this.nodeLabel);
          this.CONSUME(MermaidTokens.RectangleClose);
        }
      },
      // Round (text)
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.RoundOpen);
          this.SUBRULE2(this.nodeLabel);
          this.CONSUME(MermaidTokens.RoundClose);
        }
      },
      // Diamond {{text}}
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.DiamondOpen);
          this.SUBRULE3(this.nodeLabel);
          this.CONSUME(MermaidTokens.DiamondClose);
        }
      },
      // Curly brace {text}
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.CurlyOpen);
          this.SUBRULE7(this.nodeLabel);
          this.CONSUME(MermaidTokens.CurlyClose);
        }
      },
      // Circle ((text))
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.CircleOpen);
          this.SUBRULE4(this.nodeLabel);
          this.CONSUME(MermaidTokens.CircleClose);
        }
      },
      // Square bracket [[text]]
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.SquareBracketOpen);
          this.SUBRULE5(this.nodeLabel);
          this.CONSUME(MermaidTokens.SquareBracketClose);
        }
      },
      // Asymmetric >text]
      {
        ALT: () => {
          this.CONSUME(MermaidTokens.AsymmetricOpen);
          this.SUBRULE6(this.nodeLabel);
          this.CONSUME2(MermaidTokens.RectangleClose);
        }
      },
    ]);
  });

  /**
   * Node label content (text, string literals, or identifiers)
   */
  public nodeLabel = this.RULE('nodeLabel', () => {
    this.OR([
      { ALT: () => this.CONSUME(MermaidTokens.StringLiteral) },
      { ALT: () => this.CONSUME(MermaidTokens.SingleQuoteString) },
      { 
        ALT: () => {
          // Multiple text tokens for labels like "Rectangle Node"
          this.CONSUME(MermaidTokens.NodeId);
          this.MANY(() => {
            this.OR2([
              { ALT: () => this.CONSUME2(MermaidTokens.NodeId) },
              { ALT: () => this.CONSUME(MermaidTokens.Text) },
            ]);
          });
        }
      },
    ]);
  });


  /**
   * Edge type with optional label
   */
  public edgeType = this.RULE('edgeType', () => {
    this.OR([
      // Arrows with optional labels: -->|label|, -.->|label|, etc.
      {
        ALT: () => {
          this.OR2([
            { ALT: () => this.CONSUME(MermaidTokens.SolidArrow) },
            { ALT: () => this.CONSUME(MermaidTokens.DottedArrow) },
            { ALT: () => this.CONSUME(MermaidTokens.ThickArrow) },
            { ALT: () => this.CONSUME(MermaidTokens.CrossArrow) },
            { ALT: () => this.CONSUME(MermaidTokens.CircleArrow) },
          ]);
          this.OPTION(() => this.SUBRULE(this.edgeLabel));
        }
      },
      // Lines with optional labels: ---|label|, -.-|label|, etc.
      {
        ALT: () => {
          this.OR3([
            { ALT: () => this.CONSUME(MermaidTokens.SolidLine) },
            { ALT: () => this.CONSUME(MermaidTokens.DottedLine) },
            { ALT: () => this.CONSUME(MermaidTokens.ThickLine) },
          ]);
          this.OPTION2(() => this.SUBRULE2(this.edgeLabel));
        }
      },
    ]);
  });

  /**
   * Edge label between pipes: |label|
   */
  public edgeLabel = this.RULE('edgeLabel', () => {
    this.CONSUME(MermaidTokens.Pipe);
    this.SUBRULE(this.nodeLabel);
    this.CONSUME2(MermaidTokens.Pipe);
  });

  /**
   * Subgraph definition
   */
  public subgraphDefinition = this.RULE('subgraphDefinition', () => {
    this.CONSUME(MermaidTokens.SubgraphKeyword);
    // Only consume title if it's explicitly quoted
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(MermaidTokens.StringLiteral) },
        { ALT: () => this.CONSUME(MermaidTokens.SingleQuoteString) },
      ]);
    });
    this.MANY(() => this.SUBRULE(this.statement));
    this.CONSUME(MermaidTokens.EndKeyword);
  });

  /**
   * Class definition: classDef className fill:#color
   */
  public classDefinition = this.RULE('classDefinition', () => {
    this.CONSUME(MermaidTokens.ClassDefKeyword);
    this.CONSUME(MermaidTokens.NodeId); // Class name
    this.OPTION(() => this.SUBRULE(this.styleProperty));
  });

  /**
   * Style property for classes
   */
  public styleProperty = this.RULE('styleProperty', () => {
    this.CONSUME(MermaidTokens.NodeId); // Property name (fill, stroke, etc.)
    this.CONSUME(MermaidTokens.Colon);
    this.OR([
      { ALT: () => this.CONSUME(MermaidTokens.StringLiteral) },
      { ALT: () => this.CONSUME(MermaidTokens.Text) },
      { ALT: () => this.CONSUME2(MermaidTokens.NodeId) },
    ]);
  });

  /**
   * Class assignment: class nodeList className
   */
  public classAssignment = this.RULE('classAssignment', () => {
    this.CONSUME(MermaidTokens.ClassKeyword);
    this.SUBRULE(this.nodeList);
    this.CONSUME(MermaidTokens.NodeId); // Class name
  });

  /**
   * Node list for class assignments: A,B,C
   */
  public nodeList = this.RULE('nodeList', () => {
    this.CONSUME(MermaidTokens.NodeId);
    this.MANY(() => {
      this.CONSUME(MermaidTokens.Comma);
      this.CONSUME2(MermaidTokens.NodeId);
    });
  });

  /**
   * Click definition: click nodeId callback
   */
  public clickDefinition = this.RULE('clickDefinition', () => {
    this.CONSUME(MermaidTokens.ClickKeyword);
    this.CONSUME(MermaidTokens.NodeId);
    this.OR([
      { ALT: () => this.CONSUME(MermaidTokens.StringLiteral) },
      { ALT: () => this.CONSUME2(MermaidTokens.NodeId) },
    ]);
  });
}

/**
 * Parser instance
 */
export const mermaidParser = new MermaidParser();

/**
 * Parse Mermaid text into a Concrete Syntax Tree
 */
export function parseMermaid(text: string): {
  cst: any;
  lexErrors: any[];
  parseErrors: any[];
  success: boolean;
} {
  // First tokenize the input
  const lexResult = tokenizeMermaid(text);
  
  if (!lexResult.success) {
    return {
      cst: null,
      lexErrors: lexResult.errors,
      parseErrors: [],
      success: false,
    };
  }

  // Reset parser state
  mermaidParser.input = lexResult.tokens;

  // Parse the tokens
  const cst = mermaidParser.flowchart();
  
  return {
    cst,
    lexErrors: lexResult.errors,
    parseErrors: mermaidParser.errors,
    success: lexResult.success && mermaidParser.errors.length === 0,
  };
}

/**
 * Validate Mermaid syntax using the parser
 */
export function validateMermaidParse(text: string): {
  isValid: boolean;
  errors: string[];
  cst?: any;
} {
  const result = parseMermaid(text);
  
  const allErrors: string[] = [];
  
  // Add lexing errors
  if (result.lexErrors.length > 0) {
    allErrors.push(...result.lexErrors.map((error: any) => 
      `Lexing error at line ${error.line}, column ${error.column}: ${error.message}`
    ));
  }
  
  // Add parsing errors
  if (result.parseErrors.length > 0) {
    allErrors.push(...result.parseErrors.map((error: any) => 
      `Parse error at line ${error.token?.startLine || 'unknown'}, column ${error.token?.startColumn || 'unknown'}: ${error.message}`
    ));
  }
  
  return {
    isValid: result.success,
    errors: allErrors,
    cst: result.success ? result.cst : undefined,
  };
}

/**
 * Get parsing performance metrics
 */
export function getMermaidParsingMetrics(text: string): {
  lexingTime: number;
  parsingTime: number;
  totalTime: number;
  tokenCount: number;
  success: boolean;
} {
  const startTime = performance.now();
  
  // Tokenize
  const lexStart = performance.now();
  const lexResult = tokenizeMermaid(text);
  const lexEnd = performance.now();
  
  // Parse
  const parseStart = performance.now();
  mermaidParser.input = lexResult.tokens;
  // Clear previous errors
  mermaidParser.errors = [];
  mermaidParser.flowchart();
  const parseEnd = performance.now();
  
  const endTime = performance.now();
  
  return {
    lexingTime: lexEnd - lexStart,
    parsingTime: parseEnd - parseStart,
    totalTime: endTime - startTime,
    tokenCount: lexResult.tokens.length,
    success: lexResult.success && mermaidParser.errors.length === 0,
  };
}

// Export types for external use
export type MermaidCst = ReturnType<typeof mermaidParser.flowchart>;
export type ParseResult = ReturnType<typeof parseMermaid>;
export type ValidationResult = ReturnType<typeof validateMermaidParse>;
export type ParsingMetrics = ReturnType<typeof getMermaidParsingMetrics>;