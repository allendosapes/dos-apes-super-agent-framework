# Skills

Domain knowledge files that teammates load for specialized expertise.

## How Skills Work

In the Dos Apes framework, skills replace the v1 concept of individual agent definitions. Instead of 12 separate agents, Claude Code's Agent Teams spawns teammates who load the appropriate skill file for their domain.

When a command like `/apes-build` assembles a team, it assigns each teammate a skill:

```
Teammate: "architect" → loads skills/architecture.md
Teammate: "builder"   → loads skills/frontend.md + skills/backend.md
Teammate: "tester"    → loads skills/testing.md
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
├── your-domain-logic.md     # Your custom skill
└── your-api-patterns.md     # Your custom skill
```

## Skill File Guidelines

- Keep under 500 lines — focused domain knowledge, not tutorials
- Include concrete code patterns — show what good looks like
- Include anti-patterns — show what to avoid
- Reference other skills where domains overlap
- Write for the teammate context — they'll read this at task start
