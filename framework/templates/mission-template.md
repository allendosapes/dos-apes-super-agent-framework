---
# ============================================================================
# Mission frontmatter
# ----------------------------------------------------------------------------
# Missions are atomic units of work. They live under
# .planning/missions/<state>/ where <state> is one of:
#   todo | doing | review | done | canceled
#
# State transitions happen by `git mv`-ing the file between state directories.
# The audit trail is reconstructed from `git log --follow <path>`.
# ============================================================================

# REQUIRED. Canonical mission ID. Format: M-NNNN (zero-padded to 4 digits).
# Must be unique across the repo. Allocate the next free number.
id: M-0001

# REQUIRED. One-line human-readable summary. Imperative voice preferred.
# Example: "Add POST /todos endpoint with validation"
title: Short imperative summary of the mission

# REQUIRED. Current lifecycle state. Must match the parent directory name.
# Allowed values: todo, doing, review, done, canceled
state: todo

# OPTIONAL. Integer 1–5. 1 is highest priority. Default: 3.
priority: 3

# REQUIRED. ISO 8601 date the mission was created.
created: 2026-05-01

# REQUIRED. ISO 8601 date of the most recent update to this file.
# Bump whenever frontmatter or body changes materially.
updated: 2026-05-01

# OPTIONAL. Phase ID from ROADMAP.md. Must match an existing phase when set.
# Omit for standalone missions (bug fixes, quick wins, ad-hoc work).
# Example: phase-1-foundation
phase: phase-1-foundation

# OPTIONAL. Mission IDs that must be in `done` before this mission can
# transition out of `todo`. Empty list or omitted = no dependencies.
depends_on:
  - M-0000

# OPTIONAL. Free-form tags for filtering and grouping. Lowercase, kebab-case.
labels:
  - backend
  - api

# OPTIONAL. Acceptance criteria. Each entry is a single testable statement.
# Reviewer agents check these before transitioning review -> done.
acceptance:
  - "Endpoint POST /todos returns 201 with created todo body"
  - "Validation error returns 400 with field-level error messages"
  - "New unit tests cover happy path and validation failure"

# OPTIONAL. Verification pyramid gates this mission must satisfy.
# Level IDs: L0, L1, L2, L2.5, L3, L4, L5, L6, L7
# (See ARCHITECTURE.md for the full pyramid description.)
verification:
  # Required levels MUST pass before review -> done is allowed.
  required_levels:
    - L0
    - L1
    - L2
    - L2.5
  # Optional levels are nice-to-have; failures are reported but don't block.
  optional_levels:
    - L3
    - L5

# OPTIONAL. Workspace settings for agent execution.
workspace:
  # Branch to create for this mission.
  # Default: feat/m-nnnn-<slug-of-title> (lowercase, hyphenated)
  branch: feat/m-0001-short-imperative-summary
  # Relative path to the git worktree where the mission is built.
  # Default: .worktrees/M-NNNN
  worktree: .worktrees/M-0001

# OPTIONAL. Hard cap on agent iteration loops. Prevents runaway loops.
# Default: 50
max_iterations: 50
---

## Context

<!--
Why this mission exists. Prior art. Links to related missions, ADRs, PRDs,
issues, or external references. Constraints (technical, business, regulatory).
Future agents picking up this mission read this section first.
-->

[Describe the problem this mission solves and the surrounding context. Include
links to related work and any non-obvious constraints that shaped the approach.]

## Implementation notes

<!--
Tech choices, libraries, and patterns to follow. Reference skill files in
.claude/skills/ where applicable. Keep terse — link to ADRs for deep rationale.
-->

- Library / framework: [e.g., Express + Zod for validation]
- Pattern reference: [e.g., follow .claude/skills/backend-api.md "thin handler" pattern]
- File layout: [e.g., handler in src/routes/todos.ts, schema in src/schemas/todo.ts]
- Non-obvious constraints: [e.g., must remain compatible with existing M-0000 schema]

## Out of scope

<!--
Explicit non-goals. Prevents scope creep and gives reviewers a clear boundary.
-->

- [Non-goal — e.g., "Authentication: handled by existing middleware, not modified here."]
- [Non-goal — e.g., "Pagination: deferred to M-0007."]

## Workpad

<!-- Updated by agent during execution. Append timestamped entries; do not delete prior entries. -->

<!--
Format each entry as:

### YYYY-MM-DD HH:MM — <agent-role>
- short note
- short note

This section is the running log of progress, blockers, and decisions. It lets
a paused or handed-off mission be resumed without losing context.
-->
