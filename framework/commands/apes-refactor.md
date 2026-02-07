---
description: Refactor existing code while preserving behavior
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Refactor: $ARGUMENTS

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| builder | `skills/backend.md` + `skills/frontend.md` | Refactoring implementation |
| reviewer | `skills/review.md` | Verify behavior preserved, review changes |

## Pre-Flight

1. **Load Context**
   - Read `.planning/codebase/CONVENTIONS.md`
   - Read `.planning/codebase/CONCERNS.md`
   - Read `CLAUDE.md`

2. **Verify Clean State**

   ```bash
   git status --short
   ```

3. **Verify Test Coverage**
   ```bash
   npm run test:coverage
   ```

## Analysis Phase

### Step 1: Understand Scope

Parse "$ARGUMENTS" to identify:

- What needs to be refactored?
- What's the target state?
- What behavior must be preserved?

### Step 2: Find Affected Code

```bash
# Find files matching refactor criteria
grep -rn "[pattern to refactor]" src/ --include="*.ts" --include="*.tsx" | head -50

# Count scope
find src/ -name "*.tsx" -exec grep -l "[pattern]" {} \; | wc -l
```

### Step 3: Assess Risk

| Factor               | Status            |
| -------------------- | ----------------- |
| Test coverage        | [high/medium/low] |
| Complexity           | [high/medium/low] |
| Dependencies         | [many/few/none]   |
| Breaking change risk | [high/medium/low] |

### Step 4: Create Refactor Tasks

Use the Tasks API to plan the refactor:

```
TaskCreate: "Add safety net tests"
  description: "Add characterization tests for any uncovered behavior
    that will change. These tests must pass BEFORE and AFTER refactor.
    Focus on: [specific areas with low coverage]"

TaskCreate: "Refactor batch 1: [scope]"
  description: "Files: [first batch]. Pattern change: [from] → [to].
    Verify: typecheck + tests pass after changes."
  blockedBy: ["Add safety net tests"]

TaskCreate: "Refactor batch 2: [scope]"
  description: "Files: [second batch]. Same pattern change.
    Verify: typecheck + tests pass after changes."
  blockedBy: ["Add safety net tests"]

TaskCreate: "Clean up dead code"
  description: "Remove old patterns, unused imports, deprecated code
    left over from the refactor."
  blockedBy: ["Refactor batch 1", "Refactor batch 2"]

TaskCreate: "[GATE] Full verification"
  description: "Run build + typecheck + lint + tests.
    Verify behavior is unchanged. Review changes for correctness."
  blockedBy: ["Clean up dead code"]
```

## Execution Phase

### Golden Rule: Tests Must Pass After EVERY Change

```
change → test → pass → commit → next change
```

Never batch multiple risky changes.

### Step 1: Create Branch

```bash
git checkout -b refactor/[descriptive-name]
```

### Step 2: Add Safety Net (if needed)

If test coverage is low for affected code:

1. Add characterization tests
2. These tests document CURRENT behavior
3. They must pass before AND after refactor

### Step 3: Refactor Incrementally

For each batch:

1. **Make Changes**
   Apply refactoring to one batch of files.

2. **Run Type Check**

   ```bash
   npm run typecheck
   ```

   Fix any type errors immediately.

3. **Run Tests**

   ```bash
   npm test
   ```

   All tests must pass. If not, fix or revert.

4. **Commit**

   ```bash
   git add .
   git commit -m "refactor: [what changed in this batch]"
   ```

5. **Continue to Next Batch**

### Step 4: Clean Up

After all refactoring complete:

1. **Remove Dead Code**
   - Unused imports
   - Deprecated functions
   - Old patterns no longer used

2. **Run Full Suite**

   ```bash
   npm run build
   npm run typecheck
   npm run lint
   npm test
   ```

3. **Final Commit**
   ```bash
   git add .
   git commit -m "refactor: clean up after [refactor description]"
   ```

### Step 5: Verify Behavior Unchanged

Manually verify key user flows still work as expected.

## Commit History

Refactor should result in clean, atomic commits:

```
abc1234 refactor: add safety net tests for X
def5678 refactor: convert X components to new pattern
ghi9012 refactor: convert Y components to new pattern
jkl3456 refactor: clean up deprecated code
```

Each commit:

- Passes all tests
- Is independently revertable
- Has clear description

## Completion Criteria

Refactor is complete when:

- [ ] All targeted code refactored
- [ ] All tests passing (same as before)
- [ ] No type errors
- [ ] No lint errors
- [ ] Dead code removed
- [ ] Behavior verified unchanged
- [ ] Clean commit history

Output <promise>REFACTOR_COMPLETE</promise> when done.
