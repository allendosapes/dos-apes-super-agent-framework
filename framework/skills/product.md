---
name: product
description: Product management patterns — PRD parsing, acceptance criteria,
  epic decomposition, backlog structuring, and scope management. Load when
  breaking down requirements, writing stories, or planning delivery phases.
allowed-tools: Read, Grep, Glob, TaskCreate, TaskUpdate, TaskList
---

# Product Management Skill

## PRD Parsing

Read the PRD (or `--idea` text) and extract structured requirements.

### Priority Classification

| Priority | Meaning | Rule |
|----------|---------|------|
| P0 | Must ship — product is broken without it | Launch blocker. No phase completes without all P0s done. |
| P1 | Should ship — significant value, low risk to cut | Include in current phase if time allows. Defer to next phase if not. |
| P2 | Nice to have — polish, optimization, extras | Only after all P0/P1 work is verified. Never block a release. |

### Extraction Process

1. Read the PRD end-to-end. Identify every stated requirement.
2. For each requirement, extract:
   - **What:** The capability described
   - **Who:** The user/actor involved
   - **Why:** The business value or user need
   - **Priority:** P0/P1/P2 based on the table above
3. Identify the **happy path** — the primary success flow.
4. Identify **edge cases** — boundary conditions, empty states, concurrent access.
5. Identify **error states** — network failure, invalid input, permission denied.
6. **Flag ambiguities** — requirements that could be interpreted multiple ways. Stop and ask the human before assuming.

### Ambiguity Detection

Flag requirements that contain:
- Vague adjectives: "fast", "intuitive", "seamless", "modern"
- Missing specifics: "support multiple formats" (which formats?)
- Implied behavior: "users can manage their data" (CRUD? Export? Delete?)
- Conflicting statements: requirement A says X, requirement B implies not-X

Format ambiguity flags as:

```
AMBIGUITY: [requirement reference]
The PRD says "[quoted text]" but does not specify:
- [specific question 1]
- [specific question 2]
ACTION: Clarify with stakeholder before creating tasks.
```

## Acceptance Criteria

Every task MUST have at least one testable acceptance criterion before work begins.

### Format

Use Given/When/Then:

```
GIVEN [context or precondition]
WHEN [action performed]
THEN [expected observable result]
```

### Quality Rules

| Rule | Good Example | Bad Example |
|------|-------------|-------------|
| Specific and measurable | "THEN the response status is 201 and body contains `id` field" | "THEN it works correctly" |
| One behavior per criterion | "WHEN user submits empty form THEN validation errors display" | "WHEN user interacts with form THEN everything works" |
| Testable by an agent | "THEN the list shows 0 items and displays 'No results found'" | "THEN the UX should feel good" |
| Includes error cases | "GIVEN invalid token WHEN requesting /api/me THEN status is 401" | (error case omitted entirely) |

A tester agent must be able to write a test from the acceptance criteria **without additional context**. If they can't, the criteria are insufficient.

### Criteria Confidence Score

Rate each criterion 0-100 for testability:

| Score | Meaning | Action |
|-------|---------|--------|
| 90-100 | Fully testable, no ambiguity | Ready for development |
| 70-89 | Testable but may need minor clarification | Acceptable, note assumptions |
| 50-69 | Partially testable, missing details | Rewrite before assigning |
| < 50 | Untestable or vague | Block task until criteria are rewritten |

## Epic to Story Decomposition

Break epics into stories sized for a single agent task.

### Story Sizing Rules

A properly sized story:
- Modifies **1-3 files** (not 10+)
- Takes **1-2 hours** of agent work
- Has a **single logical outcome** that can be verified independently
- Produces a **working increment** (not half-built scaffolding)

### Decomposition Process

1. Identify the epic's end-to-end flow (e.g., "User authentication").
2. Slice **vertically** through layers, not horizontally:
   - Good: "Login form submits credentials and receives token" (touches UI + API + DB)
   - Bad: "Build all API endpoints" then "Build all UI components" (horizontal slicing)
3. Each story gets:
   - **Acceptance criteria** (Given/When/Then format)
   - **Dependencies** (blockedBy references to other stories)
   - **Verification approach** (which pyramid levels apply — see below)

### Verification Level Assignment

Map each story to the verification pyramid levels it requires:

| Story Type | Minimum Levels | Example |
|-----------|---------------|---------|
| Data model / schema | L0 (build), L1 (types), L2 (unit) | "Add User model with email field" |
| API endpoint | L0, L1, L2, L3 (integration) | "POST /api/users creates a user" |
| UI component | L0, L1, L2, L4 (UI integration) | "Login form renders and validates" |
| Full user flow | L0, L1, L2, L3, L6 (E2E) | "User signs up and sees dashboard" |
| Security-sensitive | L0, L1, L2, L3, L5 (security) | "Password hashing and token rotation" |

## Backlog Structuring

Output a structured task list using the Tasks API.

### Task Format

Each task in the backlog must include:

```
Task: [imperative action — "Add user login endpoint"]
Description: [1-2 sentences of context]
Priority: P0 | P1 | P2
Acceptance Criteria:
  - GIVEN ... WHEN ... THEN ...
  - GIVEN ... WHEN ... THEN ...
Dependencies: [blockedBy task IDs, or "none"]
Agent: architect | builder | tester | reviewer
Verification: L0, L1, L2 [list applicable levels]
```

### Agent Assignment Guidelines

| Agent | Assign When |
|-------|-------------|
| `architect` | Schema design, API contracts, ADRs, project scaffolding |
| `builder` | Implementation — components, routes, services, business logic |
| `tester` | Test creation, coverage gaps, E2E scenarios |
| `reviewer` | Code review, security audit, convention checks |

### Ordering Rules

1. P0 tasks before P1, P1 before P2.
2. Within the same priority, order by dependency depth (tasks with no blockers first).
3. Group related tasks into waves for parallel execution where they touch different files.
4. Every wave ends with a tester task to verify the wave's output.

## Domain Context Awareness

### Reading Project Context

Before creating any tasks:

1. Read `.planning/PROJECT.md` for product vision, target users, and domain language.
2. Read `CLAUDE.md` for technical conventions and constraints.
3. Read existing task list (`TaskList`) to avoid duplicating work.

### Domain Language Rules

- Use the same terminology as the PRD and PROJECT.md in all acceptance criteria.
- If the PRD says "workspace" don't call it "project" in your stories.
- If the domain has specific terms (e.g., "tenant", "invoice", "campaign"), use them consistently.

### Conflict Detection

Flag when PRD requirements conflict with stated product vision:

```
CONFLICT: [requirement reference]
The PRD requires "[quoted text]" but PROJECT.md states "[quoted vision text]".
This conflicts because [explanation].
ACTION: Resolve with stakeholder before proceeding.
```

## Scope Management

### Phase Boundary Rules

When requirements are too large for a single phase:

1. Apply the **walking skeleton** principle: Phase 1 delivers a thin vertical slice through every layer, not a thick horizontal slice of one layer.
2. Each phase is independently deployable and verifiable.
3. Phase boundaries align with user-facing value — each phase delivers something a user can interact with.

### Walking Skeleton Pattern

```
Phase 1 (Skeleton):
  - One model, one API endpoint, one UI page, fully wired
  - Proves the architecture works end-to-end
  - All verification levels pass on the thin slice

Phase 2 (Core):
  - Remaining P0 features built on the proven skeleton
  - Each story extends an existing layer, never builds a new isolated one

Phase 3 (Complete):
  - P1 features, error handling, edge cases
  - Polish and optimization
```

### Scope Escalation Signals

Recommend splitting into additional phases when:
- A single phase has more than **8-10 tasks**
- Task dependency chains are deeper than **3 levels**
- Multiple tasks require schema migrations
- The estimated file count exceeds **15 new/modified files** in one phase

## Anti-Patterns

### Tasks Without Acceptance Criteria

Bad: "Implement the dashboard"
- Criteria: ??? What does "implement" mean? What should the dashboard show?

Good: "Add dashboard page showing active project count"
- GIVEN a user with 3 active projects
- WHEN they navigate to /dashboard
- THEN they see "3 Active Projects" with a list of project names

### Untestable Acceptance Criteria

Bad: "The UX should feel good" / "Performance should be acceptable"
Good: "Page loads in under 2 seconds on 3G" / "Form validates on blur, not on submit"

### Monolithic Tasks

Bad: "Build the authentication system" (touches auth model, middleware, login UI, signup UI, password reset, token rotation, session management — 10+ files)

Good: Break into 5 stories:
1. "Add User model with password hash field" (1 file)
2. "Add POST /api/auth/login endpoint" (2 files)
3. "Add login form component" (2 files)
4. "Add auth middleware to protected routes" (2 files)
5. "Add password reset flow" (3 files)

### Missing Error Requirements

Bad: PRD only describes the happy path.
Good: For every happy path, explicitly ask:
- What happens on invalid input?
- What happens on network failure?
- What happens when the user isn't authorized?
- What happens with empty/null data?

### Horizontal Slicing

Bad: "Phase 1: Build all database models. Phase 2: Build all APIs. Phase 3: Build all UI."
- Nothing works until Phase 3 is done. No incremental value.

Good: "Phase 1: User can sign up (model + API + UI). Phase 2: User can create projects (model + API + UI)."
- Each phase delivers user-facing value.

## Output Checklist

Before finalizing a backlog, verify:

- [ ] Every task has at least one Given/When/Then acceptance criterion
- [ ] All criteria score >= 70 on the testability confidence scale
- [ ] No task modifies more than 4 files
- [ ] P0 tasks have no unresolved ambiguities
- [ ] Dependencies form a DAG (no circular blockedBy references)
- [ ] Each phase delivers a working, deployable increment
- [ ] Domain language matches PROJECT.md and PRD terminology
- [ ] Error cases and edge cases are covered (not just happy paths)
- [ ] Every wave includes a verification task
