---
name: architecture
description: System design, ADRs, phase decomposition, tech stack decisions.
  Load for architecture planning, system design, and technical decision-making.
---

# Architecture Skill

## Tech Stack Selection

When choosing a tech stack, optimize for:
1. Team familiarity (fastest path to shipping)
2. Ecosystem maturity (libraries, community, hiring)
3. Type safety (TypeScript/typed languages preferred)
4. Deployment simplicity (managed services over self-hosted)

Default recommendations by project type:
- **Web app:** Next.js or React+Vite / Node.js+Express / PostgreSQL+Prisma / Tailwind
- **API-only:** Node.js+Express+TypeScript / PostgreSQL+Prisma / Zod validation
- **Full-stack rapid:** Next.js App Router / PostgreSQL+Prisma / NextAuth / Tailwind

## Architecture Decision Records (ADRs)

Create an ADR for every significant technical decision. Store in `docs/architecture/`.

Format:
```markdown
# ADR-NNN: [Title]

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** YYYY-MM-DD
**Context:** What is the issue we're facing?
**Decision:** What did we decide?
**Consequences:** What are the trade-offs?
**Alternatives Considered:** What else did we evaluate?
```

Decisions that require ADRs:
- Framework/library selection
- Database choice and schema design patterns
- Authentication/authorization approach
- API design (REST vs GraphQL vs tRPC)
- State management strategy
- Deployment architecture
- Third-party service integrations

### ExecPlans

ADRs and ExecPlans serve different purposes:

- **ADRs** record **decisions** — why we chose X over Y. They go through an `[APPROVAL]` gate.
- **ExecPlans** record **implementation plans** — how to build X. They are the builder handoff artifact.

The architect produces both: ADR first (for the approval gate), then ExecPlan (for builder handoff). The flow is:

```
PRD requirement → ADR (decision) → [APPROVAL] → ExecPlan (blueprint) → Builder implements
```

ExecPlans live in `.planning/execplans/` and each one maps to one or more tasks in the backlog. They define file scope, interface contracts, implementation steps, and verification plan — enough detail that a builder agent can implement end-to-end without additional context.

Use the template at `docs/templates/execplan-template.md` to create new ExecPlans.

When to create an ExecPlan:
- Any task that touches 3+ files
- Any task that introduces a new interface or data flow
- Any task where the implementation approach isn't obvious from the acceptance criteria alone

When to skip:
- Single-file fixes, config changes, or tasks where the acceptance criteria fully specify the implementation

### Architecture Rules File

After making tech stack decisions in Phase 1, the architect should generate `.planning/ARCHITECTURE_RULES.md` from the template at `docs/templates/architecture-rules-template.md`. This file defines:

- **Dependency direction:** Which directories can import from which (e.g., `src/services -> src/types, src/lib`)
- **Boundary walls:** Explicit "never import" rules (e.g., `src/services -> src/components`)

The `scripts/check-structure.sh` hook reads this file and enforces boundaries on every `.ts`/`.tsx` file edit — violations block the agent automatically. Update the rules file when adding new layers or reorganizing modules.

## Phase Decomposition

Break projects into 3-5 phases. Each phase should be independently deployable.

Pattern:
```
Phase 1: Foundation (scaffolding, auth, database, core models)
Phase 2: Core Features (primary user flows, business logic)
Phase 3: Secondary Features (settings, admin, notifications)
Phase 4: Polish (error handling, performance, accessibility)
Phase 5: Launch (deployment, monitoring, documentation)
```

Rules:
- Each phase takes 1-3 days of agent work
- Phase N must be fully verified before Phase N+1 starts
- Dependencies flow forward only (Phase 2 depends on Phase 1, never reverse)
- Each phase gets its own feature branch: `feat/phase-N-description`

## Task Decomposition

Within each phase, break work into tasks. Each task should be:
- **Independent:** Can be worked on without blocking other tasks (where possible)
- **Small:** 1-4 files changed, completable in one agent session
- **Verifiable:** Has clear acceptance criteria that can be tested
- **Atomic:** One logical unit of work per commit

Use Tasks API with `blockedBy` dependencies to create execution waves:
```
Wave 1: [Independent tasks] → execute in parallel via worktrees
Wave 2: [Tasks depending on Wave 1] → execute in parallel via worktrees
Wave 3: [Tasks depending on Wave 2] → sequential if needed
```

**Parallel execution rule:** When designing tasks, maximize parallelism by keeping tasks in the same wave touching **different files/directories**. Tasks in the same wave get their own git worktree and run simultaneously via separate teammates. After all complete, branches merge back to the phase branch.

Example — good parallel wave (separate concerns):
```
Wave 1: "API routes" (src/routes/) | "UI shell" (src/components/) | "DB models" (prisma/)
```

Example — bad parallel wave (shared files):
```
Wave 1: "User API" (src/routes/users.ts) | "Auth middleware" (src/routes/users.ts) ← CONFLICT
```

## Layer Architecture

Standard web application layers:
```
Routes/Pages    → URL mapping, page components
Components      → Reusable UI elements
Hooks           → Shared client-side logic
Services        → API calls, external integrations
Lib/Utils       → Pure functions, helpers
Types           → TypeScript type definitions
```

Backend layers:
```
Routes          → HTTP endpoint definitions
Controllers     → Request handling, validation
Services        → Business logic (no HTTP knowledge)
Repositories    → Database access (no business logic)
Models          → Data structures, Prisma schema
Middleware      → Auth, logging, error handling
```

Rules:
- Dependencies flow downward only (routes → controllers → services → repositories)
- Never import from a higher layer
- Services contain business logic, controllers handle HTTP concerns
- Repositories are the only layer that touches the database
