---
name: orchestration
description: Agent Teams orchestration patterns — role definitions, handoff
  contracts, parallel execution, capability gap detection, and state management.
  Load when leading a multi-agent build, coordinating teammates, or planning
  execution waves.
allowed-tools: Read, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList
---

# Orchestration Skill

## Agent Roles

Every orchestrated build assigns agents to one of five roles. Each role loads
specific skills and owns a bounded domain.

| Role | Owns | Loads |
|------|------|-------|
| Product | Requirements, acceptance criteria, backlog | `skills/product.md` |
| Architect | System design, ADRs, interface contracts | `skills/architecture.md` |
| Builder | Implementation + unit tests | `skills/backend.md`, `skills/frontend.md` |
| Tester | Verification, test plans mapped to criteria | `skills/testing.md`, `skills/browser-verification.md` |
| Reviewer | Code review, security audit, conventions | `skills/review.md` |

### Role Boundaries

- **Product** never writes code. Outputs task definitions and acceptance criteria only.
- **Architect** writes schemas, contracts, and ADRs — not implementation. Scaffolding (project init, config files) is the exception.
- **Builder** implements against contracts the Architect defined. Never invents new interfaces without Architect approval.
- **Tester** writes tests against acceptance criteria from Product. Never modifies source code — only test files.
- **Reviewer** reads and reports. Never fixes issues directly — creates follow-up tasks for Builder instead.

### When One Agent Wears Multiple Hats

For small tasks (single-story fixes, < 3 files), one agent may combine roles:
- Builder + Tester: Write implementation and tests together (TDD).
- Architect + Builder: Design and implement in one session when the scope is a single module.

Never combine Product + Builder (requirements author shouldn't implement) or Reviewer + Builder (reviewer shouldn't fix their own findings).

## Orchestration Patterns

### Fan-Out

Leader spawns N workers for parallel independent tasks.

```
         ┌─→ Builder A (API routes)
Leader ──┼─→ Builder B (UI components)
         └─→ Builder C (data models)
              │
         Leader merges results
```

**Use when:** A wave has 2+ tasks touching different files/directories.

**Rules:**
- Each worker gets its own worktree via `isolation: "worktree"`.
- Workers must not modify overlapping files — verify file domains before spawning.
- Leader waits for all workers, then merges branches and runs verification.
- If any worker fails, the leader diagnoses before retrying (see Capability Gap Detection).

### Pipeline

Agent A completes → unblocks Agent B → unblocks Agent C.

```
Product → Architect → Builder → Reviewer → Tester
```

**Use when:** Tasks have strict sequential dependencies — schema must exist before API, API before UI.

**Rules:**
- Each transition has a handoff gate (see Handoff Contracts below).
- The downstream agent does not start until the gate passes.
- Use `blockedBy` in Tasks API to enforce ordering.

### Map-Reduce

Multiple agents investigate in parallel, leader synthesizes findings.

```
         ┌─→ Explorer A (src/routes/)
Leader ──┼─→ Explorer B (src/services/)
         └─→ Explorer C (src/components/)
              │
         Leader synthesizes → creates unified plan
```

**Use when:** Codebase analysis, multi-file refactors, understanding a large unfamiliar project.

**Rules:**
- Each explorer gets a bounded search scope (directory, file pattern, or concern).
- Explorers return findings only — they never modify files.
- Leader resolves conflicts between findings and produces a single action plan.

### Specialist Handoff

One agent completes their domain expertise, passes artifact to the next specialist.

```
Architect (ADR + contracts)
  → Builder (implementation)
    → Reviewer (code review)
      → Tester (verification)
```

**Use when:** Standard feature development following the full lifecycle.

**Rules:**
- Each specialist produces a concrete artifact (ADR, code, review report, test results).
- The artifact is committed to the repo before handoff — not passed in memory.
- If the downstream specialist rejects the artifact (e.g., Reviewer finds critical issues), work returns to the upstream specialist with specific feedback.

## Handoff Contracts

Every role transition has a gate. Work does not proceed until the gate passes.

### Product → Architect

**Artifact:** Task backlog with acceptance criteria in Tasks API.

**Gate checklist:**
- [ ] Every task has >= 1 Given/When/Then acceptance criterion
- [ ] All criteria score >= 70 on testability confidence (see `skills/product.md`)
- [ ] P0 tasks have no unresolved ambiguity flags
- [ ] Dependencies form a valid DAG (no circular `blockedBy`)

**If gate fails:** Product agent rewrites criteria that scored < 70 or resolves flagged ambiguities with the user.

### Architect → Builder

**Artifact:** ADRs committed in `docs/architecture/` + interface contracts defined (types, API schemas, DB models).

**Gate checklist:**
- [ ] ADR exists for every significant technical decision
- [ ] Interface contracts (TypeScript types, API route signatures, DB schema) are committed
- [ ] Contracts match the acceptance criteria from Product
- [ ] L0 passes (project builds with the new contracts/types)

**If gate fails:** Architect revises contracts. Builder never starts against undefined interfaces.

### Builder → Reviewer

**Artifact:** Implementation on feature branch with passing L0–L2.5.

**Gate checklist:**
- [ ] L0: Build passes (no compile errors)
- [ ] L1: Type checks and lint pass
- [ ] L2: Unit tests pass
- [ ] L2.5: Coverage meets threshold (80%+ on changed files)
- [ ] Changes are committed on the feature branch

**If gate fails:** Builder fixes build/type/test failures before requesting review. Reviewer never reviews broken code.

### Reviewer → Tester

**Artifact:** Review report with confidence-scored findings (see `skills/review.md`).

**Gate checklist:**
- [ ] No findings with confidence >= 90 remain unresolved
- [ ] Findings with confidence 80-89 are acknowledged (fix or defer with justification)
- [ ] Review verdict is PASS or PASS WITH NOTES (not FAIL)

**If gate fails:** Builder addresses critical findings, then re-requests review. Tester never tests code with known critical issues.

### Tester → Orchestrator

**Artifact:** Test results with acceptance criteria mapping.

**Gate checklist:**
- [ ] Every acceptance criterion from Product has a corresponding test
- [ ] All applicable verification pyramid levels pass (per story type in `skills/product.md`)
- [ ] No test failures
- [ ] Coverage threshold met on all changed files

**If gate fails:** If tests fail due to bugs, create tasks for Builder. If tests fail due to missing test infrastructure, see Capability Gap Detection.

## Capability Gap Detection

When a task fails 2+ times, stop retrying and diagnose.

### The Diagnostic Question

> "What capability is missing — tools, abstractions, documentation?"

Do NOT ask "Why is the agent failing?" — that leads to blame. Ask what the system lacks.

### Diagnosis Categories

| Category | Signal | Example | Resolution |
|----------|--------|---------|------------|
| Missing tool | Agent can't perform a needed action | No database seed command exists | Create a seed script, add to `scripts/` |
| Missing abstraction | Agent repeats boilerplate across tasks | Every API route manually validates input | Create a validation middleware, document in CLAUDE.md |
| Missing documentation | Agent makes wrong assumptions | Uses wrong auth pattern because CLAUDE.md doesn't specify | Add the pattern to CLAUDE.md or relevant skill file |
| Missing test infrastructure | Tests can't verify the behavior | No test database configured | Create test DB setup script |

### Resolution Process

1. Create a sub-task: "Add [capability] to unblock [original task]".
2. Assign to the appropriate agent (usually Architect or Builder).
3. Block the original task on the capability sub-task.
4. After the capability is built, log it in `.planning/MEMORY.md`:

```markdown
## Capability Added: [name]
- **Date:** YYYY-MM-DD
- **Trigger:** [task] failed because [gap description]
- **Solution:** [what was built/documented]
- **Location:** [file path]
```

5. Retry the original task with the new capability available.

### Escalation

If diagnosis reveals a gap the agents cannot fill (e.g., missing API credentials, unclear business rules, hardware dependency), escalate to the user immediately. Do not retry.

## Parallel Execution Rules

### When to Parallelize (Worktrees)

Use parallel execution with `isolation: "worktree"` when ALL of these are true:

- Wave has **2+ tasks** ready to execute
- Tasks touch **different file domains** (different directories or file groups)
- Project is **past Phase 1** (skeleton is established)
- No shared resource conflicts (see "Never Parallel" below)

### When to Execute Sequentially

- **Phase 1 scaffolding** — Foundation must be built in order
- **Shared files** — Two tasks need the same file
- **Single task in wave** — No benefit to worktree overhead
- **Debugging** — Isolate variables by running one thing at a time

### Never Parallel

These file types cause merge conflicts when modified in parallel:

| File | Why |
|------|-----|
| `package.json` / lockfiles | Dependency changes conflict unpredictably |
| Shared type definitions (`types/index.ts`) | Multiple agents extending the same interface |
| Config files (`.env`, `next.config.js`) | Key ordering and value conflicts |
| Database schema (`prisma/schema.prisma`) | Migration ordering is sequential by design |
| `CLAUDE.md` | Conventions must be consistent, not merged |

If two tasks both need a shared file, make one `blockedBy` the other.

### Merge Protocol

After parallel workers complete:

1. Merge each worker branch into the phase branch (one at a time).
2. Run L0 (build) after each merge to catch integration issues early.
3. After all merges, run full verification (L0–L2.5 minimum).
4. If merge conflicts occur, resolve manually — do not auto-resolve.

## State Management

### Iron Rule

> **If it's not in the repo, it doesn't exist for agents.**

Agent memory is ephemeral. Conversation context compresses. The only durable state is what's committed to files.

### State Locations

| State | Location | Updated By |
|-------|----------|-----------|
| Task status and dependencies | Tasks API | All agents via `TaskCreate`, `TaskUpdate` |
| Phase progress | `.planning/ROADMAP.md` | Orchestrator at phase boundaries |
| Cross-session learnings | `.planning/MEMORY.md` | Any agent that discovers reusable knowledge |
| Rollback points | Git tags (`phase-N-complete`) | Orchestrator after phase verification |
| Technical decisions | `docs/architecture/ADR-NNN.md` | Architect |
| Project conventions | `CLAUDE.md` | Architect (with user approval) |

### Git Tag Protocol

Create tags at significant milestones for safe rollback:

```bash
git tag phase-1-complete    # After Phase 1 passes all gates
git tag phase-2-complete    # After Phase 2 passes all gates
git tag pre-refactor        # Before risky refactors
```

### Session Handoff

When ending a session (time limit, context exhaustion, user break):

1. Commit all work in progress (even partial — on a WIP branch).
2. Update task statuses in Tasks API.
3. Write session summary to `.planning/MEMORY.md`.
4. Use `/apes-handoff` to create a structured handoff document.

The next session uses `/apes-resume` to reload context from these files.

## Anti-Patterns

### Spawning Teammates for Sequential Work

Bad: Spawn 3 agents when tasks are strictly sequential (A → B → C).
The coordination overhead (worktree setup, merge, conflict resolution) exceeds the time saved.

Good: One agent executes the pipeline. Spawn teammates only when tasks are genuinely parallel.

### Skipping Handoff Gates

Bad: "We're behind schedule, skip the review and go straight to testing."
Skipping gates accumulates hidden defects. The cost of fixing bugs found late always exceeds the time "saved" by skipping early verification.

Good: If time is short, reduce scope (cut P2 tasks) rather than reduce quality (skip gates).

### Retry Without Diagnosis

Bad: Task fails → retry immediately → fails again → retry again → fails a third time.
Three identical failures means the approach is wrong, not unlucky.

Good: After 2 failures, invoke Capability Gap Detection. Diagnose what's missing before the third attempt.

### State in Agent Memory

Bad: "I remember from earlier that the auth pattern uses JWT."
Agent memory compresses and eventually disappears. The next session won't have this context.

Good: Write it to `CLAUDE.md` or `.planning/MEMORY.md`. Future sessions read the file.
