# Dos Apes Super Agent Framework

```
                       .:+*-.                                         .:+*-.
                      .*@@@@@%*:                                  ..+%@@@@@%:
                      +@@@@@@@@@%+.                             .-#@@@@@@@@@%.
                    .=%@@@@@@@@@@@@+.                         .-%@@@@@@@@@@@@#.
                   .*@@@@@@@@@@@@@@@@=.                     .:%@@@@@@@@@@@@@@@@-
                  .-:=*%%%#*-..=%@@@@@%:.                  .*@@@@@@*...+*#%%#+:-.
                 ..-%=....:-+=..:%@@@@@@@%+:..        ..-%@@@@@@@@#..-+-:....-#*..
             ..=@@%.=@#-+%@@-  .:@@@@@@@@@@@@%:.   ..#@@@@@@@@@@@@#.  .@@%*-*%%.+@@*..
           .-@@@@@@@-*=.:=.   .*@@@@@@@@@@@@@@@#. .+@@@@@@@@@@@@@@@%:.  .:=.:*.*@@@@@@*.
          .%@@@@@@@=.......  :#%@@@@@@@@@@@@@@@@%.-@@@@@@@@@@@@@@@@@%=. .......:@@@@@@@@=
         .%@@@@@@@%:.          .%@@@@@@@@@@@@@@@%:#@@@@@@@@@@@@@@@@-          ..%@@@@@@@@:
         =@@@@@@@@#::::=###*-..-@@@@@@@@@@@@@@@@%:*@@@@@@@@@@@@@@@@*. :*###*-:::-@@@@@@@@%.
         *@@@@@@@@@#.        .=%@@@@@@@@@@@@@@@@#.-@@@@@@@@@@@@@@@@@#.        .=@@@@@@@@@%:
        .%@@@@@@@@@@%+.    .+%@*%@@@@@@@@@@@@@@%: .#@@@@@@@@@@@@@@%*%@*..  ..-%@@@@@@@@@@@=
        .%@@@@@@@@@@@@@@@@@@@%:%@@@@@@@@@@@@@@@= ...%@@@@@@@@@@@@@@@*#@@@@@@@@@@@@@@@@@@@@=
        .%@@@@@@@@@@@@@@@@@@@-@@@@@@@@@@@@@@@@*..#=.-%@@@@@@@@@@@@@@@=+@@@@@@@@@@@@@@@@@@@=
         #@@@@@@@@@@@@@@@@@%.#@@@@@@@@@@@@@@@# .#@%-.=@@@@@@@@@@@@@@@@=*@@@@@@@@@@@@@@@@@@-
         +@@@@@@@@@@@@@@@@@-*@@@@@@@@@@@@@@@%:.*@@@@-.+@@@@@@@@@@@@@@@%.*@@@@@@@@@@@@@@@@%:
         =@@@@@@@@@@@@@@@@=:%@@@@@@@@@@@@@@%:.*@@@@@%..#@@@@@@@@@@@@@@@+:@@@@@@@@@@@@@@@@%.
         :%@@@@@@@@@@@@@@#.=@@@@@@@@@@@@@@@=.=@@@@@@@@:.#@@@@@@@@@@@@@@@.-@@@@@@@@@@@@@@@+
         .%@@@@@@@@@@@@@@-.%@@@@@@@@@@@@@@=.=@@@@@@@@@#.:@@@@@@@@@@@@@@@=.#@@@@@@@@@@@@@@:
          =@@@@@@@@@@@@@+ -@@@@@@@@@@@@@@*.-%@@@@@@@@@@%.:%@@@@@@@@@@@@@*.:@@@@@@@@@@@@@#.
          .%@@@@@@@@@@@%..#@@@@@@@@@@@@@+..%@@@@@@@@@@@@=.:@@@@@@@@@@@@@%..-@@@@@@@@@@@@=
           +@@@@@@@@@@@. .#@@@@@@@@@@@@#. :@@@@@@@@@@@@@*. -%@@@@@@@@@@@@: .#@@@@@@@@@@@.
           :%@@@@@@@@@=  :%@@@@@@@@@@@*.  .*@@@@@@@@@@@%-  .:%@@@@@@@@@@@+. .%@@@@@@@@@=
           .+@@@@@@@@%.  :%@@@@@@@@@@+.    .*@@@@@@@@@%:     :%@@@@@@@@@@#.  -@@@@@@@@#.
            .#@@@@@@@=.  :@@@@@@@@@@+.      .*@@@@@@@@-       .%@@@@@@@@@#. .:%@@@@@@@=.
             =@@@@@@@@@=.:%@@@@@@@@@#.       :@@@@@@@*.      .+@@@@@@@@@@#.:%@@@@@@@@#.
             .:#%@@@@@@@-.:#@@@@@@@@@-       .%@@@@@@-       .%@@@@@@@@%+ .%@@@@@@@%+.
```

## We ain't monkeying around with code!

**Feed it a PRD. Walk away. Come back to a shipped product.**

Dos Apes is a software engineering framework for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that turns ideas into production-ready applications. It uses Agent Teams for multi-agent orchestration, an 8-level verification pyramid for quality enforcement, and automated hooks for deterministic code review — so you can focus on product decisions while Claude handles the engineering.

```bash
npx dos-apes-super-agent
```

---

## Quick Start

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/getting-started) installed and authenticated
- Node.js 18+
- Git

### Install

```bash
# Navigate to your project (or create one)
mkdir my-app && cd my-app && git init

# Install the framework
npx dos-apes-super-agent
```

The installer will ask you:
1. **Install location** — This project (recommended) or global
2. **Project type** — Greenfield (new) or brownfield (existing)
3. **Tech stack** — Preset or custom (generates a tailored CLAUDE.md)

### Build Something

```bash
# Start Claude Code
claude

# Build from a PRD
/apes-build --prd requirements.md --ralph

# Or describe what you want
/apes-build --idea "Build a task management app with team collaboration"
```

### Add to an Existing Project

```bash
claude

/apes-map                                    # Analyze your codebase
/apes-feature "Add real-time notifications"  # Add a feature (single-phase)
/apes-fix "Login fails with special chars"   # Fix a bug
/apes-refactor "Extract API client layer"    # Refactor safely

# For multi-phase features with a PRD, use build (works for brownfield too)
/apes-build --prd feature-prd.md --ralph
```

---

## How It Works

Dos Apes is a **playbook, not a runtime**. It provides Claude Code with:

- **Slash commands** that assemble agent teams for specific workflows
- **Skills** that teach teammates domain expertise (architecture, testing, frontend, etc.)
- **Hook scripts** that enforce quality gates automatically on every file edit
- **CI workflows** that run scheduled quality sweeps

The platform (Claude Code Agent Teams + Tasks API) handles orchestration. Dos Apes defines *how to build software properly*.

### Build Flow

```
/apes-build --prd requirements.md --ralph
       │
       ▼
   INGEST ─── Parse PRD → PROJECT.md, ROADMAP.md
       │
       ▼
   PLAN ───── Break into phases → Create tasks via Tasks API
       │
       ▼
   TEAM ───── Assemble teammates: architect, builder, tester, reviewer
       │
       ▼
   BUILD ──── Each task: implement → verify → commit → tag
       │         │
       │         └─ Hooks fire on every edit:
       │              • TypeScript check on .ts files
       │              • Tests run on test file changes
       │              • Main branch protection
       │              • File tracking for auto-review
       │
       ▼
   VERIFY ─── 8-level pyramid (build → types → lint → tests →
       │       coverage → security → E2E → visual regression)
       │
       ▼
   BROWSER ── UI smoke test gate (Playwright or MCP fallback)
       │
       ▼
   MERGE ──── Squash merge to main, tag phase complete
       │
       ▼
   ITERATE ── More phases? Loop back to PLAN
       │
       ▼
   SHIP ───── PRODUCT_COMPLETE 🦍🦍
```

---

## Commands

### Build

| Command | Purpose |
|---------|---------|
| `/apes-build` | Full autonomous build from PRD to shipped product (works for greenfield and brownfield) |

### Brownfield

| Command | Purpose |
|---------|---------|
| `/apes-map` | Analyze existing codebase |
| `/apes-feature "desc"` | Add a single-phase feature (for multi-phase PRDs, use `/apes-build`) |
| `/apes-fix "desc"` | Test-first bug fix |
| `/apes-refactor "desc"` | Behavior-preserving refactor |

### Quality

| Command | Purpose |
|---------|---------|
| `/apes-verify` | Run 8-level verification pyramid |
| `/apes-test-e2e` | Generate and run E2E tests from user stories |
| `/apes-test-visual` | Visual regression screenshot testing |
| `/apes-test-a11y` | WCAG 2.1 AA accessibility audit |
| `/apes-security-scan` | Full security pipeline (npm audit, secrets, OWASP) |

### Info

| Command | Purpose |
|---------|---------|
| `/apes-status` | Show current position and progress |
| `/apes-metrics` | Session and project metrics dashboard |
| `/apes-help` | All commands with examples |

### Flags

| Flag | Effect |
|------|--------|
| `--ralph` | Autonomous iteration loop until complete |
| `--max-iterations N` | Limit iterations (default: 50, build: 500) |
| `--prd [file]` | Path to PRD document |
| `--idea "[text]"` | Describe what to build |

---

## Verification Pyramid

Every task must pass before commit. Hooks enforce L0–L2.5 automatically.

```
L7  Visual Regression    ← Screenshot diff against baselines
L6  E2E / Browser        ← Playwright + agent-browser
L5  Security Scan        ← npm audit + gitleaks + semgrep
L4  UI Integration       ← Component actually used in app?
L3  Integration Tests    ← API and E2E tests
L2.5 Coverage Gate       ← 80% threshold enforced
L2  Unit Tests           ← Function-level tests
L1  Static Analysis      ← TypeScript + ESLint
L0.5 Auto Code Review    ← Fires on every Stop (automatic)
L0  Build                ← Does it compile?
```

**L0–L2.5** are deterministic — hooks fire on every file edit regardless of agent behavior. **L3–L5** are automated via scripts. **L6–L7** run automatically when `playwright.config.ts/js` exists in your project. When Playwright isn't configured, the tester uses Playwright MCP tools as a fallback — opening the app, navigating routes, and taking screenshots for evidence. Either way, browser verification is part of every build and feature flow.

---

## Architecture

### Skills-Based Agent Teams

Instead of 12 hardcoded agents, Dos Apes uses 7 skill files that any teammate can load:

| Skill | Domain |
|-------|--------|
| `architecture.md` | System design, ADRs, tech decisions, scaling |
| `backend.md` | APIs, database, auth, business logic |
| `frontend.md` | Components, state, routing, accessibility |
| `testing.md` | TDD, coverage gates, 8-level pyramid |
| `browser-verification.md` | Playwright, visual regression, E2E |
| `design-integration.md` | Figma MCP, design tokens, pixel validation |
| `review.md` | Confidence-based code review, security audit |

Commands assemble the right team. `/apes-build` spawns architect + builder + tester + reviewer. `/apes-fix` spawns a focused debugger + tester pair.

### Hook Scripts (Deterministic Quality)

These fire automatically — no agent cooperation required:

| Hook | Trigger | Action |
|------|---------|--------|
| `guard-main-branch.sh` | PreToolUse (Edit/Write) | Blocks edits on main branch |
| `track-modified-files.sh` | PostToolUse (Edit/Write) | Tracks files for auto-review |
| `check-coverage.sh` | On verify | Enforces 80% coverage threshold |
| `check-secrets.sh` | On verify | Detects leaked secrets (gitleaks) |
| `metrics-init.sh` | SessionStart | Initializes metrics tracking |
| `metrics-update.sh` | PostToolUse | Updates file modification counts |
| `check-doc-drift.sh` | On verify | Warns when source changes without doc updates |

TypeScript checking, test running, and auto-formatting also fire as PostToolUse hooks (configured in `settings.json`). All PostToolUse hooks include safety nets (`|| true`) to prevent cascading failures when bash can't start (common on Windows).

### What Gets Installed

```
project-root/
├── CLAUDE.md                    # Project brain (generated for your stack)
├── .claude/
│   ├── commands/                # 13 slash commands
│   │   ├── apes-build.md
│   │   ├── apes-feature.md
│   │   ├── apes-fix.md
│   │   ├── apes-refactor.md
│   │   ├── apes-map.md
│   │   ├── apes-verify.md
│   │   ├── apes-test-e2e.md
│   │   ├── apes-test-visual.md
│   │   ├── apes-test-a11y.md
│   │   ├── apes-security-scan.md
│   │   ├── apes-status.md
│   │   ├── apes-metrics.md
│   │   └── apes-help.md
│   ├── skills/                  # 7 domain skills + README
│   │   ├── architecture.md
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── testing.md
│   │   ├── browser-verification.md
│   │   ├── design-integration.md
│   │   └── review.md
│   └── settings.json            # Hooks, permissions, MCP servers
├── scripts/                     # 10 hook scripts
│   ├── guard-main-branch.sh
│   ├── hook-format-and-stage.sh
│   ├── hook-typecheck.sh
│   ├── hook-test-related.sh
│   ├── track-modified-files.sh
│   ├── check-coverage.sh
│   ├── check-secrets.sh
│   ├── check-doc-drift.sh
│   ├── metrics-init.sh
│   └── metrics-update.sh
├── .planning/                   # Project state
│   ├── PROJECT.md
│   ├── ROADMAP.md
│   └── MEMORY.md
├── docs/templates/              # PRD and ADR templates
└── .github/workflows/           # CI workflow templates (optional)
    ├── weekly-quality.yml
    ├── dependency-audit.yml
    └── post-merge-verify.yml
```

---

## Git Workflow

Built-in branching strategy with hook-enforced main branch protection:

| Action | What Happens |
|--------|-------------|
| Phase start | Branch from main: `feat/phase-N-description` |
| Each task | Commit + git tag: `phase-N/task-M-complete` |
| Phase complete | Squash merge to main |
| Task rollback | `git reset --hard phase-N/task-M-complete` |
| Approval gates | `[APPROVAL]` tasks block until human confirms |
| Browser gate | `[GATE] UI Smoke Test` verifies app works in browser after each phase |

---

## CI Workflows (Optional)

Three GitHub Actions templates are installed to `.github/workflows/`:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `weekly-quality.yml` | Monday 3am | Full quality sweep: build, typecheck, lint, test |
| `dependency-audit.yml` | Biweekly | npm audit + auto-update with test verification |
| `post-merge-verify.yml` | On merge to main | Full verification pyramid after every merge |

Skip with `npx dos-apes --no-ci`.

---

## Configuration

### settings.json

The main configuration file at `.claude/settings.json` controls:

- **Hooks** — SessionStart, PreToolUse, PostToolUse, Stop hooks
- **Permissions** — Allowed CLI commands (git, npm, node, etc.)
- **MCP Servers** — Playwright MCP for browser testing
- **Environment** — Framework version and flags

### CLAUDE.md

Your project brain file. The CLI generates it with your tech stack, but you should maintain it:

- Add project-specific conventions as they emerge
- Log mistakes so Claude doesn't repeat them
- Keep it under 2000 tokens — prune aggressively
- Commit to git so it persists across sessions

### Installer Flags

```bash
npx dos-apes-super-agent                   # Interactive setup
npx dos-apes-super-agent --local           # Install to ./.claude/ (this project)
npx dos-apes-super-agent --global          # Install to ~/.claude/ (all projects)
npx dos-apes-super-agent --greenfield      # New project (skip prompt)
npx dos-apes-super-agent --brownfield      # Existing project (skip prompt)
npx dos-apes-super-agent --yes             # Accept all defaults
npx dos-apes-super-agent --no-hooks        # Skip hook scripts
npx dos-apes-super-agent --no-ci           # Skip CI workflow templates
npx dos-apes-super-agent --version         # Print version
npx dos-apes-super-agent --help            # Show all options
```

---

## Philosophy

### Plan First, Execute Second

Every piece of work starts in plan mode. A good plan pays back 5x during execution. The framework enforces this — `/apes-build` plans before it builds, `/apes-feature` specs before it codes.

### Verify Everything

Claude must prove its work, not just claim completion. Hooks make verification automatic. If Claude can't verify it, it's not done.

### Skills Over Agents

v1 had 12 hardcoded agents. v2 has 7 skill files that any teammate can load. The platform handles orchestration; the framework provides domain expertise.

### Hooks Over Trust

Quality checks fire deterministically regardless of agent behavior. TypeScript is checked on every `.ts` edit. Tests run on every test file change. Main branch is protected on every write. No cooperation required.

---

## Troubleshooting

### Commands not showing up

Slash commands must be in `.claude/commands/`. If you installed globally, they're in `~/.claude/commands/`. Restart Claude Code after installing.

### Hooks not firing

Check that `scripts/` directory exists in your project root and scripts are executable. On Windows, hooks route through `scripts/run-hook.cmd` which locates Git Bash automatically. If Git Bash isn't installed, hooks degrade gracefully (skip with a warning rather than failing the session).

### Playwright MCP not connecting

The framework configures Playwright MCP in `settings.json`, but you need `@playwright/mcp` installed. It will auto-install via `npx` on first use, but you can pre-install:

```bash
npm install -D @playwright/test
npx playwright install
```

### Coverage gate failing

The default threshold is 80%. Adjust in `scripts/check-coverage.sh` or skip with:

```bash
DOS_APES_SKIP_COVERAGE=true
```

---

## Credits

Built on patterns from:

- **[Claude Code Agent Teams](https://docs.anthropic.com/en/docs/claude-code)** — Native multi-agent orchestration
- **[GSD](https://github.com/glittercowboy/get-shit-done)** — Spec-driven development, context engineering
- **[VibeKanban](https://vibekanban.com)** — Git worktree orchestration, parallel execution
- **[Ralph Wiggum](https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md)** — Iterative loops, persistence
- **Boris Cherny's Workflow** — Verification-first philosophy, shared CLAUDE.md

---

## License

MIT — Use freely, contribute back.

---

🦍🦍 **Dos Apes: We ain't monkeying around with code!**
