# [Project Name]

> This file is read by Claude at the start of every session. Keep it updated with project context.

## For Product Owners

You don't need to understand the technical sections below — they're for the AI team. Here's what you need to know:

**How to build your product:**

1. Write down what you want built in a requirements document (see `docs/templates/PRD-TEMPLATE.md` for a starting point — fill in as much or as little as you can)
2. Run: `/apes-build --prd your-file.md --ralph`
3. Walk away. The AI team will plan, build, test, and deliver your product.

**When you'll be asked for input:**

- At `[APPROVAL]` checkpoints — the AI will show you what it's built so far and ask if you're happy with the direction before continuing
- If something goes wrong that the AI can't figure out on its own

**Useful commands:**

| What you want | What to type |
|---|---|
| Build a product from scratch | `/apes-build --prd your-file.md --ralph` |
| Add a feature to an existing product | `/apes-feature add a login page` |
| Fix a bug | `/apes-fix the signup button doesn't work` |
| Check progress | `/apes-status` |
| See all available commands | `/apes-help` |

**What the AI handles for you (no action needed):**

- Choosing the right programming languages and tools
- Writing code, tests, and documentation
- Checking for bugs, security issues, and code quality
- Saving progress with version control (git)
- Organizing work into phases and tasks

**What the AI will NOT do without asking you:**

- Deploy to a live website or server
- Make major architecture changes after you've approved a direction
- Spend money (cloud services, paid APIs, etc.)

---

## Overview

[One paragraph describing what this project is and its current state]

## Tech Stack

- **Frontend:** [e.g., React 18 + TypeScript + Vite]
- **Backend:** [e.g., Node.js + Express + TypeScript]
- **Database:** [e.g., PostgreSQL with Prisma ORM]
- **Styling:** [e.g., Tailwind CSS]
- **Testing:** [e.g., Vitest + React Testing Library]
- **Deployment:** [e.g., Vercel + Railway]

## Deployment

{{DEPLOYMENT_TARGET}}

## Testing Strategy

{{TESTING_STRATEGY}}

## Project Structure

```
src/
├── components/     # React components
│   ├── ui/         # Reusable UI components
│   └── features/   # Feature-specific components
├── pages/          # Page components / routes
├── hooks/          # Custom React hooks
├── services/       # API calls and external services
├── lib/            # Utilities and helpers
├── types/          # TypeScript type definitions
└── styles/         # Global styles
```

## Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build

# Testing
npm test             # Run tests
npm run test:watch   # Watch mode
npm run test:e2e     # E2E tests

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix lint issues
npm run typecheck    # TypeScript check
npm run format       # Prettier format

# Database (if applicable)
npm run db:push      # Push schema changes
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

## Conventions

### Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- Named exports (not default exports)
- Co-located test files: `Component.tsx` + `Component.test.tsx`

### Naming

- Components: `PascalCase` (e.g., `UserProfile.tsx`)
- Hooks: `camelCase` with `use` prefix (e.g., `useAuth.ts`)
- Utilities: `camelCase` (e.g., `formatDate.ts`)
- Types: `PascalCase` (e.g., `User`, `ApiResponse`)
- Constants: `UPPER_SNAKE_CASE`

### Git

- Branch naming: `feat/description`, `fix/description`, `refactor/description`
- Conventional commits: `feat(scope): description`
- Squash merge to main

### Imports Order

```typescript
// 1. React
import { useState, useEffect } from "react";

// 2. External libraries
import { format } from "date-fns";

// 3. Internal modules (absolute paths)
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

// 4. Relative imports
import { UserAvatar } from "./UserAvatar";

// 5. Types
import type { User } from "@/types";

// 6. Styles
import "./styles.css";
```

## Environment Variables

```bash
# Required
DATABASE_URL=           # Database connection string
API_KEY=                # External API key

# Optional
DEBUG=                  # Enable debug mode
LOG_LEVEL=              # Logging verbosity
```

## Key Decisions

### [Decision 1 - e.g., "State Management"]

**Decision:** [What was decided - e.g., "Use React Query for server state, Zustand for client state"]
**Rationale:** [Why - e.g., "Separates concerns, React Query handles caching"]

### [Decision 2 - e.g., "Authentication"]

**Decision:** [What was decided]
**Rationale:** [Why]

## Autonomy Policy

Claude should operate autonomously for routine development work. Only pause for human input when explicitly required.

### Proceed Without Asking

- Build, test, lint, typecheck, format commands
- Git branch creation, switching, committing, tagging
- Git push to feature branches and main (after squash merge)
- Git merge --squash from feature branches to main
- File creation, editing, deletion within the project
- Package installation and dependency management
- Code generation, scaffolding, writing tests
- Security scans (npm audit, gitleaks)
- Local branch cleanup after merge

### Always Ask First

- `[APPROVAL]` gate tasks (architecture reviews, phase boundaries)
- Force push (`--force` or `--force-with-lease`) to any branch
- Deployment to production or staging environments
- Database migrations or schema changes on shared databases
- Modifying environment variables, secrets, or credentials
- Ambiguous merge conflicts where the correct resolution is unclear
- Any action that is irreversible or affects systems beyond this repository

**Rule of thumb:** If the action is reversible and local, proceed. If it's irreversible or touches shared/production systems, ask.

## Model Guidance

- Solo work / simple tasks: Lead handles directly (Sonnet-tier cost)
- Complex implementation: Spawn builder teammate (gets Opus-tier reasoning)
- Use teams for parallelizable work only — overhead isn't worth it for sequential tasks

## Known Issues / Tech Debt

- [ ] [Issue 1 - e.g., "Need to add error boundaries"]
- [ ] [Issue 2 - e.g., "API rate limiting not implemented"]

## Resources

- [Design mockups](link)
- [API documentation](link)
- [Deployment guide](link)

---

_Managed by [Dos Apes Super Agent Framework](https://github.com/allendosapes/dos-apes-super-agent-framework)_
