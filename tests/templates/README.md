# Test Templates

This directory contains templates for creating new tests. Use these templates as starting points to ensure consistency across all tests.

## Available Templates

### Unit Test Template (`unit.test.template.ts`)
Use for testing individual components in isolation:
- Component methods and functions
- Class behaviors
- Error handling
- Mocking external dependencies

### Integration Test Template (`integration.test.template.ts`)
Use for testing component interactions and CLI commands:
- CLI command execution
- File I/O operations
- End-to-end workflows
- Cross-component integration

## Usage

1. Copy the appropriate template to your test directory
2. Rename it to match your component (e.g., `CallGraphAnalyzer.test.ts`)
3. Replace placeholder names with your actual component names
4. Implement the test cases for your specific component
5. Remove unused sections and add component-specific tests

## Guidelines

- Follow the AAA pattern: Arrange, Act, Assert
- Use descriptive test names that explain what is being tested
- Group related tests using `describe` blocks
- Mock external dependencies to ensure isolation
- Test both success and error cases
- Include edge cases and boundary conditions

## Example

```typescript
// From unit.test.template.ts
describe('CallGraphAnalyzer', () => {
  let analyzer: CallGraphAnalyzer;
  
  beforeEach(() => {
    analyzer = new CallGraphAnalyzer({
      rootPath: '/test/path'
    });
  });
  
  describe('analyzeFunction', () => {
    it('should extract function calls correctly', () => {
      // Test implementation
    });
  });
});
```