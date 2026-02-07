---
description: Add a new feature to existing codebase
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Add Feature: $ARGUMENTS

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| builder | `skills/backend.md` + `skills/frontend.md` | Implementation |
| tester | `skills/testing.md` | Verification, test coverage |

## HUMAN INTERRUPTION POLICY

Proceed autonomously for all build, test, lint, git branch/commit/merge/push, and file operations. Only pause for human input on `[APPROVAL]` tasks, force-push, deployment, database migrations, environment/secret changes, or ambiguous merge conflicts. Rule: reversible and local = proceed; irreversible or shared = ask.

## Pre-Flight Checks

### 1. Auto-Load Context Based on Keywords

Parse "$ARGUMENTS" and load relevant codebase documents:

| Keywords                  | Load Documents                   |
| ------------------------- | -------------------------------- |
| api, endpoint, route      | ARCHITECTURE.md, STACK.md        |
| ui, component, page       | CONVENTIONS.md, STRUCTURE.md     |
| auth, login, user         | INTEGRATIONS.md, CONCERNS.md     |
| test, testing             | TESTING.md                       |
| database, model, schema   | ARCHITECTURE.md, INTEGRATIONS.md |
| payment, stripe, billing  | INTEGRATIONS.md                  |
| notification, email, push | INTEGRATIONS.md                  |

**Always load:**

- `CLAUDE.md` (project rules)
- `.planning/codebase/CONVENTIONS.md` (patterns to follow)
- `.planning/codebase/ARCHITECTURE.md` (system design)

**Conditionally load based on feature type:**

```bash
# Detect keywords in feature description
KEYWORDS=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]')

# Load relevant context
if echo "$KEYWORDS" | grep -qE "api|endpoint|route"; then
  cat .planning/codebase/STACK.md
fi

if echo "$KEYWORDS" | grep -qE "auth|login|user|payment"; then
  cat .planning/codebase/INTEGRATIONS.md
fi

if echo "$KEYWORDS" | grep -qE "test"; then
  cat .planning/codebase/TESTING.md
fi
```

### 2. Verify Codebase Is Mapped

```bash
# Check if codebase documents exist
if [ ! -d ".planning/codebase" ]; then
  echo "⚠️ Codebase not mapped. Run /apes-map first to analyze your codebase."
  echo "  Usage: /apes-map"
  echo "  This creates .planning/codebase/ documents that /apes-feature needs."
  exit 1
fi
```

### 3. Verify Clean State

```bash
git status --short
# Should be clean or stashed
```

## Planning Phase

### Step 1: Analyze Feature Request

Break down "$ARGUMENTS" into:

- Core functionality required
- UI changes needed
- API changes needed
- Database changes needed
- Test requirements

### Step 2: Find Related Code

```bash
# Search for related patterns
grep -rn "[relevant keywords]" src/ --include="*.ts" --include="*.tsx" | head -20

# Find similar features for pattern reference
find src/ -name "*[similar]*" -type f | head -10
```

### Step 3: Create Feature Tasks

Use the Tasks API to plan implementation:

```
TaskCreate: "Analyze existing patterns for [feature]"
  description: "Find related code, identify patterns to follow,
    determine files to create/modify."

TaskCreate: "Implement [backend component]"
  description: "Create/modify backend files: [list files].
    Follow patterns from [related existing code]."
  blockedBy: ["Analyze existing patterns"]

TaskCreate: "Implement [frontend component]"
  description: "Create/modify UI components: [list files].
    Integration point: [where in app]."
  blockedBy: ["Analyze existing patterns"]

TaskCreate: "Add tests for [feature]"
  description: "Unit tests for new functions. Integration test
    for the full feature flow."
  blockedBy: ["Implement backend", "Implement frontend"]

TaskCreate: "[GATE] Feature verification"
  description: "Run build, typecheck, lint, tests. Verify UI
    integration in browser if applicable."
  blockedBy: ["Add tests"]
```

## Execution Phase

### If --ralph flag:

Execute all tasks autonomously with verification loop.

### If manual:

Present plan and wait for approval before executing.

### Task Retry Logic

When a task fails verification, retry up to 3 times before escalating:

```
attempt = 1
WHILE task is not passing AND attempt <= 3:
  1. Read the error output and classify:
     TYPE_ERROR | TEST_FAILURE | BUILD_FAILURE | LINT_ERROR | RUNTIME_ERROR | ENV_ERROR
  2. Fix based on classification (see error, fix cause, re-verify)
  3. On each subsequent attempt, try a different approach:
     - Attempt 1: Direct fix based on error output
     - Attempt 2: Re-read related code, try alternative implementation
     - Attempt 3: Revert task changes, rewrite from scratch
  attempt += 1
END WHILE

IF still failing after 3 attempts:
  Log to .planning/ISSUES.md with: error type, all 3 approaches tried, suggested fix
  Pause and ask human for guidance
  NEVER skip the task or mark it complete
```

## Git Workflow

1. **Create Branch**

   ```bash
   git checkout -b feature/[descriptive-name]
   ```

2. **Implement Tasks**
   Execute each task in order.

3. **Verify Each Task**
   Run verification suite after each task.

4. **Commit Incrementally**

   ```bash
   git add .
   git commit -m "feat: [task description]"
   ```

5. **Final Verification**
   Full suite + browser verification.

6. **Push Feature Branch**
   ```bash
   git push origin feature/[name]
   ```

7. **Merge to Main**

   ```bash
   git checkout main
   git pull origin main 2>/dev/null || true
   git merge --squash feature/[name]
   git commit -m "feat: [feature description]"
   ```

   If merge conflicts occur:
   ```bash
   # Identify conflicts
   git status
   # Resolve conflicts, then:
   git add [resolved-files]
   git commit -m "feat: [feature description] (resolved conflicts)"
   ```

   If conflict resolution is ambiguous, pause and ask the human for guidance.

8. **Push and Clean Up**

   ```bash
   git push origin main
   git branch -d feature/[name]
   git push origin --delete feature/[name]
   ```

## Completion Criteria

Feature is complete when:

- [ ] All tasks implemented
- [ ] All tests passing
- [ ] UI integration verified (if applicable)
- [ ] Browser tested
- [ ] Merged to main and pushed
- [ ] Feature branch cleaned up

Output <promise>FEATURE_COMPLETE</promise> when done.
