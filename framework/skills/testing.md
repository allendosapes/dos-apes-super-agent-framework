---
name: testing
description: Testing patterns, TDD, coverage enforcement, E2E with Playwright, visual regression, accessibility testing. Load when writing tests, configuring test runners, or verifying quality.
allowed-tools: Read, Grep, Glob, Bash(bash scripts/check-:*), Bash(node scripts/log-verification.js:*), Bash(npx playwright:*)
---

# Testing Skill

## Verification Pyramid

The Dos Apes framework uses a 9-level verification pyramid:

```
L0:   Build                    ← npm run build
L0.5: Auto Code Review         ← Stop hook (runs automatically)
L1:   Static Analysis          ← typecheck + lint
L1.5: Documentation Drift      ← scripts/check-doc-drift.sh
L2:   Unit Tests               ← npm test
L2.5: Coverage Gate            ← scripts/check-coverage.sh
L3:   Integration Tests        ← npm run test:integration
L4:   UI Integration           ← Component routed and navigable?
L5:   Security Scan            ← npm audit + gitleaks
L6:   E2E / Browser            ← agent-browser + Playwright
L7:   Visual Regression        ← Playwright screenshot diff
L8:   Adversarial Review       ← Cross-model review via Codex CLI (opt-in, fails open)
```

Levels 0-5 are mandatory. Levels 6-7 activate when Playwright is configured. L8 is opt-in — see [`cross-model-review.md`](./cross-model-review.md).

### Enforcement tiers

The pyramid groups into four tiers by *how* a level is enforced. The tier matters when deciding whether a failure should block, warn, or be silently skipped.

| Tier            | Levels                       | Enforcement mechanism                                         | Failure behavior                                                                  |
|-----------------|------------------------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------|
| Deterministic   | L0, L1, L1.5, L2, L2.5, L5    | Build/typecheck/test runners + scripted gates. Same input → same output. | Blocks. A failing deterministic level is a hard stop; fix it before continuing.  |
| Automated       | L0.5                          | Claude-driven Stop hook. Heuristic but invoked automatically. | Blocks per the hook contract; can be overridden by the user mid-session.          |
| Comprehensive   | L3, L4, L6, L7                | Broader scope: integration, UI, browser, visual.              | Blocks if configured for the project; warns + skips when prerequisites are absent.|
| External        | L8                            | Requires an external CLI (Codex). Opt-in, capability-gated.   | **Fails open** — never blocks the pyramid. Findings surface to the user.          |

L8 is the only level in its tier today. The "fails open" guarantee is part of the contract: any pyramid run that completes L0–L7 successfully must complete with a green overall verdict regardless of L8's state, including the case where Codex is offline, unauthenticated, or disabled in `.dos-apes/codex-review-config.json`.

## Verification Logs

Every verification run is appended as one line to a JSON-Lines log under the active mission's directory. This log is the source of truth for "did this mission pass" and is consumed by the evidence-packet generator and the status dashboard.

### File location

```
.planning/missions/<state>/M-NNNN/verification.jsonl
```

The per-mission directory (`M-NNNN/`) lives alongside the mission's markdown file (`M-NNNN-<slug>.md`) inside the current state folder. When a mission transitions states, both move together.

### Record schema

One JSON object per line:

```json
{
  "timestamp": "2026-04-30T15:23:01Z",
  "level": "L2",
  "level_name": "Unit Tests",
  "outcome": "pass",
  "duration_ms": 12340,
  "details": {},
  "summary": "All 47 unit tests passed"
}
```

| Field | Type | Notes |
|---|---|---|
| `timestamp` | string | ISO 8601 UTC, second precision |
| `level` | string | Pyramid level ID: `L0`, `L0.5`, `L1`, `L1.5`, `L2`, `L2.5`, `L3`, `L4`, `L5`, `L6`, `L7`, `L8` |
| `level_name` | string | Human-readable name; canonical mapping in `log-verification.js` |
| `outcome` | string | `pass` \| `fail` \| `skip` |
| `duration_ms` | number \| null | Wall-clock duration; `null` if not measured |
| `details` | object | Level-specific freeform JSON (coverage percentages, tool name, etc.) |
| `summary` | string | One-line human-readable result |

The schema is intentionally minimal — anything that varies between levels lives in `details`.

### How to log a run

Verification scripts call the helper after their main work:

```bash
node scripts/log-verification.js <level> <outcome> <summary> [details-json]
```

Example from `check-coverage.sh`:

```bash
node scripts/log-verification.js L2.5 pass \
  "Coverage 80% threshold met (lines=82 branches=78 functions=85)" \
  '{"runner":"vitest","threshold":80,"lines":82,"branches":78,"functions":85}'
```

The helper resolves the active mission ID by reading `.planning/active-mission` (a one-line file written when a mission transitions to `doing`).

### Graceful degradation contract

The verification log is **best-effort**. If any of these conditions hold, the helper prints a single warning to stderr and exits zero:

- `.planning/active-mission` does not exist or is unreadable.
- The active-mission file contains an invalid mission ID.
- The mission file cannot be located in any state directory.
- The log file cannot be written (permissions, disk full, etc.).

Calling scripts must therefore never fail because of logging. The pattern in every script is:

```bash
node scripts/log-verification.js <args> 2>/dev/null || true
```

Argument-validation errors (unknown level, invalid outcome, malformed JSON) exit with code 2 — these are programmer errors and should surface in development, but the `|| true` in the call site keeps the verification pipeline running.

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

Coverage threshold defaults to 80%. Override by passing the threshold as
the first argument (the `COVERAGE_THRESHOLD` env var remains the fallback
for hook contexts):

```bash
bash scripts/check-coverage.sh 90
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

## Acceptance Criteria Verification

This closes the loop from product intent to verified implementation. Every acceptance criterion from the product agent must have a corresponding passing test.

### Reading Acceptance Criteria

The tester reads the task's acceptance criteria (GIVEN/WHEN/THEN format from `.planning/BACKLOG.md`). Each criterion becomes **at least one** test case. The criterion wording drives the test name.

### Test-to-Criteria Mapping

Every test file should include a comment block mapping tests to acceptance criteria:

```typescript
// Acceptance Criteria Coverage:
// AC-1: "GIVEN a logged-in user WHEN they click 'New Task' THEN a modal appears"
//   → test: "shows new task modal on button click"
// AC-2: "GIVEN an empty task name WHEN user submits THEN validation error shows"
//   → test: "displays validation error for empty task name"
```

This makes traceability explicit — reviewers and future agents can verify coverage at a glance.

### Criteria Coverage Report

After running tests, produce a criteria coverage report:

```
═══ ACCEPTANCE CRITERIA VERIFICATION ═══
Task: [task name]
Criteria: 5 defined, 5 covered, 0 uncovered

✅ AC-1: Modal appears on click       → shows-modal.test.ts:12
✅ AC-2: Validation error              → validation.test.ts:24
✅ AC-3: Task saves to DB              → api.test.ts:45
✅ AC-4: Success toast                 → shows-modal.test.ts:38
✅ AC-5: List refreshes                → task-list.test.ts:67
═════════════════════════════════════════
```

### Blocking Rule

A task **cannot** transition to VERIFIED if any acceptance criterion lacks a corresponding passing test. This is enforced by the tester agent — not a hook — because mapping criteria to tests requires judgment. See `scripts/check-task-gates.sh` for how state transitions are gated.

### Edge Case & Error Testing

For every happy-path criterion, verify at least one error/edge case:

- **Invalid input** — What happens with empty strings, null, wrong types?
- **Network failure** — What happens when an API call fails or times out?
- **Empty/null data** — What renders when the list is empty or data is missing?
- **Boundary values** — What happens at limits (max length, zero, negative)?

Name error tests with the criterion they guard: `"AC-1: shows error when modal fails to load"`.

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
