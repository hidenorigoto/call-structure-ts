import { CallGraph, CallGraphNode, CallGraphEdge } from '../types/CallGraph';
import { Formatter, FormatOptions, ValidationResult } from '../types/Formatter';
import { Writable } from 'stream';

export interface DotFormatOptions extends FormatOptions {
  /** Layout direction: TB (top-bottom), BT (bottom-top), LR (left-right), RL (right-left) */
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Node separation in inches */
  nodesep?: number;
  /** Rank separation in inches */
  ranksep?: number;
  /** Font name for the graph */
  fontname?: string;
  /** Font size for the graph */
  fontsize?: number;
  /** Whether to cluster nodes by file */
  clustered?: boolean;
  /** Node shape (box, ellipse, diamond, etc.) */
  nodeShape?: string;
  /** Whether to show async indicators */
  showAsync?: boolean;
  /** Whether to show edge labels */
  showEdgeLabels?: boolean;
}

export class DotFormatter implements Formatter {
  format(graph: CallGraph, options: DotFormatOptions = {}): string {
    const lines: string[] = ['digraph CallGraph {'];

    // Graph attributes
    this.addGraphAttributes(lines, options);

    // Node defaults
    lines.push(
      `  node [shape=${options.nodeShape || 'box'}, fontname="${options.fontname || 'Arial'}"];`
    );
    lines.push(
      `  edge [fontname="${options.fontname || 'Arial'}", fontsize=${options.fontsize ? options.fontsize - 2 : 10}];`
    );
    lines.push('');

    // Add nodes
    if (options.clustered) {
      this.addClusteredNodes(lines, graph, options);
    } else {
      this.addNodes(lines, graph, options);
    }

    lines.push('');

    // Add edges
    this.addEdges(lines, graph, options);

    lines.push('}');
    return lines.join('\n');
  }

  private addGraphAttributes(lines: string[], options: DotFormatOptions): void {
    lines.push(`  rankdir=${options.rankdir || 'TB'};`);
    if (options.nodesep !== undefined) lines.push(`  nodesep=${options.nodesep};`);
    if (options.ranksep !== undefined) lines.push(`  ranksep=${options.ranksep};`);
    if (options.fontname) lines.push(`  fontname="${options.fontname}";`);
    if (options.fontsize) lines.push(`  fontsize=${options.fontsize};`);
    lines.push('  compound=true;');
    lines.push('');
  }

  private addNodes(lines: string[], graph: CallGraph, options: DotFormatOptions): void {
    for (const node of graph.nodes) {
      const attributes = this.getNodeAttributes(node, node.id === graph.entryPointId, options);
      lines.push(`  "${node.id}" [${attributes}];`);
    }
  }

  private addClusteredNodes(lines: string[], graph: CallGraph, options: DotFormatOptions): void {
    // Group nodes by file
    const nodesByFile = new Map<string, CallGraphNode[]>();

    for (const node of graph.nodes) {
      const file = node.filePath;
      if (!nodesByFile.has(file)) {
        nodesByFile.set(file, []);
      }
      nodesByFile.get(file)!.push(node);
    }

    // Create subgraphs for each file
    let clusterIndex = 0;
    for (const [file, nodes] of nodesByFile) {
      lines.push(`  subgraph cluster_${clusterIndex} {`);
      lines.push(`    label="${this.escapeLabel(this.getFileName(file))}";`);
      lines.push('    style=filled;');
      lines.push('    color=lightgrey;');
      lines.push('    node [style=filled, color=white];');

      for (const node of nodes) {
        const attributes = this.getNodeAttributes(node, node.id === graph.entryPointId, options);
        lines.push(`    "${node.id}" [${attributes}];`);
      }

      lines.push('  }');
      lines.push('');
      clusterIndex++;
    }
  }

  private getNodeAttributes(
    node: CallGraphNode,
    isEntryPoint: boolean,
    options: DotFormatOptions
  ): string {
    const attributes: string[] = [];

    // Label
    const label = this.formatNodeLabel(node, options);
    attributes.push(`label="${this.escapeLabel(label)}"`);

    // Shape based on type
    if (!options.nodeShape) {
      switch (node.type) {
        case 'method':
          attributes.push('shape=box');
          break;
        case 'function':
          attributes.push('shape=ellipse');
          break;
        case 'arrow':
          attributes.push('shape=diamond');
          break;
        case 'constructor':
          attributes.push('shape=house');
          break;
        case 'accessor':
          attributes.push('shape=hexagon');
          break;
      }
    }

    // Style for async functions
    if (node.async && options.showAsync !== false) {
      attributes.push('style=filled', 'fillcolor=lightblue');
    }

    // Style for static methods
    if (node.static) {
      attributes.push('style="filled,dashed"', 'fillcolor=lightyellow');
    }

    // Highlight entry point
    if (isEntryPoint) {
      attributes.push('peripheries=2', 'penwidth=2');
    }

    // Add tooltip with full information
    const tooltip = this.formatNodeTooltip(node);
    attributes.push(`tooltip="${this.escapeLabel(tooltip)}"`);

    return attributes.join(', ');
  }

  private formatNodeLabel(node: CallGraphNode, options: DotFormatOptions): string {
    let label = node.name;

    // Add class name for methods
    if (node.type === 'method' && node.className) {
      label = `${node.className}.${node.name}`;
    }

    // Add async indicator
    if (node.async && options.showAsync !== false) {
      label = `async ${label}`;
    }

    // Add static indicator
    if (node.static) {
      label = `static ${label}`;
    }

    // Add parameters if not too long
    const paramStr = this.formatParameters(node);
    if (paramStr.length < 30) {
      label += paramStr;
    }

    return label;
  }

  private formatNodeTooltip(node: CallGraphNode): string {
    const parts: string[] = [
      `${node.name}`,
      `Type: ${node.type}`,
      `File: ${this.getFileName(node.filePath)}`,
      `Line: ${node.line}`,
    ];

    if (node.className) {
      parts.push(`Class: ${node.className}`);
    }

    if (node.async) {
      parts.push('Async: true');
    }

    if (node.static) {
      parts.push('Static: true');
    }

    if (node.visibility) {
      parts.push(`Visibility: ${node.visibility}`);
    }

    parts.push(`Return: ${node.returnType}`);

    return parts.join('\\n');
  }

  private formatParameters(node: CallGraphNode): string {
    if (!node.parameters || node.parameters.length === 0) {
      return '()';
    }

    const params = node.parameters
      .map(p => {
        let param = p.name;
        if (p.optional) param += '?';
        return param;
      })
      .join(', ');

    return `(${params})`;
  }

  private addEdges(lines: string[], graph: CallGraph, options: DotFormatOptions): void {
    for (const edge of graph.edges) {
      const attributes = this.getEdgeAttributes(edge, options);
      lines.push(`  "${edge.source}" -> "${edge.target}" [${attributes}];`);
    }
  }

  private getEdgeAttributes(edge: CallGraphEdge, options: DotFormatOptions): string {
    const attributes: string[] = [];

    // Style based on edge type
    switch (edge.type) {
      case 'async':
        attributes.push('style=dashed', 'color=blue');
        break;
      case 'callback':
        attributes.push('style=dotted', 'color=green');
        break;
      case 'constructor':
        attributes.push('style=bold', 'color=red');
        break;
      default:
        attributes.push('style=solid');
    }

    // Add conditional styling
    if (edge.conditional) {
      attributes.push('arrowhead=empty');
    }

    // Add label if requested
    if (options.showEdgeLabels) {
      const label = this.formatEdgeLabel(edge);
      if (label) {
        attributes.push(`label="${this.escapeLabel(label)}"`);
      }
    }

    // Add tooltip
    const tooltip = `Line ${edge.line}${edge.column ? `, Col ${edge.column}` : ''}`;
    attributes.push(`tooltip="${tooltip}"`);

    return attributes.join(', ');
  }

  private formatEdgeLabel(edge: CallGraphEdge): string {
    const parts: string[] = [];

    if (edge.type !== 'sync') {
      parts.push(edge.type);
    }

    if (edge.conditional) {
      parts.push('?');
    }

    return parts.join(' ');
  }

  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private escapeLabel(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  formatStream(graph: CallGraph, stream: Writable, options: DotFormatOptions = {}): void {
    try {
      const output = this.format(graph, options);
      stream.write(output);
      stream.end();
    } catch (error) {
      stream.emit('error', error);
    }
  }

  validate(output: string): ValidationResult {
    try {
      // Basic DOT syntax validation
      const lines = output.split('\n');

      // Check for graph declaration
      if (!lines[0].trim().match(/^(di)?graph\s+\w*\s*\{$/)) {
        return {
          isValid: false,
          error: 'Invalid DOT format: Missing graph declaration',
        };
      }

      // Check for closing brace
      if (!lines[lines.length - 1].trim().match(/^\}$/)) {
        return {
          isValid: false,
          error: 'Invalid DOT format: Missing closing brace',
        };
      }

      // Check for balanced quotes
      let quoteCount = 0;
      for (const line of lines) {
        for (const char of line) {
          if (char === '"' && line[line.indexOf(char) - 1] !== '\\') {
            quoteCount++;
          }
        }
      }

      if (quoteCount % 2 !== 0) {
        return {
          isValid: false,
          error: 'Invalid DOT format: Unbalanced quotes',
        };
      }

      // Check for valid node/edge declarations
      const nodeEdgePattern =
        /^\s*(subgraph\s+\w+\s*\{|"?[^"]+\s*(->\s*[^;]+)?\s*(\[.*\])?\s*;?|rankdir|nodesep|ranksep|fontname|fontsize|compound|node\s*\[|edge\s*\[|label=|\}|;)/;
      const contentLines = lines.slice(1, -1);

      for (const line of contentLines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('//') && !nodeEdgePattern.test(trimmedLine)) {
          return {
            isValid: false,
            error: `Invalid DOT format: Unrecognized syntax: ${trimmedLine}`,
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `DOT validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
