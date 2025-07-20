# NestJS Application Example

This example demonstrates how to analyze a NestJS application using call-structure-ts. It showcases decorator patterns, dependency injection, module structure, and enterprise patterns.

## Architecture Overview

```
src/
├── main.ts                    # Application bootstrap
├── app.module.ts             # Root module
├── app.controller.ts         # Root controller
├── app.service.ts           # Root service
├── modules/                  # Feature modules
│   ├── auth/                # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/      # Passport strategies
│   │   ├── guards/         # Auth guards
│   │   └── dto/           # Data transfer objects
│   ├── users/              # Users module
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/      # TypeORM entities
│   │   └── dto/
│   ├── products/          # Products module
│   └── orders/           # Orders module
├── common/               # Shared module
│   ├── decorators/      # Custom decorators
│   ├── filters/        # Exception filters
│   ├── guards/         # Global guards
│   ├── interceptors/   # Global interceptors
│   ├── pipes/         # Validation pipes
│   └── services/      # Shared services
└── config/            # Configuration
```

## Key Features Demonstrated

### 1. Decorator-based Architecture

- Controllers with route decorators
- Dependency injection with `@Injectable`
- Module organization with `@Module`
- Custom decorators for roles and public routes

### 2. Dependency Injection

- Constructor-based injection
- Module providers and exports
- Circular dependency resolution
- Dynamic module configuration

### 3. Middleware Pipeline

- Global pipes for validation
- Guards for authentication/authorization
- Interceptors for logging and transformation
- Exception filters for error handling

### 4. Module System

- Feature modules with clear boundaries
- Shared/common module
- Dynamic module imports
- Module re-exports

### 5. Enterprise Patterns

- Repository pattern with TypeORM
- Service layer abstraction
- DTO validation with class-validator
- Strategy pattern for authentication

## Analyzing the Application

### Bootstrap Analysis

```bash
# Analyze application bootstrap
call-structure analyze --entry src/main.ts#bootstrap --output analysis/bootstrap.json

# Visualize startup sequence
call-structure analyze --entry src/main.ts#bootstrap --format mermaid --depth 3
```

### Module Analysis

```bash
# Analyze module dependencies
call-structure analyze --entry src/app.module.ts#AppModule --output analysis/app-module.json

# Analyze specific module
call-structure analyze --entry src/modules/auth/auth.module.ts#AuthModule

# Check module boundaries
call-structure test --spec nest-architecture.yaml --filter "Module"
```

### Decorator Analysis

```bash
# Find all decorators in controllers
call-structure analyze --entry "src/**/*.controller.ts" --pattern "@(Controller|Get|Post|Put|Delete)"

# Analyze decorator metadata
call-structure analyze --entry src/modules/auth/auth.controller.ts --include-decorators
```

### Dependency Injection Analysis

```bash
# Analyze service dependencies
call-structure analyze --entry "src/**/*.service.ts" --pattern "constructor.*private"

# Check injection patterns
call-structure test --spec nest-architecture.yaml --filter "Dependency Injection"
```

## Common Analysis Scenarios

### 1. Request Flow Analysis

```bash
# Trace request through middleware pipeline
call-structure analyze --entry src/modules/auth/auth.controller.ts#login --depth 10
```

### 2. Guard Execution Flow

```bash
# Analyze guard chain
call-structure analyze --entry src/common/guards/roles.guard.ts#canActivate
```

### 3. Module Loading Order

```bash
# Analyze module initialization
call-structure analyze --entry src/app.module.ts --pattern "forRoot|forRootAsync"
```

### 4. Service Method Calls

```bash
# Analyze service interactions
call-structure analyze --entry src/modules/users/users.service.ts#create --include-async
```

## Architecture Testing

```bash
# Run all architecture tests
call-structure test --spec nest-architecture.yaml

# Test specific patterns
call-structure test --spec nest-architecture.yaml --filter "Controller Decorators"

# Check anti-patterns
call-structure test --spec nest-architecture.yaml --filter "anti_patterns"
```

## Decorator Patterns

### Controller Decorators

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() loginDto: LoginDto) {
    // Method implementation
  }
}
```

### Injectable Services

```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cacheService: CacheService
  ) {}
}
```

### Module Declaration

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

## Middleware Pipeline

### Execution Order

1. **Middleware** → 2. **Guards** → 3. **Interceptors** (pre) → 4. **Pipes** → 5. **Route Handler** → 6. **Interceptors** (post) → 7. **Exception Filters**

### Analysis Commands

```bash
# Analyze guard execution
call-structure analyze --entry "src/**/*.guard.ts" --pattern "canActivate"

# Analyze interceptor chain
call-structure analyze --entry "src/**/*.interceptor.ts" --pattern "intercept"

# Analyze exception handling
call-structure analyze --entry "src/**/*.filter.ts" --pattern "catch"
```

## Dependency Injection Patterns

### Provider Types

```bash
# Analyze different provider patterns
call-structure analyze --entry src/app.module.ts --pattern "provide:|useClass:|useFactory:|useValue:"
```

### Circular Dependencies

```bash
# Detect circular dependencies
call-structure analyze --entry src/app.module.ts --detect-circular
```

## Performance Analysis

### Lazy Loading

```bash
# Check for lazy loaded modules
call-structure analyze --entry src/app.module.ts --pattern "import\\(.*\\)"
```

### Database Queries

```bash
# Analyze repository usage
call-structure analyze --entry "src/**/*.service.ts" --pattern "repository\\.(find|save|update|delete)"
```

### Caching Patterns

```bash
# Analyze cache usage
call-structure analyze --entry "src/**/*.service.ts" --pattern "cache\\.(get|set|del)"
```

## Security Analysis

### Authentication Flow

```bash
# Analyze complete auth flow
call-structure analyze --entry src/modules/auth/strategies/jwt.strategy.ts#validate
```

### Guard Coverage

```bash
# Check guard usage
call-structure analyze --entry "src/**/*.controller.ts" --pattern "@UseGuards"
```

### Input Validation

```bash
# Check DTO validation
call-structure analyze --entry "src/**/*.dto.ts" --pattern "@Is"
```

## Common Issues and Solutions

### 1. Missing Decorators

```bash
# Find controllers without @ApiTags
call-structure test --spec nest-architecture.yaml --filter "Controller.*must_have.*ApiTags"
```

### 2. Direct Repository Access in Controllers

```bash
# Detect anti-pattern
call-structure test --spec nest-architecture.yaml --filter "Direct Database Access"
```

### 3. Business Logic in Controllers

```bash
# Find misplaced logic
call-structure test --spec nest-architecture.yaml --filter "Business Logic in Controllers"
```

## Integration with CI/CD

```yaml
# .github/workflows/nest-analysis.yml
- name: Analyze NestJS Architecture
  run: |
    npm install -g call-structure-ts
    call-structure test --spec nest-architecture.yaml --fail-on-violation
    call-structure analyze --entry src/main.ts#bootstrap --detect-circular --fail-on-circular
```

## Advanced Analysis

### Decorator Metadata

```bash
# Extract decorator metadata
call-structure analyze --entry "src/**/*.controller.ts" --extract-metadata --output decorators.json
```

### Module Graph

```bash
# Generate module dependency graph
call-structure analyze --entry "src/**/*.module.ts" --format dot --output module-graph.dot
```

### Service Interactions

```bash
# Map service-to-service calls
call-structure analyze --entry "src/**/*.service.ts" --pattern "this\\.\\w+Service\\." --output service-interactions.json
```

## Best Practices Demonstrated

1. **Separation of Concerns**: Controllers handle HTTP, services handle business logic
2. **Dependency Injection**: All dependencies injected via constructor
3. **Module Boundaries**: Clear module structure with proper exports
4. **Error Handling**: Consistent use of NestJS exceptions
5. **Validation**: DTOs with class-validator decorators
6. **Documentation**: Swagger/OpenAPI integration
7. **Testing**: Testable architecture with mockable dependencies
8. **Performance**: Caching, pagination, and selective queries
9. **Security**: Guards, authentication strategies, and input validation
