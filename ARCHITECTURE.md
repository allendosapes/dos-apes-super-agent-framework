# Dos Apes Framework — Architecture v3

## Executive Summary

**What it does:** Takes a PRD → ships complete, tested product autonomously using Claude Code Agent Teams.

**Core mechanism:** 10 skills, role-based agent spawning, gate-enforced task state machine, 8-level verification pyramid, acceptance criteria verification loop, hook-enforced quality gates.

**Key shift from v2:** Added product analysis and orchestration roles. Tasks now follow a gate-enforced state machine (BACKLOG → MERGED). Every acceptance criterion must have a passing test before a task can be verified. The installer captures richer project context (product description, deployment target, testing strategy).

---

## Architecture Overview

```
                         ┌─────────────────┐
                         │   PRD / Idea     │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  /apes-build     │
                         │  (slash command) │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────▼───────┐ ┌────────▼────────┐ ┌────────▼────────┐
     │    INGEST       │ │     PLAN        │ │    EXECUTE       │
     │ Product agent   │ │ Orchestrator    │ │ Build loop       │
     │ parses PRD →    │ │ creates tasks   │ │ per task with    │
     │ BACKLOG.md      │ │ with gates      │ │ state machine    │
     └────────────────┘ └─────────────────┘ └────────┬────────┘
                                                      │
                          ┌──────────────────────────┤
                          │                          │
              ┌───────────▼──────────┐ ┌─────────────▼──────────┐
              │   HOOKS (automatic)  │ │   VERIFICATION          │
              │ • guard main branch  │ │ 8-level pyramid         │
              │ • TypeScript check   │ │ + acceptance criteria   │
              │ • test on edit       │ │   verification loop     │
              │ • structure check    │ │ + gate-enforced         │
              │ • auto-review (Stop) │ │   state transitions     │
              └──────────────────────┘ └─────────────┬──────────┘
                                       ┌─────────────▼──────────┐
                                       │   GIT WORKFLOW          │
                                       │ Branch → Commit → Tag → │
                                       │ Squash → Merge to main  │
                                       └────────────────────────┘
```

---

## Task State Machine

Every task follows this state flow. Each transition has a gate check enforced by `scripts/check-task-gates.sh`.

```
BACKLOG → READY → IN_PROGRESS → IN_REVIEW → IN_QA → VERIFIED → MERGED
```

| Transition | Gate | Enforced By |
|-----------|------|-------------|
| BACKLOG → READY | Has acceptance criteria + all blockers resolved | check-task-gates.sh |
| READY → IN_PROGRESS | Agent role assigned + branch exists | check-task-gates.sh |
| IN_PROGRESS → IN_REVIEW | L0 build + L1 types + L2 tests pass | check-task-gates.sh |
| IN_REVIEW → IN_QA | No critical review findings (confidence >= 90) | check-task-gates.sh |
| IN_QA → VERIFIED | All acceptance criteria have passing tests + coverage met | Tester agent |
| VERIFIED → MERGED | Full pyramid passes on merge branch | check-task-gates.sh |

---

## Role-Based Agent Teams

Each role loads specific skills and owns a bounded domain (see `skills/orchestration.md` for full details).

| Role | Skills Loaded | Owns |
|------|--------------|------|
| **Lead** | `product.md` + `orchestration.md` | Requirements analysis, task planning, coordination |
| **Architect** | `architecture.md` | System design, ADRs, interface contracts |
| **Builder** | `backend.md` + `frontend.md` + `devops.md` | Implementation + unit tests |
| **Tester** | `testing.md` + `browser-verification.md` + `observability.md` | Verification, coverage, E2E |
| **Reviewer** | `review.md` + `observability.md` | Code review, security audit |

**Role boundaries:** Product never writes code. Architect writes schemas and contracts, not implementation. Builder implements against Architect's contracts. Tester writes tests against Product's acceptance criteria. Reviewer reads and reports — never fixes directly.

---

## Core Components

### 1. Slash Commands (15)

Commands are the entry points. Each assembles the right team and workflow.

| Command | Team Assembled | Workflow |
|---------|---------------|----------|
| `/apes-build` | lead + architect + builder + tester + reviewer | Full PRD → product pipeline |
| `/apes-feature` | builder + tester | Plan → implement → test → commit |
| `/apes-fix` | debugger + tester | Reproduce → root cause → fix → verify |
| `/apes-refactor` | builder + reviewer | Preserve behavior → refactor → verify |
| `/apes-map` | analyst | Analyze codebase → generate context docs |
| `/apes-verify` | tester | Run 8-level verification pyramid |
| `/apes-test-e2e` | tester | Generate Playwright tests from stories |
| `/apes-test-visual` | tester | Screenshot comparison against baselines |
| `/apes-test-a11y` | tester | WCAG 2.1 AA compliance audit |
| `/apes-security-scan` | reviewer | npm audit + secrets + OWASP checks |
| `/apes-board` | — (lead only) | Kanban board with critical path |
| `/apes-gc` | reviewer | Codebase garbage collection sweep |
| `/apes-status` | — (lead only) | Show progress and git state |
| `/apes-metrics` | — (lead only) | Session and project metrics |
| `/apes-help` | — (lead only) | Command reference |

### 2. Skills (10)

Skills are domain knowledge files that teammates load. They replace v1's 12 agent definitions.

| Skill | File | Teaches |
|-------|------|---------|
| Architecture | `architecture.md` | System design, ADRs, ExecPlans, architecture rules |
| Backend | `backend.md` | APIs, database, auth, business logic |
| Frontend | `frontend.md` | Components, state, routing, a11y, responsive |
| Testing | `testing.md` | TDD, coverage gates, acceptance criteria verification |
| Browser | `browser-verification.md` | Playwright, visual regression, E2E gen |
| Design | `design-integration.md` | Figma MCP, design tokens, pixel validation |
| Review | `review.md` | Confidence-based code review, security audit |
| Product | `product.md` | PRD parsing, acceptance criteria, backlog structuring |
| Orchestration | `orchestration.md` | Agent roles, handoff contracts, parallel execution |
| Observability | `observability.md` | Structured logging, performance verification, health checks |
| DevOps | `devops.md` | Deployment pipelines, environments, platform config |

### 3. Hook Scripts (12)

Deterministic quality enforcement. Fire regardless of agent behavior.

| Script | Hook Point | Purpose |
|--------|-----------|---------|
| `guard-main-branch.sh` | PreToolUse (Edit/Write) | Block edits on main |
| `hook-format-and-stage.sh` | PostToolUse (Edit/Write) | Prettier format + git add |
| `hook-typecheck.sh` | PostToolUse (Edit/Write) | TypeScript check on .ts/.tsx files |
| `check-structure.sh` | PostToolUse (Edit/Write) | Architectural boundary enforcement |
| `hook-test-related.sh` | PostToolUse (Edit/Write) | Run related tests on .test.* files |
| `track-modified-files.sh` | PostToolUse (Edit/Write) | Track files for auto-review |
| `check-task-gates.sh` | Explicit (orchestrator) | State transition enforcement |
| `check-coverage.sh` | Verify | Enforce 80% coverage |
| `check-secrets.sh` | Verify | Detect leaked secrets |
| `check-doc-drift.sh` | Verify | Warn on undocumented changes |
| `metrics-init.sh` | SessionStart | Initialize metrics JSON |
| `metrics-update.sh` | PostToolUse | Update file modification counts |

### 4. CI Workflows (3)

GitHub Actions for scheduled quality enforcement:

| Workflow | Schedule | Pipeline |
|----------|----------|----------|
| `weekly-quality.yml` | Monday 3am | Build → typecheck → lint → test |
| `dependency-audit.yml` | Biweekly | npm audit → update → test verify |
| `post-merge-verify.yml` | On merge | Full verification pyramid |

---

## Verification Pyramid (8 Levels)

```
┌─────────────────────────────────────────────────────────────┐
│ L7: Visual Regression  │ Screenshot diff vs baselines       │
│ L6: E2E / Browser      │ Playwright + agent-browser          │
│ L5: Security Scan      │ npm audit + gitleaks + semgrep      │
│ L4: UI Integration     │ Component used in app?              │
│ L3: Integration Tests  │ API + E2E tests                     │
│ L2.5: Coverage Gate    │ 80% threshold (configurable)        │
│ L2: Unit Tests         │ Function-level tests                │
│ L1: Static Analysis    │ TypeScript + ESLint                 │
│ L0.5: Auto Review      │ Stop hook (fires automatically)     │
│ L0: Build              │ Does it compile?                    │
└─────────────────────────────────────────────────────────────┘
```

**Enforcement tiers:**
- L0–L2.5: **Deterministic** — hooks fire on every edit
- L3–L5: **Automated** — scripts run on verify
- L6–L7: **Comprehensive** — requires Playwright MCP configured

---

## Git Workflow

### Branch Strategy

```
main (protected by guard-main-branch.sh)
  ├── feat/phase-1-foundation    → squash merge
  ├── feat/phase-2-core          → squash merge
  └── feat/phase-3-polish        → squash merge
```

### Task-Level Tags

After each verified task:
```
git tag phase-1/task-1-complete
git tag phase-1/task-2-complete
```

Enables precise rollback: `git reset --hard phase-1/task-2-complete`

### Approval Gates

Tasks prefixed with `[APPROVAL]` block downstream work until human confirms in chat. Used for architecture decisions, design reviews, and deployment authorization.

---

## State Management

### .planning/ Directory

| File | Purpose | Update Frequency |
|------|---------|------------------|
| PROJECT.md | Vision, target users, success criteria | Once at init |
| ROADMAP.md | Phase breakdown, status | Per phase |
| BACKLOG.md | Structured requirements with acceptance criteria | Once at ingest |
| MEMORY.md | Cross-session learnings, capability gaps | Continuously |
| ARCHITECTURE_RULES.md | Dependency direction + boundary walls | Per architecture change |

### Tasks API (Native)

Claude Code's Tasks API replaces v1's manual STATE.md and PLAN.md:
- Task creation with dependencies and acceptance criteria
- Gate-enforced state transitions (BACKLOG → MERGED)
- Dependency resolution for parallel execution

---

## Separation of Concerns

| Layer | What | How |
|-------|------|-----|
| **Skills** | Teach | Domain knowledge, patterns, anti-patterns |
| **Commands** | Assemble | Team composition, workflow sequencing |
| **Hooks** | Enforce | Deterministic quality checks on every action |
| **Scripts** | Implement | The actual verification and gate logic |
| **CI** | Schedule | Automated maintenance and quality sweeps |
| **Templates** | Scaffold | PRDs, ADRs, ExecPlans, architecture rules, CLAUDE.md |

---

## File Inventory (44 files)

```
framework/
├── settings.json                    # Hooks, permissions, MCP, env
├── commands/                        # 15 slash commands
│   ├── apes-build.md
│   ├── apes-feature.md
│   ├── apes-fix.md
│   ├── apes-refactor.md
│   ├── apes-map.md
│   ├── apes-verify.md
│   ├── apes-test-e2e.md
│   ├── apes-test-visual.md
│   ├── apes-test-a11y.md
│   ├── apes-security-scan.md
│   ├── apes-board.md
│   ├── apes-gc.md
│   ├── apes-status.md
│   ├── apes-metrics.md
│   └── apes-help.md
├── skills/                          # 11 domain skills + README
│   ├── architecture.md
│   ├── backend.md
│   ├── frontend.md
│   ├── testing.md
│   ├── browser-verification.md
│   ├── design-integration.md
│   ├── review.md
│   ├── product.md
│   ├── orchestration.md
│   ├── observability.md
│   ├── devops.md
│   └── README.md
├── scripts/                         # 12 hook scripts
│   ├── guard-main-branch.sh
│   ├── hook-format-and-stage.sh
│   ├── hook-typecheck.sh
│   ├── hook-test-related.sh
│   ├── track-modified-files.sh
│   ├── check-coverage.sh
│   ├── check-secrets.sh
│   ├── check-doc-drift.sh
│   ├── check-task-gates.sh
│   ├── check-structure.sh
│   ├── metrics-init.sh
│   └── metrics-update.sh
├── ci/                              # 3 CI workflows
│   ├── weekly-quality.yml
│   ├── dependency-audit.yml
│   └── post-merge-verify.yml
└── templates/                       # 7 templates
    ├── CLAUDE-TEMPLATE.md
    ├── PRD-TEMPLATE.md
    ├── adr-template.md
    ├── execplan-template.md
    ├── architecture-rules-template.md
    ├── pipeline-test-scenario.md
    └── multi-repo-config.json
```

Plus: `bin/cli.js`, `package.json`, `assets/banner.txt`, `README.md`, `LICENSE`

---

## v2 → v3 Migration

| v2 | v3 | Rationale |
|----|-----|-----------|
| 7 skill files | 11 skills (+ product, orchestration, observability, devops) | Agents need product analysis, coordination patterns, runtime diagnosis, and deployment knowledge |
| Ad-hoc task tracking | Gate-enforced state machine (BACKLOG → MERGED) | Mechanical enforcement over documentation |
| Verification at end of phase | Verification at every state transition | Catch issues early, not at merge time |
| 13 slash commands | 15 commands (+ /apes-board, /apes-gc) | Kanban visibility and periodic codebase cleanup |
| 10 hook scripts | 12 scripts (+ check-task-gates.sh, check-structure.sh) | Gate enforcement and architectural boundary checking |
| 3-question installer | 6-question installer with project context | Product description, deployment target, testing strategy flow into generated files |
| No acceptance criteria loop | Every criterion must have a passing test | Closes the gap from product intent to verified implementation |
| 4 templates | 7 templates (+ execplan, architecture rules, pipeline test) | Richer scaffolding for builder handoffs and boundary enforcement |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2026-02 | Product/orchestration roles, gate-enforced state machine, acceptance criteria verification, 4 new skills, /apes-board, /apes-gc, ExecPlans, architecture boundary enforcement, enhanced installer |
| 2.0.0 | 2025-02 | Agent Teams rebuild, skills architecture, 8-level pyramid, hooks |
| 1.0.0 | 2025-02 | Initial release with 12 agents, 5-level verification |
