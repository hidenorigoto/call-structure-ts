import { CallGraph, FormatterOptions } from '../types/CallGraph';
export declare class YamlFormatter {
    format(callGraph: CallGraph, options?: FormatterOptions): string;
    private formatMetadata;
    private formatNode;
    private formatEdge;
    private generateYamlStatistics;
    /**
     * Format as a human-readable call tree
     */
    formatAsCallTree(callGraph: CallGraph): string;
    private buildCallTree;
    /**
     * Format as test specification
     */
    formatAsTestSpec(callGraph: CallGraph): string;
    /**
     * Parse YAML specification back to CallGraph structure
     */
    parseSpecification(yamlContent: string): any;
    private findNodeById;
    private getRelativePath;
    /**
     * Validate YAML output
     */
    validate(yamlString: string): {
        isValid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=YamlFormatter.d.ts.map