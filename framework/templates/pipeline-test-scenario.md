# Pipeline Test Scenario: Todo List API

Validates the full evolved pipeline: PRD → ingest → plan → build → review → QA → merge.

Use this scenario to verify that product skill, orchestration skill, task gates, acceptance criteria verification, and the apes-build loop all work together correctly.

## Test PRD

```markdown
# Todo List Application

A todo list API with user authentication, CRUD operations, and a basic React frontend.

## Requirements

1. Users can register with email and password
2. Users can log in and receive a JWT token
3. Authenticated users can create, read, update, and delete todos
4. Each todo has a title, description, completed status, and due date
5. The frontend shows a list of todos with filtering by status
6. Users can only see and modify their own todos
```

Run: `/apes-build --prd todo-prd.md --ralph`

---

## Stage 1: INGEST

The lead loads `skills/product.md` and reads `.planning/PROJECT.md` for domain context.

### Expected Backlog (.planning/BACKLOG.md)

```markdown
## User Registration (P0)
**What:** Users create accounts with email and password
**Who:** Anonymous visitor
**Why:** Required for all authenticated functionality
### Acceptance Criteria
- GIVEN a visitor WHEN they POST /api/auth/register with valid email and password THEN status is 201 and response contains user ID
- GIVEN a visitor WHEN they POST /api/auth/register with an existing email THEN status is 409 and response contains "email already exists"
- GIVEN a visitor WHEN they POST /api/auth/register with invalid email format THEN status is 400

## User Login (P0)
**What:** Users authenticate and receive a JWT token
**Who:** Registered user
**Why:** Gates access to all todo operations
### Acceptance Criteria
- GIVEN a registered user WHEN they POST /api/auth/login with correct credentials THEN status is 200 and response contains a JWT token
- GIVEN a user WHEN they POST /api/auth/login with wrong password THEN status is 401

## Todo CRUD (P0)
**What:** Create, read, update, and delete todos
**Who:** Authenticated user
**Why:** Core product functionality
### Acceptance Criteria
- GIVEN an authenticated user WHEN they POST /api/todos with title and description THEN status is 201 and todo is saved
- GIVEN an authenticated user WHEN they GET /api/todos THEN status is 200 and response contains only their todos
- GIVEN an authenticated user WHEN they PATCH /api/todos/:id with completed=true THEN the todo is updated
- GIVEN an authenticated user WHEN they DELETE /api/todos/:id THEN the todo is removed
- GIVEN an unauthenticated request WHEN accessing any /api/todos endpoint THEN status is 401

## Todo Data Model (P0)
**What:** Todo entity with title, description, completed, due date
**Who:** System
**Why:** Required structure for all CRUD operations
### Acceptance Criteria
- GIVEN the schema WHEN a todo is created THEN it has id, title, description, completed (default false), dueDate (nullable), userId, createdAt
- GIVEN the type definitions WHEN npm run typecheck runs THEN zero errors

## Frontend Todo List (P1)
**What:** React page showing todos with status filtering
**Who:** Authenticated user
**Why:** User-facing interface to the API
### Acceptance Criteria
- GIVEN a logged-in user with 3 todos WHEN they visit /todos THEN all 3 todos render in a list
- GIVEN the todo list WHEN user clicks "Completed" filter THEN only completed todos show
- GIVEN the todo list WHEN user clicks "Active" filter THEN only incomplete todos show

## Authorization Enforcement (P0)
**What:** Users can only access their own todos
**Who:** Authenticated user
**Why:** Multi-tenant data isolation
### Acceptance Criteria
- GIVEN user A's todo WHEN user B sends GET /api/todos/:id THEN status is 404 (not 403, to avoid leaking existence)
- GIVEN user A's todo WHEN user B sends DELETE /api/todos/:id THEN status is 404
```

### Expected Priority Summary

- **P0:** 5 requirements (registration, login, CRUD, data model, authorization)
- **P1:** 1 requirement (frontend)
- **P2:** 0

### Expected Ambiguity Flags

None — this PRD is specific. But the product agent should note:
- "due date" — no format specified. Assume ISO 8601 date string.
- "filtering by status" — does this mean client-side filter or API query param? Assume client-side (simpler, P1).

---

## Stage 2: PLAN

The architect loads `skills/architecture.md`. The lead loads `skills/orchestration.md`.

### Expected Phase Breakdown

**Phase 1: Foundation** — Project setup, data models, auth, core API

**Phase 2: Features** — Todo CRUD, authorization, frontend

### Expected Task Dependency Graph (Phase 1)

```
Task 1: Project Scaffolding          (no deps)
Task 2: User Model + DB Schema       (blockedBy: 1)
Task 3: Auth Endpoints               (blockedBy: 2)
Task 4: [APPROVAL] Architecture Review (blockedBy: 2, 3)
Task 5: [GATE] Phase 1 Verification  (blockedBy: 4)
```

### Expected Tasks via Tasks API (Phase 1)

```
TaskCreate: "Project Scaffolding"
  description: "Initialize Vite + React + Express + TypeScript. Configure ESLint, Prettier, Vitest."
  acceptance: "GIVEN a fresh repo WHEN npm run build executes THEN it exits 0"
  verify: "npm run build passes, npm run typecheck passes"
  role: builder

TaskCreate: "User Model + DB Schema"
  description: "Define User type with id, email, passwordHash, createdAt. Set up Prisma schema."
  acceptance: "GIVEN the schema WHEN npm run typecheck runs THEN zero errors"
  verify: "npm run typecheck passes, prisma generate succeeds"
  role: builder
  blockedBy: ["Project Scaffolding"]

TaskCreate: "Auth Endpoints"
  description: "POST /api/auth/register and POST /api/auth/login with JWT. Add auth middleware."
  acceptance: "GIVEN valid credentials WHEN POST /api/auth/login THEN response contains JWT token"
  verify: "npm test passes, auth.test.ts covers register + login + invalid cases"
  role: builder
  blockedBy: ["User Model + DB Schema"]

TaskCreate: "[APPROVAL] Architecture Review"
  description: "PAUSE. Present: tech stack, DB schema, auth approach, API structure. Wait for human."
  role: lead
  blockedBy: ["User Model + DB Schema", "Auth Endpoints"]

TaskCreate: "[GATE] Phase 1 Verification"
  description: "Run L0-L5 pyramid. All must pass."
  role: tester
  blockedBy: ["[APPROVAL] Architecture Review"]
```

### Wave Analysis (Phase 1)

```
Wave 1: Task 1 (Project Scaffolding) — sequential, foundation
Wave 2: Task 2 (User Model) — sequential, depends on scaffolding
Wave 3: Task 3 (Auth Endpoints) — sequential, depends on model
Wave 4: Task 4 ([APPROVAL]) — human gate
Wave 5: Task 5 ([GATE]) — verification
```

No parallel opportunities in Phase 1 — this is correct per `skills/orchestration.md` ("Phase 1 scaffolding — Foundation must be built in order").

### Expected Tasks (Phase 2)

```
Task 6: Todo Model + Schema          (blockedBy: 5)
Task 7: Todo CRUD Endpoints          (blockedBy: 6)
Task 8: Authorization Middleware      (blockedBy: 6)
Task 9: Frontend Todo List           (blockedBy: 7)
Task 10: [GATE] Phase 2 Verification (blockedBy: 7, 8, 9)
Task 11: [GATE] UI Smoke Test       (blockedBy: 10)
```

### Wave Analysis (Phase 2)

```
Wave 1: Task 6 (Todo Model) — sequential
Wave 2: Task 7 (CRUD) + Task 8 (Auth Middleware) — PARALLEL (different files)
Wave 3: Task 9 (Frontend) — sequential, depends on API
Wave 4: Task 10 ([GATE]) — verification
Wave 5: Task 11 ([GATE]) — UI smoke test
```

**Parallel opportunity:** Tasks 7 and 8 touch different files (`src/routes/todos.ts` vs `src/middleware/authorize.ts`) and can run in separate worktrees.

### Expected ExecPlan for Task 1

```markdown
# ExecPlan: Project Scaffolding

## Context
- Parent task: Task 1 — Project Scaffolding
- Related ADRs: None (first task)
- Acceptance criteria: GIVEN a fresh repo WHEN npm run build executes THEN it exits 0

## Scope
### Files to Create
- package.json — Dependencies, scripts
- tsconfig.json — TypeScript strict config
- vite.config.ts — Vite + React config
- src/main.tsx — React entry point
- src/App.tsx — Root component
- src/server/index.ts — Express server entry
- prisma/schema.prisma — Empty Prisma schema (DB connection only)
- .env.example — DATABASE_URL, JWT_SECRET, PORT

### Files NOT to Touch
- .claude/ — Framework files, not project code
- .planning/ — Already created by INGEST

## Implementation Approach
1. npm init -y, install dependencies
2. Configure TypeScript strict mode
3. Set up Vite with React plugin
4. Create Express server with health endpoint
5. Configure Prisma with PostgreSQL
6. Add npm scripts: dev, build, test, lint, typecheck
7. Create minimal React app that renders "Hello"
8. Verify: npm run build && npm run typecheck

## Verification Plan
- L0: npm run build exits 0
- L1: npm run typecheck exits 0, npm run lint exits 0
- L2: No unit tests yet (nothing to test)
```

---

## Stage 3: EXECUTE (Task 1)

### Git Operations

```bash
git checkout main
git checkout -b feat/phase-1-foundation
```

### Builder Implements

Files created:
- `package.json` — React 18, Express, TypeScript, Prisma, Vitest, ESLint, Prettier
- `tsconfig.json` — strict: true, target: ES2022
- `vite.config.ts` — React plugin, proxy to Express dev server
- `src/main.tsx` — React DOM render
- `src/App.tsx` — Root component with `<h1>Todo App</h1>`
- `src/server/index.ts` — Express with `GET /health` returning `{ status: "ok" }`
- `prisma/schema.prisma` — datasource postgresql, no models yet
- `.env.example` — DATABASE_URL, JWT_SECRET, PORT=3000
- `src/config/env.ts` — Startup env validation (per `skills/devops.md`)

### Gate Check: Task 1 → IN_REVIEW

```bash
bash scripts/check-task-gates.sh 1 IN_REVIEW
```

Expected output:
```
Checking gate: 1 → IN_REVIEW
  Running L0: build...
  ✓ L0: Build passes
  Running L1: typecheck...
  ✓ L1: Typecheck passes
  Running L2: tests...
  ⚠️  No 'test' script in package.json — skipping check (fail open)
  ⚠️  scripts/check-coverage.sh not found — skipping check (fail open)
✅ Gate passed: 1 → IN_REVIEW
```

### Git Commit

```bash
git add -A
git commit -m "feat(setup): initialize project with React + Express + TypeScript"
git tag -a "phase-1/task-1-complete" -m "Project Scaffolding - verified"
```

---

## Stage 4: REVIEW (Task 1)

The reviewer loads `skills/review.md` and checks the committed code.

### Expected Confidence Scores

| Finding | Confidence | Category |
|---------|-----------|----------|
| .env.example has placeholder JWT_SECRET | 85 | Security |
| No rate limiting on Express server | 60 | Security (below threshold, skip) |
| Missing .gitignore entries for .env | 90 | Security |

### Expected Review Output

Only findings >= 80 are reported:

```
Review: 2 findings (1 critical, 1 moderate)

[90] Security: .gitignore missing .env* pattern — secrets could be committed
  → Fix: Add .env* to .gitignore
  → Files: .gitignore

[85] Security: .env.example documents JWT_SECRET — ensure .env is gitignored
  → Fix: Verify .gitignore has .env coverage (related to above)
  → Files: .env.example, .gitignore
```

### Gate Check: Task 1 → IN_QA

After builder fixes the .gitignore issue:

```bash
bash scripts/check-task-gates.sh 1 IN_QA
```

Expected: Pass (no critical review issues remain).

---

## Stage 5: QA (Task 1)

The tester loads `skills/testing.md` and maps acceptance criteria to tests.

### Acceptance Criteria Mapping

```
═══ ACCEPTANCE CRITERIA VERIFICATION ═══
Task: Project Scaffolding
Criteria: 1 defined, 1 covered, 0 uncovered

✅ AC-1: Build exits 0 → verified by: npm run build (exit code 0)
═════════════════════════════════════════
```

### Pyramid Levels Applied

- **L0:** `npm run build` → pass
- **L1:** `npm run typecheck` → pass, `npm run lint` → pass
- **L2:** No unit tests applicable (scaffolding only)
- **L2.5:** No coverage threshold (no tests yet)

### Gate Check: Task 1 → VERIFIED

```bash
bash scripts/check-task-gates.sh 1 VERIFIED
```

Expected output:
```
Checking gate: 1 → VERIFIED
  ⚠️  scripts/check-coverage.sh not found — skipping check (fail open)
  ⚠️  scripts/check-secrets.sh not found — skipping check (fail open)
  Running regression check: build...
  ✓ Build still passes
✅ Gate passed: 1 → VERIFIED
```

---

## Stage 6: MERGE

Task 1 is verified. The orchestrator continues to Task 2 (still on the phase branch — merge happens after all phase tasks complete).

### After All Phase 1 Tasks Complete

```bash
git checkout main
git merge --squash feat/phase-1-foundation
git commit -m "feat: Phase 1 complete - Foundation (auth, user model, API structure)"
git tag -a "phase-1-complete" -m "Phase 1: Foundation - verified"
git branch -d feat/phase-1-foundation
git push origin main --tags
```

### Transition to Phase 2

The orchestrator:
1. Checks `TaskList` — all Phase 1 tasks completed
2. Reads `.planning/ROADMAP.md` — Phase 2 exists
3. Creates Phase 2 tasks (Tasks 6-11 as defined above)
4. Creates branch: `git checkout -b feat/phase-2-features`
5. Begins Wave 1 of Phase 2

---

## Validation Checklist

After running `/apes-build --prd todo-prd.md --ralph` against this scenario, verify:

### INGEST Stage
- [ ] `.planning/BACKLOG.md` exists with GIVEN/WHEN/THEN criteria for all 6 requirements
- [ ] `.planning/PROJECT.md` has product vision and target users
- [ ] `.planning/ROADMAP.md` has 2 phases
- [ ] CLAUDE.md generated with correct tech stack

### PLAN Stage
- [ ] Phase 1 has 5 tasks (3 implementation + 1 approval + 1 gate)
- [ ] Phase 2 has 6 tasks (4 implementation + 2 gates)
- [ ] Every task has acceptance criteria and role assignment
- [ ] Dependencies form a valid DAG (no cycles)
- [ ] Tasks 7 and 8 are identified as parallelizable in Phase 2

### EXECUTE Stage
- [ ] Phase branch created: `feat/phase-1-foundation`
- [ ] Each task committed with descriptive message
- [ ] Each task tagged: `phase-1/task-N-complete`
- [ ] `check-task-gates.sh` runs at each state transition
- [ ] Gate failures block progression (not skipped)

### REVIEW Stage
- [ ] Reviewer loads `skills/review.md`
- [ ] Only findings >= 80 confidence reported
- [ ] Critical findings fixed before QA transition

### QA Stage
- [ ] Test files include `// Acceptance Criteria Coverage:` comment blocks
- [ ] Criteria coverage report produced for each task
- [ ] No task marked VERIFIED with uncovered criteria
- [ ] Pyramid levels match task type (per `skills/product.md` verification table)

### MERGE Stage
- [ ] Phase branch squash-merged to main
- [ ] Phase tag created: `phase-1-complete`
- [ ] Phase branch deleted after merge
- [ ] Phase 2 planning begins automatically

---

_Template from [Dos Apes Super Agent Framework](https://github.com/allendosapes/dos-apes-super-agent-framework)_
