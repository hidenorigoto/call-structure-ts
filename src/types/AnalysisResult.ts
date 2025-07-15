import { CallGraphNode, CallGraphEdge } from './CallGraph';

export interface AnalysisResult {
  filePath: string;
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  imports: string[];
  exports: string[];
  analyzedAt: string;
  fileHash?: string;
  metrics?: {
    functionCount: number;
    classCount: number;
    complexity?: number;
  };
}
