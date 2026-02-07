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
  echo "Codebase not mapped. Run /apes-map first."
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

6. **Ready for Review**
   ```bash
   git push origin feature/[name]
   ```

## Completion Criteria

Feature is complete when:

- [ ] All tasks implemented
- [ ] All tests passing
- [ ] UI integration verified (if applicable)
- [ ] Browser tested
- [ ] Committed and pushed

Output <promise>FEATURE_COMPLETE</promise> when done.
