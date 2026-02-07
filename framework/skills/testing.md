---
name: testing
description: Testing patterns, TDD, coverage enforcement, E2E with Playwright, visual regression, accessibility testing. Load when writing tests, configuring test runners, or verifying quality.
allowed-tools: Read, Edit, Write, Bash, Grep
---

# Testing Skill

## Verification Pyramid

The Dos Apes framework uses an 8-level verification pyramid:

```
L0:   Build                    ← npm run build
L0.5: Auto Code Review         ← Stop hook (runs automatically)
L1:   Static Analysis          ← typecheck + lint
L2:   Unit Tests               ← npm test
L2.5: Coverage Gate            ← scripts/check-coverage.sh
L3:   Integration Tests        ← npm run test:integration
L4:   UI Integration           ← Component routed and navigable?
L5:   Security Scan            ← npm audit + gitleaks
L6:   E2E / Browser            ← agent-browser + Playwright
L7:   Visual Regression        ← Playwright screenshot diff
```

Levels 0-5 are mandatory. Levels 6-7 activate when Playwright is configured.

## Unit Testing Patterns

### Test File Co-location

Place tests next to the code they test:

```
src/
├── components/
│   ├── UserCard.tsx
│   └── UserCard.test.tsx
├── services/
│   ├── auth.ts
│   └── auth.test.ts
└── hooks/
    ├── useAuth.ts
    └── useAuth.test.ts
```

### Test Structure (AAA Pattern)

```typescript
describe("UserCard", () => {
  it("renders user name and email", () => {
    // Arrange
    const user = { name: "Alice", email: "alice@test.com" };

    // Act
    render(<UserCard user={user} />);

    // Assert
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
  });
});
```

### What to Test

- **Components:** Rendering, user interactions, conditional display, error states
- **Hooks:** State changes, side effects, return values
- **Services:** API calls (mocked), data transformations, error handling
- **Utilities:** Pure functions, edge cases, boundary values

### What NOT to Test

- Implementation details (internal state, private methods)
- Third-party library behavior
- Styling / CSS classes
- Exact snapshot matching (fragile)

## Coverage Enforcement

### Configuration

Coverage threshold defaults to 80%. Override via environment variable:

```bash
COVERAGE_THRESHOLD=90 bash scripts/check-coverage.sh
```

### Coverage Metrics

The coverage gate checks three metrics:
- **Lines** — percentage of code lines executed
- **Branches** — percentage of if/else/switch paths taken
- **Functions** — percentage of functions called

All three must meet the threshold.

### Improving Coverage

When coverage drops below threshold:
1. Run `npx jest --coverage` to see the detailed report
2. Open `coverage/lcov-report/index.html` for visual breakdown
3. Focus on uncovered branches first (most common gap)
4. Write tests for error paths and edge cases

## Integration Testing

### API Integration Tests

```typescript
describe("POST /api/users", () => {
  it("creates a user and returns 201", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ name: "Alice", email: "alice@test.com" });

    expect(response.status).toBe(201);
    expect(response.body.user.name).toBe("Alice");
  });

  it("returns 400 for invalid email", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ name: "Alice", email: "invalid" });

    expect(response.status).toBe(400);
  });
});
```

### Database Integration Tests

Use test databases or transactions that rollback:

```typescript
beforeEach(async () => {
  await db.migrate.latest();
  await db.seed.run();
});

afterEach(async () => {
  await db.migrate.rollback();
});
```

## E2E Testing with Playwright

### Setup

Playwright is configured as an MCP server in settings.json. For test suites:

```bash
npx playwright install
```

### Test Generation from User Stories

Given a user story with acceptance criteria, generate Playwright tests:

```typescript
// tests/e2e/user-registration.spec.ts
import { test, expect } from "@playwright/test";

test("user can register with email and password", async ({ page }) => {
  await page.goto("/register");
  await page.fill('[data-testid="email"]', "alice@test.com");
  await page.fill('[data-testid="password"]', "SecurePass123!");
  await page.click('[data-testid="submit"]');

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("Welcome")).toBeVisible();
});
```

### E2E Selector Conventions

Use `data-testid` attributes for E2E selectors:

```tsx
<input data-testid="email" type="email" />
<button data-testid="submit">Register</button>
```

Naming: `data-testid="[component]-[element]"` (e.g., `login-form-email`, `nav-logout-button`).

### Running E2E Tests

```bash
npx playwright test                          # All tests
npx playwright test --project=chromium       # Single browser
npx playwright test user-registration        # Specific test
npx playwright test --ui                     # Interactive UI mode
```

## Visual Regression Testing

### Workflow

1. **Create baselines** — First run captures reference screenshots
2. **Compare on changes** — Subsequent runs diff against baselines
3. **Review diffs** — Pixel differences above threshold are flagged
4. **Update baselines** — Accept new screenshots when UI intentionally changes

### Configuration

```typescript
// playwright.config.ts (visual regression project)
{
  name: "visual-regression",
  use: {
    viewport: { width: 1280, height: 720 },
  },
  snapshotDir: "tests/visual-baselines",
}
```

### Writing Visual Tests

```typescript
test("homepage matches baseline", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("homepage.png", {
    maxDiffPixelRatio: 0.001,
  });
});
```

### Updating Baselines

```bash
npx playwright test --update-snapshots
```

## Accessibility Testing

### Automated Checks

Use Playwright accessibility snapshots for WCAG compliance:

```typescript
test("login page is accessible", async ({ page }) => {
  await page.goto("/login");

  // Check accessibility tree
  const snapshot = await page.accessibility.snapshot();
  expect(snapshot).toBeTruthy();

  // Verify form labels
  const emailInput = page.getByLabel("Email");
  await expect(emailInput).toBeVisible();
});
```

### WCAG 2.1 AA Checklist

- All images have alt text
- Form inputs have associated labels
- Color contrast >= 4.5:1 for normal text
- Keyboard navigation works for all interactive elements
- Focus indicators are visible
- Headings follow logical hierarchy (h1 > h2 > h3)
- ARIA attributes used correctly

### Running Accessibility Audit

```bash
/apes-test-a11y              # Full accessibility audit
npx playwright test --project=accessibility
```

## Anti-Patterns

### Flaky Tests

```typescript
// BAD: Depends on timing
await page.waitForTimeout(2000);
expect(element).toBeVisible();

// GOOD: Wait for condition
await expect(element).toBeVisible({ timeout: 5000 });
```

### Over-Mocking

```typescript
// BAD: Mocking everything, testing nothing
jest.mock("./database");
jest.mock("./auth");
jest.mock("./validation");
// What are you even testing?

// GOOD: Mock only external boundaries
jest.mock("./external-api-client");
```

### Test Coupling

```typescript
// BAD: Tests depend on execution order
let userId: string;
test("creates user", () => { userId = createUser(); });
test("fetches user", () => { fetchUser(userId); }); // Fails if run alone

// GOOD: Each test is independent
test("fetches user", () => {
  const userId = createUser(); // Setup in each test
  const user = fetchUser(userId);
  expect(user).toBeDefined();
});
```
