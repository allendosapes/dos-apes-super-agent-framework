---
description: Diagnose and fix a bug in the codebase
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Fix Bug: $ARGUMENTS

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

### Step 4: Create Fix Plan

Create `.planning/PLAN.md`:

```xml
<bugfix>
  <n>$ARGUMENTS</n>
  <type>fix</type>
  
  <diagnosis>
    <expected>[Expected behavior]</expected>
    <actual>[Actual behavior]</actual>
    <root_cause>[Why it's happening]</root_cause>
    <affected_files>[Files involved]</affected_files>
    <confidence>[high/medium/low]</confidence>
  </diagnosis>
  
  <tasks>
    <task id="1" type="test">
      <n>Create reproduction test</n>
      <files>[test file]</files>
      <action>
        Write a failing test that reproduces the bug.
        This test should FAIL before the fix and PASS after.
      </action>
      <verify>npm test -- [test file] (should fail)</verify>
    </task>
    
    <task id="2" type="fix">
      <n>Implement fix</n>
      <files>[files to modify]</files>
      <action>[Fix implementation details]</action>
      <verify>npm test -- [test file] (should pass)</verify>
    </task>
    
    <task id="3" type="regression">
      <n>Check for regressions</n>
      <files>-</files>
      <action>Run full test suite</action>
      <verify>npm test (all should pass)</verify>
    </task>
  </tasks>
  
  <verification>
    <commands>
      npm run build
      npm run typecheck
      npm test
    </commands>
    <manual>
      1. [Steps to manually verify fix]
    </manual>
  </verification>
</bugfix>
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
describe('Bug: [description]', () => {
  it('should [expected behavior]', () => {
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
