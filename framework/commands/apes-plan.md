---
description: Create detailed task plan for a phase
allowed-tools: Read, Grep, Glob, Bash(find:*), Bash(cat:*), Bash(ls:*)
---

# Plan Phase $1

Create a detailed, executable task plan for Phase $1.

## Pre-Planning

### Step 1: Load Context

```bash
# Required
cat .planning/PROJECT.md
cat .planning/ROADMAP.md
cat .planning/STATE.md
cat CLAUDE.md

# If brownfield
cat .planning/codebase/STACK.md 2>/dev/null
cat .planning/codebase/ARCHITECTURE.md 2>/dev/null
cat .planning/codebase/CONVENTIONS.md 2>/dev/null
```

### Step 2: Find Phase in Roadmap

Extract Phase $1 details from ROADMAP.md:

- Goal
- Deliverable
- Tasks (high-level)
- Dependencies

### Step 3: Analyze Existing Code (if brownfield)

```bash
# Find related files
grep -rn "[relevant patterns]" src/ --include="*.ts" --include="*.tsx" | head -20

# Understand current structure
find src/ -type f -name "*.tsx" | head -30
```

## Planning Phase

### Step 4: Break Down Tasks

Decompose phase into 2-4 ATOMIC tasks.

Each task must be:

- **Completable** in one focused session
- **Independently verifiable** (can test in isolation)
- **Clear on files** (specific files to create/modify)
- **Self-contained** (includes all related changes)

### Step 5: Determine Task Types

| Type          | Description                       | Agent              |
| ------------- | --------------------------------- | ------------------ |
| `setup`       | Environment, config, dependencies | Orchestrator       |
| `backend`     | API, services, database           | Backend Developer  |
| `frontend`    | Components, pages, hooks          | Frontend Developer |
| `test`        | Unit, integration, E2E tests      | QA Engineer        |
| `integration` | Wiring pieces together            | Frontend Developer |

### Step 6: Create PLAN.md

Create `.planning/PLAN.md`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- Dos Apes Super Agent Framework - Phase Plan -->
<!-- Generated: [timestamp] -->
<!-- Phase: $1 -->

<plan>
  <metadata>
    <phase>$1</phase>
    <name>[Phase Name from Roadmap]</name>
    <goal>[Phase Goal]</goal>
    <deliverable>[Concrete Deliverable]</deliverable>
    <created>[timestamp]</created>
  </metadata>

  <context>
    <dependencies>[What must exist first]</dependencies>
    <affected_areas>[Parts of codebase affected]</affected_areas>
    <patterns_to_follow>[Existing patterns to match]</patterns_to_follow>
  </context>

  <tasks>
    <task id="1" type="[type]" complete="false">
      <name>[Short descriptive name]</name>
      <description>[What this task accomplishes]</description>

      <files>
        <create>[files to create]</create>
        <modify>[files to modify]</modify>
      </files>

      <action>
        [Detailed implementation instructions]
        [Include specific patterns to use]
        [Reference conventions from CLAUDE.md]
        [Be explicit about edge cases]
      </action>

      <verification>
        <command>npm run typecheck</command>
        <command>npm test -- [specific test]</command>
        <manual>[Manual verification steps if needed]</manual>
      </verification>

      <done>[Clear definition of done for this task]</done>
    </task>

    <task id="2" type="frontend" complete="false">
      <name>[Task name]</name>
      <description>[Description]</description>

      <files>
        <create>src/components/[Component].tsx</create>
      </files>

      <action>[Implementation details]</action>

      <!-- UI Integration Section - CRITICAL -->
      <ui_integration>
        <component>[ComponentName]</component>
        <location>[Where in UI to add]</location>
        <route>[Route path if new page]</route>
        <navigation>[Navigation link if needed]</navigation>
      </ui_integration>

      <verification>
        <command>npm run build</command>
        <command>npm test</command>
        <browser>
          1. Navigate to [URL]
          2. [Expected interaction]
          3. [Expected result]
        </browser>
      </verification>

      <done>[Definition of done including UI verification]</done>
    </task>

    <task id="3" type="test" complete="false">
      <name>Add tests for Phase $1</name>
      <description>Comprehensive tests for all new functionality</description>

      <files>
        <create>[test files]</create>
      </files>

      <action>
        Write tests covering:
        - [Scenario 1]
        - [Scenario 2]
        - [Edge case 1]
      </action>

      <verification>
        <command>npm test</command>
        <command>npm run test:coverage</command>
      </verification>

      <done>All tests passing, coverage > 80%</done>
    </task>
  </tasks>

  <phase_verification>
    <commands>
      <command>npm run build</command>
      <command>npm run typecheck</command>
      <command>npm run lint</command>
      <command>npm test</command>
    </commands>
    <browser>
      [Overall browser verification for the phase deliverable]
    </browser>
  </phase_verification>

  <completion_criteria>
    <criterion>All tasks marked complete</criterion>
    <criterion>All verification commands pass</criterion>
    <criterion>UI integration verified in browser</criterion>
    <criterion>No TODO comments left in new code</criterion>
  </completion_criteria>
</plan>
```

### Step 7: Update STATE.md

```markdown
## Current Position

- Phase: $1
- Task: 1 (pending)
- Status: planned

## Plan Created

- Timestamp: [now]
- Tasks: [count]
- Estimated complexity: [based on task count and types]
```

## Output

```
📋 Phase $1 Plan Created

Phase: [Name]
Goal: [Goal]
Tasks: [N]

Task Overview:
1. [Task 1 name] ([type])
2. [Task 2 name] ([type])
3. [Task 3 name] ([type])

Saved to: .planning/PLAN.md

Next: Run /apes-execute $1 to start implementation
      Add --ralph for autonomous execution
```

Output <promise>PHASE\_$1_PLANNED</promise> when complete.
