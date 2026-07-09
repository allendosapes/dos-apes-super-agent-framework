---
description: Full autonomous build from PRD to shipped product
allowed-tools: Read, Edit, Write, Grep, Glob, TaskCreate, TaskUpdate, TaskList, Bash(git checkout -b:*), Bash(git merge:*), Bash(npm run build:*), Bash(npm run lint:*), Bash(npm run typecheck:*), Bash(npm test:*)
---

# Build Product

**The "hands off" command. Feed it a PRD or a mission, walk away, come back to a shipped product.**

```bash
/apes-build                                  # Pick the highest-priority unblocked mission and build it
/apes-build --mission M-0001                 # Build one specific mission
/apes-build --prd requirements.md --ralph    # Generate missions from a PRD, then build them in priority order
/apes-build --idea "..." --ralph             # Same, from a one-line idea
```

## Arguments

- `--mission <M-NNNN>` — Build a specific mission. Mutually exclusive with `--prd` and `--idea`.
- `--prd <file>` — Generate missions from a PRD, then (with `--ralph`) build them in priority order.
- `--idea "<text>"` — Generate missions from a one-line idea, then (with `--ralph`) build them.
- `--ralph` — After mission generation, iterate through the generated missions. Without `--ralph` the command stops after generating missions to `todo/` so a human can review them first.
- `--max-iterations N` — Per-mission iteration cap. Overrides the mission's `max_iterations` frontmatter (default 50).
- `--fresh` — Ignore existing progress and start from scratch.

### Flag interaction matrix

| Flags                          | Behavior                                                                                  |
|--------------------------------|-------------------------------------------------------------------------------------------|
| (none)                         | Pick highest-priority unblocked mission from `todo/`, build it. Refuse if `todo/` is empty. |
| `--mission M-NNNN`             | Build that mission. Refuse if mission is missing, already in `doing`/`review`, or has unmet deps. |
| `--prd file.md`                | Generate missions to `todo/` from the PRD. Stop. Human reviews; runs `/apes-build` later. |
| `--prd file.md --ralph`        | Generate missions, then build them sequentially in priority order until `todo/` is drained or a mission fails. |
| `--idea "..."`                 | Same as `--prd` but with a one-line input.                                                |
| `--idea "..." --ralph`         | Same as `--prd --ralph`.                                                                  |
| `--mission` + `--prd`/`--idea` | **Error.** Mutually exclusive — `--mission` consumes a mission, `--prd`/`--idea` produce them. |
| `--fresh`                      | Combinable with any of the above. Wipes existing progress (tasks, workpads, evidence) before starting. |

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| lead | `skills/product.md` + `skills/orchestration.md` | Requirements analysis, task planning, coordination |
| architect | `skills/architecture.md` | System design, tech stack, phase planning |
| builder | `skills/backend.md` + `skills/frontend.md` | Implementation |
| tester | `skills/testing.md` + `skills/browser-verification.md` | Verification, coverage, E2E |
| reviewer | `skills/review.md` | Code review, security audit |

---

## MISSION MODE

`/apes-build` is mission-aware. Most invocations execute exactly one mission
end-to-end (todo → doing → review). PRD/idea flows generate one or more
missions first, then chain through them when `--ralph` is set.

Before doing anything else, load the supporting skills once at the top of
the session:

```
Read .claude/skills/missions.md
Read .claude/skills/worktrees.md
Read .claude/skills/evidence-packets.md
Read .claude/skills/testing.md
```

The five state directories under `.planning/missions/` are the single source
of truth for what work exists and where it lives. The `.planning/active-mission`
file (single line, `M-NNNN`) marks which mission this session is currently
executing — verification scripts read it to log to the right place.

### Step 1 — Resolve the target mission

Mission lookup, dependency resolution, and FSM checks all go through
`scripts/mission-cli.js`. Do not re-implement them in shell — the CLI's
exit codes are the contract.

```bash
if [ -n "$MISSION_ARG" ]; then
  # --mission <id> supplied. Validate and check preconditions.
  TARGET="$MISSION_ARG"

  # Existence + current state.
  STATE_JSON=$(node scripts/mission-cli.js show "$TARGET" 2>&1)
  case $? in
    0) ;;
    2) echo "apes-build: mission $TARGET not found" >&2; exit 1 ;;
    *) echo "apes-build: $STATE_JSON" >&2; exit 1 ;;
  esac
  CURRENT_STATE=$(echo "$STATE_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).state))')

  case "$CURRENT_STATE" in
    doing|review)
      echo "apes-build: mission $TARGET is already in $CURRENT_STATE; inspect with /apes-mission show or /apes-status" >&2
      exit 1
      ;;
    done|canceled)
      echo "apes-build: mission $TARGET is in $CURRENT_STATE; missions are immutable after completion" >&2
      exit 1
      ;;
    todo) ;;
    *) echo "apes-build: unexpected state '$CURRENT_STATE' for $TARGET" >&2; exit 1 ;;
  esac

  # Unmet dependencies.
  UNMET=$(node scripts/mission-cli.js deps "$TARGET" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).unmet.join(",")))')
  if [ -n "$UNMET" ]; then
    echo "apes-build: mission $TARGET blocked by: $UNMET" >&2
    exit 1
  fi

elif [ -n "$PRD_ARG" ] || [ -n "$IDEA_ARG" ]; then
  # See Step 1b. Without --ralph, stop after generation.
  :

else
  # No flags — pick the highest-priority unblocked mission in todo/. The
  # lib returns missions sorted by (priority, created) within each state.
  TARGET=$(node -e '
    const { execFileSync } = require("child_process");
    const list = JSON.parse(execFileSync("node", ["scripts/mission-cli.js", "list", "--state", "todo"], { encoding: "utf8" }));
    for (const m of list.missions) {
      const deps = JSON.parse(execFileSync("node", ["scripts/mission-cli.js", "deps", m.id], { encoding: "utf8" }));
      if (deps.unmet.length === 0) { console.log(m.id); break; }
    }
  ')
  if [ -z "$TARGET" ]; then
    echo "apes-build: no unblocked missions in todo/ — create one with /apes-mission new" >&2
    exit 1
  fi
fi
```

### Step 1b — PRD/idea ingestion (only with `--prd` or `--idea`)

The product agent (`.claude/skills/product.md`) and architect
(`.claude/skills/architecture.md`) decompose the input into one or more
missions. Each generated mission MUST be valid per the missions skill
(populated `acceptance`, declared `verification.required_levels`,
`workspace.branch` and `workspace.worktree` set, `phase` claimed if a
roadmap phase exists). Write each to `.planning/missions/todo/`.

Print a summary table of what was created. Without `--ralph`, stop. With
`--ralph`, fall through to Step 5 with the generated missions queued.

### Step 2 — Move target into `doing`

For the resolved `TARGET` mission ID:

```bash
# The CLI runs `git mv` (moves the .md file and the companion per-mission
# directory if present), then bumps the frontmatter `state` and `updated`
# fields atomically. It does NOT commit — that's our call.
node scripts/mission-cli.js move "$TARGET" doing
git commit -m "mission(${TARGET}): todo → doing"
```

### Step 3 — Create the worktree

```bash
node scripts/mission-worktree.js create "$TARGET"
```

Errors from this script (path collision, invalid path, missing main, git
version too old) are non-recoverable for this run — see [Error paths](#error-paths-and-cleanup).

### Step 4 — Mark active and execute

```bash
node scripts/mission-cli.js set-active "$TARGET"
```

From this point on, all work happens **inside the worktree directory**
(`.worktrees/${TARGET}`). The build phases below (PHASE 0 through PHASE 5
in this file) run against that directory, not the main checkout. The
mission's frontmatter declares the team composition and required
verification levels; honor both.

After every significant action (scaffolding, implementing a module, a
verification pass), append a workpad entry:

```bash
node scripts/mission-cli.js workpad "$TARGET" "Scaffolded route in src/routes/todos.ts; added Zod validation"
```

The CLI writes the canonical heading `### YYYY-MM-DD HH:MM` followed by
the note text, preserves prior entries, and bumps `updated`. See
`.claude/skills/missions.md` "Workpad protocol" for the rules.

The verification pyramid runs as documented in `.claude/skills/testing.md`.
Each verification script (`check-coverage.sh`, `check-secrets.sh`,
`check-doc-drift.sh`, etc.) appends a JSONL record to
`.planning/missions/doing/${TARGET}/verification.jsonl` via
`scripts/log-verification.js` — that log feeds the evidence packet.

If any required level fails after the full retry protocol below (see
"Task Retry & Recovery"), the mission does NOT advance to review — it
stays in `doing/` so the next session can pick up where this one stopped.

### Step 4.5 — Adversarial review (L8) loop

After the L0–L7 verification pyramid passes for the active mission and
before generating the evidence packet, run the L8 cross-model review loop
when L8 is enabled. L8 sits above L7 deliberately: there is no point asking
Codex to review a diff that doesn't compile or pass tests.

**Conditional invocation.** Only run when both of these hold; otherwise
skip silently:

- `.dos-apes/codex-review-config.json` exists and `enabled === true`
- `scripts/codex-review-loop.js` is installed

```bash
L8_ENABLED=0
if [ -f ".dos-apes/codex-review-config.json" ] && [ -f "scripts/codex-review-loop.js" ]; then
  if node -e "process.exit(JSON.parse(require('fs').readFileSync('.dos-apes/codex-review-config.json','utf8')).enabled === true ? 0 : 1)" 2>/dev/null; then
    L8_ENABLED=1
  fi
fi

if [ "$L8_ENABLED" -eq 1 ]; then
  echo ""
  echo "Level 8: Adversarial Review (loop, mission ${TARGET})"
  echo "─────────────────────────────"
  # The loop is worktree-aware as of the Task 3 fix in codex-review.js
  # (findProjectRoot via `git rev-parse --git-common-dir`, plus a
  # diff range pinned to the mission's workspace.branch). Invoke from
  # any cwd inside the repo — main checkout, .worktrees/<id>, or CI —
  # the loop resolves PROJECT_ROOT and the diff branch itself. Do not
  # wrap this in `( cd .worktrees/<id> && ... )`: the wrapper would
  # mask future cwd-resolution regressions instead of surfacing them.
  node scripts/codex-review-loop.js --mission "$TARGET" --base main
  L8_LOOP_EXIT=$?
fi
```

The loop persists its terminal state into the mission's `codex`
frontmatter block (see `missions.md` "Codex review state" and
`cross-model-review.md` "Mission state surface"). It also writes
`.dos-apes/codex-reviews/result.json` for the audit trail and appends
a workpad entry for terminal states where a human reader benefits
(`partial-success`, `exhausted`, `no-progress`).

**Hard-stop on non-zero loop exit.** Exit `1` from the loop means
either a script-level failure (config parse, fs error, codex-review.js
crash) or the required-skip gate firing (mission has `codex.required:
true` but Codex was unavailable). Either way the mission is not ready
for review:

```bash
if [ "$L8_ENABLED" -eq 1 ] && [ "$L8_LOOP_EXIT" -ne 0 ]; then
  echo "apes-build: L8 loop exited ${L8_LOOP_EXIT}; mission ${TARGET} stays in doing/" >&2
  echo "apes-build: inspect the codex block (mission-cli show ${TARGET}) and .dos-apes/codex-reviews/result.json" >&2
  exit 1
fi
```

**Read the verdict from the mission file, not from loop stdout.** The
codex block on the mission's frontmatter is the single source of truth
for what L8 concluded. Reading it via `mission-cli show` keeps
`/apes-build`, `/apes-status`, `/apes-codex-review`, and any future
caller pointed at the same surface — no fragile pipe-parsing of loop
output.

```bash
if [ "$L8_ENABLED" -eq 1 ]; then
  CODEX_VERDICT=$(node scripts/mission-cli.js show "$TARGET" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const fm = JSON.parse(s).frontmatter || {};
      console.log((fm.codex && fm.codex.last_verdict) || "none");
    });
  ')
fi
```

**Branching on `codex.last_verdict`.** The actions per terminal are
unchanged from M-0004 — only the input source moved (mission file
instead of loop stdout). The states themselves are M-0005's
six-terminal set; see `cross-model-review.md` for definitions.

| `codex.last_verdict`    | Action                                                                                                                                                                  |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `accepted`              | Continue to Step 5 (generate evidence packet). The L8 entry is already in the mission's `verification.jsonl`.                                                           |
| `partial-success`       | Continue to Step 5. Only low/medium findings remain — those are explicitly out of the loop's scope; the human reviewer addresses them.                                  |
| `findings-reported`     | Continue to Step 5. This state only fires when `--no-fix` was set, which `/apes-build` does NOT pass. If you see it here, something else passed `--no-fix` upstream — surface to the user. |
| `exhausted`             | **Mark the mission unresolved**, then continue to Step 5. The packet must include the open findings; do not silently swallow them.                                      |
| `no-progress`           | **Mark the mission unresolved**, then continue to Step 5. Claude Code couldn't make a fix — surface explicitly so the human reviewer sees it.                           |
| `skipped`               | Soft warning, continue to Step 5. (`codex.required: true` would have made the loop exit non-zero already, caught by the hard-stop above — so reaching `skipped` here means the mission did not require L8.) |
| `none` (no codex block) | The loop didn't write a verdict — typically because L8 is disabled, was skipped before any review ran, or the loop never executed. Continue to Step 5 silently.         |

**Mark unresolved** (used by `exhausted` and `no-progress`):

```bash
node scripts/mission-cli.js update "$TARGET" --field codex_findings_unresolved=true
```

This top-level boolean flag is preserved for backward compatibility
with reviewers, dashboards, and queries that look for it. New tooling
should prefer reading `codex.last_verdict` and `codex.unresolved_findings`
directly from the codex block — they carry the same signal at higher
fidelity.

The mission still moves to `review/` in Step 5. The flag plus the codex
block together signal to the human reviewer that L8 didn't reach a
clean verdict — the evidence packet will pick up the open findings list
via `codex.last_review_path`, and the reviewer decides whether to
address them, accept the residual risk, or push back to `doing/`.

**Why continue to packet generation in every case.** The packet is the
audit artifact — the goal is "what did this mission produce, what was
verified, what wasn't." Refusing to generate it because L8 is unsatisfied
hides information rather than surfacing it. L8's role is "another set of
eyes," not "blocker." The human reviewer has the final say.

### Step 5 — Generate evidence and submit for review

Once all `verification.required_levels` show `pass` in the latest log
entry per level:

```bash
node scripts/evidence-packet.js generate "$TARGET"
```

The generator refuses if any required level is missing or failing — that
is the moat. If it refuses, the mission is not ready; loop back to Step 4.

After a successful packet:

```bash
node scripts/mission-cli.js move "$TARGET" review
git commit -m "mission(${TARGET}): doing → review"
```

The CLI moves both the .md file and the per-mission directory, bumps
`state` and `updated`, and stages the rename. Then clear the
active-mission marker so the next invocation starts clean:

```bash
node scripts/mission-cli.js clear-active
```

Print a completion summary with the mission ID, branch, and the path to
the evidence packet (`.planning/missions/review/${TARGET}/evidence/summary.md`).

### Step 6 — Continue the loop (Ralph mode only)

If `--ralph` was supplied AND there is at least one more mission with all
dependencies satisfied (including any missions that just landed in `done/`
during this run), go back to Step 1's "no flags" branch and pick the next
target. Stop when:

- `todo/` has no unblocked missions, OR
- A mission fails to advance out of `doing/` after exhausting retries, OR
- `--max-iterations` is exhausted across the cumulative mission run.

### Error paths and cleanup

Every failure that aborts the run MUST clean up `.planning/active-mission`
so the next session is not falsely anchored to a half-baked mission:

```bash
trap 'node scripts/mission-cli.js clear-active >/dev/null 2>&1 || true' EXIT
```

(Or its equivalent in the agent's flow control — the contract is
"active-mission is removed on any abort.")

Specific failure messages, all exit non-zero:

| Condition                                              | Message                                                        | Cleanup                                  |
|--------------------------------------------------------|----------------------------------------------------------------|------------------------------------------|
| `--mission` ID does not match any mission file         | `apes-build: mission <id> not found`                           | active-mission untouched (was never set) |
| Mission already in `doing/` or `review/`               | `apes-build: mission <id> is already in <state>`               | unchanged                                |
| Mission in `done/` or `canceled/`                      | `apes-build: mission <id> is in <state>; immutable`            | unchanged                                |
| Unmet dependencies                                     | `apes-build: mission <id> blocked by: M-XXXX, M-YYYY`          | unchanged                                |
| Worktree path collision                                | `apes-build: worktree .worktrees/<id> already exists — run \`node scripts/mission-worktree.js remove <id>\` after confirming no work is in flight` | mission stays in `todo/`; active-mission cleared |
| Required verification level fails after retries       | `apes-build: mission <id> stuck in doing — required level(s) <levels> failing`  | active-mission cleared; mission stays in `doing/` |
| `--mission` combined with `--prd` or `--idea`         | `apes-build: --mission is mutually exclusive with --prd and --idea`             | nothing was done                          |
| Empty `todo/` (no flags supplied)                     | `apes-build: no unblocked missions in todo/ — create one with /apes-mission new` | nothing was done                          |
| `--ralph` reaches end of queue                        | (informational — print summary, exit 0)                                          | active-mission cleared                    |

When a run aborts mid-flight, the user can recover by:

1. Running `/apes-status` to see which mission is in `doing/` and what
   blockers remain.
2. Inspecting `.planning/missions/doing/<id>/verification.jsonl` for the
   most recent failures.
3. Either fixing the issue and re-running `/apes-build --mission <id>`,
   or transitioning the mission to `canceled/` via
   `/apes-mission move <id> canceled`.

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
- **Delete remote branches** — never delete a remote branch yourself, including merged feature branches (denied by policy, no exceptions); ask the human to do it
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

### Analyze Requirements (Product Agent)

Before the architect designs anything, the lead loads `skills/product.md` and analyzes the PRD:

```
1. Read .planning/PROJECT.md for domain context (product vision, target users, success criteria
   captured during install). Use this to inform priority classification.

2. Parse the PRD/idea into a structured task backlog:
   - Extract every stated requirement with priority (P0/P1/P2)
   - Identify happy paths, edge cases, and error states
   - Write acceptance criteria in GIVEN/WHEN/THEN format for each requirement

3. Flag ambiguous requirements that need human clarification:
   - Vague adjectives ("fast", "intuitive", "seamless")
   - Missing specifics ("support multiple formats" — which formats?)
   - Implicit assumptions not stated in the PRD
   → If any P0 requirements are ambiguous, PAUSE and ask the human before proceeding.

4. Output the structured backlog to .planning/BACKLOG.md:

   ## [Requirement Name] (P0)
   **What:** [capability]
   **Who:** [user/actor]
   **Why:** [business value]
   ### Acceptance Criteria
   - GIVEN [context] WHEN [action] THEN [outcome]
   - GIVEN [context] WHEN [action] THEN [outcome]

   Repeat for each requirement, grouped by priority.
```

This backlog feeds into PHASE 2 — every task created via Tasks API must trace back to a requirement here.

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

The architect teammate loads `skills/architecture.md` and designs the phase. The lead loads `skills/orchestration.md` to plan execution.

For Phase 1 (Foundation), typically:

- Project scaffolding
- Core data models
- Basic API structure
- Initial UI shell

### Create Tasks via Tasks API

Every task must include acceptance criteria from the BACKLOG.md analysis, a verification approach, and a role assignment per `skills/orchestration.md`:

Use TaskCreate to define tasks with dependencies:

```
TaskCreate: "Project Scaffolding"
  description: "Initialize project with Vite + React + TypeScript.
    Configure ESLint, Prettier, TypeScript strict. Set up folder structure."
  acceptance: "GIVEN a fresh repo WHEN npm run build is executed THEN it exits 0"
  verify: "npm run build passes"
  role: builder

TaskCreate: "Core Data Models"
  description: "Define TypeScript types and database schema."
  acceptance: "GIVEN the type definitions WHEN npm run typecheck runs THEN zero errors"
  verify: "npm run typecheck passes"
  role: builder
  blockedBy: ["Project Scaffolding"]

TaskCreate: "UI Shell"
  description: "Create layout component, routing, and basic page structure."
  acceptance: "GIVEN the app WHEN navigating to each route THEN the page renders without errors"
  verify: "npm run build passes, routes render"
  role: builder
  blockedBy: ["Project Scaffolding"]

TaskCreate: "[APPROVAL] Architecture Review"
  description: "PAUSE. Present architecture decisions to human for review.
    Do NOT mark complete until human confirms in chat."
  role: lead
  blockedBy: ["Core Data Models", "UI Shell"]

TaskCreate: "[GATE] Phase 1 Verification"
  description: "Run full verification pyramid (L0-L5). All must pass."
  role: tester
  blockedBy: ["[APPROVAL] Architecture Review"]

TaskCreate: "[GATE] UI Smoke Test"
  description: "If playwright.config exists: start dev server, run E2E smoke tests,
    verify pages render and navigation works. Load skills/browser-verification.md.
    If no Playwright config: use Playwright MCP tools to open the app, navigate major
    routes, verify no errors. Mark completed with evidence (test output or screenshots)."
  role: tester
  blockedBy: ["[GATE] Phase 1 Verification"]
```

The lead should identify execution waves and determine parallel vs sequential execution based on dependency analysis patterns in `skills/orchestration.md`.

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
           - Attempt 2→3 BRIDGE: Capability gap detection
             Ask: "What capability is missing — tool, abstraction, or documentation?"
             IF a gap is identified:
               Create a sub-task to build the missing capability
               Log the gap in .planning/MEMORY.md:
                 "## Capability Gap: [description] — resolved by [sub-task]"
               Complete the sub-task, then retry the original task
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
