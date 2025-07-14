import { 
  StructureValidator, 
  createBasicSpecification, 
  validateBasicStructure 
} from '../../src/analyzer/StructureValidator';
import { 
  CallGraph, 
  CallGraphNode, 
  CallGraphEdge,
  CallGraphSpecification,
  CallGraphValidationResult 
} from '../../src/types/CallGraph';

describe('StructureValidator', () => {
  let validator: StructureValidator;
  let sampleCallGraph: CallGraph;
  let sampleSpecification: CallGraphSpecification;

  beforeEach(() => {
    validator = new StructureValidator();
    
    // Create sample call graph
    const nodes: CallGraphNode[] = [
      {
        id: 'node_1',
        name: 'main',
        filePath: 'src/main.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void'
      },
      {
        id: 'node_2',
        name: 'processData',
        filePath: 'src/processor.ts',
        line: 10,
        type: 'function',
        async: true,
        parameters: [],
        returnType: 'Promise<string>'
      },
      {
        id: 'node_3',
        name: 'validateInput',
        filePath: 'src/validator.ts',
        line: 5,
        type: 'method',
        async: false,
        parameters: [],
        returnType: 'boolean',
        className: 'ValidationService'
      }
    ];

    const edges: CallGraphEdge[] = [
      {
        id: 'edge_1',
        source: 'node_1',
        target: 'node_2',
        type: 'sync',
        line: 5
      },
      {
        id: 'edge_2',
        source: 'node_2',
        target: 'node_3',
        type: 'async',
        line: 15
      }
    ];

    sampleCallGraph = {
      metadata: {
        generatedAt: '2024-01-01T00:00:00Z',
        entryPoint: 'main',
        maxDepth: 3,
        projectRoot: '/project',
        totalFiles: 3,
        analysisTimeMs: 100
      },
      nodes,
      edges,
      entryPointId: 'node_1'
    };

    sampleSpecification = {
      entryPoint: 'main',
      requiredEdges: [
        { from: 'main', to: 'processData', type: 'sync' },
        { from: 'processData', to: 'validateInput', type: 'async' }
      ],
      forbiddenEdges: [
        { from: 'validateInput', to: 'main', type: 'sync' }
      ],
      requiredNodes: ['main', 'processData', 'validateInput'],
      forbiddenNodes: ['deprecatedFunction'],
      maxDepth: 5,
      maxComplexity: 10
    };
  });

  describe('Basic Validation', () => {
    it('should validate a correct call graph', () => {
      const result = validator.validate(sampleCallGraph, sampleSpecification);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.requiredEdgesFound).toBe(2);
      expect(result.summary.requiredEdgesTotal).toBe(2);
      expect(result.summary.forbiddenEdgesFound).toBe(0);
    });

    it('should report missing required edges', () => {
      const incompleteGraph = {
        ...sampleCallGraph,
        edges: [sampleCallGraph.edges[0]] // Remove second edge
      };

      const result = validator.validate(incompleteGraph, sampleSpecification);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_edge');
      expect(result.errors[0].message).toContain('processData');
      expect(result.errors[0].message).toContain('validateInput');
    });

    it('should report forbidden edges', () => {
      const forbiddenEdge: CallGraphEdge = {
        id: 'edge_3',
        source: 'node_3',
        target: 'node_1',
        type: 'sync',
        line: 20
      };

      const graphWithForbiddenEdge = {
        ...sampleCallGraph,
        edges: [...sampleCallGraph.edges, forbiddenEdge]
      };

      const result = validator.validate(graphWithForbiddenEdge, sampleSpecification);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('forbidden_edge');
      expect(result.errors[0].message).toContain('validateInput');
      expect(result.errors[0].message).toContain('main');
    });

    it('should report missing required nodes', () => {
      const incompleteGraph = {
        ...sampleCallGraph,
        nodes: sampleCallGraph.nodes.slice(0, 2) // Remove validateInput node
      };

      const result = validator.validate(incompleteGraph, sampleSpecification);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_node')).toBe(true);
      expect(result.summary.missingNodes).toContain('validateInput');
    });
  });

  describe('Entry Point Validation', () => {
    it('should validate correct entry point', () => {
      const result = validator.validate(sampleCallGraph, sampleSpecification);
      
      expect(result.isValid).toBe(true);
    });

    it('should report incorrect entry point', () => {
      const wrongSpec = {
        ...sampleSpecification,
        entryPoint: 'wrongEntryPoint'
      };

      const result = validator.validate(sampleCallGraph, wrongSpec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'type_mismatch')).toBe(true);
    });

    it('should handle missing entry point node', () => {
      const graphWithoutEntry = {
        ...sampleCallGraph,
        entryPointId: 'nonexistent_node'
      };

      const result = validator.validate(graphWithoutEntry, sampleSpecification);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_node')).toBe(true);
    });
  });

  describe('Wildcard Pattern Matching', () => {
    it('should match wildcard patterns in node names', () => {
      const wildcardSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [
          { from: 'main', to: 'process*', type: 'sync' }
        ],
        forbiddenEdges: [],
        requiredNodes: ['*Data'],
        forbiddenNodes: ['*deprecated*']
      };

      const result = validator.validate(sampleCallGraph, wildcardSpec);
      
      expect(result.isValid).toBe(true);
      expect(result.summary.requiredEdgesFound).toBe(1);
    });

    it('should match wildcard patterns in forbidden nodes', () => {
      const nodeWithDeprecated: CallGraphNode = {
        id: 'node_4',
        name: 'oldDeprecatedFunction',
        filePath: 'src/old.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void'
      };

      const graphWithDeprecated = {
        ...sampleCallGraph,
        nodes: [...sampleCallGraph.nodes, nodeWithDeprecated]
      };

      const wildcardSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [],
        forbiddenEdges: [],
        forbiddenNodes: ['*deprecated*']
      };

      const result = validator.validate(graphWithDeprecated, wildcardSpec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'type_mismatch' && 
        e.message.includes('oldDeprecatedFunction')
      )).toBe(true);
    });

    it('should handle complex wildcard patterns', () => {
      const complexSpec: CallGraphSpecification = {
        entryPoint: '*main*',
        requiredEdges: [
          { from: '*main*', to: '*Data', type: 'sync' }
        ],
        forbiddenEdges: [],
        requiredNodes: ['validate*'],
        forbiddenNodes: []
      };

      const result = validator.validate(sampleCallGraph, complexSpec);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Complexity Validation', () => {
    it('should report depth warnings', () => {
      const lowDepthSpec = {
        ...sampleSpecification,
        maxDepth: 2
      };

      const result = validator.validate(sampleCallGraph, lowDepthSpec);
      
      expect(result.warnings.some(w => 
        w.type === 'complexity' && 
        w.message.includes('depth')
      )).toBe(true);
    });

    it('should report complexity warnings', () => {
      const lowComplexitySpec = {
        ...sampleSpecification,
        maxComplexity: 0 // Set to 0 to trigger warning (actual complexity is 1)
      };

      const result = validator.validate(sampleCallGraph, lowComplexitySpec);
      
      expect(result.warnings.some(w => 
        w.type === 'complexity' && 
        w.message.includes('complexity')
      )).toBe(true);
    });

    it('should pass complexity checks when within limits', () => {
      const highLimitSpec = {
        ...sampleSpecification,
        maxDepth: 10,
        maxComplexity: 20
      };

      const result = validator.validate(sampleCallGraph, highLimitSpec);
      
      expect(result.warnings.filter(w => w.type === 'complexity')).toHaveLength(0);
    });
  });

  describe('Edge Type Validation', () => {
    it('should validate specific edge types', () => {
      const typeSpecificSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [
          { from: 'main', to: 'processData', type: 'sync' },
          { from: 'processData', to: 'validateInput', type: 'async' }
        ],
        forbiddenEdges: [
          { from: 'processData', to: 'validateInput', type: 'sync' }
        ]
      };

      const result = validator.validate(sampleCallGraph, typeSpecificSpec);
      
      expect(result.isValid).toBe(true);
    });

    it('should report wrong edge types', () => {
      const wrongTypeSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [
          { from: 'main', to: 'processData', type: 'async' } // Should be sync
        ],
        forbiddenEdges: []
      };

      const result = validator.validate(sampleCallGraph, wrongTypeSpec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_edge')).toBe(true);
    });

    it('should handle forbidden edges without specific type', () => {
      const forbiddenEdge: CallGraphEdge = {
        id: 'edge_3',
        source: 'node_2',
        target: 'node_1',
        type: 'callback',
        line: 20
      };

      const graphWithCallback = {
        ...sampleCallGraph,
        edges: [...sampleCallGraph.edges, forbiddenEdge]
      };

      const anyTypeForbiddenSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [],
        forbiddenEdges: [
          { from: 'processData', to: 'main' } // No type specified
        ]
      };

      const result = validator.validate(graphWithCallback, anyTypeForbiddenSpec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'forbidden_edge')).toBe(true);
    });
  });

  describe('Report Generation', () => {
    it('should generate human-readable validation report', () => {
      const result = validator.validate(sampleCallGraph, sampleSpecification);
      const report = validator.generateReport(result);
      
      expect(report).toContain('Call Graph Validation Report');
      expect(report).toContain('Status: VALID');
      expect(report).toContain('Required edges found: 2/2');
      expect(report).toContain('Forbidden edges found: 0');
    });

    it('should generate report with errors', () => {
      const incompleteGraph = {
        ...sampleCallGraph,
        edges: [sampleCallGraph.edges[0]]
      };

      const result = validator.validate(incompleteGraph, sampleSpecification);
      const report = validator.generateReport(result);
      
      expect(report).toContain('Status: INVALID');
      expect(report).toContain('Errors: 1');
      expect(report).toContain('[MISSING_EDGE]');
      expect(report).toContain('processData');
    });

    it('should generate diff report', () => {
      const diffReport = validator.generateDiffReport(sampleCallGraph, sampleSpecification);
      
      expect(diffReport).toContain('Call Graph Structure Diff');
      expect(diffReport).toContain('Nodes:');
      expect(diffReport).toContain('Edges:');
      expect(diffReport).toContain('');
    });

    it('should show missing items in diff report', () => {
      const incompleteSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [
          { from: 'main', to: 'processData', type: 'sync' },
          { from: 'main', to: 'missingFunction', type: 'sync' } // Missing
        ],
        forbiddenEdges: [],
        requiredNodes: ['main', 'processData', 'missingNode'], // Missing
        forbiddenNodes: []
      };

      const diffReport = validator.generateDiffReport(sampleCallGraph, incompleteSpec);
      
      expect(diffReport).toContain(' missingNode');
      expect(diffReport).toContain(' main --sync--> missingFunction');
    });
  });

  describe('Helper Functions', () => {
    describe('createBasicSpecification', () => {
      it('should create basic specification with entry point', () => {
        const spec = createBasicSpecification('testEntry');
        
        expect(spec.entryPoint).toBe('testEntry');
        expect(spec.requiredNodes).toContain('testEntry');
        expect(spec.requiredEdges).toHaveLength(0);
        expect(spec.forbiddenEdges).toHaveLength(0);
        expect(spec.maxDepth).toBe(10);
        expect(spec.maxComplexity).toBe(20);
      });
    });

    describe('validateBasicStructure', () => {
      it('should validate with basic specification', () => {
        const result = validateBasicStructure(sampleCallGraph, 'main');
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail with wrong entry point', () => {
        const result = validateBasicStructure(sampleCallGraph, 'wrongEntry');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.type === 'type_mismatch')).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty call graph', () => {
      const emptyGraph: CallGraph = {
        metadata: {
          generatedAt: '2024-01-01T00:00:00Z',
          entryPoint: '',
          maxDepth: 0,
          projectRoot: '/project',
          totalFiles: 0,
          analysisTimeMs: 0
        },
        nodes: [],
        edges: [],
        entryPointId: ''
      };

      const emptySpec: CallGraphSpecification = {
        entryPoint: '',
        requiredEdges: [],
        forbiddenEdges: [],
        requiredNodes: [],
        forbiddenNodes: []
      };

      const result = validator.validate(emptyGraph, emptySpec);
      
      expect(result.isValid).toBe(true);
    });

    it('should handle specification with no constraints', () => {
      const relaxedSpec: CallGraphSpecification = {
        entryPoint: 'main',
        requiredEdges: [],
        forbiddenEdges: []
      };

      const result = validator.validate(sampleCallGraph, relaxedSpec);
      
      expect(result.isValid).toBe(true);
    });

    it('should handle nodes with same names but different IDs', () => {
      const duplicateNameNode: CallGraphNode = {
        id: 'node_4',
        name: 'main', // Same name as node_1
        filePath: 'src/other.ts',
        line: 1,
        type: 'function',
        async: false,
        parameters: [],
        returnType: 'void'
      };

      const graphWithDuplicates = {
        ...sampleCallGraph,
        nodes: [...sampleCallGraph.nodes, duplicateNameNode]
      };

      const result = validator.validate(graphWithDuplicates, sampleSpecification);
      
      expect(result.isValid).toBe(true);
    });

    it('should handle circular dependencies', () => {
      const circularEdge: CallGraphEdge = {
        id: 'edge_3',
        source: 'node_3',
        target: 'node_2',
        type: 'sync',
        line: 25
      };

      const circularGraph = {
        ...sampleCallGraph,
        edges: [...sampleCallGraph.edges, circularEdge]
      };

      const result = validator.validate(circularGraph, sampleSpecification);
      
      expect(result.isValid).toBe(true); // Should not fail on circular dependencies
    });
  });

  describe('Performance Tests', () => {
    it('should handle large graphs efficiently', () => {
      // Generate large graph
      const largeNodes: CallGraphNode[] = Array.from({ length: 100 }, (_, i) => ({
        id: `node_${i}`,
        name: `function${i}`,
        filePath: `src/file${i}.ts`,
        line: 1,
        type: 'function' as const,
        async: false,
        parameters: [],
        returnType: 'void'
      }));

      const largeEdges: CallGraphEdge[] = Array.from({ length: 99 }, (_, i) => ({
        id: `edge_${i}`,
        source: `node_${i}`,
        target: `node_${i + 1}`,
        type: 'sync' as const,
        line: 1
      }));

      const largeGraph: CallGraph = {
        metadata: {
          generatedAt: '2024-01-01T00:00:00Z',
          entryPoint: 'function0',
          maxDepth: 100,
          projectRoot: '/project',
          totalFiles: 100,
          analysisTimeMs: 1000
        },
        nodes: largeNodes,
        edges: largeEdges,
        entryPointId: 'node_0'
      };

      const largeSpec: CallGraphSpecification = {
        entryPoint: 'function0',
        requiredEdges: [
          { from: 'function0', to: 'function1', type: 'sync' },
          { from: 'function50', to: 'function51', type: 'sync' }
        ],
        forbiddenEdges: [],
        requiredNodes: ['function0', 'function99'],
        forbiddenNodes: []
      };

      const startTime = performance.now();
      const result = validator.validate(largeGraph, largeSpec);
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });
});