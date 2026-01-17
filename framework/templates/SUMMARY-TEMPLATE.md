# Summary Template

> Template for `.planning/phases/XX-name/XX-NN-SUMMARY.md` - plan completion documentation with dependency graph.

---

## File Template

```markdown
---
# Identity
phase: XX-phase-name
plan: NN
subsystem: [primary: auth|api|ui|database|infra|testing|payments|etc.]
tags: [searchable tech: jwt, react, postgres, prisma, stripe]

# Dependency Graph
requires:
  - phase: [prior phase this depends on]
    provides: [what that phase built that this uses]
provides:
  - [what this plan delivers for other plans]
affects: [phases/plans that will need this context]

# Tech Tracking
tech-stack:
  added: [libraries/tools added]
  patterns: [patterns established]

key-files:
  created: [new files]
  modified: [changed files]

key-decisions:
  - "Decision 1: rationale"
  - "Decision 2: rationale"

patterns-established:
  - "Pattern 1: description"
  - "Pattern 2: description"

issues-created: [ISS-XXX, ISS-YYY]

# Metrics
duration: Xmin
completed: YYYY-MM-DD
gate-status: G4-pass
---

# Phase [X] Plan [NN]: [Name] Summary

**[Substantive one-liner - what actually shipped, not "plan complete"]**

## Performance

- **Duration:** [time] (e.g., 23 min, 1h 15m)
- **Started:** [ISO timestamp]
- **Completed:** [ISO timestamp]
- **Tasks:** [count completed]
- **Files modified:** [count]

## Accomplishments

- [Most important outcome]
- [Second key accomplishment]
- [Third if applicable]

## Task Commits

Each task was committed atomically:

1. **Task 1: [task name]** - `abc123f` ([type]: [description])
2. **Task 2: [task name]** - `def456g` ([type]: [description])
3. **Task 3: [task name]** - `ghi789j` ([type]: [description])

**Plan metadata:** `lmn012o` (docs: complete [plan-name] plan)

## Files Created/Modified

- `path/to/file.ts` - What it does
- `path/to/another.ts` - What it does

## Decisions Made

[Key decisions with brief rationale, or "None - followed plan as specified"]

## Deviations from Plan

[If no deviations: "None - plan executed exactly as written"]

[If deviations occurred:]

### Auto-fixed Issues

**1. [Rule X - Category] Brief description**
- **Found during:** Task [N] ([task name])
- **Issue:** [What was wrong]
- **Fix:** [What was done]
- **Files modified:** [file paths]
- **Verification:** [How it was verified]
- **Committed in:** [hash] (part of task commit)

### Deferred Enhancements

Logged to .planning/ISSUES.md for future consideration:
- ISS-XXX: [Brief description] (discovered in Task [N])
- ISS-XXX: [Brief description] (discovered in Task [N])

---

**Total deviations:** [N] auto-fixed ([breakdown by rule]), [N] deferred
**Impact on plan:** [Brief assessment]

## Issues Encountered

[Problems and how they were resolved, or "None"]

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| Build | PASS/FAIL | |
| Types | PASS/FAIL | |
| Lint | PASS/FAIL | |
| Tests | PASS/FAIL | X/Y passing |
| UI Integration | PASS/FAIL/NA | [where integrated] |
| Browser Verified | YES/NO | [what was tested] |

## Next Plan Readiness

- [What's ready for next plan/phase]
- [Any blockers or concerns]
- [Context needed by dependent plans]

---
*Phase: XX-phase-name*
*Plan: NN*
*Completed: [date]*
```

---

## Frontmatter Field Guide

| Field | Purpose | Example |
|-------|---------|---------|
| `phase` | Phase identifier | `01-foundation` |
| `plan` | Plan number | `02` |
| `subsystem` | Primary category for grouping | `auth`, `api`, `ui`, `database` |
| `tags` | Searchable tech keywords | `jwt`, `prisma`, `react-query` |
| `requires` | What this plan needed from prior work | `phase: 01-foundation, provides: User model` |
| `provides` | What this plan delivers | `JWT authentication`, `Login endpoint` |
| `affects` | Plans that will need this context | `02-dashboard`, `03-profile` |
| `tech-stack.added` | New dependencies | `jose`, `bcrypt` |
| `tech-stack.patterns` | Patterns established | `JWT refresh rotation` |
| `key-files` | Important files for @context | `src/lib/auth.ts`, `src/middleware.ts` |
| `key-decisions` | Decisions for STATE.md | `"Used jose over jsonwebtoken for Edge compat"` |
| `patterns-established` | Conventions future plans should follow | `"httpOnly cookies for tokens"` |
| `issues-created` | ISSUES.md references | `ISS-001`, `ISS-002` |
| `duration` | Execution time | `28min` |
| `gate-status` | Quality gate result | `G4-pass` |

## Why Frontmatter Matters

1. **Fast scanning** - First ~30 lines, cheap to scan all summaries
2. **Dependency graph** - `requires`/`provides`/`affects` create explicit links
3. **Auto-context assembly** - `/apes-plan` can select relevant summaries automatically
4. **Tech stack awareness** - Know what's already installed/configured
5. **Pattern consistency** - Maintain established patterns across plans

## One-Liner Rules

The one-liner MUST be substantive:

**Good:**
- "JWT auth with refresh rotation using jose library"
- "Prisma schema with User, Session, and Product models"
- "Dashboard with real-time metrics via Server-Sent Events"

**Bad:**
- "Plan complete"
- "Authentication implemented"
- "Foundation finished"

---

## Example Summary

```markdown
---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [jwt, jose, bcrypt, nextjs-middleware]

requires:
  - phase: 01-foundation
    plan: 01
    provides: User model with email/password fields

provides:
  - JWT authentication with refresh token rotation
  - Protected route middleware
  - Login/logout API endpoints

affects: [02-dashboard, 03-profile, 04-settings]

tech-stack:
  added: [jose, bcrypt]
  patterns: [httpOnly JWT cookies, 15min access/7d refresh]

key-files:
  created: [src/lib/auth.ts, src/app/api/auth/login/route.ts]
  modified: [src/middleware.ts]

key-decisions:
  - "Used jose over jsonwebtoken - Edge runtime compatible"
  - "15min access tokens with 7d refresh for security/UX balance"

patterns-established:
  - "All tokens in httpOnly cookies, never localStorage"
  - "Refresh token rotation on each request"

issues-created: [ISS-001, ISS-002]
duration: 28min
completed: 2025-01-15
gate-status: G4-pass
---

# Phase 01 Plan 02: Authentication Summary

**JWT auth with refresh rotation using jose library, protected API middleware, and httpOnly cookie storage**

## Performance

- **Duration:** 28 min
- **Started:** 2025-01-15T14:22:10Z
- **Completed:** 2025-01-15T14:50:33Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Login/logout endpoints with httpOnly JWT cookies
- Protected route middleware checking token validity
- Refresh token rotation on each request
- Secure password hashing with bcrypt

## Task Commits

1. **Task 1: Create auth utilities** - `abc123f` (feat(auth): add JWT helpers with jose)
2. **Task 2: Create login endpoint** - `def456g` (feat(auth): add login/logout API routes)
3. **Task 3: Add middleware protection** - `ghi789j` (feat(auth): add protected route middleware)

**Plan metadata:** `lmn012o` (docs(01-02): complete authentication plan)

## Files Created/Modified

- `src/lib/auth.ts` - JWT creation, verification, refresh logic
- `src/app/api/auth/login/route.ts` - Login endpoint
- `src/app/api/auth/logout/route.ts` - Logout endpoint
- `src/middleware.ts` - Protected route checks

## Decisions Made

- Used jose instead of jsonwebtoken (ESM-native, Edge-compatible)
- 15-min access tokens with 7-day refresh tokens
- Storing refresh tokens in database for revocation capability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added password hashing**
- **Found during:** Task 2 (Login endpoint)
- **Issue:** Plan didn't specify password hashing
- **Fix:** Added bcrypt with salt rounds 10
- **Files modified:** src/lib/auth.ts, src/app/api/auth/login/route.ts
- **Verification:** Password hash test passes
- **Committed in:** def456g

### Deferred Enhancements

- ISS-001: Add rate limiting to login endpoint
- ISS-002: Improve token refresh UX with auto-retry on 401

---

**Total deviations:** 1 auto-fixed (missing critical), 2 deferred
**Impact on plan:** Auto-fix essential for security. No scope creep.

## Issues Encountered

None - plan executed smoothly

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| Build | PASS | |
| Types | PASS | |
| Lint | PASS | |
| Tests | PASS | 8/8 passing |
| UI Integration | N/A | Backend only |
| Browser Verified | YES | Login flow tested |

## Next Plan Readiness

- Auth foundation complete, ready for dashboard
- Protected routes working, can be applied to any endpoint
- Next: Dashboard should use auth middleware

---
*Phase: 01-foundation*
*Plan: 02*
*Completed: 2025-01-15*
```

---

*Managed by [Dos Apes Super Agent Framework](https://github.com/dos-apes/dos-apes)*
