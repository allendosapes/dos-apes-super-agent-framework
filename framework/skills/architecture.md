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
Wave 1: [Independent tasks] → execute in parallel
Wave 2: [Tasks depending on Wave 1] → execute in parallel
Wave 3: [Tasks depending on Wave 2] → sequential if needed
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
