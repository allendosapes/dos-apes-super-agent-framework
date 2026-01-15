# API Standards

Standards for designing and implementing RESTful APIs.

## URL Design

### Resource Naming
```
# Use nouns, not verbs
GET /users          # Good
GET /getUsers       # Bad

# Use plural nouns
GET /users          # Good
GET /user           # Bad

# Nested resources for relationships
GET /users/123/posts     # Posts by user 123
GET /posts?userId=123    # Alternative query parameter

# Use kebab-case for multi-word
GET /order-items         # Good
GET /orderItems          # Bad
```

### URL Patterns
```
GET    /resources          # List resources
POST   /resources          # Create resource
GET    /resources/:id      # Get single resource
PATCH  /resources/:id      # Partial update
PUT    /resources/:id      # Full replace
DELETE /resources/:id      # Delete resource

# Actions (when needed)
POST   /resources/:id/archive     # Action on resource
POST   /orders/:id/cancel         # Cancel order
```

## HTTP Methods

| Method | Purpose | Idempotent | Body |
|--------|---------|------------|------|
| GET | Retrieve | Yes | No |
| POST | Create | No | Yes |
| PUT | Replace | Yes | Yes |
| PATCH | Partial update | Yes | Yes |
| DELETE | Remove | Yes | No |

## Status Codes

### Success
| Code | Meaning | Use When |
|------|---------|----------|
| 200 | OK | GET, PATCH, PUT success |
| 201 | Created | POST created resource |
| 204 | No Content | DELETE success |

### Client Errors
| Code | Meaning | Use When |
|------|---------|----------|
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Auth required |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate/conflict |
| 422 | Unprocessable | Semantic error |
| 429 | Too Many Requests | Rate limited |

### Server Errors
| Code | Meaning | Use When |
|------|---------|----------|
| 500 | Internal Error | Server failure |
| 502 | Bad Gateway | Upstream failure |
| 503 | Service Unavailable | Temporarily down |

## Request Format

### Headers
```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>        # For tracing
```

### Body (JSON)
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin"
}
```

## Response Format

### Success Response
```json
{
  "data": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### List Response (with Pagination)
```json
{
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "email": "Invalid email format",
      "password": "Must be at least 8 characters"
    }
  }
}
```

## Pagination

### Query Parameters
```
GET /users?page=2&limit=20&sort=createdAt&order=desc
```

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| page | 1 | - | Page number |
| limit | 10 | 100 | Items per page |
| sort | createdAt | - | Sort field |
| order | desc | - | asc or desc |

### Implementation
```typescript
interface PaginationParams {
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
}

function paginate<T>(items: T[], params: PaginationParams) {
  const { page, limit, sort, order } = params;
  const start = (page - 1) * limit;

  const sorted = [...items].sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];
    return order === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return {
    data: sorted.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit)
    }
  };
}
```

## Filtering

### Query Parameters
```
GET /users?status=active&role=admin&createdAfter=2024-01-01
```

### Implementation
```typescript
const FilterSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  role: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  search: z.string().max(100).optional()
});

function buildFilter(params: FilterParams): WhereClause {
  const where: WhereClause = {};

  if (params.status) where.status = params.status;
  if (params.role) where.role = params.role;
  if (params.createdAfter) where.createdAt = { gte: new Date(params.createdAfter) };
  if (params.search) where.name = { contains: params.search, mode: 'insensitive' };

  return where;
}
```

## Validation

### Input Validation
```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100)
});

app.post('/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten().fieldErrors
      }
    });
  }

  const user = await createUser(result.data);
  res.status(201).json({ data: user });
});
```

## Versioning

### URL Versioning (Recommended)
```
GET /api/v1/users
GET /api/v2/users
```

### Header Versioning (Alternative)
```
GET /api/users
Accept: application/vnd.api+json; version=2
```

## Error Handling

### Standard Error Format
```typescript
class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

// Error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Log unexpected errors
  console.error(err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

## Rate Limiting

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

### Response (429)
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

## Documentation

### OpenAPI Specification
```yaml
openapi: 3.0.3
info:
  title: API
  version: 1.0.0

paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
```
