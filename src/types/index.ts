/**
 * Central export point for all type definitions
 * 
 * This file provides a single import location for all call graph types,
 * making it easier to consume types throughout the application.
 * 
 * @example
 * ```typescript
 * import { CallGraph, CallGraphNode, CallGraphEdge } from '../types';
 * ```
 */

// Core call graph data structures
export * from './CallGraph';

// Formatter interfaces
export * from './Formatter';

// Re-export commonly used types for convenience
export type {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
  CallGraphMetadata,
  CallGraphParameter,
  CallGraphAnalysisOptions,
  CallGraphMetrics,
  CallGraphValidationResult,
  CallGraphSpecification,
  OutputFormat,
  AnalysisError,
  EntryPointLocation,
  ProjectContext,
} from './CallGraph';

export type {
  Formatter,
  FormatOptions,
  ValidationResult,
  CircularReferenceStrategy,
} from './Formatter';

// Re-export error classes
export { CallGraphError } from './CallGraph';