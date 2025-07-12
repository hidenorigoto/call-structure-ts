import { CallGraph, FormatterOptions } from '../types/CallGraph';
export declare class JsonFormatter {
    format(callGraph: CallGraph, options?: FormatterOptions): string;
    private generateStatistics;
    private calculateDepthDistribution;
    /**
     * Format with custom schema for specific use cases
     */
    formatWithSchema(callGraph: CallGraph, schema: 'simple' | 'detailed' | 'compact'): string;
    private formatSimple;
    private formatDetailed;
    private formatCompact;
    /**
     * Validate JSON output
     */
    validate(jsonString: string): {
        isValid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=JsonFormatter.d.ts.map