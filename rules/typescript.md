# TypeScript Development Rules

- Last Updated: 2025-01-26
- Description: TypeScript development best practices and type safety guidelines
- Version: 1.0

## Type Safety

### Strict Mode Configuration
Always enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Explicit Types
- Always provide explicit types for function parameters
- Use return type annotations for public functions
- Avoid using `any` type - use `unknown` instead when type is truly unknown

```typescript
// Good: Explicit types
function processUser(user: User, options: ProcessOptions): Promise<ProcessedUser> {
  return processUserData(user, options);
}

// Bad: Implicit any
function processUser(user, options) {
  return processUserData(user, options);
}
```

## Type Definitions

### Interfaces vs Types
- Use interfaces for object shapes that might be extended
- Use type aliases for unions, primitives, and computed types
- Prefer interfaces for public APIs

```typescript
// Good: Interface for extensible object shape
interface User {
  id: string;
  name: string;
  email: string;
}

interface AdminUser extends User {
  permissions: Permission[];
}

// Good: Type alias for unions
type Status = 'pending' | 'approved' | 'rejected';
type EventHandler<T> = (event: T) => void;
```

### Generic Types
- Use descriptive generic parameter names
- Provide default types when appropriate
- Use constraints to limit generic types

```typescript
// Good: Descriptive generic names with constraints
interface Repository<TEntity extends { id: string }> {
  findById(id: string): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: string): Promise<void>;
}

// Good: Generic with default type
interface ApiResponse<TData = unknown> {
  data: TData;
  status: number;
  message?: string;
}
```

## Utility Types

### Built-in Utility Types
Leverage TypeScript's built-in utility types:

```typescript
// Partial for optional updates
function updateUser(id: string, updates: Partial<User>): Promise<User> {
  // Implementation
}

// Pick for selecting specific properties
type UserSummary = Pick<User, 'id' | 'name' | 'email'>;

// Omit for excluding properties
type CreateUserRequest = Omit<User, 'id' | 'createdAt'>;

// Record for key-value mappings
type UserRoles = Record<string, Role[]>;
```

### Custom Utility Types
Create reusable utility types for common patterns:

```typescript
// Nullable type
type Nullable<T> = T | null;

// API response wrapper
type ApiResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
```

## Error Handling

### Discriminated Unions
Use discriminated unions for error handling:

```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

function parseJson<T>(json: string): Result<T, SyntaxError> {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as SyntaxError };
  }
}

// Usage with type narrowing
const result = parseJson<User>(jsonString);
if (result.success) {
  console.log(result.data.name); // TypeScript knows this is User
} else {
  console.error(result.error.message); // TypeScript knows this is SyntaxError
}
```

### Custom Error Types
Define specific error types for better error handling:

```typescript
abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
}

class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}
```

## Advanced Patterns

### Branded Types
Use branded types for type safety with primitive values:

```typescript
// Branded types for IDs
type UserId = string & { readonly brand: unique symbol };
type ProductId = string & { readonly brand: unique symbol };

function createUserId(id: string): UserId {
  return id as UserId;
}

function getUser(id: UserId): Promise<User> {
  // Implementation - can only be called with UserId
}

// This prevents mixing up different ID types
const userId = createUserId('user-123');
const productId = 'product-456' as ProductId;

getUser(userId); // ✓ Correct
getUser(productId); // ✗ TypeScript error
```

### Template Literal Types
Use template literal types for string validation:

```typescript
// API endpoint types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiVersion = 'v1' | 'v2';
type ApiEndpoint = `/${ApiVersion}/${string}`;

// CSS property types
type CSSUnit = 'px' | 'em' | 'rem' | '%';
type CSSValue<T extends string> = `${number}${T}`;
type Padding = CSSValue<CSSUnit>;

const padding: Padding = '16px'; // ✓ Valid
const invalidPadding: Padding = '16'; // ✗ TypeScript error
```

## Module Organization

### Barrel Exports
Use barrel exports for clean imports:

```typescript
// types/index.ts
export type { User, UserRole, UserPermission } from './user';
export type { Product, ProductCategory } from './product';
export type { ApiResponse, ApiError } from './api';

// Usage
import type { User, Product, ApiResponse } from '@/types';
```

### Declaration Merging
Use declaration merging for extending third-party types:

```typescript
// Extending Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId: string;
    }
  }
}

// Now available in all Express handlers
app.get('/profile', (req, res) => {
  const user = req.user; // TypeScript knows this exists
  const requestId = req.requestId; // TypeScript knows this exists
});
```

## Testing with TypeScript

### Type-Safe Test Utilities
Create type-safe test utilities:

```typescript
// Test data factory with proper typing
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    createdAt: new Date(),
    ...overrides
  };
}

// Type-safe mock functions
function createMockRepository<T>(): jest.Mocked<Repository<T>> {
  return {
    findById: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}
```

### Testing Types
Test your types with type-level tests:

```typescript
// Type-level tests using conditional types
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

// Test that utility type works correctly
type TestPartialUser = Expect<Equal<
  Partial<User>,
  {
    id?: string;
    name?: string;
    email?: string;
  }
>>;
```

## Performance Considerations

### Type-Only Imports
Use type-only imports to avoid runtime dependencies:

```typescript
// Type-only import (no runtime cost)
import type { User } from './types/user';

// Regular import (includes runtime code)
import { validateUser } from './utils/validation';

// Mixed import
import { type User, createUser } from './user-service';
```

### Const Assertions
Use const assertions for better type inference:

```typescript
// Without const assertion
const colors = ['red', 'green', 'blue']; // string[]

// With const assertion
const colors = ['red', 'green', 'blue'] as const; // readonly ['red', 'green', 'blue']

// Object const assertion
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} as const; // All properties become readonly
```