# Dos Apes Framework — Architecture v2

## Executive Summary

**What it does:** Takes a PRD → ships complete, tested product autonomously using Claude Code Agent Teams.

**Core mechanism:** Skills-based teammates, 8-level verification pyramid, hook-enforced quality gates, Tasks API for orchestration.

**Key shift from v1:** Replaced 12 hardcoded agents with 7 skill files on Claude Code's native Agent Teams platform. The framework is a playbook, not a runtime.

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
                    ┌─────────────┼─────────────┐
                    │             │             │
            ┌───────▼──────┐ ┌───▼────┐ ┌──────▼───────┐
            │   PLAN       │ │ TEAM   │ │   EXECUTE    │
            │ Tasks API    │ │ Agent  │ │ Build loop   │
            │ creates deps │ │ Teams  │ │ per task     │
            └──────────────┘ └────────┘ └──────┬───────┘
                                               │
                          ┌────────────────────┤
                          │                    │
              ┌───────────▼──────────┐ ┌───────▼───────────┐
              │   HOOKS (automatic)  │ │   VERIFICATION    │
              │ • guard main branch  │ │ 8-level pyramid   │
              │ • TypeScript check   │ │ L0 → L7           │
              │ • test on edit       │ │ (see below)       │
              │ • track files        │ └───────┬───────────┘
              │ • auto-review (Stop) │         │
              └──────────────────────┘ ┌───────▼───────────┐
                                       │   GIT WORKFLOW    │
                                       │ Branch → Commit → │
                                       │ Tag → Squash →    │
                                       │ Merge to main     │
                                       └───────────────────┘
```

---

## Core Components

### 1. Slash Commands (13)

Commands are the entry points. Each assembles the right team and workflow.

| Command | Team Assembled | Workflow |
|---------|---------------|----------|
| `/apes-build` | architect + builder + tester + reviewer | Full PRD → product pipeline |
| `/apes-feature` | builder + tester | Plan → implement → test → commit |
| `/apes-fix` | debugger + tester | Reproduce → root cause → fix → verify |
| `/apes-refactor` | builder + reviewer | Preserve behavior → refactor → verify |
| `/apes-map` | analyst | Analyze codebase → generate context docs |
| `/apes-verify` | tester | Run 8-level verification pyramid |
| `/apes-test-e2e` | tester | Generate Playwright tests from stories |
| `/apes-test-visual` | tester | Screenshot comparison against baselines |
| `/apes-test-a11y` | tester | WCAG 2.1 AA compliance audit |
| `/apes-security-scan` | reviewer | npm audit + secrets + OWASP checks |
| `/apes-status` | — (lead only) | Show progress and git state |
| `/apes-metrics` | — (lead only) | Session and project metrics |
| `/apes-help` | — (lead only) | Command reference |

### 2. Skills (7)

Skills are domain knowledge files that teammates load. They replace v1's 12 agent definitions.

| Skill | File | Teaches |
|-------|------|---------|
| Architecture | `architecture.md` | System design, ADRs, tech decisions, scaling |
| Backend | `backend.md` | APIs, database, auth, business logic |
| Frontend | `frontend.md` | Components, state, routing, a11y, responsive |
| Testing | `testing.md` | TDD, coverage gates, 8-level pyramid |
| Browser | `browser-verification.md` | Playwright, visual regression, E2E gen |
| Design | `design-integration.md` | Figma MCP, design tokens, pixel validation |
| Review | `review.md` | Confidence-based code review, security audit |

### 3. Hook Scripts (7)

Deterministic quality enforcement. Fire regardless of agent behavior.

| Script | Hook Point | Purpose |
|--------|-----------|---------|
| `guard-main-branch.sh` | PreToolUse (Edit/Write) | Block edits on main |
| `track-modified-files.sh` | PostToolUse (Edit/Write) | Track files for auto-review |
| `check-coverage.sh` | Verify | Enforce 80% coverage |
| `check-secrets.sh` | Verify | Detect leaked secrets |
| `check-doc-drift.sh` | Verify | Warn on undocumented changes |
| `metrics-init.sh` | SessionStart | Initialize metrics JSON |
| `metrics-update.sh` | PostToolUse | Update file modification counts |

### 4. Settings.json Hooks

Additional hooks configured in settings.json (not separate scripts):

| Trigger | Action |
|---------|--------|
| PostToolUse: `*.ts`/`*.tsx` | Run `tsc --noEmit` |
| PostToolUse: `*.test.*` | Run related tests |
| PostToolUse: Edit/Write | Prettier format + git add |
| SessionStart | Print branch + roadmap status |
| Stop | Auto code review subagent |

### 5. CI Workflows (3)

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
| PROJECT.md | Vision, requirements | Once at init |
| ROADMAP.md | Phase breakdown, status | Per phase |
| MEMORY.md | Cross-session learnings | Continuously |

### Tasks API (Native)

Claude Code's Tasks API replaces v1's manual STATE.md and PLAN.md:
- Task creation with dependencies
- Status tracking (pending → in-progress → complete)
- Dependency resolution for parallel execution

---

## Separation of Concerns

| Layer | What | How |
|-------|------|-----|
| **Skills** | Teach | Domain knowledge, patterns, anti-patterns |
| **Commands** | Assemble | Team composition, workflow sequencing |
| **Hooks** | Enforce | Deterministic quality checks on every action |
| **Scripts** | Implement | The actual verification logic |
| **CI** | Schedule | Automated maintenance and quality sweeps |
| **Templates** | Scaffold | PRDs, ADRs, CLAUDE.md for new projects |

---

## File Inventory (35 files)

```
framework/
├── settings.json                    # Hooks, permissions, MCP, env
├── commands/                        # 13 slash commands
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
│   ├── apes-status.md
│   ├── apes-metrics.md
│   └── apes-help.md
├── skills/                          # 7 domain skills
│   ├── architecture.md
│   ├── backend.md
│   ├── frontend.md
│   ├── testing.md
│   ├── browser-verification.md
│   ├── design-integration.md
│   ├── review.md
│   └── README.md
├── scripts/                         # 7 hook scripts
│   ├── guard-main-branch.sh
│   ├── track-modified-files.sh
│   ├── check-coverage.sh
│   ├── check-secrets.sh
│   ├── check-doc-drift.sh
│   ├── metrics-init.sh
│   └── metrics-update.sh
├── ci/                              # 3 CI workflows
│   ├── weekly-quality.yml
│   ├── dependency-audit.yml
│   └── post-merge-verify.yml
└── templates/                       # 4 templates
    ├── CLAUDE-TEMPLATE.md
    ├── PRD-TEMPLATE.md
    ├── adr-template.md
    └── multi-repo-config.json
```

Plus: `bin/cli.js`, `package.json`, `assets/banner.txt`, `README.md`, `LICENSE`

---

## v1 → v2 Migration

| v1 | v2 | Rationale |
|----|-----|-----------|
| 12 agent definitions | 7 skill files | Skills are composable; agents were rigid |
| ORCHESTRATOR.md | CLAUDE.md + commands | Platform orchestrates; framework provides playbook |
| 6 standards files | Consolidated into skills | Reduce file count; skills teach patterns inline |
| 5 hook scripts | 7 scripts + settings.json hooks | More granular enforcement |
| 5-level verification | 8-level pyramid | Added coverage gate, auto-review, security, visual |
| Manual STATE.md | Tasks API | Native dependency tracking and status |
| XML-based PLAN.md | Tasks API | Platform handles task coordination |
| 10 slash commands | 13 slash commands | Added testing + metrics commands |
| ~50 files | 35 files | Less is more |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-02 | Agent Teams rebuild, skills architecture, 8-level pyramid, hooks |
| 1.0.0 | 2025-02 | Initial release with 12 agents, 5-level verification |
