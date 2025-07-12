import { CallGraph, FormatterOptions } from '../types/CallGraph';

export class MermaidFormatter {
  format(callGraph: CallGraph, options: FormatterOptions = { format: 'mermaid' }): string {
    const { nodes, edges } = callGraph;

    const lines: string[] = [];

    // Mermaid diagram header
    lines.push('flowchart TD');
    lines.push('');

    // Add nodes with proper styling
    const nodeDefinitions = this.generateNodeDefinitions(nodes, callGraph.entryPointId);
    lines.push(...nodeDefinitions);
    lines.push('');

    // Add edges
    const edgeDefinitions = this.generateEdgeDefinitions(edges, nodes);
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

  private generateEdgeDefinitions(edges: CallGraph['edges'], nodes: CallGraph['nodes']): string[] {
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
      const label = this.getEdgeLabel(edge, count);

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
  formatWithSubgraphs(callGraph: CallGraph): string {
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

      lines.push(`    subgraph ${subgraphId}["=� ${fileName}"]`);

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

    const addCallSequence = (nodeId: string, depth: number = 0) => {
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
  validate(mermaidString: string): { isValid: boolean; error?: string } {
    const lines = mermaidString.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return { isValid: false, error: 'Empty diagram' };
    }

    const firstLine = lines[0].trim();
    if (!firstLine.startsWith('flowchart') && !firstLine.startsWith('sequenceDiagram')) {
      return { isValid: false, error: 'Invalid diagram type' };
    }

    // Basic syntax validation
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
      const hasNodeDef = /^\s*\w+[\[\(].+[\]\)]/.test(line);

      if (!hasArrow && !hasNodeDef && line.length > 0) {
        return { isValid: false, error: `Invalid syntax at line ${i + 1}: ${line}` };
      }
    }

    return { isValid: true };
  }
}
