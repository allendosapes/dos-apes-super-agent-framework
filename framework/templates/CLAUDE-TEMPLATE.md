# [Project Name]

> This file is read by Claude at the start of every session. Keep it updated with project context.

## Overview

[One paragraph describing what this project is and its current state]

## Tech Stack

- **Frontend:** [e.g., React 18 + TypeScript + Vite]
- **Backend:** [e.g., Node.js + Express + TypeScript]
- **Database:** [e.g., PostgreSQL with Prisma ORM]
- **Styling:** [e.g., Tailwind CSS]
- **Testing:** [e.g., Vitest + React Testing Library]
- **Deployment:** [e.g., Vercel + Railway]

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

_Managed by [Dos Apes Super Agent Framework](https://github.com/dos-apes/dos-apes)_
