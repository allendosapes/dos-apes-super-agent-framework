# ExecPlan: {{FEATURE_NAME}}

## Context

- **Parent task/epic:** [link to task or task ID]
- **Related ADRs:** [link to ADR, e.g., docs/architecture/ADR-001.md]
- **Acceptance criteria:** [copy GIVEN/WHEN/THEN from task backlog]

## Scope

### Files to Create

- `path/to/new-file.ts` — [purpose]
- `path/to/new-file.test.ts` — [tests for the above]

### Files to Modify

- `path/to/existing-file.ts` — [what changes and why]

### Files NOT to Touch

- `path/to/protected-file.ts` — [why it's out of scope]

## Interface Contracts

### Inputs

[Define the data structures, props, or API payloads this feature consumes.]

```typescript
// Example
interface CreateUserInput {
  email: string;
  name: string;
}
```

### Outputs

[Define the data structures, responses, or events this feature produces.]

```typescript
// Example
interface CreateUserOutput {
  id: string;
  email: string;
  createdAt: Date;
}
```

### Dependencies

[What must exist before this can be implemented — prior tasks, packages, schemas.]

## Implementation Approach

[Step-by-step implementation order. Specific enough that a builder agent can follow without guessing. Reference patterns from the relevant skill file.]

1. [First step — e.g., "Define types in src/types/user.ts"]
2. [Second step — e.g., "Create repository in src/repositories/user.repository.ts"]
3. [Third step — e.g., "Implement service in src/services/user.service.ts"]
4. [Continue until feature is complete]

## Verification Plan

[Which pyramid levels apply. Specific test scenarios. Expected test count.]

- **L0: Build** — Build passes after changes
- **L1: Static analysis** — No new type errors or lint warnings
- **L2: Unit tests** — [specific functions/components to test, expected count]
- **L2.5: Coverage** — Coverage stays above threshold
- **L3+:** [if applicable — integration tests, E2E scenarios]

## Rollback

How to undo this change if verification fails:

```bash
git reset --hard phase-N/task-M-complete
```

---

_Template from [Dos Apes Super Agent Framework](https://github.com/allendosapes/dos-apes-super-agent-framework)_
