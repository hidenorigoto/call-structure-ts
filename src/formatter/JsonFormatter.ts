import { CallGraph } from '../types/CallGraph';
import { Formatter, FormatOptions, ValidationResult, CircularReferenceStrategy } from '../types/Formatter';
import { Writable } from 'stream';

export class JsonFormatter implements Formatter {
  format(callGraph: CallGraph, options: FormatOptions = {}): string {
    // Handle circular references if needed
    const processedGraph = this.handleCircularReferences(callGraph, options);
    
    const output: Record<string, unknown> = {};

    // Always include metadata
    if (options.includeMetadata !== false) {
      output.metadata = processedGraph.metadata;
    }

    // Core data
    output.nodes = processedGraph.nodes;
    output.edges = processedGraph.edges;
    output.entryPointId = processedGraph.entryPointId;

    // Additional statistics if requested
    if (options.includeMetrics) {
      output.statistics = this.generateStatistics(processedGraph);
    }

    // Format output
    if (options.prettify !== false) {
      return JSON.stringify(output, null, 2);
    } else {
      return JSON.stringify(output);
    }
  }

  private generateStatistics(callGraph: CallGraph): Record<string, unknown> {
    const { nodes, edges } = callGraph;

    // Basic counts
    const totalNodes = nodes.length;
    const totalEdges = edges.length;

    // Node type distribution
    const nodeTypes = nodes.reduce(
      (acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Edge type distribution
    const edgeTypes = edges.reduce(
      (acc, edge) => {
        acc[edge.type] = (acc[edge.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Async function count
    const asyncFunctions = nodes.filter(node => node.async).length;

    // Fan-out calculation (calls from each function)
    const fanOut = new Map<string, number>();
    edges.forEach(edge => {
      fanOut.set(edge.source, (fanOut.get(edge.source) || 0) + 1);
    });

    // Fan-in calculation (calls to each function)
    const fanIn = new Map<string, number>();
    edges.forEach(edge => {
      fanIn.set(edge.target, (fanIn.get(edge.target) || 0) + 1);
    });

    // Find hotspots (most called functions)
    const hotspots = Array.from(fanIn.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nodeId, callCount]) => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          nodeId,
          functionName: node?.name || 'unknown',
          callCount,
          filePath: node?.filePath,
        };
      });

    // Calculate depth distribution
    const depthCounts = this.calculateDepthDistribution(callGraph);

    // File distribution
    const fileDistribution = nodes.reduce(
      (acc, node) => {
        const fileName = node.filePath.split('/').pop() || 'unknown';
        acc[fileName] = (acc[fileName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      overview: {
        totalNodes,
        totalEdges,
        asyncFunctions,
        averageFanOut:
          fanOut.size > 0
            ? Array.from(fanOut.values()).reduce((a, b) => a + b, 0) / fanOut.size
            : 0,
        averageFanIn:
          fanIn.size > 0 ? Array.from(fanIn.values()).reduce((a, b) => a + b, 0) / fanIn.size : 0,
        maxDepth: Math.max(...depthCounts.map(d => d.depth), 0),
      },
      distribution: {
        nodeTypes,
        edgeTypes,
        depthCounts,
        fileDistribution,
      },
      hotspots,
      complexity: {
        functionsWithHighFanOut: Array.from(fanOut.entries())
          .filter(([_, count]) => count > 5)
          .map(([nodeId, count]) => {
            const node = nodes.find(n => n.id === nodeId);
            return {
              nodeId,
              functionName: node?.name || 'unknown',
              fanOut: count,
              filePath: node?.filePath,
            };
          }),
        functionsWithHighFanIn: hotspots.filter(h => h.callCount > 3),
      },
    };
  }

  private calculateDepthDistribution(
    callGraph: CallGraph
  ): Array<{ depth: number; count: number }> {
    const { edges, entryPointId } = callGraph;
    const depths = new Map<string, number>();
    const visited = new Set<string>();

    // BFS to calculate depths
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: entryPointId, depth: 0 }];
    depths.set(entryPointId, 0);

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Find outgoing edges
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);

      for (const edge of outgoingEdges) {
        const targetDepth = depth + 1;
        const currentDepth = depths.get(edge.target);

        // Only update if we found a shorter path or haven't visited this node
        if (currentDepth === undefined || targetDepth < currentDepth) {
          depths.set(edge.target, targetDepth);
          queue.push({ nodeId: edge.target, depth: targetDepth });
        }
      }
    }

    // Group by depth
    const depthGroups = new Map<number, number>();
    for (const depth of depths.values()) {
      depthGroups.set(depth, (depthGroups.get(depth) || 0) + 1);
    }

    return Array.from(depthGroups.entries())
      .map(([depth, count]) => ({ depth, count }))
      .sort((a, b) => a.depth - b.depth);
  }

  /**
   * Format with custom schema for specific use cases
   */
  formatWithSchema(callGraph: CallGraph, schema: 'simple' | 'detailed' | 'compact'): string {
    switch (schema) {
      case 'simple':
        return this.formatSimple(callGraph);
      case 'detailed':
        return this.formatDetailed(callGraph);
      case 'compact':
        return this.formatCompact(callGraph);
      default:
        return this.format(callGraph);
    }
  }

  private formatSimple(callGraph: CallGraph): string {
    const output = {
      entryPoint: callGraph.entryPointId,
      functions: callGraph.nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        async: node.async,
      })),
      calls: callGraph.edges.map(edge => ({
        from: edge.source,
        to: edge.target,
        type: edge.type,
      })),
    };

    return JSON.stringify(output, null, 2);
  }

  private formatDetailed(callGraph: CallGraph): string {
    const output = {
      metadata: callGraph.metadata,
      entryPoint: {
        id: callGraph.entryPointId,
        details: callGraph.nodes.find(n => n.id === callGraph.entryPointId),
      },
      nodes: callGraph.nodes,
      edges: callGraph.edges,
      statistics: this.generateStatistics(callGraph),
    };

    return JSON.stringify(output, null, 2);
  }

  private formatCompact(callGraph: CallGraph): string {
    const nodeMap = new Map(callGraph.nodes.map((node, index) => [node.id, index]));

    const output = {
      meta: {
        generated: callGraph.metadata.generatedAt,
        entry: callGraph.entryPointId,
        stats: {
          nodes: callGraph.nodes.length,
          edges: callGraph.edges.length,
        },
      },
      n: callGraph.nodes.map(node => [
        node.name,
        node.type,
        node.async ? 1 : 0,
        node.filePath,
        node.line,
      ]),
      e: callGraph.edges.map(edge => [
        nodeMap.get(edge.source),
        nodeMap.get(edge.target),
        edge.type,
        edge.line,
      ]),
    };

    return JSON.stringify(output);
  }

  /**
   * Validate JSON output
   */
  validate(jsonString: string): ValidationResult {
    try {
      const parsed = JSON.parse(jsonString);

      // Basic structure validation
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        return { isValid: false, error: 'Missing or invalid nodes array' };
      }

      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        return { isValid: false, error: 'Missing or invalid edges array' };
      }

      if (!parsed.entryPointId || typeof parsed.entryPointId !== 'string') {
        return { isValid: false, error: 'Missing or invalid entryPointId' };
      }

      // Validate node structure
      for (const node of parsed.nodes) {
        if (!node.id || !node.name || !node.type) {
          return { isValid: false, error: 'Invalid node structure: missing required fields' };
        }
      }

      // Validate edge structure
      for (const edge of parsed.edges) {
        if (!edge.source || !edge.target || !edge.type) {
          return { isValid: false, error: 'Invalid edge structure: missing required fields' };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `JSON parsing error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Stream format a call graph to a writable stream
   * Efficiently handles large graphs by streaming JSON in chunks
   */
  formatStream(callGraph: CallGraph, stream: Writable, options: FormatOptions = {}): void {
    const chunkSize = options.chunkSize || 100;
    const prettify = options.prettify !== false;
    const indent = prettify ? 2 : 0;
    const newline = prettify ? '\n' : '';
    const indentStr = prettify ? ' '.repeat(indent) : '';

    try {
      // Handle circular references if needed
      const processedGraph = this.handleCircularReferences(callGraph, options);

      // Start JSON object
      stream.write('{' + newline);

      let isFirst = true;

      // Write metadata
      if (options.includeMetadata !== false) {
        this.writeProperty(stream, 'metadata', processedGraph.metadata, indent, isFirst);
        isFirst = false;
      }

      // Write entryPointId
      this.writeProperty(stream, 'entryPointId', processedGraph.entryPointId, indent, isFirst);
      isFirst = false;

      // Stream nodes array
      const comma1 = isFirst ? '' : ',';
      stream.write(`${comma1}${newline}${indentStr}"nodes": [${newline}`);
      
      for (let i = 0; i < processedGraph.nodes.length; i += chunkSize) {
        const chunk = processedGraph.nodes.slice(i, i + chunkSize);
        
        for (let j = 0; j < chunk.length; j++) {
          const globalIndex = i + j;
          if (globalIndex > 0) stream.write(',' + newline);
          
          const nodeJson = JSON.stringify(chunk[j], null, prettify ? indent : undefined);
          const indentedJson = prettify ? nodeJson.split('\n').map((line, idx) => 
            idx === 0 ? indentStr + line : ' '.repeat(indent * 2) + line
          ).join('\n') : nodeJson;
          
          stream.write(indentedJson);
        }
      }
      
      stream.write(newline + indentStr + '],' + newline);

      // Stream edges array
      stream.write(`${indentStr}"edges": [${newline}`);
      
      for (let i = 0; i < processedGraph.edges.length; i += chunkSize) {
        const chunk = processedGraph.edges.slice(i, i + chunkSize);
        
        for (let j = 0; j < chunk.length; j++) {
          const globalIndex = i + j;
          if (globalIndex > 0) stream.write(',' + newline);
          
          const edgeJson = JSON.stringify(chunk[j], null, prettify ? indent : undefined);
          const indentedJson = prettify ? edgeJson.split('\n').map((line, idx) => 
            idx === 0 ? indentStr + line : ' '.repeat(indent * 2) + line
          ).join('\n') : edgeJson;
          
          stream.write(indentedJson);
        }
      }
      
      stream.write(newline + indentStr + ']');

      // Write statistics if requested
      if (options.includeMetrics) {
        stream.write(',' + newline);
        const statisticsJson = JSON.stringify(this.generateStatistics(processedGraph), null, prettify ? indent : undefined);
        const indentedStats = prettify ? statisticsJson.split('\n').map((line, idx) => 
          idx === 0 ? indentStr + '"statistics": ' + line : ' '.repeat(indent * 2) + line
        ).join('\n') : `${indentStr}"statistics": ${statisticsJson}`;
        stream.write(indentedStats);
      }

      // End JSON object
      stream.write(newline + '}');
      stream.end();
    } catch (error) {
      stream.emit('error', error);
    }
  }

  /**
   * Handle circular references based on the specified strategy
   */
  private handleCircularReferences(callGraph: CallGraph, options: FormatOptions): CallGraph {
    const strategy = options.circularReferenceStrategy || CircularReferenceStrategy.REFERENCE;
    
    // Skip circular reference processing for very large graphs to avoid stack overflow
    if (callGraph.nodes.length > 5000) {
      return callGraph;
    }
    
    if (strategy === CircularReferenceStrategy.OMIT) {
      return this.omitCircularReferences(callGraph);
    } else if (strategy === CircularReferenceStrategy.REFERENCE) {
      return this.replaceCircularWithReferences(callGraph);
    } else {
      // INLINE_ONCE strategy
      return this.inlineOnceStrategy(callGraph);
    }
  }

  /**
   * Detect and omit circular references
   */
  private omitCircularReferences(callGraph: CallGraph): CallGraph {
    const cycles = this.detectCycles(callGraph);
    const cyclicEdgeIds = new Set<string>();

    // Mark edges that are part of cycles
    cycles.forEach(cycle => {
      for (let i = 0; i < cycle.length - 1; i++) {
        const source = cycle[i];
        const target = cycle[i + 1];
        const edge = callGraph.edges.find(e => e.source === source && e.target === target);
        if (edge) {
          cyclicEdgeIds.add(edge.id);
        }
      }
    });

    return {
      ...callGraph,
      edges: callGraph.edges.filter(edge => !cyclicEdgeIds.has(edge.id))
    };
  }

  /**
   * Replace circular references with reference IDs
   */
  private replaceCircularWithReferences(callGraph: CallGraph): CallGraph {
    const cycles = this.detectCycles(callGraph);
    const processedEdges = [...callGraph.edges];

    cycles.forEach(cycle => {
      for (let i = 0; i < cycle.length - 1; i++) {
        const source = cycle[i];
        const target = cycle[i + 1];
        const edgeIndex = processedEdges.findIndex(e => e.source === source && e.target === target);
        
        if (edgeIndex >= 0) {
          processedEdges[edgeIndex] = {
            ...processedEdges[edgeIndex],
            circular: true,
            targetRef: target // Reference instead of full target
          } as any;
        }
      }
    });

    return {
      ...callGraph,
      edges: processedEdges
    };
  }

  /**
   * Inline circular references once, then use references
   */
  private inlineOnceStrategy(callGraph: CallGraph): CallGraph {
    // For JSON output, this is similar to reference strategy
    // but we could add metadata about which nodes are inlined
    const processed = this.replaceCircularWithReferences(callGraph);
    const cycles = this.detectCycles(callGraph);
    
    return {
      ...processed,
      metadata: {
        ...processed.metadata,
        circularReferences: cycles.map(cycle => ({ cycle, strategy: 'inline-once' }))
      } as any
    };
  }

  /**
   * Detect cycles in the call graph
   */
  private detectCycles(callGraph: CallGraph): string[][] {
    const { nodes, edges } = callGraph;
    const adjacencyList = new Map<string, string[]>();
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    // Build adjacency list
    nodes.forEach(node => adjacencyList.set(node.id, []));
    edges.forEach(edge => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
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

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighborId of neighbors) {
        dfs(neighborId);
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check all nodes for cycles
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });

    return cycles;
  }

  /**
   * Helper method to write a property to the stream
   */
  private writeProperty(
    stream: Writable,
    key: string,
    value: any,
    indent: number,
    isFirst: boolean,
    skipValue = false
  ): void {
    const comma = isFirst ? '' : ',';
    const space = indent > 0 ? ' ' : '';
    const newline = indent > 0 ? '\n' : '';
    const indentStr = indent > 0 ? ' '.repeat(indent) : '';

    if (skipValue) {
      stream.write(`${comma}${newline}${indentStr}"${key}":${space}`);
    } else {
      const valueJson = JSON.stringify(value, null, indent > 0 ? indent : undefined);
      stream.write(`${comma}${newline}${indentStr}"${key}":${space}${valueJson}`);
    }
  }
}
