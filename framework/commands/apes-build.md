---
description: Full autonomous build from PRD to shipped product
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Build Product

**The "hands off" command. Feed it a PRD, walk away, come back to a shipped product.**

```bash
/apes-build --prd requirements.md --ralph --max-iterations 500
```

## Arguments

- `--prd [file]` - Path to PRD or requirements document
- `--idea "[text]"` - Or just describe what you want to build
- `--ralph` - Enable autonomous loop (default: true for build)
- `--max-iterations N` - Max iterations (default: 500)

---

## THE BUILD LOOP

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   PRD/Idea                                                  │
│      │                                                      │
│      ▼                                                      │
│   ┌─────────────┐                                          │
│   │   INGEST    │  Parse requirements                      │
│   │             │  Create PROJECT.md, ROADMAP.md           │
│   └──────┬──────┘                                          │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │    PLAN     │  Break into phases                       │
│   │             │  Create PLAN.md for Phase 1              │
│   └──────┬──────┘                                          │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐     ┌─────────────┐                     │
│   │   EXECUTE   │────▶│   VERIFY    │                     │
│   │             │◀────│             │                     │
│   │  Agent Loop │     │ QA Engineer │                     │
│   └──────┬──────┘     └─────────────┘                     │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │    MERGE    │  Squash merge to main                    │
│   └──────┬──────┘                                          │
│          │                                                  │
│          ▼                                                  │
│      More phases? ───Yes──▶ [Back to PLAN]                 │
│          │                                                  │
│          No                                                 │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │   SHIPPED   │  🦍🦍                                    │
│   └─────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: INGEST

### [ORCHESTRATOR] Parse PRD

```bash
# Read PRD
cat [prd-file]
```

### [ORCHESTRATOR] Create Project Structure

```bash
# Create planning directory
mkdir -p .planning/codebase

# Initialize git if needed
git init 2>/dev/null || true
```

### [ORCHESTRATOR] Generate PROJECT.md

Extract from PRD:

```markdown
# [Project Name]

## Vision

[One sentence describing what this is]

## North Star Metric

[Primary success metric]

## Target Users

- **Primary:** [Main persona]
- **Secondary:** [Other users]

## Core Requirements

### Must Have (P0)

- [ ] [Requirement 1]
- [ ] [Requirement 2]

### Should Have (P1)

- [ ] [Requirement 1]

### Nice to Have (P2)

- [ ] [Requirement 1]

## Technical Stack

[Determined from PRD or best practices]

## Constraints

[From PRD]

## Success Criteria

[Measurable outcomes]
```

### [ORCHESTRATOR] Generate ROADMAP.md

Break project into phases:

```markdown
# Roadmap

## Phase 1: Foundation

**Goal:** [Setup, core infrastructure]
**Tasks:** 3-5
**Deliverable:** [Working skeleton]

## Phase 2: Core Features

**Goal:** [Main functionality]
**Tasks:** 3-5
**Deliverable:** [MVP]

## Phase 3: Polish & Launch

**Goal:** [Production ready]
**Tasks:** 3-5
**Deliverable:** [Shipped product]
```

### [ORCHESTRATOR] Initialize STATE.md

```markdown
# State

## Execution Mode

ralph_mode: true
max_iterations: 500
current_iteration: 0

## Current Position

phase: 1
phase_name: "Foundation"
task: 0
status: planning

## Git State

main_branch: main
current_branch: main

## Progress

phases_complete: 0/3
all_tasks_complete: false

## Session

started: [timestamp]
```

### [ORCHESTRATOR] Create CLAUDE.md

```markdown
# [Project Name]

## Stack

[From PROJECT.md]

## Commands

npm run dev # Development
npm test # Tests
npm run build # Production build
npm run lint # Linting
npm run typecheck # Type checking

## Conventions

- TypeScript strict mode
- Functional components
- Co-located tests
- Conventional commits
```

---

## PHASE 2: PLAN FIRST PHASE

### [TECHNICAL ARCHITECT] Design Phase

Load architect agent:

```bash
cat .claude/agents/technical-architect.md
```

For Phase 1 (Foundation), typically:

- Project scaffolding
- Core data models
- Basic API structure
- Initial UI shell

### [ORCHESTRATOR] Generate PLAN.md

```xml
<plan>
  <metadata>
    <phase>1</phase>
    <name>Foundation</name>
    <goal>Establish project structure and core infrastructure</goal>
  </metadata>

  <tasks>
    <task id="1" type="setup" complete="false">
      <name>Project Scaffolding</name>
      <action>
        Initialize project with Vite + React + TypeScript
        Configure ESLint, Prettier, TypeScript strict
        Set up folder structure
      </action>
      <verify>npm run build passes</verify>
    </task>

    <task id="2" type="backend" complete="false">
      <name>Core Data Models</name>
      <action>...</action>
      <verify>...</verify>
    </task>

    <task id="3" type="frontend" complete="false">
      <name>UI Shell</name>
      <action>...</action>
      <ui_integration>
        <component>Layout</component>
        <location>App.tsx</location>
        <route>/</route>
      </ui_integration>
      <verify>...</verify>
    </task>
  </tasks>
</plan>
```

---

## PHASE 3: EXECUTE

### [ORCHESTRATOR] Start Execution Loop

```
/apes-execute 1 --ralph --max-iterations [remaining]
```

This triggers the full agent orchestration:

1. Git setup (branch)
2. Task loop with agent handoffs
3. QA verification per task
4. Commit per task
5. Phase merge when complete

See `apes-execute.md` for full details.

---

## PHASE 4: ITERATE

After Phase 1 completes:

### [ORCHESTRATOR] Check Progress

```bash
# Read updated state
cat .planning/STATE.md

# Check phases remaining
grep "phases_complete:" .planning/STATE.md
```

### [ORCHESTRATOR] Plan Next Phase

```
IF phases_complete < total_phases:

  # Generate PLAN.md for next phase
  [TECHNICAL ARCHITECT] designs phase
  [ORCHESTRATOR] creates PLAN.md

  # Update state
  phase: [N+1]
  status: executing

  # Continue execution
  /apes-execute [N+1] --ralph

ELSE:
  # All done!
  GOTO PHASE 5
```

---

## PHASE 5: SHIP

### [QA ENGINEER] Final Verification

```bash
# Full test suite
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e 2>/dev/null || true

# Security check
npm audit
```

### [DEVOPS ENGINEER] Deployment (if configured)

```bash
# Check for deploy script
if [ -f "deploy.sh" ] || grep -q '"deploy"' package.json; then
  npm run deploy
fi
```

### [ORCHESTRATOR] Final Report

```
═══════════════════════════════════════════════════════════════
🦍🦍 PRODUCT COMPLETE 🦍🦍
═══════════════════════════════════════════════════════════════

Project: [Name]
Phases Completed: [N]/[N]
Total Tasks: [X]
Total Commits: [Y]
Total Iterations: [Z]

Files Created:
[list key files]

Features Delivered:
[list from ROADMAP.md]

Verification Status:
✅ Build
✅ Types
✅ Lint
✅ Tests
✅ Security Audit

Git Status:
Branch: main
Clean: Yes
Pushed: Yes

═══════════════════════════════════════════════════════════════
Dos Apes: We ain't monkeying around with code!
═══════════════════════════════════════════════════════════════
```

### Output

```
<promise>PRODUCT_COMPLETE</promise>
```

---

## FAILURE MODES

### Iteration Limit Reached

```
Max iterations (500) reached.

Progress saved:
- Phase: [N] of [Total]
- Task: [M] of [Total in phase]
- State: .planning/STATE.md

To continue:
/apes-resume
```

### Blocked by Error

```
<promise>BLOCKED</promise>

Cannot continue without human intervention.

Issue: [description]
See: .planning/ISSUES.md

To retry after fixing:
/apes-resume
```

### Recovery

```bash
# Continue from where we left off
/apes-resume

# Or retry the failed task
/apes-retry

# Or skip and continue
/apes-skip --confirm
```

---

## EXAMPLE RUN

```bash
$ claude

> /apes-build --prd ./docs/courseware-prd.md --ralph

[ORCHESTRATOR] Loading PRD...
[ORCHESTRATOR] Creating PROJECT.md...
[ORCHESTRATOR] Creating ROADMAP.md (5 phases)...
[ORCHESTRATOR] Creating STATE.md...
[ORCHESTRATOR] Creating CLAUDE.md...

═══ PHASE 1: Foundation ═══

[ORCHESTRATOR] Creating branch: feat/phase-1-foundation
[ORCHESTRATOR] Planning phase...
[TECHNICAL ARCHITECT] Designing foundation...
[ORCHESTRATOR] PLAN.md created (4 tasks)

[ORCHESTRATOR → BACKEND DEVELOPER]
Task 1: Project scaffolding
[BACKEND DEVELOPER] Initializing Vite + React + TypeScript...
[BACKEND DEVELOPER] Configuring tools...
[BACKEND DEVELOPER → QA ENGINEER] Verification requested
[QA ENGINEER] Build: ✅ Types: ✅ Lint: ✅
[QA ENGINEER → ORCHESTRATOR] Task verified
[ORCHESTRATOR] Committed: chore(setup): initialize project

[ORCHESTRATOR → BACKEND DEVELOPER]
Task 2: Core data models...
...

═══ PHASE 1 COMPLETE ═══
[ORCHESTRATOR] Merging to main...
[ORCHESTRATOR] Merged: feat/phase-1-foundation → main

<promise>PHASE_1_COMPLETE</promise>

═══ PHASE 2: Core Features ═══
...

[After all phases]

═══════════════════════════════════════════════════════════════
🦍🦍 PRODUCT COMPLETE 🦍🦍
═══════════════════════════════════════════════════════════════

Dos Apes: We ain't monkeying around with code!

<promise>PRODUCT_COMPLETE</promise>
```
