import { CallGraph, CallGraphAnalysisOptions, ProjectContext } from '../types/CallGraph';
export declare class CallGraphAnalyzer {
    private project;
    private context;
    private options;
    private visitedNodes;
    private nodes;
    private edges;
    private currentDepth;
    constructor(context: ProjectContext, options?: CallGraphAnalysisOptions);
    analyzeFromEntryPoint(entryPoint: string): Promise<CallGraph>;
    private parseEntryPoint;
    private getSourceFile;
    private findEntryPointNode;
    private analyzeNode;
    private analyzeCallExpression;
    private resolveCallTarget;
    private resolveIdentifierTarget;
    private resolvePropertyAccessTarget;
    private findCallExpressions;
    private analyzeCallbacks;
    private analyzeCallbackFunction;
    private extractNodeInfo;
    private extractParameters;
    private getVisibility;
    private determineCallType;
    private extractArgumentTypes;
    private generateNodeId;
    private isFunctionLikeNode;
    private shouldSkipNode;
    private isTestFile;
}
//# sourceMappingURL=CallGraphAnalyzer.d.ts.map