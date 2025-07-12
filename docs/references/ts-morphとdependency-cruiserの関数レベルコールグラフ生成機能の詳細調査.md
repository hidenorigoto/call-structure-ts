# ts-morphとdependency-cruiserの関数レベルコールグラフ生成機能の詳細調査

ts-morphは関数レベルのコールグラフ生成に優れた機能を提供する一方、dependency-cruiserはモジュールレベルの依存関係解析に特化しており、関数レベルの解析は**明確にサポート対象外**であることが判明しました。

## ts-morphの機能詳細

### 関数間の呼び出し関係の抽出方法

ts-morphは、TypeScript Compiler APIのラッパーとして、AST（抽象構文木）を通じて関数の呼び出し関係を詳細に解析できます。

```typescript
import { Project, SyntaxKind, CallExpression } from "ts-morph";

// プロジェクトの初期化
const project = new Project({
    tsConfigFilePath: "./tsconfig.json"
});

// CallExpressionの抽出
sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpression = node as CallExpression;
        // 呼び出し元の関数を特定
        const callerFunction = callExpression.getFirstAncestorByKind(
            SyntaxKind.FunctionDeclaration
        );
        // 呼び出し先の識別
        const callee = callExpression.getExpression();
    }
});
```

### CallExpressionから呼び出し元・呼び出し先の特定

**呼び出し先の特定方法**：
```typescript
const callExpression = node as CallExpression;
const expression = callExpression.getExpression();

// 単純な関数呼び出し：functionName()
if (expression.getKind() === SyntaxKind.Identifier) {
    const symbol = expression.getSymbol();
    const declarations = symbol?.getDeclarations();
    const targetFunction = declarations?.[0];
}

// メソッド呼び出し：object.method()
if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const propAccess = expression as PropertyAccessExpression;
    const objectExpression = propAccess.getExpression();
    const methodName = propAccess.getName();
    
    // オブジェクトの型から実際のメソッドを解決
    const objectType = objectExpression.getType();
    const methodSymbol = objectType.getProperty(methodName);
}
```

### 引数の型情報取得

```typescript
// 引数の型情報を取得
const parameters = callExpression.getArguments();
parameters.forEach((param, index) => {
    const paramType = param.getType();
    const typeText = paramType.getText();
    
    // ジェネリック型の場合
    const typeArgs = callExpression.getTypeArguments();
    if (typeArgs.length > 0) {
        typeArgs.forEach(typeArg => {
            const genericType = typeArg.getType();
        });
    }
});

// 関数シグネチャから期待される型を取得
const signature = callExpression.getType();
const callSignatures = signature.getCallSignatures();
```

### メソッド呼び出し、コールバック関数、高階関数の扱い

**メソッド呼び出しの解析**：
```typescript
// クラスメソッドの解析
sourceFile.getClasses().forEach(cls => {
    cls.getMethods().forEach(method => {
        const isStatic = method.isStatic();
        const visibility = method.getScope(); // public, private, protected
        
        // メソッド内の呼び出しを抽出
        const methodCalls = method.getDescendantsOfKind(
            SyntaxKind.CallExpression
        );
    });
});
```

**コールバックと高階関数**：
```typescript
// コールバック関数の検出
const callExpression = node as CallExpression;
const args = callExpression.getArguments();

args.forEach(arg => {
    // アロー関数のコールバック
    if (arg.getKind() === SyntaxKind.ArrowFunction) {
        const arrowFunc = arg as ArrowFunction;
        const body = arrowFunc.getBody();
        // コールバック内の呼び出しを解析
    }
    
    // 関数式のコールバック
    if (arg.getKind() === SyntaxKind.FunctionExpression) {
        const funcExpr = arg as FunctionExpression;
        // 処理
    }
});
```

### 非同期関数（async/await）の識別

```typescript
// async関数の検出
functionDeclaration.isAsync(); // boolean

// await式の検出と解析
const awaitExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.AwaitExpression
);

awaitExpressions.forEach(awaitExpr => {
    const expression = awaitExpr.getExpression();
    if (expression.getKind() === SyntaxKind.CallExpression) {
        const asyncCall = expression as CallExpression;
        // 非同期呼び出しの処理
    }
});

// Promise チェーンの解析
if (callExpression.getExpression().getText() === "then" || 
    callExpression.getExpression().getText() === "catch") {
    // Promiseチェーンの処理
}
```

### クラスメソッドとアロー関数の解析

```typescript
// アロー関数の解析
const arrowFunctions = sourceFile.getDescendantsOfKind(
    SyntaxKind.ArrowFunction
);

arrowFunctions.forEach(arrowFunc => {
    const parameters = arrowFunc.getParameters();
    const returnType = arrowFunc.getReturnType();
    
    // 即座に実行される関数式（IIFE）の検出
    const parent = arrowFunc.getParent();
    if (parent?.getKind() === SyntaxKind.CallExpression) {
        // IIFEとして処理
    }
});

// コンストラクタ呼び出し
const newExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.NewExpression
);
```

### 実際のコード例と出力例

**入力コード例**：
```typescript
// example.ts
class UserService {
    private db: Database;
    
    async getUser(id: string): Promise<User> {
        const data = await this.db.query(id);
        return this.transformUser(data);
    }
    
    private transformUser(data: any): User {
        return new User(data);
    }
}

function processUsers(userIds: string[]) {
    const service = new UserService();
    return userIds.map(id => service.getUser(id));
}
```

**出力例（JSON形式）**：
```json
{
  "nodes": [
    {
      "id": "UserService.getUser",
      "name": "getUser",
      "type": "method",
      "async": true,
      "parameters": ["id: string"],
      "returnType": "Promise<User>",
      "visibility": "public"
    },
    {
      "id": "UserService.transformUser",
      "name": "transformUser",
      "type": "method",
      "parameters": ["data: any"],
      "returnType": "User",
      "visibility": "private"
    },
    {
      "id": "processUsers",
      "name": "processUsers",
      "type": "function",
      "parameters": ["userIds: string[]"]
    }
  ],
  "edges": [
    {
      "source": "UserService.getUser",
      "target": "Database.query",
      "type": "await",
      "line": 5
    },
    {
      "source": "UserService.getUser",
      "target": "UserService.transformUser",
      "type": "call",
      "line": 6
    },
    {
      "source": "processUsers",
      "target": "UserService.getUser",
      "type": "call",
      "line": 14
    }
  ]
}
```

## dependency-cruiserの機能詳細

### 関数レベルのコールグラフ生成は不可能

dependency-cruiserは**モジュールレベルの依存関係解析に特化**しており、関数レベルの解析は明確にサポート対象外です。メンテナーは公式FAQで以下のように述べています：

> "dependency-cruiser focuses on dependencies between modules as the one thing to do well. Static analysis of classes, functions and methods and their dependencies is very interesting to dive into, but it'd make dependency-cruiser a different tool altogether."

### 解析可能な粒度

- **モジュール/ファイルレベル**：✅ 完全サポート
- **フォルダレベル**：✅ 集約ビューとして対応
- **関数レベル**：❌ サポートなし
- **クラス/メソッドレベル**：❌ サポートなし

### カスタムリポーターとプラグイン

カスタムリポーターは作成可能ですが、**既存のモジュールレベルデータの表示方法を変更するのみ**で、関数レベルの解析を追加することはできません：

```javascript
// カスタムリポーターの例
module.exports = (cruiseResult) => {
    // cruiseResultにはモジュールレベルの情報のみ含まれる
    return cruiseResult.modules.map(module => ({
        source: module.source,
        dependencies: module.dependencies
    }));
};
```

### 実際のコマンドと出力例

**最大詳細度のコマンド**：
```bash
npx depcruise src \
  --include-only "^src" \
  --output-type json \
  --ts-config tsconfig.json \
  --webpack-config webpack.config.js \
  --progress performance-log
```

**出力例（モジュールレベルのみ）**：
```json
{
  "modules": [{
    "source": "src/services/UserService.ts",
    "dependencies": [{
      "resolved": "src/database/Database.ts",
      "module": "../database/Database",
      "moduleSystem": "es6",
      "dependencyTypes": ["esm"]
    }]
  }]
}
```

## 両ツールの組み合わせ方

### 統合アーキテクチャ

```typescript
class UnifiedCallGraphGenerator {
    private tsProject: Project;
    private moduleDependencies: any;
    
    constructor(tsConfigPath: string) {
        // ts-morphプロジェクトの初期化
        this.tsProject = new Project({
            tsConfigFilePath: tsConfigPath
        });
        
        // dependency-cruiserでモジュール依存関係を取得
        this.moduleDependencies = depCruiser.cruise(['src'], {
            includeOnly: '^src',
            outputType: 'json'
        });
    }
    
    generateUnifiedGraph(): UnifiedCallGraph {
        // 1. ts-morphで関数レベルの解析
        const functionGraph = this.analyzeFunctions();
        
        // 2. dependency-cruiserのモジュール情報を統合
        const moduleGraph = this.extractModuleGraph();
        
        // 3. 両者を結合
        return {
            functions: functionGraph.nodes,
            calls: functionGraph.edges,
            modules: moduleGraph.modules,
            imports: moduleGraph.imports,
            metadata: {
                generatedAt: new Date().toISOString(),
                toolVersions: {
                    tsMorph: "21.0.1",
                    depCruiser: "16.10.4"
                }
            }
        };
    }
}
```

### 効果的な実装パターン

**レイヤー分離アプローチ**：
1. **モジュールレイヤー**：dependency-cruiserでファイル間の依存関係を把握
2. **関数レイヤー**：ts-morphで関数間の呼び出し関係を解析
3. **統合レイヤー**：両者の情報を結合し、階層的なグラフを生成

```typescript
interface HierarchicalCallGraph {
    modules: {
        [modulePath: string]: {
            imports: string[];
            exports: string[];
            functions: FunctionNode[];
        }
    };
    globalCalls: CallEdge[];
    crossModuleCalls: CallEdge[];
}
```

## 出力形式

### JSON形式での構造化データ

```json
{
  "version": "1.0.0",
  "timestamp": "2025-01-07T12:00:00Z",
  "project": {
    "root": "./src",
    "totalFiles": 42,
    "totalFunctions": 156
  },
  "functions": [{
    "id": "auth/AuthService.validateUser",
    "module": "auth/AuthService.ts",
    "name": "validateUser",
    "type": "method",
    "async": true,
    "complexity": 5,
    "parameters": [{
      "name": "credentials",
      "type": "UserCredentials"
    }],
    "calls": ["crypto.hash", "db.findUser", "logger.info"]
  }],
  "edges": [{
    "id": "edge-001",
    "source": "auth/AuthService.validateUser",
    "target": "db/UserRepository.findUser",
    "type": "async-call",
    "location": {
      "file": "auth/AuthService.ts",
      "line": 23,
      "column": 15
    }
  }]
}
```

### Markdown形式での可読性の高い出力

```typescript
function generateMarkdownReport(graph: CallGraph): string {
    return `# Call Graph Analysis Report

Generated: ${new Date().toISOString()}

## Summary
- Total Functions: ${graph.nodes.length}
- Total Calls: ${graph.edges.length}
- Entry Points: ${graph.entryPoints.join(', ')}

## Function Details

${graph.nodes.map(node => `
### ${node.name} (${node.module})
- Type: ${node.type}
- Async: ${node.async ? 'Yes' : 'No'}
- Parameters: ${node.parameters.join(', ')}
- Called by: ${getCallers(node, graph).join(', ') || 'None'}
- Calls: ${getCallees(node, graph).join(', ') || 'None'}
`).join('\n')}

## Call Relationships

\`\`\`mermaid
flowchart TD
${generateMermaidEdges(graph)}
\`\`\`
`;
}
```

### Mermaid図への変換

```typescript
function generateMermaidDiagram(graph: CallGraph): string {
    const mermaid = ['flowchart TD'];
    
    // ノードの定義（形状と色分け）
    graph.nodes.forEach(node => {
        const shape = node.type === 'method' ? '[[' : '[';
        const shapeEnd = node.type === 'method' ? ']]' : ']';
        const style = node.async ? 'fill:#f9f,stroke:#333' : '';
        
        mermaid.push(`    ${node.id}${shape}${node.name}${shapeEnd}`);
        if (style) {
            mermaid.push(`    style ${node.id} ${style}`);
        }
    });
    
    // エッジの定義
    graph.edges.forEach(edge => {
        const arrow = edge.type === 'async' ? '-.->>' : '-->';
        mermaid.push(`    ${edge.source} ${arrow} ${edge.target}`);
    });
    
    return mermaid.join('\n');
}
```

### GraphViz形式への変換

```typescript
import { digraph, toDot, attribute as attr } from 'ts-graphviz';

function generateGraphvizDot(graph: CallGraph): string {
    const g = digraph('CallGraph', (g) => {
        // グラフ全体の設定
        g.set('rankdir', 'TB');
        g.set('nodesep', 0.5);
        
        // ノードの追加
        graph.nodes.forEach(node => {
            const attributes = {
                label: `${node.name}\\n${node.type}`,
                shape: node.type === 'method' ? 'box' : 'ellipse',
                style: node.async ? 'filled' : 'solid',
                fillcolor: node.async ? 'lightblue' : 'white'
            };
            
            g.node(node.id, attributes);
        });
        
        // エッジの追加
        graph.edges.forEach(edge => {
            g.edge([edge.source, edge.target], {
                label: edge.type,
                style: edge.type === 'async' ? 'dashed' : 'solid'
            });
        });
    });
    
    return toDot(g);
}
```

## 実用的な実装例

### TypeScriptプロジェクトでの完全な実装

```typescript
import { Project, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

class ProductionCallGraphGenerator {
    private project: Project;
    private cache: Map<string, any> = new Map();
    
    constructor(private config: {
        tsConfigPath: string;
        outputPath: string;
        includeTests: boolean;
        maxDepth: number;
    }) {
        this.project = new Project({
            tsConfigFilePath: config.tsConfigPath,
            skipAddingFilesFromTsConfig: false
        });
    }
    
    async generate(): Promise<void> {
        console.log('Starting call graph generation...');
        
        try {
            // 1. ソースファイルの収集
            const sourceFiles = this.collectSourceFiles();
            console.log(`Found ${sourceFiles.length} source files`);
            
            // 2. 関数の抽出と解析
            const nodes = await this.extractAllNodes(sourceFiles);
            console.log(`Extracted ${nodes.length} functions`);
            
            // 3. 呼び出し関係の解析
            const edges = await this.extractAllEdges(sourceFiles);
            console.log(`Found ${edges.length} function calls`);
            
            // 4. グラフの構築
            const graph = this.buildGraph(nodes, edges);
            
            // 5. 出力の生成
            await this.generateOutputs(graph);
            
            console.log('Call graph generation completed successfully');
            
        } catch (error) {
            console.error('Error generating call graph:', error);
            throw error;
        }
    }
    
    private collectSourceFiles() {
        return this.project.getSourceFiles()
            .filter(sf => {
                const filePath = sf.getFilePath();
                // テストファイルの除外
                if (!this.config.includeTests && 
                    (filePath.includes('.test.') || 
                     filePath.includes('.spec.'))) {
                    return false;
                }
                // node_modulesの除外
                if (filePath.includes('node_modules')) {
                    return false;
                }
                return true;
            });
    }
    
    private async generateOutputs(graph: CallGraph) {
        // JSON出力
        const jsonPath = path.join(this.config.outputPath, 'callgraph.json');
        fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
        
        // Markdown出力
        const mdPath = path.join(this.config.outputPath, 'callgraph.md');
        fs.writeFileSync(mdPath, this.generateMarkdownReport(graph));
        
        // Mermaid図
        const mermaidPath = path.join(this.config.outputPath, 'callgraph.mmd');
        fs.writeFileSync(mermaidPath, this.generateMermaidDiagram(graph));
        
        // GraphViz DOT
        const dotPath = path.join(this.config.outputPath, 'callgraph.dot');
        fs.writeFileSync(dotPath, this.generateGraphvizDot(graph));
    }
}

// 使用例
const generator = new ProductionCallGraphGenerator({
    tsConfigPath: './tsconfig.json',
    outputPath: './analysis',
    includeTests: false,
    maxDepth: 10
});

generator.generate().catch(console.error);
```

### パフォーマンスと制限事項

**パフォーマンス最適化**：
- **バッチ処理**：大規模プロジェクトでは10-50ファイルずつ処理
- **キャッシング**：解析済みファイルの結果をキャッシュ
- **並列処理**：Worker threadsを使用して並列解析
- **メモリ管理**：500MB以上使用時にガベージコレクションを強制

**制限事項**：
- **動的呼び出し**：`eval()`や文字列ベースの動的呼び出しは解析不可
- **外部ライブラリ**：node_modulesの深い解析は性能上推奨されない
- **実行時の条件分岐**：静的解析のため実行時の分岐は考慮されない
- **デコレータ**：複雑なデコレータパターンは追跡が困難

### ベストプラクティス

1. **インクリメンタル解析**：変更されたファイルのみ再解析
2. **エラーハンドリング**：個別ファイルのエラーで全体を停止させない
3. **設定可能な深さ**：循環参照を避けるため最大深度を設定
4. **フィルタリング**：テストファイルや生成コードを除外
5. **視覚化の最適化**：大規模グラフでは階層表示やクラスタリングを使用

```typescript
// ベストプラクティスの実装例
class BestPracticeAnalyzer {
    // エラー境界の実装
    private safeAnalyzeFile(sourceFile: SourceFile): AnalysisResult | null {
        try {
            return this.analyzeFile(sourceFile);
        } catch (error) {
            console.warn(`Failed to analyze ${sourceFile.getFilePath()}:`, error);
            return null;
        }
    }
    
    // 循環参照の検出
    private detectCycles(graph: CallGraph): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        
        const dfs = (nodeId: string, path: string[]): void => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            
            const edges = graph.edges.filter(e => e.source === nodeId);
            for (const edge of edges) {
                if (!visited.has(edge.target)) {
                    dfs(edge.target, [...path, edge.target]);
                } else if (recursionStack.has(edge.target)) {
                    const cycleStart = path.indexOf(edge.target);
                    cycles.push(path.slice(cycleStart));
                }
            }
            
            recursionStack.delete(nodeId);
        };
        
        graph.nodes.forEach(node => {
            if (!visited.has(node.id)) {
                dfs(node.id, [node.id]);
            }
        });
        
        return cycles;
    }
}
```

この調査により、ts-morphは関数レベルのコールグラフ生成に非常に適したツールであることが明らかになりました。一方、dependency-cruiserはモジュールレベルの解析に特化しており、両者を組み合わせることで、プロジェクト全体の包括的な依存関係分析が可能になります。