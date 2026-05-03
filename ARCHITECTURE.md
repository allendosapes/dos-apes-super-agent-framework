# Dos Apes Framework — Architecture v3

## Executive Summary

**What it does:** Takes a PRD → ships complete, tested product autonomously using Claude Code Agent Teams.

**Core mechanism:** 12 skills, role-based agent spawning, gate-enforced task state machine, 9-level verification pyramid (L0–L8 with opt-in cross-model review), acceptance criteria verification loop, hook-enforced quality gates.

**Key shift from v2:** Added product analysis and orchestration roles. Tasks now follow a gate-enforced state machine (BACKLOG → MERGED). Every acceptance criterion must have a passing test before a task can be verified. The installer captures richer project context (product description, deployment target, testing strategy).

---

## Architecture Overview

```
                       ┌─────────────────────────┐
                       │   PRD / Idea / Mission   │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │   /apes-build (lead)    │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  MISSION RESOLUTION      │
                       │  • PRD → generate todos  │
                       │  • --mission → resolve   │
                       │  • (none) → top of todo  │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  WORKSPACE ISOLATION     │
                       │  scripts/mission-worktree│
                       │  → .worktrees/M-NNNN/    │
                       └────────────┬────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐    ┌─────────▼─────────┐    ┌────────▼────────┐
   │    INGEST       │    │     PLAN          │    │    EXECUTE      │
   │ Product agent   │    │ Orchestrator      │    │ Build loop      │
   │ parses PRD →    │    │ creates tasks     │    │ per task with   │
   │ BACKLOG.md      │    │ with gates        │    │ state machine   │
   └─────────────────┘    └───────────────────┘    └────────┬────────┘
                                                            │
                       ┌───────────────────────────────────┤
                       │                                   │
            ┌──────────▼──────────┐               ┌────────▼─────────┐
            │  HOOKS (automatic)  │               │  VERIFICATION    │
            │ • guard main branch │               │ 9-level pyramid  │
            │ • TypeScript check  │               │ + acceptance     │
            │ • test on edit      │               │   criteria loop  │
            │ • structure check   │               │ + JSONL log per  │
            │ • auto-review(Stop) │               │   active mission │
            └─────────────────────┘               └────────┬─────────┘
                                                           │
                                            ┌──────────────▼─────────────┐
                                            │  EVIDENCE PACKET           │
                                            │  scripts/evidence-packet   │
                                            │  → review/M-NNNN/evidence/ │
                                            └──────────────┬─────────────┘
                                                           │
                                            ┌──────────────▼─────────────┐
                                            │  GIT WORKFLOW              │
                                            │  Branch → Commit → Tag →   │
                                            │  state mv → Merge to main  │
                                            └────────────────────────────┘
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
| `/apes-verify` | tester | Run 9-level verification pyramid (L0–L8) |
| `/apes-codex-review` | reviewer | L8 cross-model review (Codex CLI). `--loop` for review-fix-review feedback loop |
| `/apes-test-e2e` | tester | Generate Playwright tests from stories |
| `/apes-test-visual` | tester | Screenshot comparison against baselines |
| `/apes-test-a11y` | tester | WCAG 2.1 AA compliance audit |
| `/apes-security-scan` | reviewer | npm audit + secrets + OWASP checks |
| `/apes-board` | — (lead only) | Kanban board with critical path |
| `/apes-gc` | reviewer | Codebase garbage collection sweep |
| `/apes-status` | — (lead only) | Show progress and git state |
| `/apes-metrics` | — (lead only) | Session and project metrics |
| `/apes-help` | — (lead only) | Command reference |

### 2. Skills (11)

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

## Mission Layer

The mission layer sits between strategic planning (roadmap phases) and tactical execution (the verification pyramid). A **mission** is the atomic unit of work — one focused outcome with its own acceptance criteria, verification requirements, and audit trail.

### Mission file as filesystem state machine

Missions live as single markdown files at `.planning/missions/<state>/M-NNNN-<slug>.md`. The five state directories — `todo`, `doing`, `review`, `done`, `canceled` — *are* the state machine. Transitions happen via `git mv`, so the audit trail is reconstructed from `git log --follow`. There is no separate state database.

```
.planning/missions/
├── todo/        ← created, not yet started
├── doing/       ← actively being implemented (one worktree per mission)
├── review/      ← evidence packet generated, awaiting human review
├── done/        ← merged, immutable
└── canceled/    ← abandoned (record kept)
```

Each mission file has YAML frontmatter (machine-readable: id, state, dependencies, required verification levels, workspace branch) and a markdown body (`## Context`, `## Implementation notes`, `## Out of scope`, `## Workpad`). The workpad is append-only — the running log of what every agent did, with timestamped entries that survive across sessions.

### Workspace isolation via worktrees

Every `doing` mission runs in its own git worktree at `.worktrees/M-NNNN/`, on its own branch (`feat/m-nnnn-<slug>`). This unlocks parallel missions on the same repo without working-tree thrash and lets a mission survive across Claude Code sessions, machine reboots, and human takeover. Worktrees are managed by `scripts/mission-worktree.js` (zero-dep, pure Node, no shell). The script enforces git ≥ 2.20, validates mission ID format, sanitizes paths, and refuses to remove a worktree with uncommitted changes or whose mission isn't in `done`/`canceled`.

### Evidence packets — proof of work for review

When a mission is ready for review, `scripts/evidence-packet.js` assembles a single bundle at `.planning/missions/review/M-NNNN/evidence/`:

- `summary.md` — cover sheet (acceptance status, verification table, diff stats, links)
- `verification.jsonl` — full structured log of every verification run (level, outcome, duration, summary, freeform details)
- `diff-stats.txt` + `diff.patch` — what changed against `main`
- `auto-review.md` — most recent L0.5 auto-review output
- `screenshots/` — L7 visual artifacts when present

The generator **refuses** to produce a packet if any level in the mission's `verification.required_levels` lacks a passing entry. This is the validation moat: a mission cannot reach review without verifiable evidence that every required gate passed.

### Verification log — the source of truth

Each verification script (`check-coverage.sh`, `check-secrets.sh`, etc.) appends a JSONL record to `.planning/missions/<state>/M-NNNN/verification.jsonl` via `scripts/log-verification.js`. The helper resolves the active mission from `.planning/active-mission` (a single-line file, set when a mission moves to `doing`) and degrades gracefully — if no active mission, it warns to stderr and exits zero so the verification pipeline never blocks on logging.

Schema:

```json
{
  "timestamp": "2026-04-30T15:23:01Z",
  "level": "L2",
  "level_name": "Unit Tests",
  "outcome": "pass",
  "duration_ms": 12340,
  "details": { "runner": "vitest", "count": 47 },
  "summary": "All 47 unit tests passed"
}
```

### State transition gates

| Transition           | Gate                                                                               |
|----------------------|------------------------------------------------------------------------------------|
| todo → doing         | Every `depends_on` mission is in `done/`                                           |
| doing → review       | Every level in `verification.required_levels` has a `pass` entry; evidence packet exists |
| review → done        | Evidence packet exists; reviewer has approved                                      |
| review → doing       | Allowed (rejected revision); workpad records the rejection reason                  |
| any → canceled       | Allowed except from `done`; workpad records the cancellation reason                |

Gates are enforced by the slash commands (`/apes-mission move`, `/apes-build`) and by the evidence-packet generator. A mission cannot skip `review`, and `done` is terminal.

### Relationship to roadmap phases

Phases (`.planning/ROADMAP.md`) are *strategic*; missions are *tactical*. A mission may claim a phase via the optional `phase` frontmatter field, but standalone missions are first-class — bug fixes and quick wins don't need a phase. The phase field is informational only; execution doesn't consult it.

---

## Library Layer (`framework/lib/`)

Underneath the scripts that operate on mission state lives a small library
of pure Node modules. The library is the **canonical interface for mission
operations** — every script that reads, writes, transitions, or scaffolds
a mission goes through it. Inline `node -e` blocks in commands and ad-hoc
regex parsers in scripts have been retired in favor of one tested API.

| Module | Responsibility |
|--------|----------------|
| `mission-schema.js` | Frozen constants (`STATES`, `LEVEL_IDS`, `CURRENT_SCHEMA_VERSION`), frontmatter validation, and the migration framework. No I/O. |
| `mission-parser.js` | Frontmatter ↔ body splitting, scalar/list/nested-field accessors, acceptance-checkbox parsing, workpad-entry parsing. No I/O. |
| `mission-tracker.js` | The `MissionTracker` class — identity (ID generation, lookup), state (FSM-validated transitions, list-by-state), dependencies (unmet/cycles), workpad (timestamped append), active-mission (read/write/clear), verification-log path resolution, and authoring (`createMission`). |

**Schema versioning.** Every mission carries an implicit `schema_version`.
Today the framework ships at version 1, with no prior versions to migrate
from — the migration shape exists so future field additions or shape
changes can land without rewriting callers. Bumping
`CURRENT_SCHEMA_VERSION` and appending a `{ from, to, migrate(fm) }`
record to `MIGRATIONS` is the only change required to introduce a new
schema version; `migrateFrontmatter` walks the chain automatically.

**Library principles** (documented at the top of `mission-tracker.js`):

- All filesystem operations are synchronous — the framework's hooks run
  synchronously, and the tracker must compose with them.
- Every write is validated by `mission-schema.validateFrontmatter` before
  touching disk.
- `id` is immutable once a mission exists; mutation methods reject
  attempts to change it.
- The library calls `git mv` (which stages the rename) but **never
  creates commits, branches, tags, or worktrees**. Commit boundaries
  belong to the caller.
- Zero npm dependencies. Pure Node built-ins.

**Pluggable storage backends.** The current `MissionTracker` reads and
writes mission files on the local filesystem under `.planning/missions/`.
The same API surface — `findMissionById`, `listMissionsByState`,
`moveMissionState`, `appendWorkpadEntry`, etc. — is shaped to admit
alternative backends without changing callers. A future Linear or GitHub
Issues adapter would implement the same methods against a remote source
of truth, leaving every script and command in place. No backend other
than the filesystem ships today; the section flags the intent so the
abstraction is preserved as the library grows.

**Programmatic CLI.** `framework/scripts/mission-cli.js` is a thin
wrapper that exposes every `MissionTracker` verb as a subcommand
(`list`, `show`, `next-id`, `move`, `workpad`, `update`, `deps`,
`active`, `set-active`, `clear-active`, `create`, `can-transition`).
Every verb prints exactly one JSON object on stdout; errors prefix
`mission-cli:` to stderr. Exit codes: `0` ok, `1` invalid input, `2`
not found, `3` precondition failed. Slash-command bodies and external
tooling call this script instead of hand-rolling Node snippets.

---

## Verification Pyramid (9 Levels)

```
┌─────────────────────────────────────────────────────────────┐
│ L8: Adversarial Review │ Cross-model review via Codex CLI    │
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
- L8: **External** — requires Codex CLI; opt-in; **fails open** (never blocks)

### External Reviewers (L8)

L8 introduces a new pattern: a *second* model reviews the diff produced by the *first*. The current implementation uses OpenAI's Codex CLI as the reviewer; the surrounding contracts (config schema, prompt template, findings schema, consumer protocol) are model-agnostic, so the reviewer is replaceable without touching the framework.

**Architectural properties:**

| Property              | Why                                                                                              |
|-----------------------|--------------------------------------------------------------------------------------------------|
| Opt-in                | The framework must remain fully functional without an external CLI dependency. Default off.     |
| Capability-gated      | `scripts/codex-check.js` runs an actual `--output-schema` round-trip and caches the result for 24h, keyed on model. The structured-findings parser depends on the contract holding. |
| Fails open            | Any L0–L7 success must end in a green pyramid verdict regardless of L8 state (offline, disabled, rate-limited). L8 produces evidence, not gates. |
| Severity-gated loop   | `scripts/codex-review-loop.js` only re-iterates on high/critical findings (configurable). Low/medium are reported but never auto-fixed. |
| Six terminal states   | `accepted`, `partial-success`, `findings-reported`, `exhausted`, `no-progress`, `skipped` — each maps to a distinct downstream action in `/apes-verify` and `/apes-build`. |
| Cross-platform stdin  | The loop passes prompts via positional args under ~7KB and switches to spawnSync stdin (`-`) above that threshold to clear the Windows cmd.exe argv ceiling — uniform across PowerShell/cmd/bash. |

**Files involved:**

- `scripts/codex-check.js` — prerequisite verifier
- `scripts/codex-review.js` — single-shot review primitive
- `scripts/codex-review-loop.js` — review-fix-review loop driver
- `framework/skills/cross-model-review.md` — consumer protocol (triage / fix / terminal states)
- `framework/commands/apes-codex-review.md` — slash command (single-shot, `--loop`, `--enable`/`--disable`/`--status`)
- `.dos-apes/codex-review-{config.json,prompt.md,schema.json}` — runtime artifacts (per-project, BOM-free)
- `.dos-apes/codex-capabilities.json` — capability cache (24h TTL, keyed on model)

The mission verification log (`log-verification.js`) recognizes `L8` as `Adversarial Review` so L8 results land in `verification.jsonl` alongside the other levels — the evidence-packet generator's required-levels check sees it like any other.

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

## File Inventory (57 files)

```
framework/
├── settings.json                    # Hooks, permissions, MCP, env
├── lib/                             # Library layer — canonical mission API
│   ├── mission-schema.js            # Frozen constants + validation + migration
│   ├── mission-parser.js            # Frontmatter / body / acceptance / workpad parsing
│   └── mission-tracker.js           # MissionTracker — identity, state, deps, workpad, authoring
├── commands/                        # 18 slash commands
│   ├── apes-build.md                # Mission-aware build (now invokes L8 loop pre-packet)
│   ├── apes-feature.md
│   ├── apes-fix.md
│   ├── apes-refactor.md
│   ├── apes-map.md
│   ├── apes-mission.md              # Mission CRUD + state transitions
│   ├── apes-evidence.md             # Generate evidence packets
│   ├── apes-verify.md               # 9-level pyramid (L8 single-shot, fails open)
│   ├── apes-test-e2e.md
│   ├── apes-test-visual.md
│   ├── apes-test-a11y.md
│   ├── apes-security-scan.md
│   ├── apes-codex-review.md         # L8 — single-shot / --loop / --enable / --disable / --status
│   ├── apes-board.md
│   ├── apes-gc.md
│   ├── apes-status.md               # Mission-aware status dashboard
│   ├── apes-metrics.md
│   └── apes-help.md
├── skills/                          # 15 domain skills + README
│   ├── architecture.md
│   ├── backend.md
│   ├── frontend.md
│   ├── testing.md                   # Verification log schema + 4 enforcement tiers
│   ├── browser-verification.md
│   ├── design-integration.md
│   ├── review.md
│   ├── product.md
│   ├── orchestration.md
│   ├── observability.md
│   ├── devops.md
│   ├── missions.md                  # Mission file format and lifecycle
│   ├── worktrees.md                 # Worktree management for missions
│   ├── evidence-packets.md          # Evidence packet format
│   ├── cross-model-review.md        # L8 consumer protocol
│   └── README.md
├── scripts/                         # 19 hook + helper scripts
│   ├── guard-main-branch.sh
│   ├── hook-format-and-stage.sh
│   ├── hook-typecheck.sh
│   ├── hook-test-related.sh
│   ├── track-modified-files.sh
│   ├── check-coverage.sh            # Logs to active mission's verification.jsonl
│   ├── check-secrets.sh             # Logs to active mission's verification.jsonl
│   ├── check-doc-drift.sh           # Logs to active mission's verification.jsonl
│   ├── check-task-gates.sh
│   ├── check-structure.sh
│   ├── metrics-init.sh
│   ├── metrics-update.sh
│   ├── mission-cli.js               # Thin CLI wrapper around MissionTracker (JSON I/O)
│   ├── mission-worktree.js          # Worktree create/sync/remove/list (Node, zero-dep)
│   ├── log-verification.js          # Recognizes L0–L8; graceful when no active mission
│   ├── evidence-packet.js           # Generate the proof-of-work bundle
│   ├── codex-check.js               # L8 — prerequisite check + capability cache
│   ├── codex-review.js              # L8 — single-shot review primitive
│   └── codex-review-loop.js         # L8 — review-fix-review loop driver
├── ci/                              # 3 CI workflows
│   ├── weekly-quality.yml
│   ├── dependency-audit.yml
│   └── post-merge-verify.yml
└── templates/                       # 13 templates
    ├── CLAUDE-TEMPLATE.md
    ├── PRD-TEMPLATE.md
    ├── ROADMAP-TEMPLATE.md          # Phases + auto-tracked missions
    ├── mission-template.md          # Canonical mission file format
    ├── adr-template.md
    ├── execplan-template.md
    ├── architecture-rules-template.md
    ├── pipeline-test-scenario.md
    ├── multi-repo-config.json
    ├── codex-review-config.json     # L8 config template (copied to .dos-apes/ on init)
    ├── codex-review-config.README.md
    ├── codex-review-prompt.md       # Reviewer prompt template (placeholders)
    └── codex-review-schema.json     # JSON schema for Codex structured output
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
| 3.3.0 | 2026-05 | Refactor: extracted MissionTracker to `framework/lib/`. No behavior changes. Schema versioning introduced (`schema_version: 1`, migration framework in place but no migrations needed yet). All five mission-touching scripts and four mission-touching commands now route through the library. New `mission-cli.js` thin wrapper for JSON-shaped programmatic access. |
| 3.2.0 | 2026-05 | Added L8 Adversarial Review via Codex CLI (gpt-5.5) with feedback loop. Opt-in, fails open. New skill (cross-model-review), new command (/apes-codex-review), three new scripts (codex-check / codex-review / codex-review-loop), four new templates. log-verification.js recognizes L8. /apes-verify and /apes-build invoke L8 when enabled. |
| 3.1.0 | 2026-05 | Mission layer: filesystem state machine, isolated worktrees per mission, structured verification log (JSONL), evidence packets, /apes-mission, /apes-evidence, mission-aware /apes-build and /apes-status |
| 3.0.0 | 2026-02 | Product/orchestration roles, gate-enforced state machine, acceptance criteria verification, 4 new skills, /apes-board, /apes-gc, ExecPlans, architecture boundary enforcement, enhanced installer |
| 2.0.0 | 2025-02 | Agent Teams rebuild, skills architecture, 8-level pyramid, hooks |
| 1.0.0 | 2025-02 | Initial release with 12 agents, 5-level verification |
