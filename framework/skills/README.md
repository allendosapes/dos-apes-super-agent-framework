# Skills

Domain knowledge files that teammates load for specialized expertise.

## How Skills Work

In the Dos Apes framework, skills replace the v1 concept of individual agent definitions. Instead of 12 separate agents, Claude Code's Agent Teams spawns teammates who load the appropriate skill file for their domain.

When a command like `/apes-build` assembles a team, it assigns each teammate a skill:

```
Teammate: "architect" → loads skills/architecture.md
Teammate: "builder"   → loads skills/frontend.md + skills/backend.md
Teammate: "tester"    → loads skills/testing.md
Teammate: "reviewer"  → loads skills/review.md
```

## Included Skills

| Skill | File | Domain |
|-------|------|--------|
| **Architecture** | `architecture.md` | System design, ADRs, tech stack decisions, scaling patterns |
| **Backend** | `backend.md` | APIs, database, auth, business logic, error handling |
| **Frontend** | `frontend.md` | Components, state, routing, accessibility, responsive design |
| **Testing** | `testing.md` | TDD, unit/integration/E2E, coverage gates, 8-level pyramid |
| **Browser Verification** | `browser-verification.md` | agent-browser, Playwright MCP, visual regression, E2E generation |
| **Design Integration** | `design-integration.md` | Figma MCP, design tokens, pixel-level validation |
| **Code Review** | `review.md` | Confidence-based review, security audit, issue classification |

## Adding Project-Specific Skills

Create additional skills for patterns specific to your project:

```
.claude/skills/
├── architecture.md          # Framework-provided
├── backend.md               # Framework-provided
├── frontend.md              # Framework-provided
├── testing.md               # Framework-provided
├── browser-verification.md  # Framework-provided
├── design-integration.md    # Framework-provided
├── review.md                # Framework-provided
├── your-domain-logic.md     # Your custom skill
└── your-api-patterns.md     # Your custom skill
```

## Skill File Guidelines

- Keep under 500 lines — focused domain knowledge, not tutorials
- Include concrete code patterns — show what good looks like
- Include anti-patterns — show what to avoid
- Reference other skills where domains overlap
- Write for the teammate context — they'll read this at task start

## Framework Conventions

Iron rules that apply to every skill, command, and hook in the framework.

### 1. All agent-readable state lives in the repository

No external databases, no API-only state, no runtime-only configuration. If it's not in the repo, it doesn't exist for agents.

| State | Where it lives |
|-------|---------------|
| Task status | Tasks API (persists to the session) |
| Cross-session state | `.planning/` files |
| Architecture decisions | ADRs in `docs/` |
| Configuration | `CLAUDE.md` + `settings.json` |

### 2. Skills are generic — project context goes in CLAUDE.md and .planning/

Never add project-specific logic to a skill file. Skills teach **how** to build well. `CLAUDE.md` provides **what** to build and **where** it deploys. `.planning/` provides **why** (product vision, roadmap, learnings).

### 3. Hooks enforce — skills teach — commands assemble

If a quality check must always happen, it's a **hook** (deterministic). If an agent needs domain knowledge, it's a **skill** (composable). If a workflow needs to be kicked off, it's a **command** (team launcher).

### 4. Capability gaps become infrastructure

When an agent struggles with a task, diagnose what's missing (tool, abstraction, documentation) and build it into the repo. Each solved gap becomes infrastructure for all future tasks.

---

These conventions align with the principles from OpenAI's Harness Engineering: "a map not a manual" (skills provide patterns, not step-by-step scripts), "mechanical enforcement over documentation" (hooks enforce what skills only teach), and "what the agent can't see doesn't exist" (all state must be repo-visible).
