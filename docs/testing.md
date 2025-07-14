# Testing Guide

## Overview

This project uses Jest as the testing framework with TypeScript support via ts-jest. We maintain comprehensive test coverage across unit tests, integration tests, and end-to-end tests.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── analyzer/           # Tests for analyzer components
│   ├── formatter/          # Tests for formatters
│   ├── parser/            # Tests for parsers
│   └── ...
├── integration/            # Integration tests for CLI and API
│   ├── cli-*.test.ts      # CLI command tests
│   └── ...
├── fixtures/              # Test data and expected outputs
│   ├── sample-projects/   # Sample TypeScript projects
│   ├── test-specs/       # Test specifications
│   └── ...
├── __mocks__/            # Manual mocks for modules
└── setup.ts              # Test setup and global configuration
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts

# Run tests matching pattern
npm test -- --testNamePattern="CallGraphAnalyzer"
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

## Coverage Requirements

We maintain strict coverage thresholds:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Tests will fail if coverage drops below these thresholds.

## Writing Tests

### Unit Tests

Unit tests focus on individual components in isolation:

```typescript
// tests/unit/analyzer/CallGraphAnalyzer.test.ts
import { CallGraphAnalyzer } from '../../../src/analyzer/CallGraphAnalyzer';

describe('CallGraphAnalyzer', () => {
  let analyzer: CallGraphAnalyzer;
  
  beforeEach(() => {
    const context = {
      rootPath: '/test/path',
      tsConfigPath: undefined,
      // ... other context properties
    };
    analyzer = new CallGraphAnalyzer(context);
  });
  
  describe('analyzeFromEntryPoint', () => {
    it('should analyze function calls correctly', async () => {
      const result = await analyzer.analyzeFromEntryPoint('test.ts#main');
      
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });
  });
});
```

### Integration Tests

Integration tests verify CLI commands and component interactions:

```typescript
// tests/integration/cli-analyze.test.ts
import { execSync } from 'child_process';
import * as path from 'path';

describe('CLI analyze command', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  
  it('should analyze a function and output JSON', () => {
    const result = execSync(
      `node ${cliPath} analyze -e "src/test.ts#main" -f json`,
      { encoding: 'utf-8' }
    );
    
    const output = JSON.parse(result);
    expect(output.nodes).toBeDefined();
    expect(output.edges).toBeDefined();
  });
});
```

### Test Fixtures

Use fixtures for consistent test data:

```typescript
// Load fixture data
const sampleCode = fs.readFileSync(
  path.join(__dirname, '../fixtures/sample.ts'),
  'utf-8'
);

// Use expected outputs
const expectedOutput = require('../fixtures/expected-outputs/sample.json');
```

## Mocking

### Automatic Mocks

Jest automatically mocks modules when you use `jest.mock()`:

```typescript
jest.mock('../../../src/utils/logger');

import { logger } from '../../../src/utils/logger';

// logger is now a mock
```

### Manual Mocks

For complex modules (like ES modules), create manual mocks:

```javascript
// tests/__mocks__/inquirer.js
module.exports = {
  default: {
    prompt: jest.fn(),
    registerPrompt: jest.fn()
  }
};
```

## Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use clear, descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

### 2. Test Isolation
- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/teardown
- Mock external dependencies

### 3. Assertions
- Use specific matchers (e.g., `toMatchObject`, `toContain`)
- Test both success and error cases
- Verify edge cases

### 4. Performance
- Keep unit tests fast (<100ms)
- Use `--runInBand` for debugging
- Mock expensive operations

### 5. Debugging Tests
```bash
# Run tests with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Run single test file
npm test -- --testPathPattern=CallGraphAnalyzer

# Show test output
npm test -- --verbose
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow triggers

The GitHub Actions workflow:
1. Sets up Node.js environment
2. Installs dependencies
3. Runs linting
4. Runs tests with coverage
5. Uploads coverage reports

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Check import paths
   - Verify mocks are set up correctly
   - Clear Jest cache: `npm test -- --clearCache`

2. **Timeout errors**
   - Increase timeout for slow tests: `jest.setTimeout(10000)`
   - Mock expensive operations
   - Use `--runInBand` for debugging

3. **Coverage gaps**
   - Run coverage report to identify untested code
   - Add tests for error cases
   - Test edge cases and branches

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage above 80%
4. Update this documentation if needed

## Resources

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)