import { parentPort } from 'worker_threads';
import { CallGraphAnalyzer } from '../analyzer/CallGraphAnalyzer';
import { AnalysisResult } from '../types/AnalysisResult';
import { CallGraphNode, CallGraphEdge, ProjectContext } from '../types/CallGraph';
import * as path from 'path';
import { SyntaxKind } from 'ts-morph';

interface WorkerMessage {
  type: 'analyze';
  file: string;
  tsConfigPath: string;
  options?: {
    maxDepth?: number;
    includeExternal?: boolean;
  };
}

interface WorkerResponse {
  type: 'result' | 'error';
  data?: AnalysisResult;
  error?: string;
}

// Worker thread code
if (parentPort) {
  const port = parentPort;
  port.on('message', async (message: WorkerMessage) => {
    try {
      if (message.type === 'analyze') {
        const context: ProjectContext = {
          rootPath: path.dirname(message.tsConfigPath),
          tsConfigPath: message.tsConfigPath,
          sourcePatterns: ['**/*.ts', '**/*.tsx'],
          excludePatterns: ['node_modules/**', '**/*.spec.ts', '**/*.test.ts'],
        };
        const analyzer = new CallGraphAnalyzer(context);

        // Analyze the specific file
        const sourceFile = analyzer['project'].getSourceFile(message.file);
        if (!sourceFile) {
          throw new Error(`File not found: ${message.file}`);
        }

        // Get all functions and classes from the file
        const nodes: CallGraphNode[] = [];
        const edges: CallGraphEdge[] = [];
        const imports: string[] = [];
        const exports: string[] = [];

        // Extract imports
        sourceFile.getImportDeclarations().forEach(importDecl => {
          imports.push(importDecl.getModuleSpecifierValue());
        });

        // Extract exports
        sourceFile.getExportDeclarations().forEach(exportDecl => {
          const moduleSpecifier = exportDecl.getModuleSpecifier();
          if (moduleSpecifier) {
            exports.push(moduleSpecifier.getText().slice(1, -1));
          }
        });

        // Analyze functions
        const functions = sourceFile.getFunctions();
        for (const func of functions) {
          const funcName = func.getName();
          if (funcName) {
            const node: CallGraphNode = {
              id: `${message.file}#${funcName}`,
              name: funcName,
              filePath: message.file,
              line: func.getStartLineNumber(),
              column: func.getStartLineNumber(),
              type: 'function',
              async: func.isAsync(),
              parameters: func.getParameters().map(p => ({
                name: p.getName(),
                type: p.getType().getText(),
                optional: p.isOptional(),
              })),
              returnType: func.getReturnType().getText(),
            };
            nodes.push(node);

            // Analyze function calls within this function
            // This is a simplified version - real implementation would be more thorough
            const calls = func.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const call of calls) {
              const expression = (call as any).getExpression?.();
              if (expression) {
                const callName = expression.getText();
                edges.push({
                  id: `${node.id}->${callName}`,
                  source: node.id,
                  target: callName,
                  type: func.isAsync() ? 'async' : 'sync',
                  line: call.getStartLineNumber(),
                });
              }
            }
          }
        }

        // Analyze classes and methods
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
          const className = cls.getName();
          if (className) {
            const methods = cls.getMethods();
            for (const method of methods) {
              const methodName = method.getName();
              const node: CallGraphNode = {
                id: `${message.file}#${className}.${methodName}`,
                name: `${className}.${methodName}`,
                filePath: message.file,
                line: method.getStartLineNumber(),
                column: method.getStartLineNumber(),
                type: 'method',
                async: method.isAsync(),
                parameters: method.getParameters().map(p => ({
                  name: p.getName(),
                  type: p.getType().getText(),
                  optional: p.isOptional(),
                })),
                returnType: method.getReturnType().getText(),
              };
              nodes.push(node);
            }
          }
        }

        const result: AnalysisResult = {
          filePath: message.file,
          nodes,
          edges,
          imports,
          exports,
          analyzedAt: new Date().toISOString(),
          metrics: {
            functionCount: functions.length,
            classCount: classes.length,
          },
        };

        const response: WorkerResponse = {
          type: 'result',
          data: result,
        };
        port.postMessage(response);
      }
    } catch (error) {
      const response: WorkerResponse = {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
      port.postMessage(response);
    }
  });
}
