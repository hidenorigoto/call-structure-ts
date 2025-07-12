import { CallGraph, FormatterOptions } from '../types/CallGraph';
export declare class MermaidFormatter {
    format(callGraph: CallGraph, options?: FormatterOptions): string;
    private generateNodeDefinitions;
    private nodeMap;
    private generateEdgeDefinitions;
    private generateStyleDefinitions;
    private generateClickEvents;
    private generateSafeNodeId;
    private generateNodeLabel;
    private getNodeShape;
    private getArrowStyle;
    private getEdgeLabel;
    /**
     * Generate a subgraph-based diagram for better organization
     */
    formatWithSubgraphs(callGraph: CallGraph): string;
    /**
     * Generate a sequence diagram for call flow
     */
    formatAsSequenceDiagram(callGraph: CallGraph): string;
    private groupNodesByFile;
    private getFileName;
    private getRelativePath;
    /**
     * Validate Mermaid syntax
     */
    validate(mermaidString: string): {
        isValid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=MermaidFormatter.d.ts.map