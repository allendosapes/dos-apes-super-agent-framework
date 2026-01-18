# Coding Standards

Standards for code quality, consistency, and maintainability.

## Naming Conventions

### Files

| Type       | Convention     | Example              |
| ---------- | -------------- | -------------------- |
| Components | PascalCase     | `UserProfile.tsx`    |
| Utilities  | camelCase      | `formatDate.ts`      |
| Constants  | UPPER_SNAKE    | `API_ENDPOINTS.ts`   |
| Styles     | kebab-case     | `user-profile.css`   |
| Tests      | [name].test.ts | `formatDate.test.ts` |

### Variables & Functions

```typescript
// Variables: camelCase
const userName = "John";
const isActive = true;
const maxRetries = 3;

// Functions: camelCase, verb-first
function getUserById(id: string) {}
function calculateTotal(items: Item[]) {}
function handleSubmit(e: FormEvent) {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = "/api/v1";
```

### Classes & Interfaces

```typescript
// Classes: PascalCase
class UserService {}
class AuthenticationError extends Error {}

// Interfaces: PascalCase, no 'I' prefix
interface User {}
interface ApiResponse<T> {}

// Types: PascalCase
type UserId = string;
type Status = "active" | "inactive";
```

## Code Organization

### Function Size

- Maximum 30 lines per function
- Single responsibility
- Early returns for guard clauses

```typescript
// Good: Early returns, single responsibility
function processUser(user: User | null): ProcessedUser {
  if (!user) {
    return getDefaultUser();
  }

  if (!user.isActive) {
    return markInactive(user);
  }

  return enrichUser(user);
}
```

### File Size

- Maximum 300 lines per file
- Split large files into modules
- One component per file

### Import Order

```typescript
// 1. Node/framework imports
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

// 2. Third-party libraries
import { z } from "zod";
import { format } from "date-fns";

// 3. Local imports (absolute)
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

// 4. Relative imports
import { UserCard } from "./UserCard";
import { formatUserName } from "./utils";

// 5. Types (if separate)
import type { User } from "@/types";

// 6. Styles
import styles from "./styles.module.css";
```

## TypeScript Standards

### Strict Mode

Always enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Type Safety

```typescript
// Never use 'any'
function bad(data: any) {} // BAD
function good(data: unknown) {} // GOOD

// Use type guards
function isUser(obj: unknown): obj is User {
  return typeof obj === "object" && obj !== null && "id" in obj;
}

// Prefer interfaces for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Use types for unions/intersections
type Status = "pending" | "active" | "inactive";
type UserWithRole = User & { role: Role };
```

### Null Handling

```typescript
// Use optional chaining
const name = user?.profile?.name;

// Use nullish coalescing
const displayName = user.name ?? "Anonymous";

// Be explicit about nullable types
function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}
```

## Error Handling

### Custom Error Classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}
```

### Error Boundaries (React)

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

## Comments

### When to Comment

- Complex algorithms
- Non-obvious workarounds
- API documentation (JSDoc)
- TODO with issue reference

### When NOT to Comment

- Obvious code
- Already clear variable names
- Every function

```typescript
// BAD: Obvious comment
// Get user by id
function getUserById(id: string) {}

// GOOD: Explains why, not what
// Use binary search since users array is always sorted by id
function findUser(id: string): User | null {}

// GOOD: Documents public API
/**
 * Fetches user data with automatic retry on failure.
 * @param id - User identifier
 * @param options - Retry configuration
 * @returns User data or null if not found
 * @throws {AuthError} If authentication fails
 */
async function fetchUser(
  id: string,
  options?: RetryOptions,
): Promise<User | null> {}
```

## Async/Await

### Prefer async/await over callbacks

```typescript
// BAD: Callback pyramid
fetchUser(id, (err, user) => {
  if (err) return handleError(err);
  fetchPosts(user.id, (err, posts) => {
    if (err) return handleError(err);
    // ...
  });
});

// GOOD: async/await
async function loadUserData(id: string) {
  const user = await fetchUser(id);
  const posts = await fetchPosts(user.id);
  return { user, posts };
}
```

### Error Handling

```typescript
// Always handle errors
async function safelyFetchUser(id: string): Promise<User | null> {
  try {
    return await fetchUser(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error; // Re-throw unexpected errors
  }
}
```

## Don'ts

1. **No magic numbers** - Use named constants
2. **No nested ternaries** - Use if/else or switch
3. **No console.log in production** - Use proper logging
4. **No commented-out code** - Delete it
5. **No string concatenation for SQL** - Use parameterized queries
6. **No secrets in code** - Use environment variables
