# Contributing to Call Structure TS

Thank you for your interest in contributing to Call Structure TS! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 22.0.0 or higher
- npm or yarn
- Git
- A TypeScript-enabled editor (VS Code recommended)

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/call-structure-ts.git
   cd call-structure-ts
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build the Project**

   ```bash
   npm run build
   ```

4. **Run Tests**

   ```bash
   npm test
   ```

5. **Link for Local Development**
   ```bash
   npm link
   ```

Now you can use `call-structure` command with your local development version.

## 🔧 Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `feature/issue-{number}-{description}` - Feature branches
- `fix/issue-{number}-{description}` - Bug fix branches
- `docs/issue-{number}-{description}` - Documentation branches

### Making Changes

1. **Create a Branch**

   ```bash
   git checkout -b feature/issue-123-awesome-feature
   ```

2. **Make Your Changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**

   ```bash
   npm run verify  # Runs lint, type-check, and tests
   ```

4. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `style:` - Code style changes
   - `refactor:` - Code refactoring
   - `test:` - Test additions/changes
   - `chore:` - Maintenance tasks

5. **Push and Create PR**

   ```bash
   git push origin feature/issue-123-awesome-feature
   ```

   Create a pull request on GitHub with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/examples if applicable

## 📝 Code Style and Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer interfaces over type aliases for object types
- Use explicit return types for public functions
- Avoid `any` type - use proper typing or `unknown`

### Code Formatting

We use Prettier and ESLint for code formatting:

```bash
npm run lint      # Check for linting errors
npm run lint:fix  # Fix linting errors automatically
npm run format    # Format code with Prettier
```

### Naming Conventions

- **Files**: `PascalCase.ts` for classes, `camelCase.ts` for utilities
- **Classes**: `PascalCase`
- **Functions/Methods**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` (no `I` prefix)
- **Types**: `PascalCase`

### Project Structure

```
src/
├── analyzer/          # Core analysis logic
│   ├── CallGraphAnalyzer.ts
│   ├── EntryPointAnalyzer.ts
│   └── StructureValidator.ts
├── cli/              # Command-line interface
│   ├── commands/     # Individual CLI commands
│   └── index.ts      # Main CLI entry point
├── formatter/        # Output formatters
│   ├── JsonFormatter.ts
│   ├── YamlFormatter.ts
│   └── MermaidFormatter.ts
├── parser/           # Mermaid parsing
├── performance/      # Performance optimizations
├── types/           # Type definitions
└── utils/           # Utility functions
```

## 🧪 Testing

### Test Structure

```
tests/
├── unit/            # Unit tests
│   ├── analyzer/
│   ├── formatter/
│   └── utils/
├── integration/     # Integration tests
│   ├── cli/
│   └── e2e/
└── fixtures/        # Test data and fixtures
```

### Writing Tests

- Use Jest for testing framework
- Follow the pattern: `ComponentName.test.ts`
- Include unit tests for all public functions
- Add integration tests for CLI commands
- Use descriptive test names

Example test structure:

```typescript
describe('CallGraphAnalyzer', () => {
  describe('analyzeFromEntryPoint', () => {
    it('should analyze simple function call', async () => {
      // Arrange
      const analyzer = new CallGraphAnalyzer(mockContext);

      // Act
      const result = await analyzer.analyzeFromEntryPoint('src/main.ts#main');

      // Assert
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });
  });
});
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:coverage # Run tests with coverage
npm run test:watch    # Run tests in watch mode
```

## 🚨 Git Hooks

This project uses Husky for Git hooks:

### Pre-commit Hook

Runs automatically before each commit:

- ESLint code quality checks
- Prettier formatting
- TypeScript type checking
- Unit tests

### Commit Message Hook

Validates commit messages follow conventional commit format.

### Pre-push Hook

Runs comprehensive verification before pushing:

- All linting checks
- Full test suite
- Type checking

## 📚 Documentation

### Documentation Standards

- Use clear, concise language
- Include code examples
- Keep documentation up-to-date with code changes
- Use proper markdown formatting

### Documentation Structure

- `README.md` - Main project documentation
- `CONTRIBUTING.md` - This file
- `docs/` - Detailed documentation
  - `ARCHITECTURE.md` - Architecture overview
  - `performance.md` - Performance features
  - `testing.md` - Testing guidelines
  - `git-hooks.md` - Git hooks documentation

### API Documentation

- Use TSDoc comments for public APIs
- Include parameter descriptions
- Provide usage examples
- Document return types and exceptions

Example:

````typescript
/**
 * Analyzes a TypeScript project to generate a call graph.
 *
 * @param entryPoint - Entry point in format "file.ts#functionName"
 * @param options - Analysis options
 * @returns Promise resolving to call graph data
 * @throws {CallGraphError} When entry point is not found
 *
 * @example
 * ```typescript
 * const analyzer = new CallGraphAnalyzer('./tsconfig.json');
 * const graph = await analyzer.analyzeFromEntryPoint('src/main.ts#main');
 * ```
 */
public async analyzeFromEntryPoint(
  entryPoint: string,
  options?: AnalysisOptions
): Promise<CallGraph> {
  // Implementation
}
````

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment Information**
   - Node.js version
   - npm version
   - Operating system
   - Tool version

2. **Reproduction Steps**
   - Minimal code example
   - Command that fails
   - Expected vs actual behavior

3. **Error Messages**
   - Full error output
   - Stack traces if available

4. **Additional Context**
   - Project structure
   - TypeScript configuration
   - Any relevant configuration files

## 💡 Feature Requests

When requesting features:

1. **Describe the Problem**
   - What problem does this solve?
   - Who would benefit from this feature?

2. **Propose a Solution**
   - How should it work?
   - What should the API look like?

3. **Consider Alternatives**
   - Are there other ways to solve this?
   - How do similar tools handle this?

4. **Implementation Details**
   - Are you willing to implement it?
   - What are the technical challenges?

## 🔄 Release Process

1. **Version Bumping**
   - Follow semantic versioning (semver)
   - Update version in `package.json`
   - Update CHANGELOG.md

2. **Release Notes**
   - Document new features
   - List bug fixes
   - Note breaking changes

3. **Testing**
   - Run full test suite
   - Test CLI commands manually
   - Verify examples work

## 🤝 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Reporting Issues

If you experience or witness unacceptable behavior, please report it to the project maintainers.

## 📞 Getting Help

- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the docs/ directory
- **Examples**: Look at the examples/ directory

## 🎯 Areas for Contribution

We welcome contributions in these areas:

### High Priority

- Bug fixes and stability improvements
- Performance optimizations
- Test coverage improvements
- Documentation enhancements

### Medium Priority

- New CLI commands
- Additional output formats
- Enhanced error messages
- Code refactoring

### Low Priority

- VS Code extension
- Plugin system
- Web-based visualization
- Watch mode features

## 🏆 Recognition

Contributors are recognized in:

- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to Call Structure TS! 🙏
