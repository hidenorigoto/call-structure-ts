import {
  CallGraph,
  CallGraphNode,
  CallGraphValidationResult,
  CallGraphValidationError,
  CallGraphValidationWarning,
  CallGraphSpecification
} from '../types/CallGraph';

/**
 * Structure Validator for comparing actual call graphs against expected specifications
 * 
 * Validates that a generated call graph matches the expected structure defined in
 * a CallGraphSpecification. Supports:
 * - Required edges validation
 * - Forbidden edges detection
 * - Node existence checks
 * - Partial matching with wildcards
 * - Detailed error reporting
 */
export class StructureValidator {
  
  /**
   * Validate a call graph against a specification
   */
  validate(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationResult {
    const errors: CallGraphValidationError[] = [];
    const warnings: CallGraphValidationWarning[] = [];
    
    // Validate entry point
    const entryPointErrors = this.validateEntryPoint(callGraph, specification);
    errors.push(...entryPointErrors);
    
    // Validate required edges
    const requiredEdgeErrors = this.validateRequiredEdges(callGraph, specification);
    errors.push(...requiredEdgeErrors);
    
    // Validate forbidden edges
    const forbiddenEdgeErrors = this.validateForbiddenEdges(callGraph, specification);
    errors.push(...forbiddenEdgeErrors);
    
    // Validate required nodes
    const requiredNodeErrors = this.validateRequiredNodes(callGraph, specification);
    errors.push(...requiredNodeErrors);
    
    // Validate forbidden nodes
    const forbiddenNodeErrors = this.validateForbiddenNodes(callGraph, specification);
    errors.push(...forbiddenNodeErrors);
    
    // Check complexity constraints
    const complexityWarnings = this.validateComplexity(callGraph, specification);
    warnings.push(...complexityWarnings);
    
    // Generate summary
    const summary = this.generateSummary(callGraph, specification, errors);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary
    };
  }
  
  /**
   * Validate entry point matches specification
   */
  private validateEntryPoint(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationError[] {
    const errors: CallGraphValidationError[] = [];
    
    if (specification.entryPoint) {
      const entryNode = callGraph.nodes.find(n => n.id === callGraph.entryPointId);
      
      if (!entryNode) {
        errors.push({
          type: 'missing_node',
          message: 'Entry point node not found in call graph',
          expected: specification.entryPoint,
          actual: callGraph.entryPointId
        });
      } else if (!this.matchesPattern(entryNode.name, specification.entryPoint)) {
        errors.push({
          type: 'type_mismatch',
          message: `Entry point '${entryNode.name}' does not match expected pattern '${specification.entryPoint}'`,
          expected: specification.entryPoint,
          actual: entryNode.name,
          location: {
            file: entryNode.filePath,
            line: entryNode.line
          }
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate all required edges are present
   */
  private validateRequiredEdges(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationError[] {
    const errors: CallGraphValidationError[] = [];
    
    for (const requiredEdge of specification.requiredEdges) {
      const sourceNodes = this.findNodesByPattern(callGraph.nodes, requiredEdge.from);
      const targetNodes = this.findNodesByPattern(callGraph.nodes, requiredEdge.to);
      
      if (sourceNodes.length === 0) {
        errors.push({
          type: 'missing_node',
          message: `Required edge source node '${requiredEdge.from}' not found`,
          expected: requiredEdge.from,
          actual: null
        });
        continue;
      }
      
      if (targetNodes.length === 0) {
        errors.push({
          type: 'missing_node',
          message: `Required edge target node '${requiredEdge.to}' not found`,
          expected: requiredEdge.to,
          actual: null
        });
        continue;
      }
      
      let edgeFound = false;
      
      for (const sourceNode of sourceNodes) {
        for (const targetNode of targetNodes) {
          const edge = callGraph.edges.find(e => 
            e.source === sourceNode.id && 
            e.target === targetNode.id &&
            e.type === requiredEdge.type
          );
          
          if (edge) {
            edgeFound = true;
            break;
          }
        }
        if (edgeFound) break;
      }
      
      if (!edgeFound) {
        const sourceNode = sourceNodes[0];
        
        errors.push({
          type: 'missing_edge',
          message: `Required edge from '${requiredEdge.from}' to '${requiredEdge.to}' of type '${requiredEdge.type}' not found`,
          expected: requiredEdge,
          actual: null,
          location: {
            file: sourceNode.filePath,
            line: sourceNode.line
          }
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate no forbidden edges are present
   */
  private validateForbiddenEdges(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationError[] {
    const errors: CallGraphValidationError[] = [];
    
    for (const forbiddenEdge of specification.forbiddenEdges) {
      const sourceNodes = this.findNodesByPattern(callGraph.nodes, forbiddenEdge.from);
      const targetNodes = this.findNodesByPattern(callGraph.nodes, forbiddenEdge.to);
      
      for (const sourceNode of sourceNodes) {
        for (const targetNode of targetNodes) {
          const edges = callGraph.edges.filter(e => 
            e.source === sourceNode.id && 
            e.target === targetNode.id &&
            (!forbiddenEdge.type || e.type === forbiddenEdge.type)
          );
          
          for (const edge of edges) {
            errors.push({
              type: 'forbidden_edge',
              message: `Forbidden edge from '${sourceNode.name}' to '${targetNode.name}' of type '${edge.type}' found`,
              expected: null,
              actual: forbiddenEdge,
              location: {
                file: sourceNode.filePath,
                line: sourceNode.line
              }
            });
          }
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate all required nodes are present
   */
  private validateRequiredNodes(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationError[] {
    const errors: CallGraphValidationError[] = [];
    
    if (specification.requiredNodes) {
      for (const requiredNodePattern of specification.requiredNodes) {
        const matchingNodes = this.findNodesByPattern(callGraph.nodes, requiredNodePattern);
        
        if (matchingNodes.length === 0) {
          errors.push({
            type: 'missing_node',
            message: `Required node '${requiredNodePattern}' not found`,
            expected: requiredNodePattern,
            actual: null
          });
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate no forbidden nodes are present
   */
  private validateForbiddenNodes(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationError[] {
    const errors: CallGraphValidationError[] = [];
    
    if (specification.forbiddenNodes) {
      for (const forbiddenNodePattern of specification.forbiddenNodes) {
        const matchingNodes = this.findNodesByPattern(callGraph.nodes, forbiddenNodePattern);
        
        for (const node of matchingNodes) {
          errors.push({
            type: 'type_mismatch',
            message: `Forbidden node '${node.name}' found`,
            expected: null,
            actual: forbiddenNodePattern,
            location: {
              file: node.filePath,
              line: node.line
            }
          });
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate complexity constraints
   */
  private validateComplexity(callGraph: CallGraph, specification: CallGraphSpecification): CallGraphValidationWarning[] {
    const warnings: CallGraphValidationWarning[] = [];
    
    if (specification.maxDepth && callGraph.metadata.maxDepth > specification.maxDepth) {
      warnings.push({
        type: 'complexity',
        message: `Call graph depth ${callGraph.metadata.maxDepth} exceeds maximum allowed depth ${specification.maxDepth}`,
        suggestion: 'Consider refactoring to reduce call depth'
      });
    }
    
    if (specification.maxComplexity !== undefined) {
      // Calculate cyclomatic complexity based on edges and nodes
      const cyclomaticComplexity = callGraph.edges.length - callGraph.nodes.length + 2;
      
      if (cyclomaticComplexity > specification.maxComplexity) {
        warnings.push({
          type: 'complexity',
          message: `Cyclomatic complexity ${cyclomaticComplexity} exceeds maximum allowed complexity ${specification.maxComplexity}`,
          suggestion: 'Consider breaking down complex functions into smaller ones'
        });
      }
    }
    
    return warnings;
  }
  
  /**
   * Generate validation summary
   */
  private generateSummary(
    callGraph: CallGraph, 
    specification: CallGraphSpecification, 
    errors: CallGraphValidationError[]
  ): {
    requiredEdgesFound: number;
    requiredEdgesTotal: number;
    forbiddenEdgesFound: number;
    missingNodes: string[];
    unexpectedNodes: string[];
  } {
    const requiredEdgesFound = specification.requiredEdges.length - 
      errors.filter(e => e.type === 'missing_edge').length;
    
    const forbiddenEdgesFound = errors.filter(e => e.type === 'forbidden_edge').length;
    
    const missingNodes = errors
      .filter(e => e.type === 'missing_node' && e.expected)
      .map(e => e.expected as string);
    
    const unexpectedNodes = errors
      .filter(e => e.type === 'missing_node' && e.actual)
      .map(e => e.actual as string);
    
    return {
      requiredEdgesFound,
      requiredEdgesTotal: specification.requiredEdges.length,
      forbiddenEdgesFound,
      missingNodes,
      unexpectedNodes
    };
  }
  
  /**
   * Find nodes matching a pattern (supports wildcards)
   */
  private findNodesByPattern(nodes: CallGraphNode[], pattern: string): CallGraphNode[] {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
      return nodes.filter(node => 
        regex.test(node.name) || 
        regex.test(node.id) ||
        (node.className && regex.test(node.className))
      );
    }
    
    return nodes.filter(node => 
      node.name === pattern || 
      node.id === pattern ||
      node.className === pattern
    );
  }
  
  /**
   * Check if a string matches a pattern (supports wildcards)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
      return regex.test(value);
    }
    
    return value === pattern;
  }
  
  /**
   * Generate a human-readable validation report
   */
  generateReport(result: CallGraphValidationResult): string {
    const lines: string[] = [];
    
    lines.push('Call Graph Validation Report');
    lines.push('=' .repeat(30));
    lines.push('');
    
    lines.push(`Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
    lines.push(`Errors: ${result.errors.length}`);
    lines.push(`Warnings: ${result.warnings.length}`);
    lines.push('');
    
    // Summary
    lines.push('Summary:');
    lines.push(`  Required edges found: ${result.summary.requiredEdgesFound}/${result.summary.requiredEdgesTotal}`);
    lines.push(`  Forbidden edges found: ${result.summary.forbiddenEdgesFound}`);
    lines.push(`  Missing nodes: ${result.summary.missingNodes.length}`);
    lines.push(`  Unexpected nodes: ${result.summary.unexpectedNodes.length}`);
    lines.push('');
    
    // Errors
    if (result.errors.length > 0) {
      lines.push('Errors:');
      for (const error of result.errors) {
        lines.push(`  [${error.type.toUpperCase()}] ${error.message}`);
        if (error.location) {
          lines.push(`    Location: ${error.location.file}:${error.location.line}`);
        }
        if (error.expected) {
          lines.push(`    Expected: ${JSON.stringify(error.expected)}`);
        }
        if (error.actual) {
          lines.push(`    Actual: ${JSON.stringify(error.actual)}`);
        }
        lines.push('');
      }
    }
    
    // Warnings
    if (result.warnings.length > 0) {
      lines.push('Warnings:');
      for (const warning of result.warnings) {
        lines.push(`  [${warning.type.toUpperCase()}] ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`    Suggestion: ${warning.suggestion}`);
        }
        if (warning.location) {
          lines.push(`    Location: ${warning.location.file}:${warning.location.line}`);
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Create a diff report between expected and actual structures
   */
  generateDiffReport(callGraph: CallGraph, specification: CallGraphSpecification): string {
    const lines: string[] = [];
    
    lines.push('Call Graph Structure Diff');
    lines.push('=' .repeat(25));
    lines.push('');
    
    // Expected vs Actual nodes
    lines.push('Nodes:');
    const actualNodeNames = new Set(callGraph.nodes.map(n => n.name));
    const requiredNodeNames = new Set(specification.requiredNodes || []);
    
    for (const requiredNode of requiredNodeNames) {
      const found = Array.from(actualNodeNames).some(name => this.matchesPattern(name, requiredNode));
      lines.push(`  ${found ? '' : ''} ${requiredNode}`);
    }
    
    for (const actualNode of actualNodeNames) {
      const isRequired = Array.from(requiredNodeNames).some(pattern => this.matchesPattern(actualNode, pattern));
      if (!isRequired) {
        lines.push(`  + ${actualNode} (additional)`);
      }
    }
    lines.push('');
    
    // Expected vs Actual edges
    lines.push('Edges:');
    for (const requiredEdge of specification.requiredEdges) {
      const sourceNodes = this.findNodesByPattern(callGraph.nodes, requiredEdge.from);
      const targetNodes = this.findNodesByPattern(callGraph.nodes, requiredEdge.to);
      
      let found = false;
      for (const sourceNode of sourceNodes) {
        for (const targetNode of targetNodes) {
          const edge = callGraph.edges.find(e => 
            e.source === sourceNode.id && 
            e.target === targetNode.id &&
            e.type === requiredEdge.type
          );
          if (edge) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      
      lines.push(`  ${found ? '' : ''} ${requiredEdge.from} --${requiredEdge.type}--> ${requiredEdge.to}`);
    }
    
    return lines.join('\n');
  }
}

/**
 * Create a default specification for basic validation
 */
export function createBasicSpecification(entryPoint: string): CallGraphSpecification {
  return {
    entryPoint,
    requiredEdges: [],
    forbiddenEdges: [],
    requiredNodes: [entryPoint],
    forbiddenNodes: [],
    maxDepth: 10,
    maxComplexity: 20
  };
}

/**
 * Validate a call graph with a basic specification
 */
export function validateBasicStructure(callGraph: CallGraph, entryPoint: string): CallGraphValidationResult {
  const validator = new StructureValidator();
  const specification = createBasicSpecification(entryPoint);
  return validator.validate(callGraph, specification);
}