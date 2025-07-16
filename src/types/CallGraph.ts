/**
 * Core data structures for call graph analysis
 */

export interface CallGraphNode {
  id: string;
  name: string;
  filePath: string;
  line: number;
  column?: number;
  type: 'function' | 'method' | 'arrow' | 'constructor' | 'accessor';
  async: boolean;
  static?: boolean;
  visibility?: 'public' | 'private' | 'protected';
  parameters: CallGraphParameter[];
  returnType: string;
  className?: string;
}

export interface CallGraphParameter {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string | undefined;
}

export interface CallGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'sync' | 'async' | 'callback' | 'constructor';
  line: number;
  column?: number;
  argumentTypes?: string[];
  conditional?: boolean;
}

export interface CallGraphMetadata {
  generatedAt: string;
  entryPoint: string;
  maxDepth: number;
  projectRoot: string;
  tsConfigPath?: string | undefined;
  totalFiles: number;
  analysisTimeMs: number;
  performance?: {
    analysisTime: number;
    totalNodes: number;
    totalEdges: number;
    memoryUsage: number;
    filesAnalyzed: number;
    nodesPerSecond: number;
    averageDepth: number;
  };
}

export interface CallGraph {
  metadata: CallGraphMetadata;
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  entryPointId: string;
}

export interface CallGraphMetrics {
  totalFunctions: number;
  totalCalls: number;
  asyncFunctions: number;
  maxDepth: number;
  averageFanOut: number;
  averageFanIn: number;
  circularDependencies: string[][];
  hotspots: Array<{
    nodeId: string;
    functionName: string;
    callCount: number;
  }>;
  complexity: {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
  };
}

export interface CallGraphAnalysisOptions {
  maxDepth?: number;
  includeNodeModules?: boolean;
  includeTestFiles?: boolean;
  excludePatterns?: RegExp[];
  includePatterns?: RegExp[];
  followImports?: boolean;
  analyzeCallbacks?: boolean;
  collectMetrics?: boolean;
}

export interface CallGraphValidationResult {
  isValid: boolean;
  errors: CallGraphValidationError[];
  warnings: CallGraphValidationWarning[];
  summary: {
    requiredEdgesFound: number;
    requiredEdgesTotal: number;
    forbiddenEdgesFound: number;
    missingNodes: string[];
    unexpectedNodes: string[];
  };
}

export interface CallGraphValidationError {
  type: 'missing_edge' | 'forbidden_edge' | 'missing_node' | 'type_mismatch';
  message: string;
  expected?: unknown;
  actual?: unknown;
  location?: {
    file: string;
    line: number;
  };
}

export interface CallGraphValidationWarning {
  type: 'performance' | 'complexity' | 'pattern';
  message: string;
  suggestion?: string;
  location?: {
    file: string;
    line: number;
  };
}

export interface CallGraphSpecification {
  entryPoint: string;
  requiredEdges: Array<{
    from: string;
    to: string;
    type: CallGraphEdge['type'];
  }>;
  forbiddenEdges: Array<{
    from: string;
    to: string;
    type?: CallGraphEdge['type'];
  }>;
  requiredNodes?: string[];
  forbiddenNodes?: string[];
  maxDepth?: number;
  maxComplexity?: number;
}

export type OutputFormat = 'json' | 'yaml' | 'mermaid' | 'dot' | 'markdown';

export interface FormatterOptions {
  format: OutputFormat;
  includeMetadata?: boolean;
  includeMetrics?: boolean;
  prettify?: boolean;
  colors?: boolean;
}

export interface AnalysisError extends Error {
  code: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

export class CallGraphError extends Error {
  constructor(
    message: string,
    public code: string,
    public file?: string,
    public line?: number,
    public column?: number
  ) {
    super(message);
    this.name = 'CallGraphError';
  }
}

export interface EntryPointLocation {
  filePath: string;
  functionName: string;
  className?: string | undefined;
  exportName?: string | undefined;
}

export interface ProjectContext {
  rootPath: string;
  tsConfigPath?: string | undefined;
  packageJsonPath?: string | undefined;
  sourcePatterns: string[];
  excludePatterns: string[];
}
