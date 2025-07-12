import { CallGraph, EntryPointLocation, ProjectContext, CallGraphAnalysisOptions } from '../types/CallGraph';
export declare class EntryPointAnalyzer {
    private project;
    private context;
    constructor(context: ProjectContext);
    /**
     * Discover potential entry points in the project
     */
    discoverEntryPoints(): Promise<EntryPointLocation[]>;
    /**
     * Analyze multiple entry points and generate call graphs
     */
    analyzeMultipleEntryPoints(entryPoints: string[], options?: CallGraphAnalysisOptions): Promise<Map<string, CallGraph>>;
    /**
     * Find entry points by pattern matching
     */
    findEntryPointsByPattern(patterns: string[]): Promise<EntryPointLocation[]>;
    /**
     * Find common entry point patterns (controllers, handlers, main functions)
     */
    findCommonEntryPoints(): Promise<{
        controllers: EntryPointLocation[];
        handlers: EntryPointLocation[];
        mainFunctions: EntryPointLocation[];
        exportedFunctions: EntryPointLocation[];
    }>;
    /**
     * Validate if an entry point exists and is accessible
     */
    validateEntryPoint(entryPoint: string): Promise<{
        isValid: boolean;
        error?: string;
        location?: EntryPointLocation;
    }>;
    private analyzeFileForEntryPoints;
    private findControllerMethods;
    private findHandlerFunctions;
    private findMainFunctions;
    private findExportedFunctions;
    private getSourceFiles;
    private parseEntryPoint;
    private findEntryPointNode;
}
//# sourceMappingURL=EntryPointAnalyzer.d.ts.map