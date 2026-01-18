# Testing Standards

Standards for comprehensive test coverage and quality assurance.

## Coverage Targets

| Type              | Target      | Minimum            |
| ----------------- | ----------- | ------------------ |
| Unit Tests        | 80%+        | 70%                |
| Integration Tests | Key paths   | Critical flows     |
| E2E Tests         | Happy paths | Core user journeys |

## Test Structure

### Directory Layout

```
tests/
├── unit/                   # Isolated unit tests
│   ├── components/        # React component tests
│   ├── services/          # Service layer tests
│   ├── hooks/             # Custom hook tests
│   └── utils/             # Utility function tests
├── integration/            # Integration tests
│   ├── api/               # API endpoint tests
│   └── database/          # Database operation tests
├── e2e/                    # End-to-end tests
│   └── flows/             # User flow tests
├── fixtures/               # Test data
├── mocks/                  # Mock implementations
└── utils/                  # Test utilities
```

### File Naming

- Unit: `[name].test.ts`
- Integration: `[feature].integration.test.ts`
- E2E: `[flow].spec.ts`

## Unit Tests

### Structure: Arrange-Act-Assert

```typescript
describe("calculateTotal", () => {
  it("should sum all item prices", () => {
    // Arrange
    const items = [
      { name: "Item 1", price: 10 },
      { name: "Item 2", price: 20 },
    ];

    // Act
    const result = calculateTotal(items);

    // Assert
    expect(result).toBe(30);
  });
});
```

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  const defaultProps = {
    user: { name: 'John', email: 'john@example.com' }
  };

  it('displays user information', () => {
    render(<UserProfile {...defaultProps} />);

    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    render(<UserProfile {...defaultProps} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<UserProfile {...defaultProps} loading />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

### Service Testing

```typescript
import { UserService } from "./UserService";
import { UserRepository } from "./UserRepository";

jest.mock("./UserRepository");

describe("UserService", () => {
  let service: UserService;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = new UserRepository() as jest.Mocked<UserRepository>;
    service = new UserService(mockRepo);
    jest.clearAllMocks();
  });

  describe("getUserById", () => {
    it("returns user when found", async () => {
      const user = { id: "1", name: "John" };
      mockRepo.findById.mockResolvedValue(user);

      const result = await service.getUserById("1");

      expect(result).toEqual(user);
      expect(mockRepo.findById).toHaveBeenCalledWith("1");
    });

    it("throws NotFoundError when user not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getUserById("999")).rejects.toThrow(NotFoundError);
    });
  });
});
```

## Integration Tests

### API Testing

```typescript
import request from "supertest";
import { app } from "../app";
import { createTestUser, getAuthToken, cleanupDatabase } from "./utils";

describe("Users API", () => {
  let authToken: string;

  beforeAll(async () => {
    const user = await createTestUser();
    authToken = await getAuthToken(user);
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe("GET /api/users", () => {
    it("returns paginated user list", async () => {
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: expect.any(Number),
        total: expect.any(Number),
      });
    });

    it("returns 401 without authentication", async () => {
      await request(app).get("/api/users").expect(401);
    });
  });

  describe("POST /api/users", () => {
    it("creates user with valid data", async () => {
      const userData = {
        email: "new@example.com",
        password: "SecurePass123!",
        name: "New User",
      };

      const response = await request(app)
        .post("/api/users")
        .send(userData)
        .expect(201);

      expect(response.body.email).toBe(userData.email);
      expect(response.body).not.toHaveProperty("password");
    });

    it("returns 400 for invalid email", async () => {
      const response = await request(app)
        .post("/api/users")
        .send({ email: "invalid", password: "test123" })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
```

## E2E Tests

### Playwright Setup

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
```

### User Flow Tests

```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("user can register and login", async ({ page }) => {
    // Registration
    await page.goto("/register");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "SecurePass123!");
    await page.fill('[name="name"]', "Test User");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(
      "Test User",
    );

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click("text=Logout");
    await expect(page).toHaveURL("/login");

    // Login again
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "SecurePass123!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");
  });

  test("shows error for invalid login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toContainText(
      "Invalid credentials",
    );
    await expect(page).toHaveURL("/login");
  });
});
```

## Test Utilities

### Custom Render (React)

```typescript
// tests/utils/render.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}
```

### Data Factories

```typescript
// tests/utils/factories.ts
import { faker } from "@faker-js/faker";

export function createUser(overrides = {}) {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    createdAt: faker.date.past(),
    ...overrides,
  };
}

export function createPost(overrides = {}) {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    authorId: faker.string.uuid(),
    ...overrides,
  };
}
```

## Best Practices

### Do

- Test behavior, not implementation
- Use meaningful test names
- One assertion per test (when possible)
- Test edge cases
- Keep tests independent
- Clean up after each test

### Don't

- Test internal implementation details
- Share state between tests
- Use sleep/fixed timeouts
- Test third-party libraries
- Skip tests without reason

## Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- UserService.test.ts

# Watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```
