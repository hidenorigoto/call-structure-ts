# Call Structure TS Examples

This directory contains example TypeScript projects for testing and demonstration of the call-structure-ts analyzer.

## Projects

### simple-project

Basic TypeScript project with classes, methods, and various call patterns.

**Structure:**
```
simple-project/
├── src/
│   ├── index.ts           # Main entry point
│   ├── services/
│   │   ├── UserService.ts      # Main service with async/sync calls
│   │   └── ValidationService.ts # Validation logic
│   └── utils/
│       └── logger.ts           # Logging utility
├── tsconfig.json
└── package.json
```

**Demonstrates:**
- Class instantiation and method calls
- Sync and async method calls
- Service dependencies
- Callback patterns
- Logger integration

### async-patterns

Demonstrates async/await, Promise chains, and parallel processing patterns.

**Files:**
- `AsyncPatterns.ts` - Complex async flow examples
- `tsconfig.json` - TypeScript configuration

**Demonstrates:**
- `Promise.all()` for parallel execution
- Sequential async processing with `await`
- `Promise.race()` for timeouts
- Recursive async calls
- Mixed async/sync patterns

### circular-deps

Example with circular dependencies to test edge case handling.

**Files:**
- `ServiceA.ts` - Service that depends on ServiceB
- `ServiceB.ts` - Service that depends on ServiceA (circular!)
- `tsconfig.json` - TypeScript configuration

**Demonstrates:**
- Circular dependency detection
- Cross-service method calls
- Import cycle analysis

## Running Analysis

### Analyze Simple Project

```bash
# Analyze UserService.createUser method
call-structure analyze --entry "examples/simple-project/src/services/UserService.ts#UserService.createUser"

# Analyze the main entry point
call-structure analyze --entry "examples/simple-project/src/index.ts#main"
```

### Analyze Async Patterns

```bash
# Analyze complex async flow
call-structure analyze --entry "examples/async-patterns/AsyncPatterns.ts#complexAsyncFlow"

# Analyze mixed async patterns
call-structure analyze --entry "examples/async-patterns/AsyncPatterns.ts#mixedAsyncPatterns"
```

### Analyze Circular Dependencies

```bash
# Analyze ServiceA (will detect circular dependency)
call-structure analyze --entry "examples/circular-deps/ServiceA.ts#ServiceA.methodA"

# Analyze ServiceB (will show the cycle)
call-structure analyze --entry "examples/circular-deps/ServiceB.ts#ServiceB.methodB"
```

## Compilation

Each example project can be compiled independently:

```bash
# Compile simple-project
cd examples/simple-project
npx tsc

# Compile async-patterns
cd examples/async-patterns
npx tsc

# Compile circular-deps
cd examples/circular-deps
npx tsc
```

## Expected Outputs

### Simple Project Call Graph
- Entry: `UserService.createUser`
- Shows: logger calls, validation service usage, async database operations, callback patterns

### Async Patterns Call Graph
- Entry: `complexAsyncFlow`
- Shows: Promise chains, parallel processing, data flow through async functions

### Circular Dependencies Call Graph
- Entry: `ServiceA.methodA` or `ServiceB.methodB`
- Shows: circular dependency detection, infinite recursion prevention

## Usage in Tests

These examples serve as:
- Integration test fixtures
- Performance benchmarks
- Feature demonstration
- Edge case validation

Run the analyzer against these examples to verify correct call graph generation and analysis.