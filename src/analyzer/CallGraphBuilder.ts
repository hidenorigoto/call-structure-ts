import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
  CallGraphMetadata,
  CallGraphMetrics,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Interface for graph filtering options
 */
export interface GraphFilterOptions {
  nodeTypes?: CallGraphNode['type'][];
  edgeTypes?: CallGraphEdge['type'][];
  filePatterns?: RegExp[];
  excludePatterns?: RegExp[];
}

/**
 * Interface for traversal options
 */
export interface TraversalOptions {
  visitedCallback?: (nodeId: string, depth: number) => void;
  edgeCallback?: (edge: CallGraphEdge, depth: number) => void;
  maxDepth?: number;
}

/**
 * Call Graph Builder for constructing complete call graphs from individual analyses.
 * 
 * This class provides robust graph construction capabilities including:
 * - Node and edge management with deduplication
 * - Circular dependency detection using DFS-based algorithms
 * - Graph traversal methods (DFS, BFS)
 * - Subgraph extraction with configurable depth limits
 * - Performance optimization for large graphs
 * 
 * @example
 * ```typescript
 * const builder = new CallGraphBuilder();
 * builder.addNode(functionNode);
 * builder.addEdge(callEdge);
 * const graph = builder.build();
 * const cycles = builder.detectCycles();
 * ```
 */
export class CallGraphBuilder {
  private nodes = new Map<string, CallGraphNode>();
  private edges = new Map<string, CallGraphEdge>();
  private adjacencyList = new Map<string, Set<string>>();
  private reverseAdjacencyList = new Map<string, Set<string>>();
  private metadata?: Partial<CallGraphMetadata>;

  /**
   * Add a node to the graph with automatic deduplication
   * 
   * @param node The node to add
   */
  addNode(node: CallGraphNode): void {
    if (!node.id || typeof node.id !== 'string') {
      throw new Error('Node must have a valid string id');
    }

    if (this.nodes.has(node.id)) {
      logger.debug(`Node ${node.id} already exists, skipping duplicate`);
      return;
    }

    // Validate required node properties
    if (!node.name || !node.filePath || typeof node.line !== 'number') {
      throw new Error(`Invalid node: missing required properties (name, filePath, line)`);
    }

    this.nodes.set(node.id, { ...node });
    
    // Initialize adjacency lists for this node
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.id)) {
      this.reverseAdjacencyList.set(node.id, new Set());
    }

    logger.debug(`Added node: ${node.id} (${node.type})`);
  }

  /**
   * Add an edge to the graph with duplicate prevention
   * 
   * @param edge The edge to add
   */
  addEdge(edge: CallGraphEdge): void {
    if (!edge.id || typeof edge.id !== 'string') {
      throw new Error('Edge must have a valid string id');
    }

    if (!edge.source || !edge.target) {
      throw new Error('Edge must have valid source and target node IDs');
    }

    if (this.edges.has(edge.id)) {
      logger.debug(`Edge ${edge.id} already exists, skipping duplicate`);
      return;
    }

    // Validate that source and target nodes exist or create placeholder nodes
    this.ensureNodeExists(edge.source);
    this.ensureNodeExists(edge.target);

    this.edges.set(edge.id, { ...edge });

    // Update adjacency lists
    this.adjacencyList.get(edge.source)!.add(edge.target);
    this.reverseAdjacencyList.get(edge.target)!.add(edge.source);

    logger.debug(`Added edge: ${edge.source} -> ${edge.target} (${edge.type})`);
  }

  /**
   * Set metadata for the graph
   * 
   * @param metadata Partial metadata to set
   */
  setMetadata(metadata: Partial<CallGraphMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Build the final CallGraph from accumulated nodes and edges
   * 
   * @param entryPointId Optional entry point ID for the graph
   * @returns Complete CallGraph object
   */
  build(entryPointId?: string): CallGraph {
    const defaultMetadata: CallGraphMetadata = {
      generatedAt: new Date().toISOString(),
      entryPoint: entryPointId || 'unknown',
      maxDepth: 10,
      projectRoot: process.cwd(),
      totalFiles: this.getUniqueFileCount(),
      analysisTimeMs: 0,
    };

    const finalMetadata = { ...defaultMetadata, ...this.metadata };

    const graph: CallGraph = {
      metadata: finalMetadata,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      entryPointId: entryPointId || finalMetadata.entryPoint,
    };

    logger.info(`Built call graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
    return graph;
  }

  /**
   * Detect circular dependencies in the graph using DFS-based cycle detection
   * 
   * @returns Array of cycles, where each cycle is an array of node IDs
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle, extract it from the path
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart >= 0) {
          const cycle = path.slice(cycleStart).concat([nodeId]);
          cycles.push(cycle);
        }
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (dfs(neighborId)) {
          // Continue searching for more cycles
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check all nodes to find all cycles
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    if (cycles.length > 0) {
      logger.warn(`Detected ${cycles.length} circular dependencies in the call graph`);
    }

    return cycles;
  }

  /**
   * Perform depth-first search traversal
   * 
   * @param startNodeId Starting node ID
   * @param options Traversal options
   * @returns Array of visited node IDs in DFS order
   */
  traverseDFS(startNodeId: string, options: TraversalOptions = {}): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const { visitedCallback, edgeCallback, maxDepth = Infinity } = options;

    const dfs = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId) || depth > maxDepth) {
        return;
      }

      visited.add(nodeId);
      result.push(nodeId);

      if (visitedCallback) {
        visitedCallback(nodeId, depth);
      }

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          // Find the edge for callback
          if (edgeCallback) {
            const edge = this.findEdge(nodeId, neighborId);
            if (edge) {
              edgeCallback(edge, depth);
            }
          }
          dfs(neighborId, depth + 1);
        }
      }
    };

    if (this.nodes.has(startNodeId)) {
      dfs(startNodeId, 0);
    } else {
      logger.warn(`Start node ${startNodeId} not found in graph`);
    }

    return result;
  }

  /**
   * Perform breadth-first search traversal
   * 
   * @param startNodeId Starting node ID
   * @param options Traversal options
   * @returns Array of visited node IDs in BFS order
   */
  traverseBFS(startNodeId: string, options: TraversalOptions = {}): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const queue: Array<{ nodeId: string; depth: number }> = [];
    const { visitedCallback, edgeCallback, maxDepth = Infinity } = options;

    if (!this.nodes.has(startNodeId)) {
      logger.warn(`Start node ${startNodeId} not found in graph`);
      return result;
    }

    queue.push({ nodeId: startNodeId, depth: 0 });
    visited.add(startNodeId);

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (depth > maxDepth) {
        continue;
      }

      result.push(nodeId);

      if (visitedCallback) {
        visitedCallback(nodeId, depth);
      }

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ nodeId: neighborId, depth: depth + 1 });

          if (edgeCallback) {
            const edge = this.findEdge(nodeId, neighborId);
            if (edge) {
              edgeCallback(edge, depth);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Extract a subgraph starting from a specific entry point
   * 
   * @param entryPoint Entry point node ID
   * @param maxDepth Maximum depth to traverse
   * @param filterOptions Optional filtering options
   * @returns Subgraph as a new CallGraph
   */
  getSubgraph(entryPoint: string, maxDepth: number, filterOptions?: GraphFilterOptions): CallGraph {
    const subgraphBuilder = new CallGraphBuilder();
    
    // Set metadata for subgraph
    subgraphBuilder.setMetadata({
      ...this.metadata,
      entryPoint,
      maxDepth,
      generatedAt: new Date().toISOString(),
    });

    const visitedNodes = this.traverseDFS(entryPoint, {
      maxDepth,
      visitedCallback: (nodeId) => {
        const node = this.nodes.get(nodeId);
        if (node && this.shouldIncludeNode(node, filterOptions)) {
          subgraphBuilder.addNode(node);
        }
      },
      edgeCallback: (edge) => {
        if (this.shouldIncludeEdge(edge, filterOptions)) {
          subgraphBuilder.addEdge(edge);
        }
      },
    });

    return subgraphBuilder.build(entryPoint);
  }

  /**
   * Get graph metrics and statistics
   * 
   * @returns CallGraphMetrics object
   */
  getMetrics(): CallGraphMetrics {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());
    
    const totalFunctions = nodes.length;
    const totalCalls = edges.length;
    const asyncFunctions = nodes.filter(n => n.async).length;
    
    // Calculate fan-out (average outgoing edges per node)
    const fanOutSum = Array.from(this.adjacencyList.values())
      .reduce((sum, neighbors) => sum + neighbors.size, 0);
    const averageFanOut = totalFunctions > 0 ? fanOutSum / totalFunctions : 0;
    
    // Calculate fan-in (average incoming edges per node)
    const fanInSum = Array.from(this.reverseAdjacencyList.values())
      .reduce((sum, predecessors) => sum + predecessors.size, 0);
    const averageFanIn = totalFunctions > 0 ? fanInSum / totalFunctions : 0;

    // Calculate max depth using BFS from all entry points
    const maxDepth = this.calculateMaxDepth();

    // Find hotspots (nodes with high fan-in)
    const hotspots = nodes
      .map(node => ({
        nodeId: node.id,
        functionName: node.name,
        callCount: this.reverseAdjacencyList.get(node.id)?.size || 0,
      }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10); // Top 10 hotspots

    return {
      totalFunctions,
      totalCalls,
      asyncFunctions,
      maxDepth,
      averageFanOut,
      averageFanIn,
      circularDependencies: this.detectCycles(),
      hotspots,
      complexity: {
        cyclomaticComplexity: this.calculateCyclomaticComplexity(),
        cognitiveComplexity: this.calculateCognitiveComplexity(),
      },
    };
  }

  /**
   * Clear all data from the builder
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.metadata = undefined;
    logger.debug('CallGraphBuilder cleared');
  }

  /**
   * Get the number of nodes in the graph
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get the number of edges in the graph
   */
  getEdgeCount(): number {
    return this.edges.size;
  }

  /**
   * Check if a node exists in the graph
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Check if an edge exists in the graph
   */
  hasEdge(edgeId: string): boolean {
    return this.edges.has(edgeId);
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): CallGraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): CallGraphEdge | undefined {
    return this.edges.get(edgeId);
  }

  // Private helper methods

  private ensureNodeExists(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      // Create a placeholder node
      const placeholderNode: CallGraphNode = {
        id: nodeId,
        name: 'placeholder',
        filePath: 'unknown',
        line: 0,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'unknown',
      };
      this.addNode(placeholderNode);
      logger.debug(`Created placeholder node for ${nodeId}`);
    }
  }

  private findEdge(sourceId: string, targetId: string): CallGraphEdge | undefined {
    for (const edge of this.edges.values()) {
      if (edge.source === sourceId && edge.target === targetId) {
        return edge;
      }
    }
    return undefined;
  }

  private shouldIncludeNode(node: CallGraphNode, options?: GraphFilterOptions): boolean {
    if (!options) return true;

    if (options.nodeTypes && !options.nodeTypes.includes(node.type)) {
      return false;
    }

    if (options.filePatterns) {
      const matches = options.filePatterns.some(pattern => pattern.test(node.filePath));
      if (!matches) return false;
    }

    if (options.excludePatterns) {
      const excluded = options.excludePatterns.some(pattern => pattern.test(node.filePath));
      if (excluded) return false;
    }

    return true;
  }

  private shouldIncludeEdge(edge: CallGraphEdge, options?: GraphFilterOptions): boolean {
    if (!options) return true;

    if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) {
      return false;
    }

    return true;
  }

  private getUniqueFileCount(): number {
    const uniqueFiles = new Set<string>();
    for (const node of this.nodes.values()) {
      uniqueFiles.add(node.filePath);
    }
    return uniqueFiles.size;
  }

  private calculateMaxDepth(): number {
    let maxDepth = 0;
    
    // Find potential entry points (nodes with no incoming edges)
    const entryPoints = Array.from(this.nodes.keys()).filter(nodeId => {
      const incomingEdges = this.reverseAdjacencyList.get(nodeId);
      return !incomingEdges || incomingEdges.size === 0;
    });

    // If no entry points found, use all nodes
    if (entryPoints.length === 0) {
      entryPoints.push(...this.nodes.keys());
    }

    for (const entryPoint of entryPoints) {
      const depth = this.calculateDepthFromNode(entryPoint);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private calculateDepthFromNode(startNodeId: string): number {
    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      maxDepth = Math.max(maxDepth, depth);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        dfs(neighborId, depth + 1);
      }
    };

    dfs(startNodeId, 0);
    return maxDepth;
  }

  private calculateCyclomaticComplexity(): number {
    // Simplified cyclomatic complexity: E - N + 2P
    // Where E = edges, N = nodes, P = connected components
    const edges = this.edges.size;
    const nodes = this.nodes.size;
    const components = this.countConnectedComponents();
    
    return Math.max(1, edges - nodes + 2 * components);
  }

  private calculateCognitiveComplexity(): number {
    // Simplified cognitive complexity based on graph structure
    const cycles = this.detectCycles();
    const branchingFactor = this.calculateAverageBranchingFactor();
    
    return cycles.length * 2 + Math.floor(branchingFactor);
  }

  private countConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    const dfs = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Visit all neighbors (both directions for undirected component analysis)
      const outgoing = this.adjacencyList.get(nodeId) || new Set();
      const incoming = this.reverseAdjacencyList.get(nodeId) || new Set();
      
      for (const neighborId of [...outgoing, ...incoming]) {
        dfs(neighborId);
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
        components++;
      }
    }

    return components;
  }

  private calculateAverageBranchingFactor(): number {
    const totalBranches = Array.from(this.adjacencyList.values())
      .reduce((sum, neighbors) => sum + neighbors.size, 0);
    
    return this.nodes.size > 0 ? totalBranches / this.nodes.size : 0;
  }
}