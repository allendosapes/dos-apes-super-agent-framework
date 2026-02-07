---
name: backend
description: API design, database schema, services, error handling, security patterns.
  Load for backend implementation, API development, and data layer work.
---

# Backend Skill

## TypeScript Rules

- Strict mode enabled (`"strict": true` in tsconfig)
- No `any` — use `unknown` and narrow with type guards
- All function parameters and return types explicitly typed
- Use Zod for runtime validation of external inputs

## API Design

### Request/Response Pattern

```typescript
// Consistent response envelope
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Success: 200/201
{ success: true, data: { user: { id: "...", name: "..." } } }

// Error: 400/401/404/500
{ success: false, error: { code: "VALIDATION_ERROR", message: "Email is required" } }
```

### Status Codes

- `200` — Success (GET, PUT, PATCH)
- `201` — Created (POST that creates a resource)
- `204` — No Content (DELETE)
- `400` — Bad Request (validation failure)
- `401` — Unauthorized (not authenticated)
- `403` — Forbidden (authenticated but not authorized)
- `404` — Not Found
- `409` — Conflict (duplicate resource)
- `422` — Unprocessable Entity (valid syntax, invalid semantics)
- `500` — Internal Server Error (unexpected failure)

### Endpoint Naming

```
GET    /api/users          → List users
GET    /api/users/:id      → Get user by ID
POST   /api/users          → Create user
PUT    /api/users/:id      → Full update
PATCH  /api/users/:id      → Partial update
DELETE /api/users/:id      → Delete user
```

Rules:
- Plural nouns for resources (`/users` not `/user`)
- Nested resources for relationships (`/users/:id/posts`)
- Query params for filtering (`/users?role=admin&active=true`)
- No verbs in URLs (`/users` not `/getUsers`)

## Validation with Zod

Validate ALL external inputs at the API boundary:

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["user", "admin"]).default("user"),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In controller
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({
    success: false,
    error: { code: "VALIDATION_ERROR", message: result.error.message },
  });
}
```

## Error Handling

### Custom Error Classes

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(400, "VALIDATION_ERROR", message);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}
```

### Global Error Handler

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Unexpected errors — log and return generic message
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});
```

Rules:
- Never expose stack traces in production
- Always use custom error classes, never throw plain strings
- Every async route handler wrapped in try/catch or async error middleware
- Log all 500 errors with full context

## Database

### Schema Rules

- UUIDs for primary keys (not auto-increment integers)
- `created_at` and `updated_at` timestamps on every table
- Soft delete where appropriate (`deleted_at` nullable timestamp)
- Always use parameterized queries (never string interpolation)
- Index foreign keys and frequently queried columns
- Use database-level constraints (NOT NULL, UNIQUE, CHECK)

### Prisma Patterns

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

### Migration Safety

- Never drop columns in production without a multi-step migration
- Add new columns as nullable first, backfill, then add NOT NULL
- Test migrations against a copy of production data

## Security Basics

### Input Validation
- Validate and sanitize ALL user input at the API boundary
- Use Zod schemas — never trust `req.body` / `req.params` / `req.query` directly
- Limit string lengths, validate enums, check numeric ranges

### Authentication
- Hash passwords with bcrypt (cost factor >= 12)
- Use JWTs with short expiry (15-60 min) + refresh tokens
- Store refresh tokens server-side, not in localStorage
- Always verify token signature and expiry

### Authorization
- Check permissions on every protected endpoint
- Never rely on client-side permission checks alone
- Use middleware for role-based access control
- Principle of least privilege

### Common Vulnerabilities
- **SQL Injection:** Always use parameterized queries / ORM
- **XSS:** Sanitize HTML output, use Content-Security-Policy headers
- **CSRF:** Use anti-CSRF tokens for state-changing requests
- **Rate Limiting:** Apply to auth endpoints and expensive operations
- **Secrets:** Environment variables only, never in code or git

### Headers
```typescript
app.use(helmet()); // Sets security headers
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") }));
app.use(express.json({ limit: "10mb" })); // Limit payload size
```
