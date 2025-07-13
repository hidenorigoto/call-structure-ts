import { CallGraph } from '../types/CallGraph';
import { Formatter, FormatOptions, ValidationResult, CircularReferenceStrategy } from '../types/Formatter';
import { Writable } from 'stream';

/**
 * Mermaid-specific format options
 */
export interface MermaidFormatOptions extends FormatOptions {
  /** Direction of the diagram: Top-Down, Left-Right, etc. */
  direction?: 'TD' | 'LR' | 'BT' | 'RL';
  /** Mermaid theme */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  /** Whether to cluster nodes by module/file */
  clusterByModule?: boolean;
  /** Maximum number of nodes to display (for large graphs) */
  maxNodes?: number;
  /** Whether to show edge labels */
  showEdgeLabels?: boolean;
  /** Diagram type: flowchart or sequence */
  diagramType?: 'flowchart' | 'sequence';
}

export class MermaidFormatter implements Formatter {
  format(callGraph: CallGraph, options: FormatOptions = {}): string {
    const mermaidOptions = options as MermaidFormatOptions;
    
    // Handle circular references if needed
    const processedGraph = this.handleCircularReferences(callGraph, options);
    
    // Apply node limit if specified
    const limitedGraph = this.applyNodeLimit(processedGraph, mermaidOptions.maxNodes);
    
    // Choose diagram type
    if (mermaidOptions.diagramType === 'sequence') {
      return this.formatAsSequenceDiagram(limitedGraph);
    }
    
    // Default to flowchart with clustering option
    if (mermaidOptions.clusterByModule) {
      return this.formatWithSubgraphs(limitedGraph, mermaidOptions);
    }
    
    return this.formatAsFlowchart(limitedGraph, mermaidOptions);
  }

  private formatAsFlowchart(callGraph: CallGraph, options: MermaidFormatOptions): string {
    const { nodes, edges } = callGraph;
    const lines: string[] = [];

    // Add theme if specified
    if (options.theme && options.theme !== 'default') {
      lines.push(`%%{init: {'theme':'${options.theme}'}}%%`);
    }

    // Mermaid diagram header with direction
    const direction = options.direction || 'TD';
    lines.push(`flowchart ${direction}`);
    lines.push('');

    // Add nodes with proper styling
    const nodeDefinitions = this.generateNodeDefinitions(nodes, callGraph.entryPointId);
    lines.push(...nodeDefinitions);
    lines.push('');

    // Add edges
    const edgeDefinitions = this.generateEdgeDefinitions(edges, nodes, options.showEdgeLabels);
    lines.push(...edgeDefinitions);
    lines.push('');

    // Add styling
    const styleDefinitions = this.generateStyleDefinitions(nodes, callGraph.entryPointId);
    lines.push(...styleDefinitions);

    // Add click events if in detailed mode
    if (options.includeMetadata) {
      lines.push('');
      const clickEvents = this.generateClickEvents(nodes);
      lines.push(...clickEvents);
    }

    return lines.join('\n');
  }

  private generateNodeDefinitions(nodes: CallGraph['nodes'], entryPointId: string): string[] {
    const lines: string[] = [];
    const nodeMap = new Map<string, string>();

    // Generate safe node IDs
    nodes.forEach((node, index) => {
      const safeId = this.generateSafeNodeId(node, index);
      nodeMap.set(node.id, safeId);
    });

    // Generate node definitions
    nodes.forEach(node => {
      const safeId = nodeMap.get(node.id)!;
      const label = this.generateNodeLabel(node);
      const shape = this.getNodeShape(node, node.id === entryPointId);

      lines.push(`    ${safeId}${shape.start}"${label}"${shape.end}`);
    });

    // Store node mapping for edge generation
    this.nodeMap = nodeMap;

    return lines;
  }

  private nodeMap = new Map<string, string>();

  private generateEdgeDefinitions(edges: CallGraph['edges'], _nodes: CallGraph['nodes'], showEdgeLabels?: boolean): string[] {
    const lines: string[] = [];
    const edgeMap = new Map<string, number>();

    edges.forEach(edge => {
      const sourceId = this.nodeMap.get(edge.source);
      const targetId = this.nodeMap.get(edge.target);

      if (!sourceId || !targetId) return;

      const edgeKey = `${sourceId}-${targetId}`;
      const count = edgeMap.get(edgeKey) || 0;
      edgeMap.set(edgeKey, count + 1);

      const arrow = this.getArrowStyle(edge.type);
      const label = showEdgeLabels !== false ? this.getEdgeLabel(edge, count) : '';

      lines.push(`    ${sourceId} ${arrow}${label} ${targetId}`);
    });

    return lines;
  }

  private generateStyleDefinitions(nodes: CallGraph['nodes'], entryPointId: string): string[] {
    const lines: string[] = [];

    // Define style classes
    lines.push('    %% Styling');
    lines.push('    classDef entryPoint fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000;');
    lines.push(
      '    classDef asyncFunction fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000;'
    );
    lines.push('    classDef method fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px,color:#000;');
    lines.push('    classDef constructor fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000;');
    lines.push(
      '    classDef arrowFunction fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000;'
    );
    lines.push('');

    // Apply styles to nodes
    const entryPointSafeId = this.nodeMap.get(entryPointId);
    if (entryPointSafeId) {
      lines.push(`    class ${entryPointSafeId} entryPoint;`);
    }

    const asyncNodes: string[] = [];
    const methodNodes: string[] = [];
    const constructorNodes: string[] = [];
    const arrowNodes: string[] = [];

    nodes.forEach(node => {
      const safeId = this.nodeMap.get(node.id);
      if (!safeId || node.id === entryPointId) return;

      if (node.async) {
        asyncNodes.push(safeId);
      } else if (node.type === 'method') {
        methodNodes.push(safeId);
      } else if (node.type === 'constructor') {
        constructorNodes.push(safeId);
      } else if (node.type === 'arrow') {
        arrowNodes.push(safeId);
      }
    });

    if (asyncNodes.length > 0) {
      lines.push(`    class ${asyncNodes.join(',')} asyncFunction;`);
    }
    if (methodNodes.length > 0) {
      lines.push(`    class ${methodNodes.join(',')} method;`);
    }
    if (constructorNodes.length > 0) {
      lines.push(`    class ${constructorNodes.join(',')} constructor;`);
    }
    if (arrowNodes.length > 0) {
      lines.push(`    class ${arrowNodes.join(',')} arrowFunction;`);
    }

    return lines;
  }

  private generateClickEvents(nodes: CallGraph['nodes']): string[] {
    const lines: string[] = [];
    lines.push('    %% Click events for navigation');

    nodes.forEach(node => {
      const safeId = this.nodeMap.get(node.id);
      if (!safeId) return;

      const filePath = this.getRelativePath(node.filePath);
      const clickInfo = `"${node.name} in ${filePath}:${node.line}"`;
      lines.push(`    click ${safeId} ${clickInfo};`);
    });

    return lines;
  }

  private generateSafeNodeId(node: CallGraph['nodes'][0], index: number): string {
    // Create a safe identifier for Mermaid
    let safeName = node.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

    if (!safeName || safeName.length === 0) {
      safeName = `node_${index}`;
    }

    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(safeName)) {
      safeName = `n_${safeName}`;
    }

    return safeName;
  }

  private generateNodeLabel(node: CallGraph['nodes'][0]): string {
    let label = node.name;

    // Add class context for methods
    if (node.className && node.type === 'method') {
      label = `${node.className}.${label}`;
    }

    // Add type indicator
    if (node.async) {
      label = `� ${label}`;
    }

    // Add visibility for methods
    if (node.visibility && node.visibility !== 'public') {
      const visibilitySymbol = node.visibility === 'private' ? '=' : '=';
      label = `${visibilitySymbol} ${label}`;
    }

    // Add static indicator
    if (node.static) {
      label = `=� ${label}`;
    }

    return label;
  }

  private getNodeShape(
    node: CallGraph['nodes'][0],
    isEntryPoint: boolean
  ): { start: string; end: string } {
    if (isEntryPoint) {
      return { start: '((', end: '))' }; // Double circle for entry point
    }

    switch (node.type) {
      case 'method':
        return { start: '[', end: ']' }; // Rectangle for methods
      case 'constructor':
        return { start: '[[', end: ']]' }; // Rounded rectangle for constructors
      case 'arrow':
        return { start: '>', end: ']' }; // Asymmetric for arrow functions
      case 'function':
      default:
        return { start: '(', end: ')' }; // Circle for regular functions
    }
  }

  private getArrowStyle(edgeType: CallGraph['edges'][0]['type']): string {
    switch (edgeType) {
      case 'async':
        return '-.->'; // Dashed arrow for async calls
      case 'callback':
        return '..->'; // Dotted arrow for callbacks
      case 'constructor':
        return '==>'; // Thick arrow for constructor calls
      case 'sync':
      default:
        return '-->'; // Regular arrow for sync calls
    }
  }

  private getEdgeLabel(edge: CallGraph['edges'][0], count: number): string {
    let label = '';

    // Add count if multiple calls
    if (count > 0) {
      label = `|"${count + 1}x"|`;
    }

    // Add type information for complex cases
    if (edge.type === 'async') {
      label = label || '|"await"|';
    } else if (edge.type === 'callback') {
      label = label || '|"callback"|';
    }

    return label;
  }

  /**
   * Generate a subgraph-based diagram for better organization
   */
  formatWithSubgraphs(callGraph: CallGraph, _options: MermaidFormatOptions = {}): string {
    const { nodes, edges } = callGraph;
    const lines: string[] = [];

    lines.push('flowchart TD');
    lines.push('');

    // Group nodes by file
    const fileGroups = this.groupNodesByFile(nodes);

    // Generate subgraphs for each file
    let subgraphIndex = 0;
    const nodeMap = new Map<string, string>();

    for (const [filePath, fileNodes] of fileGroups) {
      const fileName = this.getFileName(filePath);
      const subgraphId = `sg${subgraphIndex++}`;

      lines.push(`    subgraph ${subgraphId}["📁 ${fileName}"]`);

      fileNodes.forEach((node, index) => {
        const safeId = this.generateSafeNodeId(node, index);
        nodeMap.set(node.id, safeId);

        const label = node.name;
        const shape = this.getNodeShape(node, node.id === callGraph.entryPointId);

        lines.push(`        ${safeId}${shape.start}"${label}"${shape.end}`);
      });

      lines.push('    end');
      lines.push('');
    }

    // Add edges between subgraphs
    edges.forEach(edge => {
      const sourceId = nodeMap.get(edge.source);
      const targetId = nodeMap.get(edge.target);

      if (sourceId && targetId) {
        const arrow = this.getArrowStyle(edge.type);
        lines.push(`    ${sourceId} ${arrow} ${targetId}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate a sequence diagram for call flow
   */
  formatAsSequenceDiagram(callGraph: CallGraph): string {
    const { nodes, edges, entryPointId } = callGraph;
    const lines: string[] = [];

    lines.push('sequenceDiagram');
    lines.push('    participant Entry as Entry Point');

    // Add participants
    const participants = new Set<string>();
    nodes.forEach(node => {
      if (node.id !== entryPointId) {
        const participant = node.className || this.getFileName(node.filePath);
        participants.add(participant);
      }
    });

    participants.forEach(participant => {
      lines.push(`    participant ${participant}`);
    });

    lines.push('');

    // Add sequence of calls
    let stepNumber = 1;
    const processedEdges = new Set<string>();

    const addCallSequence = (nodeId: string, depth: number = 0): void => {
      if (depth > 5) return; // Prevent infinite recursion

      const outgoingEdges = edges.filter(
        edge => edge.source === nodeId && !processedEdges.has(edge.id)
      );

      outgoingEdges.forEach(edge => {
        processedEdges.add(edge.id);

        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          const sourceParticipant =
            edge.source === entryPointId
              ? 'Entry'
              : sourceNode.className || this.getFileName(sourceNode.filePath);

          const targetParticipant = targetNode.className || this.getFileName(targetNode.filePath);

          const arrow = edge.type === 'async' ? '->>+' : '->>';
          const label = `${stepNumber++}. ${targetNode.name}`;

          lines.push(`    ${sourceParticipant} ${arrow} ${targetParticipant}: ${label}`);

          // Recursively process calls from target
          addCallSequence(edge.target, depth + 1);
        }
      });
    };

    addCallSequence(entryPointId);

    return lines.join('\n');
  }

  private groupNodesByFile(nodes: CallGraph['nodes']): Map<string, CallGraph['nodes']> {
    const groups = new Map<string, CallGraph['nodes']>();

    nodes.forEach(node => {
      const filePath = node.filePath;
      if (!groups.has(filePath)) {
        groups.set(filePath, []);
      }
      groups.get(filePath)!.push(node);
    });

    return groups;
  }

  private getFileName(filePath: string): string {
    return filePath.split('/').pop()?.replace('.ts', '') || 'unknown';
  }

  private getRelativePath(filePath: string): string {
    const parts = filePath.split('/');
    const srcIndex = parts.findIndex(part => part === 'src');
    if (srcIndex !== -1) {
      return parts.slice(srcIndex).join('/');
    }
    return parts.slice(-2).join('/');
  }

  /**
   * Validate Mermaid syntax
   */
  validate(mermaidString: string): ValidationResult {
    const lines = mermaidString.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return { isValid: false, error: 'Empty diagram' };
    }

    const firstLine = lines[0].trim();
    const isFlowchart = firstLine.startsWith('flowchart');
    const isSequence = firstLine.startsWith('sequenceDiagram');
    
    if (!isFlowchart && !isSequence) {
      return { isValid: false, error: 'Invalid diagram type' };
    }

    // Different validation for sequence diagrams
    if (isSequence) {
      return this.validateSequenceDiagram(lines);
    }

    // Flowchart validation
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('%% ')) continue; // Comment
      if (line.startsWith('class ')) continue; // Style
      if (line.startsWith('classDef ')) continue; // Style definition
      if (line.startsWith('click ')) continue; // Click event
      if (line.startsWith('subgraph ')) continue; // Subgraph
      if (line === 'end') continue; // Subgraph end

      // Check for valid node or edge definition
      const hasArrow =
        line.includes('-->') ||
        line.includes('-.->') ||
        line.includes('..->') ||
        line.includes('==>');
      const hasNodeDef = /^\s*\w+[[(].+[\])]/.test(line);

      if (!hasArrow && !hasNodeDef && line.length > 0) {
        return { isValid: false, error: `Invalid syntax at line ${i + 1}: ${line}` };
      }
    }

    return { isValid: true };
  }
  
  private validateSequenceDiagram(lines: string[]): ValidationResult {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Valid sequence diagram elements
      if (line.startsWith('participant ')) continue;
      if (line.startsWith('actor ')) continue;
      if (line.startsWith('activate ')) continue;
      if (line.startsWith('deactivate ')) continue;
      if (line.startsWith('note ')) continue;
      if (line.startsWith('loop ')) continue;
      if (line.startsWith('alt ')) continue;
      if (line.startsWith('opt ')) continue;
      if (line.startsWith('par ')) continue;
      if (line.startsWith('rect ')) continue;
      if (line === 'end') continue;
      if (line.startsWith('%% ')) continue; // Comment
      
      // Check for message arrows
      const hasSequenceArrow = 
        line.includes('->>') ||
        line.includes('-->>') ||
        line.includes('->>+') ||
        line.includes('->>-') ||
        line.includes('->') ||
        line.includes('-->');
        
      if (!hasSequenceArrow && line.length > 0) {
        return { isValid: false, error: `Invalid sequence diagram syntax at line ${i + 1}: ${line}` };
      }
    }
    
    return { isValid: true };
  }

  /**
   * Stream format a call graph to a writable stream
   * Efficiently handles large graphs by streaming Mermaid diagram in chunks
   */
  formatStream(callGraph: CallGraph, stream: Writable, options: FormatOptions = {}): void {
    const mermaidOptions = options as MermaidFormatOptions;
    const chunkSize = options.chunkSize || 100;
    
    try {
      // Handle circular references if needed
      const processedGraph = this.handleCircularReferences(callGraph, options);
      
      // Apply node limit if specified
      const limitedGraph = this.applyNodeLimit(processedGraph, mermaidOptions.maxNodes);
      
      // Choose diagram type
      if (mermaidOptions.diagramType === 'sequence') {
        this.streamSequenceDiagram(limitedGraph, stream, mermaidOptions);
        return;
      }
      
      // Default to flowchart
      if (mermaidOptions.clusterByModule) {
        this.streamSubgraphDiagram(limitedGraph, stream, mermaidOptions, chunkSize);
      } else {
        this.streamFlowchartDiagram(limitedGraph, stream, mermaidOptions, chunkSize);
      }
    } catch (error) {
      stream.emit('error', error);
    }
  }

  private streamFlowchartDiagram(
    callGraph: CallGraph, 
    stream: Writable, 
    options: MermaidFormatOptions,
    chunkSize: number
  ): void {
    const { nodes, edges } = callGraph;
    
    // Write theme if specified
    if (options.theme && options.theme !== 'default') {
      stream.write(`%%{init: {'theme':'${options.theme}'}}%%\n`);
    }
    
    // Write diagram header
    const direction = options.direction || 'TD';
    stream.write(`flowchart ${direction}\n\n`);
    
    // Stream nodes in chunks
    for (let i = 0; i < nodes.length; i += chunkSize) {
      const chunk = nodes.slice(i, i + chunkSize);
      const nodeDefinitions = this.generateNodeDefinitions(chunk, callGraph.entryPointId);
      stream.write(nodeDefinitions.join('\n') + '\n');
    }
    
    stream.write('\n');
    
    // Stream edges in chunks
    for (let i = 0; i < edges.length; i += chunkSize) {
      const chunk = edges.slice(i, i + chunkSize);
      const edgeDefinitions = this.generateEdgeDefinitions(chunk, nodes, options.showEdgeLabels);
      stream.write(edgeDefinitions.join('\n') + '\n');
    }
    
    stream.write('\n');
    
    // Write styling
    const styleDefinitions = this.generateStyleDefinitions(nodes, callGraph.entryPointId);
    stream.write(styleDefinitions.join('\n') + '\n');
    
    // Add click events if requested
    if (options.includeMetadata) {
      stream.write('\n');
      const clickEvents = this.generateClickEvents(nodes);
      stream.write(clickEvents.join('\n') + '\n');
    }
    
    stream.end();
  }

  private streamSubgraphDiagram(
    callGraph: CallGraph,
    stream: Writable,
    options: MermaidFormatOptions,
    chunkSize: number
  ): void {
    const { nodes, edges } = callGraph;
    
    stream.write('flowchart TD\n\n');
    
    // Group nodes by file
    const fileGroups = this.groupNodesByFile(nodes);
    let subgraphIndex = 0;
    
    // Stream subgraphs
    for (const [filePath, fileNodes] of fileGroups) {
      const fileName = this.getFileName(filePath);
      const subgraphId = `sg${subgraphIndex++}`;
      
      stream.write(`    subgraph ${subgraphId}["📁 ${fileName}"]\n`);
      
      for (let i = 0; i < fileNodes.length; i += chunkSize) {
        const chunk = fileNodes.slice(i, i + chunkSize);
        chunk.forEach((node, index) => {
          const safeId = this.generateSafeNodeId(node, index);
          this.nodeMap.set(node.id, safeId);
          
          const label = node.name;
          const shape = this.getNodeShape(node, node.id === callGraph.entryPointId);
          
          stream.write(`        ${safeId}${shape.start}"${label}"${shape.end}\n`);
        });
      }
      
      stream.write('    end\n\n');
    }
    
    // Stream edges in chunks
    for (let i = 0; i < edges.length; i += chunkSize) {
      const chunk = edges.slice(i, i + chunkSize);
      chunk.forEach(edge => {
        const sourceId = this.nodeMap.get(edge.source);
        const targetId = this.nodeMap.get(edge.target);
        
        if (sourceId && targetId) {
          const arrow = this.getArrowStyle(edge.type);
          stream.write(`    ${sourceId} ${arrow} ${targetId}\n`);
        }
      });
    }
    
    stream.end();
  }

  private streamSequenceDiagram(
    callGraph: CallGraph,
    stream: Writable,
    _options: MermaidFormatOptions
  ): void {
    const { nodes, edges, entryPointId } = callGraph;
    
    stream.write('sequenceDiagram\n');
    stream.write('    participant Entry as Entry Point\n');
    
    // Add participants
    const participants = new Set<string>();
    nodes.forEach(node => {
      if (node.id !== entryPointId) {
        const participant = node.className || this.getFileName(node.filePath);
        participants.add(participant);
      }
    });
    
    participants.forEach(participant => {
      stream.write(`    participant ${participant}\n`);
    });
    
    stream.write('\n');
    
    // Stream sequence of calls
    let stepNumber = 1;
    const processedEdges = new Set<string>();
    
    const addCallSequence = (nodeId: string, depth: number = 0): void => {
      if (depth > 5) return;
      
      const outgoingEdges = edges.filter(
        edge => edge.source === nodeId && !processedEdges.has(edge.id)
      );
      
      outgoingEdges.forEach(edge => {
        processedEdges.add(edge.id);
        
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const sourceParticipant =
            edge.source === entryPointId
              ? 'Entry'
              : sourceNode.className || this.getFileName(sourceNode.filePath);
          
          const targetParticipant = targetNode.className || this.getFileName(targetNode.filePath);
          
          const arrow = edge.type === 'async' ? '->>+' : '->>';
          const label = `${stepNumber++}. ${targetNode.name}`;
          
          stream.write(`    ${sourceParticipant} ${arrow} ${targetParticipant}: ${label}\n`);
          
          // Recursively process calls from target
          addCallSequence(edge.target, depth + 1);
        }
      });
    };
    
    addCallSequence(entryPointId);
    stream.end();
  }

  /**
   * Handle circular references based on the specified strategy
   */
  private handleCircularReferences(callGraph: CallGraph, options: FormatOptions): CallGraph {
    const strategy = options.circularReferenceStrategy || CircularReferenceStrategy.REFERENCE;
    
    if (strategy === CircularReferenceStrategy.OMIT) {
      // Remove edges that create cycles
      const cycles = this.detectCycles(callGraph);
      const cyclicEdges = new Set<string>();
      
      cycles.forEach(cycle => {
        // Find the edge that completes the cycle
        const lastEdge = callGraph.edges.find(
          e => e.source === cycle[cycle.length - 2] && e.target === cycle[cycle.length - 1]
        );
        if (lastEdge) {
          cyclicEdges.add(lastEdge.id);
        }
      });
      
      return {
        ...callGraph,
        edges: callGraph.edges.filter(e => !cyclicEdges.has(e.id))
      };
    } else if (strategy === CircularReferenceStrategy.REFERENCE) {
      // Mark circular edges with a special property
      const cycles = this.detectCycles(callGraph);
      const markedEdges = [...callGraph.edges];
      
      cycles.forEach(cycle => {
        const lastEdge = markedEdges.find(
          e => e.source === cycle[cycle.length - 2] && e.target === cycle[cycle.length - 1]
        );
        if (lastEdge) {
          (lastEdge as any).circular = true;
        }
      });
      
      return {
        ...callGraph,
        edges: markedEdges
      };
    }
    
    // INLINE_ONCE - for Mermaid we'll just return as-is since Mermaid handles cycles
    return callGraph;
  }

  /**
   * Apply node limit to the graph
   */
  private applyNodeLimit(callGraph: CallGraph, maxNodes?: number): CallGraph {
    if (!maxNodes || callGraph.nodes.length <= maxNodes) {
      return callGraph;
    }
    
    // Prioritize nodes based on their connectivity
    const nodeScores = new Map<string, number>();
    
    // Initialize scores
    callGraph.nodes.forEach(node => {
      nodeScores.set(node.id, 0);
    });
    
    // Score based on edges (both incoming and outgoing)
    callGraph.edges.forEach(edge => {
      nodeScores.set(edge.source, (nodeScores.get(edge.source) || 0) + 1);
      nodeScores.set(edge.target, (nodeScores.get(edge.target) || 0) + 1);
    });
    
    // Always include entry point
    nodeScores.set(callGraph.entryPointId, Infinity);
    
    // Sort nodes by score and take top N
    const sortedNodes = [...callGraph.nodes].sort(
      (a, b) => (nodeScores.get(b.id) || 0) - (nodeScores.get(a.id) || 0)
    );
    
    const selectedNodes = sortedNodes.slice(0, maxNodes);
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    
    // Filter edges to only include those between selected nodes
    const filteredEdges = callGraph.edges.filter(
      edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );
    
    return {
      ...callGraph,
      nodes: selectedNodes,
      edges: filteredEdges
    };
  }

  /**
   * Detect cycles in the call graph
   */
  private detectCycles(callGraph: CallGraph): string[][] {
    const { nodes, edges } = callGraph;
    const cycles: string[][] = [];
    
    // For large graphs, use a simpler approach
    if (nodes.length > 1000) {
      // Simple self-loop detection
      edges.forEach(edge => {
        if (edge.source === edge.target) {
          cycles.push([edge.source, edge.target]);
        }
      });
      return cycles;
    }
    
    // For smaller graphs, use proper DFS
    const adjacencyList = new Map<string, string[]>();
    
    // Build adjacency list
    nodes.forEach(node => adjacencyList.set(node.id, []));
    edges.forEach(edge => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });
    
    // DFS to detect cycles
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);
      
      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
      
      path.pop();
      recStack.delete(nodeId);
    };
    
    // Run DFS from each unvisited node
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });
    
    return cycles;
  }
}
