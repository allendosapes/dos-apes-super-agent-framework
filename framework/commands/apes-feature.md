---
description: Add a new feature to existing codebase
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Add Feature: $ARGUMENTS

## Pre-Flight Checks

### 1. Auto-Load Context Based on Keywords

Parse "$ARGUMENTS" and load relevant codebase documents:

| Keywords | Load Documents |
|----------|---------------|
| api, endpoint, route | ARCHITECTURE.md, STACK.md |
| ui, component, page | CONVENTIONS.md, STRUCTURE.md |
| auth, login, user | INTEGRATIONS.md, CONCERNS.md |
| test, testing | TESTING.md |
| database, model, schema | ARCHITECTURE.md, INTEGRATIONS.md |
| payment, stripe, billing | INTEGRATIONS.md |
| notification, email, push | INTEGRATIONS.md |

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

### Step 3: Create Feature Plan

Create `.planning/PLAN.md`:

```xml
<feature>
  <name>$ARGUMENTS</name>
  <type>feature</type>
  
  <analysis>
    <related_files>[files that will be affected]</related_files>
    <patterns_to_follow>[existing patterns to match]</patterns_to_follow>
    <new_files>[files to create]</new_files>
  </analysis>
  
  <tasks>
    <task id="1" type="backend">
      <n>[Task name]</n>
      <files>[Files]</files>
      <action>[Implementation details]</action>
      <verify>[How to verify]</verify>
    </task>
    
    <task id="2" type="frontend">
      <n>[Task name]</n>
      <files>[Files]</files>
      <action>[Implementation details]</action>
      <ui-integration>
        <component>[Component name]</component>
        <location>[Where to integrate]</location>
        <route>[Route if new page]</route>
      </ui-integration>
      <verify>[How to verify]</verify>
    </task>
    
    <task id="3" type="test">
      <n>Add tests</n>
      <files>[Test files]</files>
      <action>[Test implementation]</action>
      <verify>npm test</verify>
    </task>
  </tasks>
  
  <verification>
    <commands>
      npm run build
      npm run typecheck
      npm run lint
      npm test
    </commands>
    <browser>
      1. Navigate to [URL]
      2. [Interaction]
      3. [Expected result]
    </browser>
  </verification>
</feature>
```

### Step 4: Update STATE.md

```markdown
## Current Work
- Type: Feature
- Description: $ARGUMENTS
- Status: planned
- Branch: feature/[name]
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
