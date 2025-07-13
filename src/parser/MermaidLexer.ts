import { createToken, Lexer } from 'chevrotain';

/**
 * Mermaid Lexer using Chevrotain for parsing Mermaid flowchart syntax
 * 
 * Supports:
 * - Flowchart declarations (flowchart TD, graph LR, etc.)
 * - Node definitions with various shapes
 * - Edge definitions with different arrow styles
 * - Node labels with text
 * - Comments and whitespace handling
 */

// Whitespace - must be defined first to be skipped
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// Comments - Skip %% comments
export const Comment = createToken({
  name: 'Comment',
  pattern: /%%[^\r\n]*/,
  group: Lexer.SKIPPED,
});

// Keywords
export const FlowchartKeyword = createToken({
  name: 'FlowchartKeyword',
  pattern: /flowchart|graph/,
});

export const Direction = createToken({
  name: 'Direction',
  pattern: /TD|TB|BT|RL|LR/,
});

export const SubgraphKeyword = createToken({
  name: 'SubgraphKeyword',
  pattern: /subgraph/,
});

export const EndKeyword = createToken({
  name: 'EndKeyword',
  pattern: /end/,
});

// Arrows and connections
export const SolidArrow = createToken({
  name: 'SolidArrow',
  pattern: /-->/,
});

export const DottedArrow = createToken({
  name: 'DottedArrow',
  pattern: /-\.->/,
});

export const ThickArrow = createToken({
  name: 'ThickArrow',
  pattern: /==>/,
});

export const CrossArrow = createToken({
  name: 'CrossArrow',
  pattern: /--x/,
});

export const CircleArrow = createToken({
  name: 'CircleArrow',
  pattern: /--o/,
});

export const SolidLine = createToken({
  name: 'SolidLine',
  pattern: /---/,
});

export const DottedLine = createToken({
  name: 'DottedLine',
  pattern: /-\.-/,
});

export const ThickLine = createToken({
  name: 'ThickLine',
  pattern: /===/,
});

// Node shapes - order matters for proper matching
export const SquareBracketOpen = createToken({
  name: 'SquareBracketOpen',
  pattern: /\[\[/,
});

export const SquareBracketClose = createToken({
  name: 'SquareBracketClose',
  pattern: /\]\]/,
});

export const RectangleOpen = createToken({
  name: 'RectangleOpen',
  pattern: /\[/,
});

export const RectangleClose = createToken({
  name: 'RectangleClose',
  pattern: /\]/,
});

export const RoundOpen = createToken({
  name: 'RoundOpen',
  pattern: /\(/,
});

export const RoundClose = createToken({
  name: 'RoundClose',
  pattern: /\)/,
});

export const CurlyOpen = createToken({
  name: 'CurlyOpen',
  pattern: /\{/,
});

export const CurlyClose = createToken({
  name: 'CurlyClose',
  pattern: /\}/,
});

export const DiamondOpen = createToken({
  name: 'DiamondOpen',
  pattern: /\{\{/,
});

export const DiamondClose = createToken({
  name: 'DiamondClose',
  pattern: /\}\}/,
});

export const CircleOpen = createToken({
  name: 'CircleOpen',
  pattern: /\(\(/,
});

export const CircleClose = createToken({
  name: 'CircleClose',
  pattern: /\)\)/,
});

export const AsymmetricOpen = createToken({
  name: 'AsymmetricOpen',
  pattern: />/,
});

export const AsymmetricClose = createToken({
  name: 'AsymmetricClose',
  pattern: /</,
});

// Edge labels and text
export const Pipe = createToken({
  name: 'Pipe',
  pattern: /\|/,
});

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"([^"\\]|\\.)*"/,
});

export const SingleQuoteString = createToken({
  name: 'SingleQuoteString',
  pattern: /'([^'\\]|\\.)*'/,
});

// Identifiers and text
export const NodeId = createToken({
  name: 'NodeId',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const Text = createToken({
  name: 'Text',
  pattern: /[^|[\](){}><"'\s-]+/,
});

// Special characters
export const Semicolon = createToken({
  name: 'Semicolon',
  pattern: /;/,
});

export const Colon = createToken({
  name: 'Colon',
  pattern: /:/,
});

export const Newline = createToken({
  name: 'Newline',
  pattern: /\r?\n/,
});

// CSS class definitions
export const ClassDefKeyword = createToken({
  name: 'ClassDefKeyword',
  pattern: /classDef/,
});

export const ClassKeyword = createToken({
  name: 'ClassKeyword',
  pattern: /class/,
});

export const ClickKeyword = createToken({
  name: 'ClickKeyword',
  pattern: /click/,
});

// All tokens in order (more specific patterns first)
export const allTokens = [
  // Whitespace and comments (skipped)
  WhiteSpace,
  Comment,
  
  // Multi-character tokens first
  FlowchartKeyword,
  SubgraphKeyword,
  ClassDefKeyword,
  ClassKeyword,
  ClickKeyword,
  EndKeyword,
  
  Direction,
  
  // Arrows (more specific first)
  SolidArrow,
  DottedArrow,
  ThickArrow,
  CrossArrow,
  CircleArrow,
  
  // Lines
  SolidLine,
  DottedLine,
  ThickLine,
  
  // Node shapes (more specific first)
  SquareBracketOpen,
  SquareBracketClose,
  DiamondOpen,
  DiamondClose,
  CircleOpen,
  CircleClose,
  RectangleOpen,
  RectangleClose,
  RoundOpen,
  RoundClose,
  CurlyOpen,
  CurlyClose,
  
  // Single character shapes
  AsymmetricOpen,
  AsymmetricClose,
  
  // Strings
  StringLiteral,
  SingleQuoteString,
  
  // Special characters
  Pipe,
  Semicolon,
  Colon,
  Newline,
  
  // Identifiers and text (least specific)
  NodeId,
  Text,
];

/**
 * Mermaid Lexer instance
 */
export const mermaidLexer = new Lexer(allTokens, {
  // Enable position tracking for better error messages
  positionTracking: 'full',
  
  // Required line terminator characters for v10.5.0
  lineTerminatorCharacters: ['\n', '\r\n'],
  
  // Skip validation for performance in production
  skipValidations: process.env.NODE_ENV === 'production',
});

/**
 * Tokenize Mermaid diagram text
 * @param text - Mermaid diagram text to tokenize
 * @returns Lexing result with tokens and errors
 */
export function tokenizeMermaid(text: string): {
  tokens: any[];
  errors: any[];
  errorMessages: string[];
  success: boolean;
} {
  const lexingResult = mermaidLexer.tokenize(text);
  
  if (lexingResult.errors.length > 0) {
    const errorMessages = lexingResult.errors.map((error: any) => 
      `Lexing error at line ${error.line}, column ${error.column}: ${error.message}`
    );
    
    return {
      tokens: lexingResult.tokens,
      errors: lexingResult.errors,
      errorMessages,
      success: false,
    };
  }
  
  return {
    tokens: lexingResult.tokens,
    errors: [],
    errorMessages: [],
    success: true,
  };
}

/**
 * Validate Mermaid syntax at lexical level
 * @param text - Mermaid diagram text to validate
 * @returns Validation result
 */
export function validateMermaidSyntax(text: string): {
  isValid: boolean;
  errors: string[];
  tokens: any[];
} {
  const result = tokenizeMermaid(text);
  
  if (!result.success) {
    return {
      isValid: false,
      errors: result.errorMessages,
      tokens: result.tokens,
    };
  }
  
  // Basic validation - should start with flowchart or graph
  const firstToken = result.tokens.find(token => token.tokenType !== WhiteSpace);
  const isValidStart = firstToken && 
    (firstToken.tokenType === FlowchartKeyword);
  
  if (!isValidStart) {
    return {
      isValid: false,
      errors: ['Mermaid diagram must start with "flowchart" or "graph" keyword'],
      tokens: result.tokens,
    };
  }
  
  return {
    isValid: true,
    errors: [],
    tokens: result.tokens,
  };
}

/**
 * Get performance metrics for lexing
 * @param text - Text to analyze
 * @returns Performance metrics
 */
export function getMermaidLexingMetrics(text: string): {
  lexingTime: number;
  tokenCount: number;
  characterCount: number;
  tokensPerMs: number;
  success: boolean;
} {
  const startTime = performance.now();
  const result = tokenizeMermaid(text);
  const endTime = performance.now();
  
  return {
    lexingTime: endTime - startTime,
    tokenCount: result.tokens.length,
    characterCount: text.length,
    tokensPerMs: result.tokens.length / (endTime - startTime),
    success: result.success,
  };
}

// Export token types for use in parser
export const MermaidTokens = {
  WhiteSpace,
  Comment,
  FlowchartKeyword,
  Direction,
  SubgraphKeyword,
  EndKeyword,
  SolidArrow,
  DottedArrow,
  ThickArrow,
  CrossArrow,
  CircleArrow,
  SolidLine,
  DottedLine,
  ThickLine,
  SquareBracketOpen,
  SquareBracketClose,
  RectangleOpen,
  RectangleClose,
  RoundOpen,
  RoundClose,
  CurlyOpen,
  CurlyClose,
  DiamondOpen,
  DiamondClose,
  CircleOpen,
  CircleClose,
  AsymmetricOpen,
  AsymmetricClose,
  Pipe,
  StringLiteral,
  SingleQuoteString,
  NodeId,
  Text,
  Semicolon,
  Colon,
  Newline,
  ClassDefKeyword,
  ClassKeyword,
  ClickKeyword,
};