import * as yaml from 'js-yaml';
import { CallGraph, FormatterOptions } from '../types/CallGraph';

export class YamlFormatter {
  format(callGraph: CallGraph, options: FormatterOptions = { format: 'yaml' }): string {
    const output: any = {};

    // Metadata section
    if (options.includeMetadata !== false) {
      output.metadata = this.formatMetadata(callGraph.metadata);
    }

    // Entry point information
    output.entry_point = {
      id: callGraph.entryPointId,
      function: this.findNodeById(callGraph, callGraph.entryPointId)?.name || 'unknown',
    };

    // Nodes section
    output.functions = callGraph.nodes.map(node => this.formatNode(node));

    // Edges section
    output.calls = callGraph.edges.map(edge => this.formatEdge(edge, callGraph));

    // Statistics if requested
    if (options.includeMetrics) {
      output.statistics = this.generateYamlStatistics(callGraph);
    }

    // Convert to YAML with custom formatting
    return yaml.dump(output, {
      indent: 2,
      lineWidth: -1, // Disable line wrapping
      noRefs: true,
      sortKeys: false,
      flowLevel: -1, // Use block style for arrays
    });
  }

  private formatMetadata(metadata: CallGraph['metadata']): any {
    return {
      generated_at: metadata.generatedAt,
      entry_point: metadata.entryPoint,
      project_root: metadata.projectRoot,
      tsconfig_path: metadata.tsConfigPath || null,
      analysis_time_ms: metadata.analysisTimeMs,
      max_depth: metadata.maxDepth,
      total_files: metadata.totalFiles,
    };
  }

  private formatNode(node: CallGraph['nodes'][0]): any {
    const formatted: any = {
      id: node.id,
      name: node.name,
      type: node.type,
      file: this.getRelativePath(node.filePath),
      location: {
        line: node.line,
        column: node.column || null,
      },
      async: node.async,
    };

    if (node.className) {
      formatted.class = node.className;
    }

    if (node.visibility) {
      formatted.visibility = node.visibility;
    }

    if (node.static) {
      formatted.static = true;
    }

    if (node.parameters && node.parameters.length > 0) {
      formatted.parameters = node.parameters.map(param => ({
        name: param.name,
        type: param.type,
        optional: param.optional,
        default: param.defaultValue || null,
      }));
    }

    formatted.return_type = node.returnType;

    return formatted;
  }

  private formatEdge(edge: CallGraph['edges'][0], callGraph: CallGraph): any {
    const sourceNode = this.findNodeById(callGraph, edge.source);
    const targetNode = this.findNodeById(callGraph, edge.target);

    return {
      from: {
        id: edge.source,
        function: sourceNode?.name || 'unknown',
      },
      to: {
        id: edge.target,
        function: targetNode?.name || 'unknown',
      },
      type: edge.type,
      location: {
        line: edge.line,
        column: edge.column || null,
      },
      conditional: edge.conditional || false,
      argument_types: edge.argumentTypes || [],
    };
  }

  private generateYamlStatistics(callGraph: CallGraph): any {
    const { nodes, edges } = callGraph;

    // Basic counts
    const overview = {
      total_functions: nodes.length,
      total_calls: edges.length,
      async_functions: nodes.filter(n => n.async).length,
      static_methods: nodes.filter(n => n.static).length,
    };

    // Function types
    const function_types = nodes.reduce(
      (acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Call types
    const call_types = edges.reduce(
      (acc, edge) => {
        acc[edge.type] = (acc[edge.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // File distribution
    const files = nodes.reduce(
      (acc, node) => {
        const fileName = this.getRelativePath(node.filePath);
        acc[fileName] = (acc[fileName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Most called functions (hotspots)
    const callCounts = new Map<string, number>();
    edges.forEach(edge => {
      callCounts.set(edge.target, (callCounts.get(edge.target) || 0) + 1);
    });

    const hotspots = Array.from(callCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nodeId, count]) => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          function: node?.name || 'unknown',
          file: node ? this.getRelativePath(node.filePath) : 'unknown',
          call_count: count,
        };
      });

    // Functions that call many others (high fan-out)
    const fanOut = new Map<string, number>();
    edges.forEach(edge => {
      fanOut.set(edge.source, (fanOut.get(edge.source) || 0) + 1);
    });

    const high_fan_out = Array.from(fanOut.entries())
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .map(([nodeId, count]) => {
        const node = nodes.find(n => n.id === nodeId);
        return {
          function: node?.name || 'unknown',
          file: node ? this.getRelativePath(node.filePath) : 'unknown',
          calls_count: count,
        };
      });

    return {
      overview,
      distribution: {
        function_types,
        call_types,
        files: Object.entries(files)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .reduce(
            (acc, [file, count]) => {
              acc[file] = count;
              return acc;
            },
            {} as Record<string, number>
          ),
      },
      complexity: {
        hotspots: hotspots.slice(0, 5),
        high_fan_out: high_fan_out.slice(0, 5),
      },
    };
  }

  /**
   * Format as a human-readable call tree
   */
  formatAsCallTree(callGraph: CallGraph): string {
    const tree = this.buildCallTree(callGraph);
    return yaml.dump(
      {
        call_tree: tree,
        metadata: {
          generated_at: callGraph.metadata.generatedAt,
          entry_point: callGraph.metadata.entryPoint,
          total_nodes: callGraph.nodes.length,
        },
      },
      {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      }
    );
  }

  private buildCallTree(callGraph: CallGraph): any {
    const { nodes, edges, entryPointId } = callGraph;
    const visited = new Set<string>();

    const buildNode = (nodeId: string, depth: number = 0): any => {
      if (visited.has(nodeId) || depth > 10) {
        return { function: nodes.find(n => n.id === nodeId)?.name || 'unknown', circular: true };
      }

      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;

      const children = edges
        .filter(edge => edge.source === nodeId)
        .map(edge => {
          const childNode = buildNode(edge.target, depth + 1);
          return childNode
            ? {
                ...childNode,
                call_type: edge.type,
                line: edge.line,
              }
            : null;
        })
        .filter(Boolean);

      const result: any = {
        function: node.name,
        type: node.type,
        file: this.getRelativePath(node.filePath),
        line: node.line,
        async: node.async,
      };

      if (children.length > 0) {
        result.calls = children;
      }

      return result;
    };

    return buildNode(entryPointId);
  }

  /**
   * Format as test specification
   */
  formatAsTestSpec(callGraph: CallGraph): string {
    const spec = {
      test_specification: {
        entry_point: callGraph.metadata.entryPoint,
        description: `Call structure test for ${callGraph.metadata.entryPoint}`,

        required_functions: callGraph.nodes.map(node => ({
          name: node.name,
          type: node.type,
          file: this.getRelativePath(node.filePath),
          async: node.async,
        })),

        required_calls: callGraph.edges.map(edge => {
          const sourceNode = this.findNodeById(callGraph, edge.source);
          const targetNode = this.findNodeById(callGraph, edge.target);

          return {
            from: sourceNode?.name || 'unknown',
            to: targetNode?.name || 'unknown',
            type: edge.type,
            description: `${sourceNode?.name || 'unknown'} should call ${targetNode?.name || 'unknown'} (${edge.type})`,
          };
        }),

        constraints: {
          max_depth: callGraph.metadata.maxDepth,
          total_functions: `<= ${callGraph.nodes.length}`,
          total_calls: `<= ${callGraph.edges.length}`,
          async_calls: `<= ${callGraph.edges.filter(e => e.type === 'async').length}`,
        },
      },
    };

    return yaml.dump(spec, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
  }

  /**
   * Parse YAML specification back to CallGraph structure
   */
  parseSpecification(yamlContent: string): any {
    try {
      const spec = yaml.load(yamlContent) as any;

      if (!spec.test_specification) {
        throw new Error('Invalid specification format: missing test_specification');
      }

      return {
        entryPoint: spec.test_specification.entry_point,
        requiredFunctions: spec.test_specification.required_functions || [],
        requiredCalls: spec.test_specification.required_calls || [],
        constraints: spec.test_specification.constraints || {},
        description: spec.test_specification.description,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse YAML specification: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private findNodeById(callGraph: CallGraph, nodeId: string): CallGraph['nodes'][0] | undefined {
    return callGraph.nodes.find(node => node.id === nodeId);
  }

  private getRelativePath(filePath: string): string {
    // Simple relative path calculation - in a real implementation,
    // this should be relative to the project root
    const parts = filePath.split('/');
    const srcIndex = parts.findIndex(part => part === 'src');
    if (srcIndex !== -1) {
      return parts.slice(srcIndex).join('/');
    }
    return parts.slice(-2).join('/'); // Last two parts
  }

  /**
   * Validate YAML output
   */
  validate(yamlString: string): { isValid: boolean; error?: string } {
    try {
      const parsed = yaml.load(yamlString) as any;

      if (!parsed.functions || !Array.isArray(parsed.functions)) {
        return { isValid: false, error: 'Missing or invalid functions array' };
      }

      if (!parsed.calls || !Array.isArray(parsed.calls)) {
        return { isValid: false, error: 'Missing or invalid calls array' };
      }

      if (!parsed.entry_point || typeof parsed.entry_point !== 'object') {
        return { isValid: false, error: 'Missing or invalid entry_point' };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `YAML parsing error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
