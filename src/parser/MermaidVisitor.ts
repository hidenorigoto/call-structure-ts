import { CstNode, CstChildrenDictionary, IToken } from 'chevrotain';
import { mermaidParser } from './MermaidParser';
import { 
  CallGraph, 
  CallGraphNode, 
  CallGraphEdge,
  CallGraphMetadata 
} from '../types/CallGraph';

/**
 * Visitor for transforming Mermaid CST to CallGraph format
 * 
 * This visitor walks the Concrete Syntax Tree produced by MermaidParser
 * and extracts nodes and edges to build a CallGraph structure.
 * 
 * Supports:
 * - Node definitions with various shapes mapped to function types
 * - Edge definitions with arrow styles mapped to call types
 * - Subgraph handling for grouping related nodes
 * - Class definitions for styling (mapped to metadata)
 */
export class MermaidToCallGraphVisitor extends mermaidParser.getBaseCstVisitorConstructor() {
  private nodes: Map<string, CallGraphNode> = new Map();
  private edges: CallGraphEdge[] = [];
  private nodeIdCounter = 0;
  private edgeIdCounter = 0;
  private currentSubgraph: string | null = null;
  private nodeClasses: Map<string, string> = new Map();
  private classDefs: Map<string, Record<string, string>> = new Map();

  constructor() {
    super();
    this.validateVisitor();
  }

  /**
   * Main entry point - visit flowchart
   */
  flowchart(ctx: CstChildrenDictionary): CallGraph {
    // Reset state
    this.nodes.clear();
    this.edges = [];
    this.nodeIdCounter = 0;
    this.edgeIdCounter = 0;
    this.currentSubgraph = null;
    this.nodeClasses.clear();
    this.classDefs.clear();

    // Process all statements
    if (ctx.statement) {
      ctx.statement.forEach((stmt) => {
        if ('children' in stmt) {
          this.visit(stmt);
        }
      });
    }

    // Build metadata
    const metadata: CallGraphMetadata = {
      generatedAt: new Date().toISOString(),
      entryPoint: 'mermaid-diagram',
      maxDepth: this.calculateMaxDepth(),
      projectRoot: process.cwd(),
      totalFiles: 1,
      analysisTimeMs: 0,
    };

    // Find entry point (first node or explicitly marked)
    const entryPointId = this.findEntryPoint();

    return {
      metadata,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      entryPointId,
    };
  }

  /**
   * Handle statement types
   */
  statement(ctx: CstChildrenDictionary): void {
    if (ctx.nodeOrEdgeStatement) {
      this.visit(ctx.nodeOrEdgeStatement[0] as CstNode);
    } else if (ctx.subgraphDefinition) {
      this.visit(ctx.subgraphDefinition[0] as CstNode);
    } else if (ctx.classDefinition) {
      this.visit(ctx.classDefinition[0] as CstNode);
    } else if (ctx.classAssignment) {
      this.visit(ctx.classAssignment[0] as CstNode);
    } else if (ctx.clickDefinition) {
      this.visit(ctx.clickDefinition[0] as CstNode);
    }
  }

  /**
   * Handle node or edge statements
   */
  nodeOrEdgeStatement(ctx: CstChildrenDictionary): void {
    if (!ctx.first || ctx.first.length === 0) {
      return;
    }
    const firstNodeId = (ctx.first[0] as IToken).image;
    
    // Create first node if it has a shape or if it's standalone
    if (ctx.nodeShape || !ctx.edgeType) {
      const shape = ctx.nodeShape ? this.visit(ctx.nodeShape[0] as CstNode) : null;
      this.createNode(firstNodeId, shape);
    }

    // Process edges if any
    if (ctx.edgeType && ctx.target) {
      for (let i = 0; i < ctx.edgeType.length; i++) {
        const sourceId = i === 0 ? firstNodeId : (ctx.target[i - 1] as IToken).image;
        const targetId = (ctx.target[i] as IToken).image;
        const edgeType = this.visit(ctx.edgeType[i] as CstNode);

        // Create target node if it has a shape
        if (ctx.nodeShape && ctx.nodeShape[i + 1]) {
          const targetShape = this.visit(ctx.nodeShape[i + 1] as CstNode);
          this.createNode(targetId, targetShape);
        }

        // Create edge
        this.createEdge(sourceId, targetId, edgeType);
      }
    }
  }

  /**
   * Extract node shape and label
   */
  nodeShape(ctx: CstChildrenDictionary): { shape: string; label: string } {
    let shape = 'rectangle';
    let label = '';

    if (ctx.RectangleOpen) {
      shape = 'rectangle';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    } else if (ctx.RoundOpen) {
      shape = 'round';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    } else if (ctx.DiamondOpen) {
      shape = 'diamond';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    } else if (ctx.CircleOpen) {
      shape = 'circle';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    } else if (ctx.SquareBracketOpen) {
      shape = 'subroutine';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    } else if (ctx.CurlyOpen) {
      shape = 'curly';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    } else if (ctx.AsymmetricOpen) {
      shape = 'asymmetric';
      label = ctx.nodeLabel ? this.visit(ctx.nodeLabel[0] as CstNode) : '';
    }

    return { shape, label };
  }

  /**
   * Extract node label text
   */
  nodeLabel(ctx: CstChildrenDictionary): string {
    if (ctx.StringLiteral) {
      // Remove quotes
      return (ctx.StringLiteral[0] as IToken).image.slice(1, -1);
    } else if (ctx.SingleQuoteString) {
      // Remove quotes
      return (ctx.SingleQuoteString[0] as IToken).image.slice(1, -1);
    } else if (ctx.NodeId) {
      // Concatenate all NodeId and Text tokens
      let label = (ctx.NodeId[0] as IToken).image;
      if (ctx.NodeId.length > 1) {
        for (let i = 1; i < ctx.NodeId.length; i++) {
          label += ' ' + (ctx.NodeId[i] as IToken).image;
        }
      }
      if (ctx.Text) {
        ctx.Text.forEach((text) => {
          label += ' ' + (text as IToken).image;
        });
      }
      return label;
    }
    return '';
  }

  /**
   * Extract edge type and label
   */
  edgeType(ctx: CstChildrenDictionary): { type: string; label?: string } {
    let type = 'solid';
    let label: string | undefined;

    if (ctx.SolidArrow) {
      type = 'solid-arrow';
    } else if (ctx.DottedArrow) {
      type = 'dotted-arrow';
    } else if (ctx.ThickArrow) {
      type = 'thick-arrow';
    } else if (ctx.CrossArrow) {
      type = 'cross-arrow';
    } else if (ctx.CircleArrow) {
      type = 'circle-arrow';
    } else if (ctx.SolidLine) {
      type = 'solid-line';
    } else if (ctx.DottedLine) {
      type = 'dotted-line';
    } else if (ctx.ThickLine) {
      type = 'thick-line';
    }

    if (ctx.edgeLabel) {
      label = this.visit(ctx.edgeLabel[0] as CstNode);
    }

    return { type, label };
  }

  /**
   * Extract edge label
   */
  edgeLabel(ctx: CstChildrenDictionary): string {
    if (ctx.nodeLabel) {
      return this.visit(ctx.nodeLabel[0] as CstNode);
    }
    return '';
  }

  /**
   * Handle subgraph definitions
   */
  subgraphDefinition(ctx: CstChildrenDictionary): void {
    const previousSubgraph = this.currentSubgraph;
    
    // Extract subgraph title if present
    if (ctx.StringLiteral) {
      this.currentSubgraph = (ctx.StringLiteral[0] as IToken).image.slice(1, -1);
    } else if (ctx.SingleQuoteString) {
      this.currentSubgraph = (ctx.SingleQuoteString[0] as IToken).image.slice(1, -1);
    } else {
      this.currentSubgraph = `subgraph_${this.nodeIdCounter++}`;
    }

    // Process statements within subgraph
    if (ctx.statement) {
      ctx.statement.forEach((stmt) => {
        if ('children' in stmt) {
          this.visit(stmt);
        }
      });
    }

    // Restore previous subgraph context
    this.currentSubgraph = previousSubgraph;
  }

  /**
   * Handle class definitions
   */
  classDefinition(ctx: CstChildrenDictionary): void {
    const className = (ctx.NodeId[0] as IToken).image;
    const styleProperty = ctx.styleProperty ? this.visit(ctx.styleProperty[0] as CstNode) : null;
    this.classDefs.set(className, styleProperty);
  }

  /**
   * Extract style property
   */
  styleProperty(ctx: CstChildrenDictionary): Record<string, string> {
    const propertyName = (ctx.NodeId[0] as IToken).image;
    let propertyValue = '';
    
    if (ctx.StringLiteral) {
      propertyValue = (ctx.StringLiteral[0] as IToken).image.slice(1, -1);
    } else if (ctx.Text) {
      propertyValue = (ctx.Text[0] as IToken).image;
    } else if (ctx.NodeId && ctx.NodeId[1]) {
      propertyValue = (ctx.NodeId[1] as IToken).image;
    }

    return { [propertyName]: propertyValue };
  }

  /**
   * Handle class assignments
   */
  classAssignment(ctx: CstChildrenDictionary): void {
    const nodeList = this.visit(ctx.nodeList[0] as CstNode) as string[];
    const className = (ctx.NodeId[0] as IToken).image;
    
    nodeList.forEach((nodeId: string) => {
      this.nodeClasses.set(nodeId, className);
    });
  }

  /**
   * Extract node list
   */
  nodeList(ctx: CstChildrenDictionary): string[] {
    const nodes = [(ctx.NodeId[0] as IToken).image];
    if (ctx.NodeId.length > 1) {
      for (let i = 1; i < ctx.NodeId.length; i++) {
        nodes.push((ctx.NodeId[i] as IToken).image);
      }
    }
    return nodes;
  }

  /**
   * Handle click definitions
   */
  clickDefinition(_ctx: CstChildrenDictionary): void {
    // Ignore click definitions for now
  }

  /**
   * Create a node in the graph
   */
  private createNode(nodeId: string, shape: { shape: string; label: string } | null): void {
    if (this.nodes.has(nodeId)) {
      return; // Node already exists
    }

    const node: CallGraphNode = {
      id: `node_${this.nodeIdCounter++}`,
      name: shape?.label || nodeId,
      filePath: 'mermaid-diagram',
      line: 0,
      type: this.mapShapeToType(shape?.shape),
      async: false,
      parameters: [],
      returnType: 'unknown',
    };

    // Add subgraph info if present
    if (this.currentSubgraph) {
      node.className = this.currentSubgraph;
    }

    this.nodes.set(nodeId, node);
  }

  /**
   * Create an edge in the graph
   */
  private createEdge(sourceId: string, targetId: string, edgeInfo: { type: string; label?: string }): void {
    // Ensure both nodes exist
    if (!this.nodes.has(sourceId)) {
      this.createNode(sourceId, null);
    }
    if (!this.nodes.has(targetId)) {
      this.createNode(targetId, null);
    }

    const sourceNode = this.nodes.get(sourceId)!;
    const targetNode = this.nodes.get(targetId)!;

    const edge: CallGraphEdge = {
      id: `edge_${this.edgeIdCounter++}`,
      source: sourceNode.id,
      target: targetNode.id,
      type: this.mapEdgeTypeToCallType(edgeInfo.type),
      line: 0,
    };

    this.edges.push(edge);
  }

  /**
   * Map Mermaid shape to CallGraph function type
   */
  private mapShapeToType(shape?: string): CallGraphNode['type'] {
    switch (shape) {
      case 'diamond':
        return 'method'; // Decision points as methods
      case 'curly':
        return 'method'; // Curly braces are also decision points
      case 'circle':
      case 'round':
        return 'function'; // Regular functions
      case 'subroutine':
        return 'method'; // Subroutines as methods
      case 'asymmetric':
        return 'arrow'; // Special shape as arrow function
      default:
        return 'function';
    }
  }

  /**
   * Map Mermaid edge type to CallGraph call type
   */
  private mapEdgeTypeToCallType(edgeType: string): CallGraphEdge['type'] {
    if (edgeType === 'dotted-arrow' || edgeType === 'dotted-line') {
      return 'async'; // Dotted lines as async calls
    } else if (edgeType === 'thick-arrow' || edgeType === 'thick-line') {
      return 'constructor'; // Thick lines as constructor calls
    } else if (edgeType.includes('line')) {
      return 'callback'; // Regular lines as callbacks
    } else {
      return 'sync'; // Arrows represent direct calls
    }
  }

  /**
   * Calculate maximum depth of the graph
   */
  private calculateMaxDepth(): number {
    if (this.nodes.size === 0) return 0;
    
    const visited = new Set<string>();
    const depths = new Map<string, number>();
    
    const calculateNodeDepth = (nodeId: string, currentDepth: number): number => {
      if (visited.has(nodeId)) {
        return depths.get(nodeId) || 0;
      }
      
      visited.add(nodeId);
      let maxChildDepth = currentDepth;
      
      // Find all edges from this node
      const outgoingEdges = this.edges.filter(e => e.source === nodeId);
      
      for (const edge of outgoingEdges) {
        const childDepth = calculateNodeDepth(edge.target, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
      
      depths.set(nodeId, maxChildDepth);
      return maxChildDepth;
    };
    
    let maxDepth = 0;
    for (const [, node] of this.nodes) {
      if (!visited.has(node.id)) {
        maxDepth = Math.max(maxDepth, calculateNodeDepth(node.id, 1));
      }
    }
    
    return maxDepth;
  }

  /**
   * Find the entry point node
   */
  private findEntryPoint(): string {
    // Find nodes with no incoming edges
    const nodesWithIncoming = new Set(this.edges.map(e => e.target));
    
    for (const [, node] of this.nodes) {
      if (!nodesWithIncoming.has(node.id)) {
        return node.id;
      }
    }
    
    // If all nodes have incoming edges, return the first one
    return this.nodes.values().next().value?.id || '';
  }
}

/**
 * Transform Mermaid CST to CallGraph
 */
export function mermaidCstToCallGraph(cst: CstNode): CallGraph {
  const visitor = new MermaidToCallGraphVisitor();
  return visitor.visit(cst);
}

/**
 * Parse and transform Mermaid text to CallGraph
 */
export function mermaidToCallGraph(mermaidText: string): CallGraph | null {
  // Import at top of file, using dynamic import here for now
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseMermaid } = require('./MermaidParser');
  const parseResult = parseMermaid(mermaidText);
  
  if (!parseResult.success) {
    return null;
  }
  
  return mermaidCstToCallGraph(parseResult.cst);
}