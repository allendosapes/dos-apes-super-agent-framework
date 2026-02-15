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
- `--fresh` - Ignore existing progress and start from scratch

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| architect | `skills/architecture.md` | System design, tech stack, phase planning |
| builder | `skills/backend.md` + `skills/frontend.md` | Implementation |
| tester | `skills/testing.md` + `skills/browser-verification.md` | Verification, coverage, E2E |
| reviewer | `skills/review.md` | Code review, security audit |

---

## HUMAN INTERRUPTION POLICY

The build command is designed for autonomous execution. Only pause for human input at explicit `[APPROVAL]` gates.

### Proceed Autonomously (NEVER prompt)

- **Build/Test/Lint:** `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format`
- **Git branching:** `git checkout -b`, `git checkout main`, `git branch -d` (local branches)
- **Git commits:** `git add`, `git commit` (on feature branches and main after squash merge)
- **Git tags:** `git tag -a` for task and release tags
- **Git push:** `git push origin main`, `git push origin --tags`, `git push origin feature/*`
- **Git merge:** `git merge --squash` from feature branch to main
- **File operations:** Creating, editing, deleting project files
- **Package install:** `npm install`, `npx`, dependency management
- **Code generation:** Scaffolding, writing code, creating tests
- **Security scans:** `npm audit`, `gitleaks`, dependency checks

### Pause and Ask Human (ALWAYS prompt)

- **`[APPROVAL]` tasks** — Phase boundary reviews, architecture decisions
- **Force push** — `git push --force` or `git push --force-with-lease` to any branch
- **Delete remote branches** — `git push origin --delete` (except cleaning up merged feature branches)
- **Deployment** — `npm run deploy`, running deploy scripts, touching production
- **Database migrations** — Schema changes, data migrations in production
- **Environment/secrets** — Modifying `.env` files, credentials, API keys
- **Ambiguous merge conflicts** — When the correct resolution isn't obvious from context
- **Scope changes** — If a task requires work significantly beyond what the PRD specified

When in doubt about whether to proceed: if the action is **reversible and local**, proceed. If it's **irreversible or affects shared/production systems**, pause.

---

## THE BUILD LOOP

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   PRD/Idea                                                  │
│      │                                                      │
│      ▼                                                      │
│   ┌─────────────┐                                          │
│   │   RESUME?   │  Check for existing tasks & progress     │
│   │             │  Skip to last incomplete task if found    │
│   └──────┬──────┘                                          │
│          │                                                  │
│     Found? ─── Yes ──▶ [Jump to incomplete task]           │
│          │                                                  │
│          No                                                 │
│          │                                                  │
│          ▼                                                  │
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

## PHASE 0: RESUME CHECK

**This runs FIRST, before anything else.** Skip only if `--fresh` flag is set.

```
1. CHECK TASKS API:
   TaskList
   Count tasks by status: completed, in_progress, pending

2. CHECK PLANNING ARTIFACTS:
   Does .planning/ROADMAP.md exist?
   Does .planning/PROJECT.md exist?
   Does CLAUDE.md exist (not the template)?

3. CHECK GIT STATE:
   git tag -l "phase-*" --sort=creatordate    → find last completed phase
   git branch -l "feat/phase-*"               → find in-progress phase branch
   git stash list                             → check for stashed WIP

4. DECIDE:

   IF no tasks AND no .planning/ artifacts:
     → FRESH BUILD. Proceed to PHASE 1: INGEST.

   IF tasks exist (any status):
     → RESUME MODE. Show progress summary:

     ═══════════════════════════════════════
     Existing progress detected.
     ═══════════════════════════════════════
     Project: [from PROJECT.md]
     Tasks: [completed]/[total] complete
     Last phase completed: [from git tags]
     In-progress phase: [from git branches]
     Current branch: [git branch --show-current]
     Uncommitted changes: [yes/no]
     ═══════════════════════════════════════

     Then determine where to resume:

     IF a feat/phase-N branch exists (not yet merged to main):
       git checkout feat/phase-N-slug
       Find first task with status pending or in_progress
       → Jump to PHASE 3: EXECUTE, continue from that task

     ELIF all tasks for phase N are completed but phase not merged:
       → Jump to PHASE 4: ITERATE (merge phase, plan next)

     ELIF phase N fully merged and phase N+1 exists in ROADMAP.md:
       → Jump to PHASE 2: PLAN for phase N+1

     ELIF all phases complete:
       → Jump to PHASE 5: SHIP

   IF tasks exist but --fresh flag is set:
     → Warn: "Existing progress found. --fresh will start over."
     → Delete all existing tasks via TaskUpdate(status: deleted)
     → Proceed to PHASE 1: INGEST.

5. HANDLE STASHED WIP:
   IF git stash list shows entries:
     git stash pop
     (Restore any work-in-progress from a previous interrupted session)
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

TaskCreate: "[GATE] UI Smoke Test"
  description: "If playwright.config exists: start dev server, run E2E smoke tests,
    verify pages render and navigation works. Load skills/browser-verification.md.
    If no Playwright config: use Playwright MCP tools to open the app, navigate major
    routes, verify no errors. Mark completed with evidence (test output or screenshots)."
  blockedBy: ["[GATE] Phase 1 Verification"]
```

### Phase-End UI Test Plans

Each phase should include browser verification appropriate to the phase's scope:

**Foundation phase:**
- App loads at root URL without errors
- Routing works (navigate between defined routes)
- No console errors on any page
- Basic layout renders (header, nav, content area)

**Core Features phase:**
- Each feature's primary user flow works E2E in browser
- Forms submit and validation shows correctly
- Data displays after CRUD operations
- Navigation between features works

**Polish & Launch phase:**
- Full E2E suite passes across Chromium + Firefox minimum
- Visual regression baselines captured and clean
- Accessibility audit passes (WCAG 2.1 AA)
- Performance: pages load under 3s on throttled connection

---

## PHASE 3: EXECUTE

### Create Phase Branch

```bash
# Create feature branch for this phase
git checkout main
git pull origin main 2>/dev/null || true
git checkout -b feat/phase-${PHASE_NUM}-${PHASE_SLUG}
```

### Identify Execution Waves

Group phase tasks into waves based on dependencies:

```
Wave 1: Tasks with no blockedBy within this phase → can run in parallel
Wave 2: Tasks that depend only on Wave 1 tasks → can run in parallel
Wave 3: Tasks that depend on Wave 2 → sequential if only one, parallel if multiple
```

### Execute Wave (Sequential — default)

For waves with a single task, or when tasks modify overlapping files:

1. Builder implements the task in the phase branch
2. Tester verifies
3. Commit with git tag
4. Move to next task

### Execute Wave (Parallel — via Worktrees)

When a wave has 2+ independent tasks that touch **different files/directories**, use git worktrees to execute them in parallel:

```bash
# Create a worktree for each parallel task, branching off the phase branch
git worktree add ../$(basename "$PWD")-wt-task-${TASK_ID} \
  -b task/${TASK_ID}-${TASK_SLUG} \
  feat/phase-${PHASE_NUM}-${PHASE_SLUG}

# Repeat for each independent task in the wave
```

Spawn a teammate (via Task tool) for each worktree. Each teammate works in its own directory:

```
[teammate-A in ../project-wt-task-4] → Task 4: API endpoints
[teammate-B in ../project-wt-task-5] → Task 5: UI components
[teammate-C in ../project-wt-task-6] → Task 6: Data models
```

After all teammates complete, merge back to the phase branch and clean up:

```bash
# Switch to the phase branch
git checkout feat/phase-${PHASE_NUM}-${PHASE_SLUG}

# Merge each completed task branch
git merge task/${TASK_ID_A}-${SLUG_A} --no-edit
git merge task/${TASK_ID_B}-${SLUG_B} --no-edit
git merge task/${TASK_ID_C}-${SLUG_C} --no-edit

# Run verification on the combined result
npm run build && npm run typecheck && npm test

# Phase-end browser verification (if Playwright configured)
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
  echo "Running phase-end E2E smoke test..."
  npx playwright test --reporter=list
  # E2E failures block the phase merge
fi
# If no Playwright config, tester teammate should use Playwright MCP tools:
# open app, navigate major routes, screenshot evidence

# Clean up worktrees and task branches
git worktree remove ../$(basename "$PWD")-wt-task-${TASK_ID_A}
git worktree remove ../$(basename "$PWD")-wt-task-${TASK_ID_B}
git worktree remove ../$(basename "$PWD")-wt-task-${TASK_ID_C}
git branch -d task/${TASK_ID_A}-${SLUG_A} task/${TASK_ID_B}-${SLUG_B} task/${TASK_ID_C}-${SLUG_C}
```

**When to use parallel execution:**
- Wave has 2+ tasks with no mutual dependencies
- Tasks touch clearly separate areas (e.g., backend API vs. frontend UI vs. database models)
- Project is past Phase 1 (foundation must be sequential — everything depends on scaffolding)

**When to stay sequential:**
- Wave has only 1 task
- Tasks modify shared files (e.g., shared types, config, package.json)
- Phase 1 / project scaffolding (no existing code to branch from)

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

### Task Retry & Recovery

**CRITICAL: Never skip a failing task. Either fix it or escalate.**

When a task fails verification, follow this retry protocol:

```
TASK RETRY LOOP (max 3 attempts per task):

  attempt = 1

  WHILE task is not passing AND attempt <= 3:

    1. CLASSIFY the error:

       TYPE_ERROR:    TypeScript compilation failure
       TEST_FAILURE:  Unit/integration test not passing
       BUILD_FAILURE: Build/bundle fails (missing deps, syntax errors)
       LINT_ERROR:    Linting or formatting violation
       RUNTIME_ERROR: App crashes or throws at runtime
       ENV_ERROR:     Missing dependency, wrong Node version, config issue

    2. FIX based on classification:

       TYPE_ERROR →
         - Read the tsc error output
         - Fix the type errors in the reported files
         - Re-run: npm run typecheck

       TEST_FAILURE →
         - Read the failing test output
         - Determine: is the test wrong, or is the code wrong?
         - If test expectation is stale: update the test
         - If code has a bug: fix the implementation
         - Re-run: npm test

       BUILD_FAILURE →
         - Read the build error output
         - Check for missing imports, syntax errors, circular deps
         - Fix and re-run: npm run build

       LINT_ERROR →
         - Run: npm run lint:fix (auto-fix what's possible)
         - Manually fix remaining issues
         - Re-run: npm run lint

       RUNTIME_ERROR →
         - Read the error stack trace
         - Identify the root cause (null ref, async issue, bad state)
         - Fix the implementation
         - Re-run the failing scenario

       ENV_ERROR →
         - Check: npm install (missing dependency?)
         - Check: node --version (version mismatch?)
         - Check: required config files exist?
         - Fix and retry the original command

    3. RE-VERIFY the full task (not just the one check that failed)

    4. IF still failing:
         attempt += 1
         IF attempt <= 3:
           Try a DIFFERENT approach:
           - Attempt 1: Direct fix based on error output
           - Attempt 2: Re-read related code for context, try alternative impl
           - Attempt 3: Rollback task to last good state, rewrite from scratch

  END WHILE

  IF task passes: commit, tag, continue to next task

  IF task still fails after 3 attempts: ESCALATE
```

**Escalation procedure (after 3 failed attempts):**

```bash
# 1. Log the issue
mkdir -p .planning
cat >> .planning/ISSUES.md << 'ISSUE'
## [Task Name] - BLOCKED

**Phase:** ${PHASE_NUM}
**Task:** ${TASK_ID} - ${TASK_NAME}
**Attempts:** 3
**Error type:** [classification]
**Last error output:**
```
[paste last error]
```
**What was tried:**
1. [attempt 1 approach]
2. [attempt 2 approach]
3. [attempt 3 approach]

**Suggested fix:** [best guess at what a human should look at]
ISSUE
```

Then pause and ask the human for guidance. Do NOT continue to the next task — downstream tasks depend on this one. Do NOT mark the task as completed.

---

## PHASE 4: ITERATE

After Phase 1 completes:

### Merge Phase to Main

After all phase tasks pass verification:

```bash
# Switch to main and merge the phase branch
git checkout main
git merge --squash feat/phase-${PHASE_NUM}-${PHASE_SLUG}
git commit -m "feat: Phase ${PHASE_NUM} complete - ${PHASE_DESCRIPTION}"
git branch -d feat/phase-${PHASE_NUM}-${PHASE_SLUG}
```

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
# E2E tests — blocking when Playwright is configured
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
  npx playwright test --reporter=list
fi

# Security check
npm audit
```

### Git Completion

```bash
# Ensure we're on main with all phases merged
git checkout main

# Push to remote
git push origin main

# Tag the release
git tag -a "v1.0.0" -m "Release v1.0.0 - $(date -Iseconds)"
git push origin --tags
```

### Handle Merge Conflicts

If a merge conflict occurs at any phase:

```bash
# 1. Identify conflicting files
git status

# 2. Open and resolve conflicts (prefer the feature branch changes)
# 3. Stage resolved files
git add [resolved-files]

# 4. Complete the merge
git commit -m "feat: Phase ${PHASE_NUM} complete - ${PHASE_DESCRIPTION} (resolved conflicts)"
```

If conflict resolution is ambiguous, create an `[APPROVAL]` task requesting human guidance before continuing.

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
- Last completed task tag: phase-N/task-M-complete
- Completed tasks visible via TaskList

All work is committed and tagged. To continue:
/apes-build --prd [same-prd] --ralph
(Resume detection will find the last completed task and continue)
```

### Task Blocked After Retries

After 3 failed attempts on a task, the build pauses:

```
<promise>BLOCKED</promise>

Task: [task name]
Phase: [N]
Attempts: 3 (exhausted)
Error: [classification]: [summary]

Details logged to: .planning/ISSUES.md

Options:
1. Fix the issue manually, then: /apes-build --prd [same-prd] --ralph
2. Rollback to last good task: git reset --hard phase-N/task-M-complete
   Then: /apes-build --prd [same-prd] --ralph
3. Skip this task (NOT recommended — will break downstream tasks)
```

### Session Interrupted

If the session ends unexpectedly (timeout, crash, network):

```
All completed tasks are committed with git tags.
Work-in-progress on the current task may be uncommitted.

To recover:
1. Check state: git status && git tag -l "phase-*"
2. If dirty working tree: git stash (preserve WIP) or git checkout . (discard)
3. Resume: /apes-build --prd [same-prd] --ralph
   (Resume detection picks up from last tagged task)
```

### Recovery Commands

```bash
# Resume from where we left off (automatic — uses resume detection)
/apes-build --prd [same-prd] --ralph

# See what was completed
git tag -l "phase-*" --sort=creatordate

# Rollback to a specific task and retry from there
git reset --hard phase-2/task-3-complete
/apes-build --prd [same-prd] --ralph

# Nuclear option: restart everything from scratch
/apes-build --prd [same-prd] --ralph --fresh

# Nuclear option: restart a single phase
git checkout main
git branch -D feat/phase-2-core-features
git tag -d $(git tag -l "phase-2/*")
/apes-build --prd [same-prd] --ralph
```

---

## EXAMPLE: FRESH BUILD

```bash
$ claude

> /apes-build --prd ./docs/courseware-prd.md --ralph

Checking for existing progress... none found.

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
Tester: Build ✅ Types ✅ Lint ✅ E2E Smoke ✅
Committed: chore(setup): initialize project

[builder]
Task 2: Core data models...
...

═══ PHASE 1 COMPLETE ═══
Merging to main...
Merged: feat/phase-1-foundation → main (squash)

<promise>PHASE_1_COMPLETE</promise>

═══ PHASE 2: Core Features ═══

Creating branch: feat/phase-2-core-features
Architect designing core features...
Tasks created (5 tasks via Tasks API)

Wave 1: 3 independent tasks → parallel execution
Creating worktrees...
  ../courseware-wt-task-6 → task/6-api-endpoints
  ../courseware-wt-task-7 → task/7-ui-components
  ../courseware-wt-task-8 → task/8-data-models

[builder-A in wt-task-6] API endpoints...
[builder-B in wt-task-7] UI components...
[builder-C in wt-task-8] Data models...

All teammates complete. Merging to phase branch...
Merged: task/6 ✅ task/7 ✅ task/8 ✅
Combined verification: Build ✅ Types ✅ Tests ✅
Worktrees cleaned up.

Wave 2: 2 tasks (depend on Wave 1) → sequential
Task 9: Integration wiring...
Task 10: E2E tests...

═══ PHASE 2 COMPLETE ═══
...

[After all phases]

═══════════════════════════════════════════════════════════════
🦍🦍 PRODUCT COMPLETE 🦍🦍
═══════════════════════════════════════════════════════════════

Dos Apes: We ain't monkeying around with code!

<promise>PRODUCT_COMPLETE</promise>
```

## EXAMPLE: RESUMED BUILD

```bash
# Session was interrupted during Phase 2, Task 9
$ claude

> /apes-build --prd ./docs/courseware-prd.md --ralph

Checking for existing progress...

═══════════════════════════════════════
Existing progress detected.
═══════════════════════════════════════
Project: Courseware Platform
Tasks: 8/15 complete, 1 in progress, 6 pending
Last phase completed: Phase 1 (Foundation)
In-progress phase: feat/phase-2-core-features
Current branch: feat/phase-2-core-features
Uncommitted changes: yes (stashed)
═══════════════════════════════════════

Restoring stashed work...
Resuming Phase 2, Task 9: Integration wiring

[builder]
Task 9: Integration wiring (resuming)...
[builder → tester] Verification requested
Tester: Build ✅ Types ✅ Tests ✅
Committed: feat(integration): wire API to UI components

Task 10: E2E tests...
...

═══ PHASE 2 COMPLETE ═══
Merging to main...
Merged: feat/phase-2-core-features → main (squash)

(continues with remaining phases...)
```
