---
description: Execute phase with full agent orchestration and git workflow
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Execute Phase

**Autonomously execute a phase using agent handoffs, proper git workflow, and Ralph loops.**

## Arguments

- `[phase]` - Phase number (optional, uses current from STATE.md)
- `--ralph` - Enable autonomous loop until phase/product complete
- `--max-iterations N` - Max iterations (default: 50)
- `--parallel` - Use git worktrees for parallel task execution
- `--max-concurrent N` - Maximum concurrent agents (default: 4)

---

## WAVE-BASED PARALLEL EXECUTION

### Overview

Plans are assigned to execution waves during planning. Independent plans execute in parallel within each wave.

```
PHASE EXECUTION:

Wave 1: [Plan A, Plan B, Plan C] → Execute all 3 in parallel (max 4 concurrent)
         ↓ (wait for all to complete)
Wave 2: [Plan D, Plan E]         → Execute both in parallel
         ↓ (wait for all to complete)
Wave 3: [Plan F]                 → Sequential (depends on D, E)
```

### How Waves Are Determined

From PLAN.md frontmatter:

```yaml
---
phase: 01-foundation
plan: 02
wave: 1 # Pre-assigned during planning
depends_on: [] # No dependencies = Wave 1
---
```

Plans with dependencies execute in later waves:

- `depends_on: []` → Wave 1
- `depends_on: ["01-01"]` → Wave 2 (after 01-01 completes)
- `depends_on: ["01-01", "01-02"]` → Wave 3 (after both complete)

### Execution Logic

```
FOR each wave W in sorted(waves):

  # Get all plans in this wave
  plans_in_wave = filter(plans, wave == W)

  # Limit to max_concurrent (default: 4)
  batches = chunk(plans_in_wave, max_concurrent)

  FOR each batch in batches:
    # Execute all plans in batch in parallel
    PARALLEL:
      FOR each plan in batch:
        spawn_subagent(plan)  # Fresh 200k context

    # Wait for all in batch to complete
    wait_for_all(batch)

    # Verify all passed
    FOR each plan in batch:
      IF plan.failed:
        retry_with_context(plan)

  # Wave complete, proceed to next wave

---

### Subagent Context Management

Each plan executes in a fresh subagent with 200k token context:

```

Orchestrator Context Usage:
├── 15% - Coordination, state management, handoffs
└── 85% - Available for subagent spawning

Per-Plan Subagent:
├── 100% fresh context (200k tokens)
├── Loads: PROJECT.md, STATE.md, PLAN.md, relevant source
├── Executes: 2-3 tasks
└── Returns: SUMMARY.md with results

````

**Context Quality Zones:**
- 0-30%: Peak quality (optimal)
- 30-50%: Good (acceptable)
- 50-70%: Degrading (consider splitting)
- 70%+: Poor (must spawn fresh)

---

## STEP 1: INITIALIZE

```bash
# Load orchestration engine
cat .claude/framework/ORCHESTRATOR.md

# Load current state
cat .planning/STATE.md

# Load phase plans (scan for wave assignments)
ls .planning/phases/[phase-name]/*-PLAN.md

# Load project memory
cat CLAUDE.md
cat .planning/MEMORY.md 2>/dev/null || echo "No memory yet"
````

### Set Execution Mode

Update `.planning/STATE.md`:

```markdown
## Execution Mode

ralph_mode: [true if --ralph, else false]
max_iterations: [N]
current_iteration: 0
```

---

## STEP 2: GIT SETUP (MANDATORY)

**⚠️ DO NOT START implementation until branch is created and confirmed.**

### [ORCHESTRATOR] Create Phase Branch

Execute these commands NOW:

```bash
# 1. ENSURE main is current
git checkout main
git pull origin main

# 2. CREATE phase branch (replace placeholders with actual values)
PHASE_NUM="[phase number]"           # e.g., "01"
PHASE_NAME="[name-from-roadmap]"     # e.g., "foundation" (kebab-case)
BRANCH_NAME="feat/phase-${PHASE_NUM}-${PHASE_NAME}"

git checkout -b "$BRANCH_NAME"

# 3. VERIFY branch created
git branch --show-current
# Must show: feat/phase-XX-name
```

**Branch Setup Checklist:**
- [ ] On main and pulled latest
- [ ] Feature branch created with naming: `feat/phase-[N]-[name]`
- [ ] `git branch --show-current` confirms correct branch
- [ ] STATE.md updated with `current_branch: [branch-name]`

**If on wrong branch:** `git checkout -b feat/phase-XX-name` from main.

### If --parallel: Create Worktrees

```bash
# Create worktree for each task
TASKS=$(grep -c '<task' .planning/PLAN.md)

for i in $(seq 1 $TASKS); do
  git worktree add -b "feat/phase-${PHASE_NUM}-task-${i}" \
    "../worktrees/phase-${PHASE_NUM}-task-${i}" main
done
```

### Update STATE.md

```markdown
## Git State

main_branch: main
current_branch: feat/phase-[N]-[name]
worktrees:

- path: ../worktrees/phase-[N]-task-1
  branch: feat/phase-[N]-task-1
  status: active
```

---

## STEP 3: TASK EXECUTION LOOP

```
FOR each task in PLAN.md WHERE complete="false":
```

### 3.1 [ORCHESTRATOR] Load Task

```bash
# Parse task from PLAN.md
TASK_ID=[task id]
TASK_TYPE=[backend|frontend|test|security|deploy|design]
TASK_NAME=[task name]
TASK_FILES=[files to create/modify]
TASK_ACTION=[implementation details]
TASK_VERIFY=[verification commands]
```

### 3.2 [ORCHESTRATOR] Select Agent

| Task Type  | Agent               | Agent File                              |
| ---------- | ------------------- | --------------------------------------- |
| `backend`  | Backend Developer   | `.claude/agents/backend-developer.md`   |
| `frontend` | Frontend Developer  | `.claude/agents/frontend-developer.md`  |
| `test`     | QA Engineer         | `.claude/agents/qa-engineer.md`         |
| `security` | Security Engineer   | `.claude/agents/security-engineer.md`   |
| `deploy`   | DevOps Engineer     | `.claude/agents/devops-engineer.md`     |
| `design`   | Technical Architect | `.claude/agents/technical-architect.md` |

### 3.3 [ORCHESTRATOR → AGENT] Handoff

```
═══════════════════════════════════════════════════════════
[ORCHESTRATOR → [AGENT_NAME]]

Task: [TASK_NAME]
Files: [TASK_FILES]
Action: [TASK_ACTION]

Context:
- Phase: [PHASE_NUM] - [PHASE_NAME]
- Previous tasks in this phase: [list completed]
- Key patterns from MEMORY.md: [relevant patterns]

Requirements:
- Follow agent rules from .claude/agents/[agent].md
- Update files as specified
- Run verification: [TASK_VERIFY]
═══════════════════════════════════════════════════════════
```

Update STATE.md:

```markdown
current_agent: [agent-name]
handoff_pending: false
```

### 3.4 [AGENT] Execute Task

Load and follow agent-specific rules:

```bash
cat .claude/agents/[agent-name].md
```

**Agent executes according to their rules:**

- Backend Developer: TypeScript strict, validation, error handling
- Frontend Developer: Components + **UI INTEGRATION** (mandatory)
- QA Engineer: Verification stack
- etc.

### 3.5 [AGENT] Agent Verification

Each agent runs their own verification before handoff:

**Backend Developer:**

```bash
npm run typecheck
npm test -- [service].test.ts
```

**Frontend Developer:**

```bash
npm run typecheck
# CRITICAL: UI Integration check
grep -rn "[ComponentName]" src/ --include="*.tsx" | grep -v "src/components"
# Must return results showing where component is USED
```

### 3.6 [AGENT → QA ENGINEER] Handoff for Verification

```
═══════════════════════════════════════════════════════════
[[AGENT_NAME] → QA ENGINEER]

Task Complete: [TASK_NAME]
Files Changed: [list files]

Agent Verification: PASSED

Requesting full verification stack.
═══════════════════════════════════════════════════════════
```

### 3.7 [QA ENGINEER] Full Verification

Load QA rules:

```bash
cat .claude/agents/qa-engineer.md
```

Run verification stack:

```bash
echo "═══ QA VERIFICATION ═══"

# Level 0: Build
echo "Build..."
npm run build || { echo "❌ BUILD FAILED"; exit 1; }
echo "✅ Build"

# Level 1: Static Analysis
echo "Types..."
npm run typecheck || { echo "❌ TYPES FAILED"; exit 1; }
echo "✅ Types"

echo "Lint..."
npm run lint || { echo "❌ LINT FAILED"; exit 1; }
echo "✅ Lint"

# Level 2: Tests
echo "Tests..."
npm test || { echo "❌ TESTS FAILED"; exit 1; }
echo "✅ Tests"

# Level 3: UI Integration (if frontend task)
if [ "$TASK_TYPE" = "frontend" ]; then
  echo "UI Integration..."
  COMPONENT=$(grep -o '<component>[^<]*</component>' .planning/PLAN.md | head -1 | sed 's/<[^>]*>//g')
  USAGE=$(grep -rn "$COMPONENT" src/ --include="*.tsx" | grep -v "src/components" | grep -v ".test." | wc -l)
  if [ "$USAGE" -eq 0 ]; then
    echo "❌ UI INTEGRATION FAILED - Component not used in app"
    exit 1
  fi
  echo "✅ UI Integration ($USAGE usage(s) found)"
fi

echo ""
echo "═══ ALL VERIFICATION PASSED ═══"
```

### 3.8 [QA ENGINEER → ORCHESTRATOR] Report

```
═══════════════════════════════════════════════════════════
[QA ENGINEER → ORCHESTRATOR]

Task: [TASK_NAME]
Verification: ✅ ALL PASSED

| Check | Status |
|-------|--------|
| Build | ✅ |
| Types | ✅ |
| Lint | ✅ |
| Tests | ✅ |
| UI Integration | ✅ (if applicable) |

Ready for commit.
═══════════════════════════════════════════════════════════
```

### 3.9 [ORCHESTRATOR] Commit Task (MANDATORY)

**⚠️ DO NOT PROCEED to next task until commit is confirmed.**

Execute these commands NOW - not as templates:

```bash
# EXECUTE IMMEDIATELY after verification passes:
git add -A
git commit -m "$(cat <<'EOF'
[type]([scope]): [task description]

- [Change 1]
- [Change 2]
- [Change 3]

[TASK-ID] complete
Verified by: QA Engineer

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# VERIFY commit succeeded:
git log --oneline -1
```

**Commit Checklist:**
- [ ] `git add -A` executed
- [ ] `git commit` executed with descriptive message
- [ ] `git log --oneline -1` shows new commit
- [ ] STATE.md updated with `last_commit: [hash]`

**If commit fails:** Fix the issue and retry. DO NOT continue to next task.

### 3.10 [ORCHESTRATOR] Update State

Update `.planning/STATE.md`:

```markdown
task: [N+1]
task_name: "[Next task]"

## Verification Status

build: pass
types: pass
lint: pass
tests: pass
ui_integration: pass

## Progress

current_phase_tasks: [N]/[Total]
```

Mark task complete in `.planning/PLAN.md`:

```xml
<task id="[N]" type="[type]" complete="true">
```

---

## STEP 4: PHASE COMPLETION

When all tasks complete:

### 4.1 [QA ENGINEER] Final Phase Verification

```bash
echo "═══ FINAL PHASE VERIFICATION ═══"

npm run build
npm run typecheck
npm run lint
npm test
npm run test:integration 2>/dev/null || echo "No integration tests"

echo ""
echo "Browser verification required."
echo "Run: npm run dev"
echo "Verify: [list key features from phase]"
```

### 4.2 [ORCHESTRATOR] Merge to Main (MANDATORY)

**⚠️ DO NOT PROCEED to next phase until merge AND push are confirmed.**

Execute these commands NOW - not as templates:

```bash
# 1. VERIFY clean state
git status
# Must show: "nothing to commit, working tree clean" or only staged changes

# 2. CHECKOUT main
git checkout main
git pull origin main

# 3. SQUASH MERGE (execute with actual branch name)
PHASE_BRANCH="feat/phase-[N]-[name]"  # Replace with actual branch
git merge --squash "$PHASE_BRANCH"

# 4. COMMIT with full context
git commit -m "$(cat <<'EOF'
feat: Phase [N] - [Phase Name]

Completed tasks:
- [Task 1]
- [Task 2]
- [Task 3]

All verification passed.
Ready for Phase [N+1].

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# 5. PUSH to remote (MANDATORY after phase complete)
git push origin main

# 6. VERIFY push succeeded
git log origin/main --oneline -1

# 7. Clean up feature branch
git branch -d "$PHASE_BRANCH"
```

**Phase Merge Checklist:**
- [ ] `git checkout main` executed
- [ ] `git merge --squash` executed
- [ ] `git commit` executed with phase summary
- [ ] `git push origin main` executed and confirmed
- [ ] `git log origin/main` shows merge commit
- [ ] Feature branch deleted
- [ ] STATE.md updated: `pending_push: false`

**If merge/push fails:** Resolve conflicts, fix issues, and retry. DO NOT start next phase until main is updated.

### 4.3 [ORCHESTRATOR] Update State for Next Phase

```markdown
## Current Position

phase: [N+1]
phase_name: "[Next phase from ROADMAP]"
task: 1
status: planning

## Progress

phases_complete: [N]/[Total]
current_phase_tasks: 0/[pending count]
```

### 4.4 Output Phase Complete

```
<promise>PHASE_[N]_COMPLETE</promise>
```

---

## STEP 5: RALPH LOOP CONTINUATION

If `--ralph` mode:

```
IF more phases exist:
  Create PLAN.md for next phase
  GOTO STEP 2 (Git Setup for new phase)

ELSE:
  OUTPUT "<promise>PRODUCT_COMPLETE</promise>"

  echo "═══════════════════════════════════════════"
  echo "🦍🦍 PRODUCT SHIPPED!"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "Phases completed: [Total]"
  echo "Total commits: $(git rev-list --count main)"
  echo ""
  echo "Dos Apes: We ain't monkeying around with code!"
  echo "═══════════════════════════════════════════"
```

---

## FAILURE HANDLING

### If Verification Fails

```
[QA ENGINEER]
❌ Verification failed: [specific failure]

[QA ENGINEER → AGENT]
Fix required: [what needs fixing]
Error details: [error output]

[AGENT]
Analyzing failure...
Implementing fix...
[retry verification]
```

### If 3+ Retries Fail

```
[ORCHESTRATOR]
Task [N] failed 3 times.

Adding to ISSUES.md:
- Task: [name]
- Error: [persistent error]
- Attempts: 3

Options:
1. Continue with next task (may cause issues)
2. Block and request human help

Choosing: Block for human review

<promise>BLOCKED</promise>
```

---

## OUTPUT

On success:

```
<promise>PHASE_[N]_COMPLETE</promise>
```

On all phases done:

```
<promise>PRODUCT_COMPLETE</promise>
```

On failure requiring human:

```
<promise>BLOCKED</promise>
```
