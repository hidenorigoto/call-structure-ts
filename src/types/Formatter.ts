import { CallGraph } from './CallGraph';
import { Writable } from 'stream';

/**
 * Base interface for all call graph formatters
 */
export interface Formatter {
  /**
   * Format a call graph to string representation
   * @param graph The call graph to format
   * @param options Optional formatting options
   * @returns Formatted string representation
   */
  format(graph: CallGraph, options?: FormatOptions): string;

  /**
   * Stream format a call graph to a writable stream
   * @param graph The call graph to format
   * @param stream The writable stream to output to
   * @param options Optional formatting options
   */
  formatStream(graph: CallGraph, stream: Writable, options?: FormatOptions): void;

  /**
   * Validate the formatter output
   * @param output The formatted output to validate
   * @returns Validation result
   */
  validate(output: string): ValidationResult;
}

/**
 * Enhanced format options for formatters
 */
export interface FormatOptions {
  /** Output format type */
  format?: 'json' | 'yaml' | 'mermaid' | 'dot' | 'markdown';
  
  /** Include metadata in output */
  includeMetadata?: boolean;
  
  /** Include metrics/statistics in output */
  includeMetrics?: boolean;
  
  /** Pretty print the output */
  prettify?: boolean;
  
  /** Include colors in output (for supported formats) */
  colors?: boolean;
  
  /** Maximum depth to include in output */
  maxDepth?: number;
  
  /** Filter out external dependencies */
  filterExternal?: boolean;
  
  /** Strategy for handling circular references */
  circularReferenceStrategy?: 'omit' | 'reference' | 'inline-once';
  
  /** Chunk size for streaming large graphs */
  chunkSize?: number;
}

/**
 * Validation result for formatter output
 */
export interface ValidationResult {
  /** Whether the output is valid */
  isValid: boolean;
  
  /** Error message if validation failed */
  error?: string;
  
  /** Warning messages */
  warnings?: string[];
}

/**
 * Circular reference handling strategies
 */
export enum CircularReferenceStrategy {
  /** Omit circular references entirely */
  OMIT = 'omit',
  
  /** Replace with reference ID */
  REFERENCE = 'reference',
  
  /** Include full object once, then use references */
  INLINE_ONCE = 'inline-once'
}