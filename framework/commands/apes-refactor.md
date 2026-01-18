---
description: Refactor existing code while preserving behavior
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Refactor: $ARGUMENTS

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

### Step 4: Create Refactor Plan

Create `.planning/PLAN.md`:

```xml
<refactor>
  <n>$ARGUMENTS</n>
  <type>refactor</type>

  <scope>
    <files_affected>[count]</files_affected>
    <pattern_from>[current pattern]</pattern_from>
    <pattern_to>[target pattern]</pattern_to>
    <behavior_preserved>true</behavior_preserved>
  </scope>

  <strategy>
    <approach>[incremental/batch/strangler-fig]</approach>
    <safety_net>[existing tests/new tests/both]</safety_net>
    <rollback_plan>[how to revert if needed]</rollback_plan>
  </strategy>

  <tasks>
    <task id="1" type="safety">
      <n>Add safety net tests</n>
      <action>
        Add tests for any uncovered behavior that will change.
        These tests should pass BEFORE and AFTER refactor.
      </action>
      <verify>npm test (all pass)</verify>
    </task>

    <task id="2" type="refactor">
      <n>Refactor batch 1: [scope]</n>
      <files>[first batch of files]</files>
      <action>[Specific refactoring steps]</action>
      <verify>
        npm run typecheck
        npm test
      </verify>
    </task>

    <task id="3" type="refactor">
      <n>Refactor batch 2: [scope]</n>
      <files>[second batch of files]</files>
      <action>[Specific refactoring steps]</action>
      <verify>
        npm run typecheck
        npm test
      </verify>
    </task>

    <task id="4" type="cleanup">
      <n>Clean up dead code</n>
      <action>
        Remove old patterns, unused imports, deprecated code.
      </action>
      <verify>
        npm run lint
        npm run build
      </verify>
    </task>
  </tasks>

  <verification>
    <commands>
      npm run build
      npm run typecheck
      npm run lint
      npm test
    </commands>
    <behavior_check>
      [Steps to verify behavior unchanged]
    </behavior_check>
  </verification>
</refactor>
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
