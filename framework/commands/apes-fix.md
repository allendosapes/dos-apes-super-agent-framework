---
description: Diagnose and fix a bug in the codebase
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Fix Bug: $ARGUMENTS

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| debugger | `skills/backend.md` + `skills/frontend.md` | Root cause analysis, fix implementation |
| tester | `skills/testing.md` | Reproduction test, regression check |

## Pre-Flight

### 1. Auto-Load Context Based on Bug Area

Parse "$ARGUMENTS" and load relevant codebase documents:

**Always load:**

- `CLAUDE.md` (project rules)
- `.planning/codebase/CONCERNS.md` (known issues - may already document this bug)
- `.planning/codebase/TESTING.md` (test patterns for reproduction test)

**Conditionally load:**

```bash
KEYWORDS=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]')

# API/Backend bugs
if echo "$KEYWORDS" | grep -qE "api|endpoint|500|request|response"; then
  cat .planning/codebase/ARCHITECTURE.md
  cat .planning/codebase/STACK.md
fi

# UI bugs
if echo "$KEYWORDS" | grep -qE "ui|component|display|render|style"; then
  cat .planning/codebase/CONVENTIONS.md
  cat .planning/codebase/STRUCTURE.md
fi

# Auth/Integration bugs
if echo "$KEYWORDS" | grep -qE "auth|login|permission|token|401|403"; then
  cat .planning/codebase/INTEGRATIONS.md
fi
```

### 2. Check Recent Git History

```bash
# Recent changes that might have introduced the bug
git log --oneline -20

# Recent changes to suspected areas
git log --oneline -10 -- [suspected files]
```

### 3. Clean State

```bash
git status --short
git stash  # if needed
```

## Diagnosis Phase

### Step 1: Understand the Bug

Parse "$ARGUMENTS" to identify:

- What's the expected behavior?
- What's the actual behavior?
- When does it occur? (conditions, inputs)
- Any error messages?

### Step 2: Search for Related Code

```bash
# Search for keywords from bug description
grep -rn "[keywords]" src/ --include="*.ts" --include="*.tsx" | head -30

# Find error messages if mentioned
grep -rn "[error text]" src/ | head -10

# Check recent changes to relevant files
git log --oneline -10 -- [suspected files]
```

### Step 3: Identify Root Cause

Document findings:

- Affected files
- Root cause hypothesis
- Why it's happening
- Confidence level (high/medium/low)

### Step 4: Create Fix Tasks

Use the Tasks API to plan the fix:

```
TaskCreate: "Write reproduction test"
  description: "Create a failing test that reproduces the bug.
    Expected: [expected behavior]
    Actual: [actual behavior]
    Test MUST fail before the fix is applied."

TaskCreate: "Implement fix"
  description: "Root cause: [explanation]
    Fix: [minimal change needed]
    Files: [files to modify]"
  blockedBy: ["Write reproduction test"]

TaskCreate: "[GATE] Verify fix and check regressions"
  description: "1. Reproduction test now passes
    2. Full test suite passes (no regressions)
    3. Build + typecheck + lint pass"
  blockedBy: ["Implement fix"]
```

## Execution Phase

### Step 1: Create Branch

```bash
git checkout -b fix/[descriptive-name]
```

### Step 2: Write Reproduction Test FIRST

This is critical. The test should:

- Reproduce the exact bug condition
- FAIL before the fix
- Be specific enough to catch regressions

```typescript
describe("Bug: [description]", () => {
  it("should [expected behavior]", () => {
    // Arrange: Set up the bug condition
    // Act: Trigger the bug
    // Assert: Verify correct behavior
  });
});
```

### Step 3: Verify Test Fails

```bash
npm test -- [test file]
# Should fail with the bug
```

### Step 4: Implement Fix

Make the minimal change needed to fix the bug.
Don't refactor unrelated code in the same commit.

### Step 5: Verify Test Passes

```bash
npm test -- [test file]
# Should now pass
```

### Step 6: Run Full Suite

```bash
npm test
# All tests should pass - no regressions
```

### Step 7: Commit

```bash
git add .
git commit -m "fix: [description]

- Root cause: [explanation]
- Fix: [what was changed]
- Test: [test added]

Fixes #[issue number if applicable]"
```

## Completion Criteria

Bug fix is complete when:

- [ ] Reproduction test written
- [ ] Test failed before fix
- [ ] Fix implemented
- [ ] Test passes after fix
- [ ] No regressions (full suite passes)
- [ ] Committed with proper message

Output <promise>BUG_FIXED</promise> when done.
