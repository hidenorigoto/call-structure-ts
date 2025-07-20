# Domain-Driven Design Example

This example demonstrates how to analyze a Domain-Driven Design (DDD) architecture using call-structure-ts. It showcases clean architecture principles with proper layer separation and dependency rules.

## Architecture Overview

```
src/
├── domain/              # Core business logic (no external dependencies)
│   ├── entities/        # Business entities
│   ├── value-objects/   # Immutable value objects
│   ├── aggregates/      # Aggregate roots
│   ├── repositories/    # Repository interfaces
│   └── services/        # Domain services
├── application/         # Application business rules
│   ├── use-cases/       # Application use cases
│   ├── services/        # Application services
│   └── dto/             # Data transfer objects
├── infrastructure/      # External concerns
│   ├── repositories/    # Repository implementations
│   ├── external/        # External service adapters
│   ├── persistence/     # Database mappings
│   └── mappers/         # Data mappers
└── presentation/        # UI/API layer
    ├── controllers/     # HTTP controllers
    └── middleware/      # Express middleware
```

## Key Concepts Demonstrated

1. **Layer Independence**: Domain layer has no dependencies on other layers
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Aggregate Pattern**: Order aggregate controls access to related entities
4. **Value Objects**: Money, Address, OrderStatus are immutable
5. **Repository Pattern**: Interfaces in domain, implementations in infrastructure
6. **Use Cases**: Encapsulate application-specific business rules

## Running the Example

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the example
node dist/main.js
```

## Analyzing the Code Structure

### Basic Analysis

```bash
# Analyze the main entry point
call-structure analyze --entry src/main.ts#main --output analysis/main.json

# Analyze a specific use case
call-structure analyze --entry src/application/use-cases/CreateOrderUseCase.ts#CreateOrderUseCase.execute --format mermaid
```

### Architecture Testing

```bash
# Test architecture rules
call-structure test --spec architecture-rules.yaml
```

### Batch Analysis

```bash
# Analyze all configured entry points
call-structure analyze-batch --config analysis-config.yaml
```

## Example Flows

### Order Creation Flow

1. **Controller** receives HTTP request
2. **Use Case** validates and orchestrates
3. **Service** coordinates domain logic
4. **Repository** persists data
5. **Notification** sends emails/SMS

### Key Analysis Points

- Controllers should only call use cases
- Use cases should not depend on each other
- Domain services must not access infrastructure
- Entities are only modified through aggregates

## Architecture Rules

The `architecture-rules.yaml` file enforces:

- Layer dependency constraints
- Forbidden imports in domain entities
- Required locations for interfaces and implementations
- Value object immutability
- Aggregate access patterns

## Metrics and Reports

After running batch analysis:

```bash
# View architecture compliance
cat analysis/architecture-compliance.json

# View call statistics
cat analysis/call-statistics.json

# Generate dependency graph
dot -Tpng analysis/dependencies.dot -o dependencies.png
```

## Common Analysis Commands

```bash
# Find all calls from controllers
call-structure analyze --entry "src/presentation/controllers/**" --depth 2

# Check for circular dependencies
call-structure analyze --entry src/main.ts#main --detect-circular

# Analyze domain service independence
call-structure analyze --entry "src/domain/services/**" --exclude "src/infrastructure/**"
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Test DDD Architecture
  run: call-structure test --spec architecture-rules.yaml --fail-on-violation
```

This ensures architecture rules are enforced in every build.
