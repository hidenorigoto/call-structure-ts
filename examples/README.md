# Call Structure TS Examples

This directory contains example projects demonstrating various use cases and features of call-structure-ts.

## 📚 Example Projects

### 1. [Simple Project](./simple-project/)

**Purpose**: Basic TypeScript project demonstrating fundamental analysis features

**Key Features**:

- Function call tracking
- Import/export analysis
- Basic project structure
- Simple test cases

**Quick Start**:

```bash
cd simple-project
call-structure analyze --entry src/main.ts#main
```

### 2. [Async Patterns](./async-patterns/)

**Purpose**: Analyzing asynchronous code patterns

**Key Features**:

- Promise chains
- Async/await functions
- Concurrent operations
- Error handling in async code

**Quick Start**:

```bash
cd async-patterns
call-structure analyze --entry src/async-operations.ts#processDataAsync
```

### 3. [Circular Dependencies](./circular-deps/)

**Purpose**: Detecting and analyzing circular dependencies

**Key Features**:

- Circular dependency detection
- Dependency visualization
- Resolution strategies
- Anti-pattern examples

**Quick Start**:

```bash
cd circular-deps
call-structure analyze --entry src/moduleA.ts#functionA --format mermaid
```

### 4. [Domain-Driven Design (DDD)](./ddd-example/)

**Purpose**: Complete DDD architecture example

**Key Features**:

- Clean architecture layers
- Domain aggregates and entities
- Use cases and repositories
- Architecture validation rules

**Quick Start**:

```bash
cd ddd-example
call-structure analyze --entry src/main.ts#main
call-structure test --spec architecture-rules.yaml
```

### 5. [Express.js API](./express-api/)

**Purpose**: REST API with authentication and middleware

**Key Features**:

- Express middleware pipeline
- JWT authentication
- Service layer architecture
- Error handling patterns

**Quick Start**:

```bash
cd express-api
call-structure analyze --entry src/server.ts#createApp
call-structure test --spec test-spec.yaml
```

### 6. [React Application](./react-app/)

**Purpose**: Modern React app with state management

**Key Features**:

- React hooks and contexts
- Zustand state management
- React Query integration
- Component architecture

**Quick Start**:

```bash
cd react-app
call-structure analyze --entry src/App.tsx#App
call-structure test --spec component-patterns.yaml
```

### 7. [NestJS Application](./nestjs-app/)

**Purpose**: Enterprise NestJS application

**Key Features**:

- Decorator-based architecture
- Dependency injection
- Module system
- Guards and interceptors

**Quick Start**:

```bash
cd nestjs-app
call-structure analyze --entry src/main.ts#bootstrap
call-structure test --spec nest-architecture.yaml
```

### 8. [Performance Optimization](./performance-optimization/)

**Purpose**: Techniques for analyzing large codebases

**Key Features**:

- Caching strategies
- Parallel processing
- Memory management
- Batch analysis

**Quick Start**:

```bash
cd performance-optimization
npm run profile
call-structure batch --config performance-config.yaml
```

## 🚀 Getting Started

1. **Navigate to an example**:

   ```bash
   cd examples/[example-name]
   ```

2. **Install dependencies** (if needed):

   ```bash
   npm install
   ```

3. **Run basic analysis**:

   ```bash
   call-structure analyze --entry [entry-point]
   ```

4. **Run architecture tests** (if available):
   ```bash
   call-structure test --spec [spec-file].yaml
   ```

## 📊 Common Analysis Commands

### Visualize Call Graph

```bash
call-structure analyze --entry src/main.ts#main --format mermaid --output graph.mmd
```

### Deep Analysis

```bash
call-structure analyze --entry src/index.ts#bootstrap --depth 15 --include-async
```

### Batch Analysis

```bash
call-structure batch --config analysis-config.yaml --parallel
```

### Architecture Validation

```bash
call-structure test --spec architecture-rules.yaml --verbose
```

## 🔍 Analysis Tips

1. **Start with entry points**: Use `call-structure discover` to find main functions
2. **Use appropriate depth**: Start with `--depth 5` and increase as needed
3. **Filter noise**: Use `--exclude` patterns to skip test files
4. **Enable caching**: Use `--cache` for repeated analyses
5. **Visualize first**: Use Mermaid format to understand the structure

## 📝 Creating Your Own Examples

To add a new example:

1. Create a new directory under `examples/`
2. Add a TypeScript project with `tsconfig.json`
3. Include a README.md explaining the example
4. Add architecture test specifications (optional)
5. Include analysis configuration files

## 🤝 Contributing

We welcome new examples! Please ensure your example:

- Demonstrates a specific use case or pattern
- Includes clear documentation
- Has working analysis commands
- Follows the existing structure

## 📚 Resources

- [Main Documentation](../README.md)
- [Architecture Patterns](../docs/ARCHITECTURE.md)
- [Performance Guide](../docs/performance.md)
- [Testing Guide](../docs/testing.md)
