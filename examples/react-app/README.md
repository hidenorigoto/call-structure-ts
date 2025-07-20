# React Application Example

This example demonstrates how to analyze a modern React application using call-structure-ts. It showcases component hierarchies, hook patterns, state management, and service integration.

## Architecture Overview

```
src/
├── App.tsx                 # Main application component
├── components/            # Reusable UI components
│   ├── Layout.tsx
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── ProtectedRoute.tsx
│   ├── ErrorBoundary.tsx
│   └── ...
├── pages/                 # Page components
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── useAuth.ts
│   ├── useProducts.ts
│   ├── useDebounce.ts
│   └── ...
├── contexts/              # React contexts
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── store/                 # Zustand state management
│   ├── index.ts
│   └── slices/
│       ├── authSlice.ts
│       ├── userSlice.ts
│       ├── productSlice.ts
│       └── ...
├── services/              # API and external services
│   ├── api.ts
│   ├── authService.ts
│   ├── productService.ts
│   └── ...
└── utils/                 # Utility functions

```

## Key Technologies

- **React 18** - UI library with hooks and concurrent features
- **TypeScript** - Type safety and better DX
- **React Router v6** - Client-side routing
- **Zustand** - Lightweight state management
- **React Query (TanStack Query)** - Server state management
- **Axios** - HTTP client with interceptors

## Features Demonstrated

### 1. Component Patterns

- Function components with TypeScript
- Custom hooks for logic reuse
- Context providers for cross-cutting concerns
- Error boundaries for resilience
- Protected routes for authentication

### 2. State Management

- **Local State**: useState for component-specific state
- **Global State**: Zustand for app-wide state
- **Server State**: React Query for API data
- **URL State**: React Router for navigation state

### 3. Data Flow

- Unidirectional data flow
- Props drilling avoidance with context and store
- Proper separation of concerns
- Service layer abstraction

### 4. Performance Optimizations

- React.memo for expensive components
- useMemo and useCallback for referential stability
- Code splitting with React.lazy
- React Query caching strategies

## Analyzing the Application

### Basic Component Analysis

```bash
# Analyze the main App component
call-structure analyze --entry src/App.tsx#App --output analysis/app.json

# Analyze component hierarchy
call-structure analyze --entry src/App.tsx#App --depth 3 --format mermaid

# Analyze a specific page component
call-structure analyze --entry src/pages/ProductsPage.tsx#ProductsPage
```

### Hook Analysis

```bash
# Analyze custom hooks
call-structure analyze --entry "src/hooks/**" --format mermaid

# Analyze specific hook dependencies
call-structure analyze --entry src/hooks/useAuth.ts#useAuth --output analysis/use-auth.json

# Check hook rules compliance
call-structure test --spec component-patterns.yaml --filter "Hook"
```

### State Management Analysis

```bash
# Analyze Zustand store
call-structure analyze --entry src/store/index.ts --output analysis/store.json

# Analyze specific slice
call-structure analyze --entry src/store/slices/authSlice.ts#authSlice

# Trace state updates
call-structure analyze --entry src/store/slices/productSlice.ts#setProductFilters --depth 5
```

### Service Layer Analysis

```bash
# Analyze API client setup
call-structure analyze --entry src/services/api.ts#ApiClient --output analysis/api-client.json

# Analyze service dependencies
call-structure analyze --entry "src/services/**" --exclude "react"

# Check service independence
call-structure test --spec component-patterns.yaml --filter "Service"
```

## Component Patterns Testing

```bash
# Run all component pattern tests
call-structure test --spec component-patterns.yaml

# Test specific patterns
call-structure test --spec component-patterns.yaml --filter "Component Hierarchy"

# Check for anti-patterns
call-structure test --spec component-patterns.yaml --filter "anti_patterns"
```

## Common Analysis Scenarios

### 1. Component Render Flow

```bash
# Trace render flow from App to specific page
call-structure analyze --entry src/App.tsx#App --target "ProductsPage" --output render-flow.json
```

### 2. Authentication Flow

```bash
# Analyze complete auth flow
call-structure analyze --entry src/pages/LoginPage.tsx#handleSubmit --depth 10
```

### 3. Data Fetching Flow

```bash
# Analyze React Query integration
call-structure analyze --entry src/hooks/useProducts.ts#useProducts --include-async
```

### 4. Error Handling Flow

```bash
# Analyze error boundary and error handling
call-structure analyze --entry src/components/ErrorBoundary.tsx#componentDidCatch
```

## Best Practices Demonstrated

### 1. Component Organization

```typescript
// Proper component structure
export function ProductCard({ product, onAddToCart }: Props) {
  // Hooks at the top
  const { addToCart } = useCart();
  const [isLoading, setIsLoading] = useState(false);

  // Event handlers
  const handleAddToCart = useCallback(async () => {
    setIsLoading(true);
    await addToCart(product);
    setIsLoading(false);
  }, [product, addToCart]);

  // Render
  return <div>...</div>;
}
```

### 2. Custom Hook Pattern

```typescript
// Encapsulate complex logic
export function useProducts(filters?: ProductFilters) {
  const query = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productService.getProducts(filters),
  });

  return {
    products: query.data?.products || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

### 3. Service Layer Pattern

```typescript
// Keep services framework-agnostic
class ProductService {
  async getProducts(filters?: ProductFilters) {
    return apiClient.get<ProductsResponse>('/products', { params: filters });
  }
}
```

### 4. State Management Pattern

```typescript
// Zustand slice with TypeScript
export const authSlice: StateCreator<AuthSlice> = (set, get) => ({
  auth: initialState,
  login: async (email, password) => {
    set({ auth: { ...get().auth, loading: true } });
    try {
      const response = await authService.login(email, password);
      set({ auth: { ...response, loading: false } });
    } catch (error) {
      set({ auth: { ...get().auth, error, loading: false } });
    }
  },
});
```

## Performance Analysis

```bash
# Check for unnecessary re-renders
call-structure analyze --entry "src/components/**" --detect-pattern "React.memo"

# Analyze bundle size impact
call-structure analyze --entry src/App.tsx --output analysis/bundle-impact.json

# Check for missing optimizations
call-structure test --spec component-patterns.yaml --filter "Performance"
```

## Common Issues and Solutions

### 1. Circular Dependencies

```bash
# Detect circular dependencies
call-structure analyze --entry src/App.tsx --detect-circular
```

### 2. Missing Dependencies in Hooks

```bash
# Check hook dependencies
call-structure test --spec component-patterns.yaml --filter "Missing Dependencies"
```

### 3. Direct API Calls in Components

```bash
# Ensure components use services
call-structure test --spec component-patterns.yaml --filter "Component Purity"
```

## Integration with CI/CD

```yaml
# .github/workflows/react-analysis.yml
- name: Analyze React Architecture
  run: |
    npm install -g call-structure-ts
    call-structure test --spec component-patterns.yaml --fail-on-violation
    call-structure analyze --entry src/App.tsx --detect-circular --fail-on-circular
```

## Advanced Analysis

### Render Performance

```bash
# Analyze component render chains
call-structure analyze --entry "src/**/*.tsx" --pattern "render|return.*<" --output render-analysis.json
```

### State Updates

```bash
# Trace state update propagation
call-structure analyze --entry "src/store/**" --pattern "set\\(" --output state-updates.json
```

### Event Handlers

```bash
# Analyze event handler patterns
call-structure analyze --entry "src/**/*.tsx" --pattern "handle|on[A-Z]" --output event-handlers.json
```
