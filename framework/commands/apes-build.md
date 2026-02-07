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

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| architect | `skills/architecture.md` | System design, tech stack, phase planning |
| builder | `skills/backend.md` + `skills/frontend.md` | Implementation |
| tester | `skills/testing.md` + `skills/browser-verification.md` | Verification, coverage, E2E |
| reviewer | `skills/review.md` | Code review, security audit |

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
│   │             │  Create tasks via Tasks API              │
│   └──────┬──────┘                                          │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐     ┌─────────────┐                     │
│   │   EXECUTE   │────▶│   VERIFY    │                     │
│   │             │◀────│             │                     │
│   │  Build Loop │     │   Tester    │                     │
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

### Parse PRD

```bash
# Read PRD
cat [prd-file]
```

### Create Project Structure

```bash
# Create planning directory
mkdir -p .planning/codebase

# Initialize git if needed
git init 2>/dev/null || true
```

### Generate PROJECT.md

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

### Generate ROADMAP.md

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

### Create CLAUDE.md

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

### Architect Designs Phase

The architect teammate loads `skills/architecture.md` and designs the phase.

For Phase 1 (Foundation), typically:

- Project scaffolding
- Core data models
- Basic API structure
- Initial UI shell

### Create Tasks via Tasks API

Use TaskCreate to define tasks with dependencies:

```
TaskCreate: "Project Scaffolding"
  description: "Initialize project with Vite + React + TypeScript.
    Configure ESLint, Prettier, TypeScript strict. Set up folder structure."
  verify: "npm run build passes"

TaskCreate: "Core Data Models"
  description: "Define TypeScript types and database schema."
  verify: "npm run typecheck passes"
  blockedBy: ["Project Scaffolding"]

TaskCreate: "UI Shell"
  description: "Create layout component, routing, and basic page structure."
  verify: "npm run build passes, routes render"
  blockedBy: ["Project Scaffolding"]

TaskCreate: "[APPROVAL] Architecture Review"
  description: "PAUSE. Present architecture decisions to human for review.
    Do NOT mark complete until human confirms in chat."
  blockedBy: ["Core Data Models", "UI Shell"]

TaskCreate: "[GATE] Phase 1 Verification"
  description: "Run full verification pyramid (L0-L5). All must pass."
  blockedBy: ["[APPROVAL] Architecture Review"]
```

---

## PHASE 3: EXECUTE

### Start Execution Loop

The build loop handles execution internally:

1. Git setup (branch)
2. Task loop with teammate handoffs
3. Tester verification per task
4. Commit per task with git tag
5. Phase merge when complete

### Task-Level Git Tags

After each task commit succeeds, tag the commit for rollback support:

```bash
# After commit succeeds
git tag -a "phase-${PHASE_NUM}/task-${TASK_ID}-complete" \
  -m "${TASK_NAME} - verified $(date -Iseconds)"
```

This enables fine-grained rollback:

```bash
# Rollback to specific task
git reset --hard phase-2/task-3-complete

# See all task tags
git tag -l "phase-*"
```

---

## PHASE 4: ITERATE

After Phase 1 completes:

### Check Progress

```
TaskList
# Review completed vs remaining tasks
# Check if more phases exist in ROADMAP.md
```

### Plan Next Phase

```
IF more phases remain in ROADMAP.md:

  # Architect designs next phase
  # Create tasks via Tasks API with dependencies

  # Continue execution loop for next phase

ELSE:
  # All done!
  GOTO PHASE 5
```

---

## PHASE 5: SHIP

### Final Verification

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

### Deployment (if configured)

```bash
# Check for deploy script
if [ -f "deploy.sh" ] || grep -q '"deploy"' package.json; then
  npm run deploy
fi
```

### Final Report

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

## TASK TYPES & APPROVAL GATES

```
Task types:
  - Regular task: auto-assigned to teammates
  - Gate task: "[GATE] ..." prefix, assigned to tester
  - Approval task: "[APPROVAL] ..." prefix, requires human

Approval tasks:
  TaskCreate: "[APPROVAL] Architecture review before implementation"
    blockedBy: [architect tasks]
    description: "PAUSE. Present architecture decisions to human for review.
    Do NOT mark complete until human confirms in chat."

  All implementation tasks blockedBy: [approval task]
```

The lead pauses and waits for human input before marking the approval task complete. Downstream tasks remain blocked until approval. Use approval gates at phase boundaries or before major architectural decisions.

---

## FAILURE MODES

### Iteration Limit Reached

```
Max iterations (500) reached.

Progress saved:
- Phase: [N] of [Total]
- Task: [M] of [Total in phase]
- Completed tasks visible via TaskList

To continue:
/apes-build --prd [same-prd] --ralph
(Build will detect existing progress and resume)
```

### Blocked by Error

```
<promise>BLOCKED</promise>

Cannot continue without human intervention.

Issue: [description]
See: .planning/ISSUES.md

To retry after fixing:
/apes-build --prd [same-prd] --ralph
```

### Recovery

```bash
# Continue from where we left off (detects existing tasks and progress)
/apes-build --prd [same-prd] --ralph

# Rollback to a specific task tag and retry
git reset --hard phase-2/task-3-complete
/apes-build --prd [same-prd] --ralph
```

---

## EXAMPLE RUN

```bash
$ claude

> /apes-build --prd ./docs/courseware-prd.md --ralph

Loading PRD...
Creating PROJECT.md...
Creating ROADMAP.md (5 phases)...
Creating CLAUDE.md...

═══ PHASE 1: Foundation ═══

Creating branch: feat/phase-1-foundation
Architect designing foundation...
Tasks created (4 tasks via Tasks API)

[architect → builder]
Task 1: Project scaffolding
Builder initializing Vite + React + TypeScript...
Builder configuring tools...
[builder → tester] Verification requested
Tester: Build ✅ Types ✅ Lint ✅
Committed: chore(setup): initialize project

[builder]
Task 2: Core data models...
...

═══ PHASE 1 COMPLETE ═══
Merging to main...
Merged: feat/phase-1-foundation → main

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
