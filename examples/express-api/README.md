# Express.js API Example

This example demonstrates how to analyze a RESTful API built with Express.js using call-structure-ts. It showcases proper layering, middleware usage, and service-oriented architecture.

## Architecture Overview

```
src/
├── server.ts           # Application entry point
├── routes/            # Route definitions
│   ├── auth.ts       # Authentication routes
│   ├── users.ts      # User management routes
│   └── products.ts   # Product routes
├── controllers/       # Request handlers
│   ├── authController.ts
│   ├── userController.ts
│   └── productController.ts
├── services/         # Business logic
│   ├── authService.ts
│   ├── userService.ts
│   ├── productService.ts
│   ├── tokenService.ts
│   ├── emailService.ts
│   ├── database.ts   # Mock database
│   └── cache.ts      # Mock cache
├── middleware/       # Express middleware
│   ├── auth.ts       # JWT authentication
│   ├── errorHandler.ts
│   ├── validateRequest.ts
│   ├── adminOnly.ts
│   ├── requestLogger.ts
│   └── rateLimiter.ts
├── models/          # Data models
│   └── user.ts
└── utils/           # Utilities
    ├── apiError.ts
    └── logger.ts
```

## Key Features Demonstrated

1. **Layered Architecture**
   - Routes → Controllers → Services → Database
   - Clear separation of concerns
   - Dependency injection pattern

2. **Middleware Pipeline**
   - Authentication (JWT)
   - Request validation
   - Error handling
   - Rate limiting
   - Request logging

3. **Service Layer**
   - Business logic encapsulation
   - Database abstraction
   - Caching strategy
   - Email notifications

4. **Security Features**
   - JWT authentication
   - Password hashing (bcrypt)
   - Rate limiting
   - Input validation
   - Role-based access control

## Running the Example

```bash
# Install dependencies
npm install

# Create .env file
echo "PORT=3000
NODE_ENV=development
ACCESS_TOKEN_SECRET=your-access-secret
REFRESH_TOKEN_SECRET=your-refresh-secret
EMAIL_FROM=noreply@example.com
APP_URL=http://localhost:3000" > .env

# Build the project
npm run build

# Start the server
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/verify-email` - Verify email address

### Users (Protected)

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/me/profile` - Get current user
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/password` - Change password
- `DELETE /api/users/:id` - Delete user (admin only)

### Products (Protected)

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

## Analyzing the Code Structure

### Basic Analysis

```bash
# Analyze server startup
call-structure analyze --entry src/server.ts#startServer --output analysis/server.json

# Analyze authentication flow
call-structure analyze --entry src/controllers/authController.ts#AuthController.login --format mermaid

# Analyze middleware chain
call-structure analyze --entry src/server.ts#createApp --depth 2
```

### Test Specifications

```bash
# Run architecture tests
call-structure test --spec test-spec.yaml
```

### Call Flow Examples

1. **User Registration Flow**

   ```
   POST /api/auth/register
   → validateRequest
   → AuthController.register
   → UserService.getUserByEmail
   → AuthService.register
   → UserService.createUser
   → TokenService.generateVerificationToken
   → EmailService.sendVerificationEmail
   ```

2. **Protected Route Access**

   ```
   GET /api/users/me/profile
   → authMiddleware
   → TokenService.verifyAccessToken
   → UserService.getUserById
   → UserController.getCurrentUser
   → UserService.getUserById
   ```

3. **Cached Product Listing**
   ```
   GET /api/products?category=Electronics
   → authMiddleware
   → ProductController.getAllProducts
   → CacheService.get (cache hit)
   → Return cached data
   ```

## Middleware Analysis

```bash
# Analyze authentication middleware
call-structure analyze --entry src/middleware/auth.ts#authMiddleware

# Analyze error handling
call-structure analyze --entry src/middleware/errorHandler.ts#errorHandler

# Analyze rate limiting
call-structure analyze --entry src/middleware/rateLimiter.ts#rateLimiter
```

## Service Layer Analysis

```bash
# Analyze user service dependencies
call-structure analyze --entry "src/services/userService.ts#UserService.*" --depth 3

# Check service independence
call-structure analyze --entry "src/services/**" --exclude "express"
```

## Performance Considerations

1. **Caching Strategy**
   - User lists cached for 5 minutes
   - Products cached for 10 minutes
   - Individual products cached for 1 hour
   - Cache invalidation on updates

2. **Database Optimization**
   - Pagination support
   - Selective field queries
   - Index usage (in real implementation)

3. **Rate Limiting**
   - General API: 100 requests/15 minutes
   - Auth endpoints: 5 requests/15 minutes
   - Per-IP tracking

## Security Analysis

```bash
# Check for direct database access in controllers
call-structure analyze --entry "src/controllers/**" --detect-pattern "database|db\."

# Verify password hashing
call-structure analyze --entry "src/**" --detect-pattern "password.*bcrypt"

# Check authentication on routes
call-structure analyze --entry "src/routes/**" --detect-pattern "authMiddleware"
```

## Common Patterns

1. **Controller Pattern**

   ```typescript
   async action(req, res, next) {
     try {
       // Validate and extract data
       // Call service method
       // Transform response
       // Send response
     } catch (error) {
       next(error); // Delegate to error handler
     }
   }
   ```

2. **Service Pattern**

   ```typescript
   // No Express dependencies
   // Pure business logic
   // Database abstraction
   // Return domain objects
   ```

3. **Middleware Pattern**
   ```typescript
   (req, res, next) => {
     // Process request
     // Modify req/res if needed
     // Call next() or next(error)
   };
   ```

## Integration with CI/CD

```yaml
# .github/workflows/api-test.yml
- name: Analyze API Architecture
  run: |
    npm install -g call-structure-ts
    call-structure test --spec test-spec.yaml --fail-on-violation
```

## Best Practices Demonstrated

1. **Error Handling**: Centralized error handling with custom error types
2. **Validation**: Input validation at route level
3. **Authentication**: JWT with refresh tokens
4. **Logging**: Structured logging with correlation
5. **Caching**: Strategic caching with invalidation
6. **Rate Limiting**: Prevent API abuse
7. **Type Safety**: Full TypeScript coverage
8. **Separation of Concerns**: Clear layer boundaries
