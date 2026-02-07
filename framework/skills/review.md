---
name: review
description: Code review patterns, confidence-based issue reporting, security and correctness checks. Load when reviewing code changes, running auto-review, or evaluating pull requests.
allowed-tools: Read, Grep, Glob
---

# Code Review Skill

## Confidence Scoring

Rate every finding 0-100. **Only report issues scoring >= 80.**

| Score | Meaning | Action |
|-------|---------|--------|
| 90-100 | Certain bug or security issue | Must fix before merge |
| 80-89 | Very likely problem | Should fix before merge |
| 60-79 | Suspicious, needs investigation | Mention only if asked |
| < 60 | Stylistic or uncertain | Do not report |

This prevents noise. A review with 3 high-confidence issues is more useful than 20 maybes.

## Issue Classification

Tag every finding with exactly one category:

| Category | Examples |
|----------|---------|
| `bug` | Logic error, wrong condition, off-by-one, null deref |
| `security` | Injection, XSS, auth bypass, secrets in code, insecure defaults |
| `performance` | N+1 query, unbounded loop, missing memo, large bundle import |
| `type-safety` | Unsafe cast, `any` escape hatch, missing null check |
| `convention` | Naming mismatch, wrong file location, pattern violation |
| `test-gap` | Changed logic with no test update, missing edge case |
| `a11y` | Missing aria label, no keyboard handler, contrast issue |
| `dead-code` | Unused export, unreachable branch, orphaned file |

## Review Checklist

Work through these in order. Stop early if a category has no relevant changes.

### 1. Correctness

- Does the logic match the stated intent?
- Are edge cases handled (empty, null, boundary values)?
- Are error paths handled (network failure, invalid input)?
- Do conditions cover all branches?

### 2. Security

- Input validation at system boundaries?
- No SQL/command/template injection?
- No secrets, tokens, or credentials in code?
- Auth checks present on protected routes/endpoints?
- No unsafe HTML rendering or eval?

### 3. Type Safety

- No `any` types (use `unknown` + narrowing instead)?
- Null/undefined handled where values are optional?
- Return types explicit on public functions?
- Generic constraints applied where needed?

### 4. Testing

- Changed code has corresponding test updates?
- New functions have tests?
- Edge cases tested (not just happy path)?
- Test names describe the behavior, not the implementation?

### 5. Conventions

- Follows project patterns from CLAUDE.md / CONVENTIONS.md?
- File placement matches project structure?
- Naming matches existing patterns (casing, prefixes)?
- Imports ordered per project convention?

## Report Format

```
## Code Review

### Issues Found

**[file:line] category (confidence: N)**
Description of the issue.

Suggested fix:
[code suggestion here]

### Verdict

PASS — No issues >= 80 confidence.
PASS WITH NOTES — N issues flagged, none blocking.
FAIL — N blocking issues (confidence >= 90) must be resolved.
```

## What NOT to Flag

- **Formatting** — Prettier/ESLint handles this via hooks. Never comment on whitespace, semicolons, quotes, or line length.
- **Style preferences** — If the code follows project conventions, don't suggest alternatives you personally prefer.
- **TODOs with tracking** — `// TODO(#123): description` is fine. Only flag bare `TODO` with no reference.
- **Test file organization** — Don't reorganize test structure unless tests are genuinely broken.
- **Import ordering** — Automated by tooling. Skip entirely.
- **Comment density** — Don't add or request docstrings on internal functions. Only flag missing docs on public API surfaces.

## Anti-Patterns

### Noisy Reviews

Bad: 15 findings, most are style nits.
Good: 3 findings, all bugs or security issues.

If you have nothing meaningful to report, say "PASS" and move on.

### Blocking on Non-Issues

Bad: "This could theoretically fail if the server returns a 418 status code."
Good: "This crashes on empty arrays because `arr[0]` is accessed without a length check." (confidence: 95)

### Reviewing Generated Code

Don't review auto-generated files (migrations, lockfiles, compiled output). Focus on human-written source code.
