import { CallGraph, FormatterOptions } from '../types/CallGraph';

export class JsonFormatter {
  format(callGraph: CallGraph, options: FormatterOptions = { format: 'json' }): string {
    const output: any = {};

    // Always include metadata
    if (options.includeMetadata !== false) {
      output.metadata = callGraph.metadata;
    }

    // Core data
    output.nodes = callGraph.nodes;
    output.edges = callGraph.edges;
    output.entryPointId = callGraph.entryPointId;

    // Additional statistics if requested
    if (options.includeMetrics) {
      output.statistics = this.generateStatistics(callGraph);
    }

    // Format output
    if (options.prettify !== false) {
      return JSON.stringify(output, null, 2);
    } else {
      return JSON.stringify(output);
    }
  }

  private generateStatistics(callGraph: CallGraph): any {
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
  validate(jsonString: string): { isValid: boolean; error?: string } {
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
}
