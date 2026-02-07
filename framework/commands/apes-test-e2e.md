---
description: Generate and run E2E tests from user stories
allowed-tools: Read, Write, Bash, Task
---

# E2E Test Generation

Read user stories from .planning/PROJECT.md or docs/requirements/.
For each user story with acceptance criteria, generate a Playwright test.

## Steps

1. Parse acceptance criteria into test steps
2. Generate test file in tests/e2e/
3. Run via: npx playwright test
4. Report results with screenshots on failure

## Usage

```bash
/apes-test-e2e              # Generate and run all E2E tests
/apes-test-e2e --generate   # Generate tests only (don't run)
/apes-test-e2e --run        # Run existing tests only
```

## Test Generation

For each user story, create a Playwright test file:

```typescript
// tests/e2e/[story-name].spec.ts
import { test, expect } from "@playwright/test";

test("[acceptance criteria description]", async ({ page }) => {
  // Steps derived from acceptance criteria
  await page.goto("/route");
  await page.fill('[data-testid="field"]', "value");
  await page.click('[data-testid="submit"]');
  await expect(page).toHaveURL("/expected-route");
  await expect(page.getByText("Expected text")).toBeVisible();
});
```

## Teammate Delegation

Spawn a tester teammate if generating tests for multiple stories:

```
tester: Read .claude/skills/browser-verification.md and
  .claude/skills/testing.md. Generate Playwright E2E tests for
  each user story. Run them and report results.
```
