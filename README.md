# Call Structure TS

A TypeScript command-line tool for analyzing function call structures in TypeScript projects.

## Features

- Analyzes function call graphs from specified entry points
- Outputs structured data in JSON, YAML, and Mermaid formats
- Validates actual call structures against expected patterns
- Supports static analysis of TypeScript codebases

## Project Structure

```
call-structure-ts/
├── src/
│   ├── analyzer/          # Core analysis engine
│   ├── parser/           # Mermaid format parsing
│   ├── formatter/        # Output formatters
│   ├── cli/             # Command-line interface
│   ├── types/           # Type definitions
│   └── utils/           # Utilities
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── examples/            # Example projects
└── docs/               # Documentation
```

## Installation

```bash
npm install
npm run build
```

### Git Hooks

This project uses Husky to enforce code quality through Git hooks:

- **Pre-commit**: Runs linting, formatting, type checking, and tests
- **Commit-msg**: Enforces conventional commit message format
- **Pre-push**: Runs comprehensive verification before pushing

See [docs/git-hooks.md](docs/git-hooks.md) for detailed information.

## Usage

```bash
# Analyze from entry point
call-structure analyze --entry "src/services/UserService.ts#createUser" --output result.json

# Test against specification
call-structure test --spec expected-structure.yaml --target src/
```

## Development

See `docs/ARCHITECTURE.md` for detailed architecture information.
