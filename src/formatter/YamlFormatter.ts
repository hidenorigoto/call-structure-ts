import * as yaml from 'js-yaml';
import { CallGraph } from '../types/CallGraph';
import {
  Formatter,
  FormatOptions,
  ValidationResult,
  CircularReferenceStrategy,
} from '../types/Formatter';
import { Writable } from 'stream';

/**
 * YAML-specific format options
 */
export interface YamlFormatOptions extends FormatOptions {
  /** Include inline comments for better documentation */
  includeComments?: boolean;
  /** Control flow style vs block style (-1 for all block) */
  flowLevel?: number;
  /** Line width for wrapping (-1 to disable) */
  lineWidth?: number;
  /** Scalar string style */
  scalarStyle?: 'plain' | 'single' | 'double' | 'literal' | 'folded';
}

export class YamlFormatter implements Formatter {
  format(callGraph: CallGraph, options: FormatOptions = {}): string {
    // Handle circular references if needed
    const processedGraph = this.handleCircularReferences(callGraph, options);

    const output: Record<string, unknown> = {};
    const yamlOptions = options as YamlFormatOptions;

    // Metadata section
    if (options.includeMetadata !== false) {
      output.metadata = this.formatMetadata(processedGraph.metadata);
    }

    // Entry point information
    output.entry_point = {
      id: processedGraph.entryPointId,
      function: this.findNodeById(processedGraph, processedGraph.entryPointId)?.name || 'unknown',
    };

    // Nodes section
    output.functions = processedGraph.nodes.map(node => this.formatNode(node));

    // Edges section
    output.calls = processedGraph.edges.map(edge => this.formatEdge(edge, processedGraph));

    // Statistics if requested
    if (options.includeMetrics) {
      output.statistics = this.generateYamlStatistics(processedGraph);
    }

    // Convert to YAML with custom formatting
    const yamlString = yaml.dump(output, {
      indent: 2,
      lineWidth: yamlOptions.lineWidth ?? -1, // Disable line wrapping by default
      noRefs: options.circularReferenceStrategy === CircularReferenceStrategy.OMIT,
      sortKeys: false,
      flowLevel: yamlOptions.flowLevel ?? -1, // Use block style for arrays by default
    });

    // Add comments if requested
    if (yamlOptions.includeComments) {
      return this.addComments(yamlString, processedGraph);
    }

    return yamlString;
  }

  private formatMetadata(metadata: CallGraph['metadata']): Record<string, unknown> {
    const formattedMetadata: Record<string, unknown> = {
      generated_at: metadata.generatedAt,
      entry_point: metadata.entryPoint,
      project_root: metadata.projectRoot,
      tsconfig_path: metadata.tsConfigPath || null,
      analysis_time_ms: metadata.analysisTimeMs,
      max_depth: metadata.maxDepth,
      total_files: metadata.totalFiles,
    };

    // Include circular references if present
    if ('circularReferences' in metadata) {
      formattedMetadata.circularReferences = metadata.circularReferences;
    }

    return formattedMetadata;
  }

  private formatNode(node: CallGraph['nodes'][0]): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
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

  private formatEdge(edge: CallGraph['edges'][0], callGraph: CallGraph): Record<string, unknown> {
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

  private generateYamlStatistics(callGraph: CallGraph): Record<string, unknown> {
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

  private buildCallTree(callGraph: CallGraph): Record<string, unknown> | null {
    const { nodes, edges, entryPointId } = callGraph;
    const visited = new Set<string>();

    const buildNode = (nodeId: string, depth: number = 0): Record<string, unknown> | null => {
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

      const result: Record<string, unknown> = {
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
  parseSpecification(yamlContent: string): Record<string, unknown> {
    try {
      const spec = yaml.load(yamlContent) as Record<string, unknown>;

      if (!spec.test_specification) {
        throw new Error('Invalid specification format: missing test_specification');
      }

      const testSpec = spec.test_specification as Record<string, unknown>;
      return {
        entryPoint: testSpec.entry_point,
        requiredFunctions: testSpec.required_functions || [],
        requiredCalls: testSpec.required_calls || [],
        constraints: testSpec.constraints || {},
        description: testSpec.description,
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
  validate(yamlString: string): ValidationResult {
    const warnings: string[] = [];

    try {
      const parsed = yaml.load(yamlString) as Record<string, unknown>;

      // Check for required fields
      if (!parsed.functions || !Array.isArray(parsed.functions)) {
        return { isValid: false, error: 'Missing or invalid functions array' };
      }

      if (!parsed.calls || !Array.isArray(parsed.calls)) {
        return { isValid: false, error: 'Missing or invalid calls array' };
      }

      if (!parsed.entry_point || typeof parsed.entry_point !== 'object') {
        return { isValid: false, error: 'Missing or invalid entry_point' };
      }

      // Validate node structure
      for (const func of parsed.functions) {
        if (!func.id || !func.name || !func.type) {
          return { isValid: false, error: 'Invalid function structure: missing required fields' };
        }
        if (!func.file) {
          warnings.push(`Function ${func.name} missing file path`);
        }
      }

      // Validate edge structure
      for (const call of parsed.calls) {
        if (!call.from || !call.to || !call.type) {
          return { isValid: false, error: 'Invalid call structure: missing required fields' };
        }
      }

      // Check for potential issues
      if (parsed.functions.length > 10000) {
        warnings.push(
          'Large number of functions detected (>10,000). Consider using streaming for better performance.'
        );
      }

      return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (error) {
      return {
        isValid: false,
        error: `YAML parsing error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Stream format a call graph to a writable stream
   * Efficiently handles large graphs by streaming YAML in chunks
   */
  formatStream(callGraph: CallGraph, stream: Writable, options: FormatOptions = {}): void {
    const yamlOptions = options as YamlFormatOptions;
    const chunkSize = options.chunkSize || 100;

    try {
      // Handle circular references if needed
      const processedGraph = this.handleCircularReferences(callGraph, options);

      // Write YAML header
      stream.write('---\n');

      // Write metadata if requested
      if (options.includeMetadata !== false) {
        stream.write('metadata:\n');
        const metadataYaml = yaml.dump(this.formatMetadata(processedGraph.metadata), {
          indent: 2,
          lineWidth: yamlOptions.lineWidth ?? -1,
        });
        stream.write(this.indentYaml(metadataYaml, 2));
        stream.write('\n');
      }

      // Write entry point
      stream.write('entry_point:\n');
      const entryNode = this.findNodeById(processedGraph, processedGraph.entryPointId);
      stream.write(`  id: ${processedGraph.entryPointId}\n`);
      stream.write(`  function: ${entryNode?.name || 'unknown'}\n\n`);

      // Stream functions array
      stream.write('functions:\n');
      for (let i = 0; i < processedGraph.nodes.length; i += chunkSize) {
        const chunk = processedGraph.nodes.slice(i, i + chunkSize);
        for (const node of chunk) {
          const nodeYaml = yaml.dump([this.formatNode(node)], {
            indent: 2,
            lineWidth: yamlOptions.lineWidth ?? -1,
            flowLevel: yamlOptions.flowLevel ?? -1,
          });
          // Remove the array brackets and adjust indentation
          const formattedYaml = nodeYaml.replace(/^- /, '  - ').replace(/\n {2}/g, '\n    ');
          stream.write(formattedYaml);
        }
      }

      stream.write('\n');

      // Stream calls array
      stream.write('calls:\n');
      for (let i = 0; i < processedGraph.edges.length; i += chunkSize) {
        const chunk = processedGraph.edges.slice(i, i + chunkSize);
        for (const edge of chunk) {
          const edgeYaml = yaml.dump([this.formatEdge(edge, processedGraph)], {
            indent: 2,
            lineWidth: yamlOptions.lineWidth ?? -1,
            flowLevel: yamlOptions.flowLevel ?? -1,
          });
          // Remove the array brackets and adjust indentation
          const formattedYaml = edgeYaml.replace(/^- /, '  - ').replace(/\n {2}/g, '\n    ');
          stream.write(formattedYaml);
        }
      }

      // Write statistics if requested
      if (options.includeMetrics) {
        stream.write('\nstatistics:\n');
        const statsYaml = yaml.dump(this.generateYamlStatistics(processedGraph), {
          indent: 2,
          lineWidth: yamlOptions.lineWidth ?? -1,
        });
        stream.write(this.indentYaml(statsYaml, 2));
      }

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

    if (strategy === CircularReferenceStrategy.OMIT) {
      return this.omitCircularReferences(callGraph);
    } else if (strategy === CircularReferenceStrategy.REFERENCE) {
      return this.replaceCircularWithReferences(callGraph);
    } else {
      // INLINE_ONCE strategy - for YAML we can use anchors and aliases
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
      edges: callGraph.edges.filter(edge => !cyclicEdgeIds.has(edge.id)),
    };
  }

  /**
   * Replace circular references with reference markers
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
          } as (typeof processedEdges)[number];
        }
      }
    });

    return {
      ...callGraph,
      edges: processedEdges,
    };
  }

  /**
   * Inline circular references once (YAML will use anchors/aliases)
   */
  private inlineOnceStrategy(callGraph: CallGraph): CallGraph {
    // For YAML, we'll mark nodes that should use anchors
    const cycles = this.detectCycles(callGraph);
    const circularNodeIds = new Set<string>();

    cycles.forEach(cycle => {
      cycle.forEach(nodeId => circularNodeIds.add(nodeId));
    });

    return {
      ...callGraph,
      metadata: {
        ...callGraph.metadata,
        circularReferences: cycles.map(cycle => ({ cycle, strategy: 'inline-once' })),
      } as typeof callGraph.metadata,
    };
  }

  /**
   * Detect cycles in the call graph
   */
  private detectCycles(callGraph: CallGraph): string[][] {
    const { nodes, edges } = callGraph;
    const adjacencyList = new Map<string, string[]>();
    const cycles: string[][] = [];

    // Build adjacency list
    nodes.forEach(node => adjacencyList.set(node.id, []));
    edges.forEach(edge => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });

    // Simple cycle detection for small graphs
    if (nodes.length < 100) {
      const visited = new Set<string>();
      const stack = new Set<string>();
      const path: string[] = [];

      const dfs = (nodeId: string): void => {
        if (stack.has(nodeId)) {
          // Found a cycle
          const cycleStart = path.indexOf(nodeId);
          if (cycleStart >= 0) {
            cycles.push(path.slice(cycleStart).concat([nodeId]));
          }
          return;
        }

        if (visited.has(nodeId)) {
          return;
        }

        visited.add(nodeId);
        stack.add(nodeId);
        path.push(nodeId);

        const neighbors = adjacencyList.get(nodeId) || [];
        for (const neighbor of neighbors) {
          dfs(neighbor);
        }

        path.pop();
        stack.delete(nodeId);
      };

      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          dfs(node.id);
        }
      });
    } else {
      // For large graphs, use simpler detection
      edges.forEach(edge => {
        if (edge.source === edge.target) {
          cycles.push([edge.source, edge.target]);
        }
      });
    }

    return cycles;
  }

  /**
   * Add comments to YAML output
   */
  private addComments(yamlString: string, callGraph: CallGraph): string {
    const lines = yamlString.split('\n');
    const commentedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Add comments for specific fields
      if (line.includes('generated_at:')) {
        commentedLines.push(line + ' # Timestamp when this analysis was performed');
      } else if (line.includes('entry_point:') && !line.includes('  ')) {
        commentedLines.push(line + ' # Starting point of the call graph analysis');
      } else if (line.includes('functions:') && !line.includes('  ')) {
        commentedLines.push(line + ' # List of all functions/methods discovered');
      } else if (line.includes('calls:') && !line.includes('  ')) {
        commentedLines.push(line + ' # List of all function calls detected');
      } else if (line.includes('statistics:') && !line.includes('  ')) {
        commentedLines.push(line + ' # Analysis metrics and insights');
      } else if (line.includes('total_functions:')) {
        commentedLines.push(line + ' # Total number of unique functions');
      } else if (line.includes('total_calls:')) {
        commentedLines.push(line + ' # Total number of function calls');
      } else if (line.includes('hotspots:')) {
        commentedLines.push(line + ' # Most frequently called functions');
      } else if (line.includes('circular:') && line.includes('true')) {
        commentedLines.push(line + ' # This edge creates a circular dependency');
      } else {
        commentedLines.push(line);
      }
    }

    // Add header comment
    const header = [
      '# Call Graph Analysis Results',
      `# Generated: ${callGraph.metadata.generatedAt}`,
      `# Entry Point: ${callGraph.metadata.entryPoint}`,
      `# Total Files Analyzed: ${callGraph.metadata.totalFiles}`,
      `# Analysis Time: ${callGraph.metadata.analysisTimeMs}ms`,
      '',
    ];

    return header.join('\n') + commentedLines.join('\n');
  }

  /**
   * Helper to indent YAML string
   */
  private indentYaml(yamlString: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return yamlString
      .split('\n')
      .map(line => (line ? indent + line : line))
      .join('\n');
  }
}
