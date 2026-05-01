---
name: missions
description: Mission file format, lifecycle, and state-transition protocol. Load when creating, reading, transitioning, or reviewing mission files under .planning/missions/.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Missions Skill

## Overview

A **mission** is the atomic unit of work in the Dos Apes framework. One mission = one focused outcome a team can finish, verify, and merge.

Missions replace:

- **Ad-hoc TODOs** scattered through code, chat, and issue trackers — there is now exactly one place a unit of work lives.
- **Manual phase tracking** in spreadsheets or whiteboards — phase membership is encoded in the mission's `phase` field; the filesystem is the source of truth.
- **In-conversation task lists** that vanish when the session ends — missions persist across sessions, agents, and humans.

Each mission is a single markdown file with YAML frontmatter (machine-readable metadata) and a markdown body (human-readable narrative). The file's *location on disk* encodes its lifecycle state. Transitions are `git mv` operations, so the audit trail is the git history of the file path.

A mission is small enough to be held in one head and finished in a bounded number of agent iterations. If a mission grows past that, split it.

## File format

Missions follow the canonical template at `framework/templates/mission-template.md`. Copy that file when creating a new mission — do not hand-author the frontmatter from memory.

Frontmatter summary (full spec lives in the template):

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `M-NNNN`, zero-padded, never reused |
| `title` | yes | One-line imperative summary |
| `state` | yes | `todo` \| `doing` \| `review` \| `done` \| `canceled` |
| `priority` | no | 1–5, default 3 |
| `created` | yes | ISO 8601 date |
| `updated` | yes | ISO 8601 date — bump on every material edit |
| `phase` | no | Phase ID from `ROADMAP.md`, or omitted for standalone |
| `depends_on` | no | Array of mission IDs |
| `labels` | no | Free-form tags |
| `acceptance` | no | Array of testable criteria |
| `verification.required_levels` | no | Pyramid levels that must pass |
| `verification.optional_levels` | no | Pyramid levels that are nice-to-have |
| `workspace.branch` | no | Defaults to `feat/m-nnnn-<slug>` |
| `workspace.worktree` | no | Defaults to `.worktrees/M-NNNN` |
| `max_iterations` | no | Default 50 |

Body sections (in order, all four required):

1. `## Context` — why this mission exists, prior art, constraints.
2. `## Implementation notes` — tech choices, libraries, patterns.
3. `## Out of scope` — explicit non-goals.
4. `## Workpad` — append-only execution log (see [Workpad protocol](#workpad-protocol)).

Do not invent extra top-level sections. If you need more structure, add subheadings under one of the four canonical sections.

## Directory structure

```
.planning/
└── missions/
    ├── todo/        ← created, not yet started
    ├── doing/       ← actively being implemented
    ├── review/      ← implementation done, awaiting verification + sign-off
    ├── done/        ← merged, verified, immutable
    └── canceled/    ← abandoned (record kept for audit)
```

A mission's `state` frontmatter field MUST equal the name of its parent directory. The two are kept in sync by the transition protocol; an out-of-sync mission is a bug.

To list missions in a state, glob the directory:

```bash
ls .planning/missions/doing/
```

To find a mission by ID regardless of state:

```bash
find .planning/missions -name 'M-0042-*.md'
```

## State machine

```
                  ┌─────────┐
                  │  todo   │
                  └────┬────┘
                       │ start (deps satisfied)
                       ▼
                  ┌─────────┐
        ┌─────────│  doing  │◄──────┐
        │         └────┬────┘       │
   any  │              │ submit     │ rejected
   →    │              ▼            │ revision
canceled│         ┌─────────┐       │
        │         │ review  │───────┘
        │         └────┬────┘
        │              │ approve
        │              ▼
        │         ┌─────────┐
        │         │  done   │
        │         └─────────┘
        ▼
   ┌──────────┐
   │ canceled │
   └──────────┘
```

Allowed transitions and their preconditions:

### `todo` → `doing` (start)
- Every mission ID in `depends_on` is present in `.planning/missions/done/`.
- A workspace exists (branch + worktree per `workspace.*` fields). See `worktrees.md`.
- The mission's frontmatter `state` is updated to `doing` and `updated` is bumped in the same commit as the `git mv`.

### `doing` → `review` (submit)
- Implementation work is committed on the mission's branch.
- An evidence packet has been produced (see `evidence-packets.md`) demonstrating that all `verification.required_levels` pass.
- All items in `acceptance` are claimed met in the `## Workpad` section (with the format in [Acceptance criteria](#acceptance-criteria)).

### `review` → `done` (approve)
- A reviewer (human or agent in reviewer role) has confirmed every acceptance criterion against the evidence packet.
- All `verification.required_levels` are green; `verification.optional_levels` are reported (pass or fail) but do not block.
- The mission's branch has been merged to the integration branch.

### `review` → `doing` (rejected revision)
- The reviewer rejects one or more acceptance criteria or finds a verification gap.
- The rejection is recorded as a workpad entry with the specific failure(s).
- The file moves back to `doing/`; no other state is allowed as a rejection target.

### Any state → `canceled` (abandon)
- A workpad entry MUST record the reason for cancellation and the date.
- Canceled missions are never reopened — if work resumes, allocate a new mission ID and reference the canceled one in `depends_on` only if the prior work is genuinely a prerequisite.

No other transitions exist. In particular: there is no `done` → anything, and no `todo` → `review`.

## Naming conventions

Filename format: `M-NNNN-kebab-case-summary.md`

- `M-NNNN` matches the `id` frontmatter field exactly.
- The slug is derived from `title`: lowercase, ASCII only, words joined with `-`, max ~60 characters, no trailing hyphen.
- The slug is stable for the life of the mission. If `title` changes substantively, update both the file name (`git mv`) and the slug — but `id` never changes.

Rules:

- **IDs are sequential and never reused.** To allocate a new ID, take `max(existing) + 1`. Never re-use the ID of a canceled mission.
- **One mission per file.** Do not bundle multiple missions into one document.
- **Filename and `id` always agree.** A linter or hook should fail a commit where they diverge.

Examples:

| `id` | `title` | Filename |
|---|---|---|
| `M-0001` | Add POST /todos endpoint | `M-0001-add-post-todos-endpoint.md` |
| `M-0042` | Fix race condition in session refresh | `M-0042-fix-race-condition-in-session-refresh.md` |

## Dependency resolution

The `depends_on` array lists mission IDs that must be in `done` before this mission can transition out of `todo`.

Resolution algorithm (used by tooling and reviewers):

1. For each `dep_id` in `depends_on`, search `.planning/missions/done/` for a file matching `<dep_id>-*.md`.
2. If any dependency is not found in `done/`, the mission is **blocked** and may not start.
3. Cycles are forbidden: if A depends on B and B (transitively) depends on A, the dependency graph is invalid and tooling should reject it.
4. Dependencies on `canceled` missions are an error — clean them up rather than ignoring them.

Forward references are allowed: a mission may declare a dependency on an ID that does not yet exist. The mission stays in `todo` until the dependency is created and completed.

Dependencies are advisory at the *implementation* layer — they describe ordering, not access control. A mission that touches files outside its scope is a separate problem (review catches it).

## Phase relationship

Missions optionally belong to a roadmap phase via the `phase` frontmatter field. The value must match a phase ID declared in `ROADMAP.md`.

- **Standalone missions** omit `phase` entirely. These are bug fixes, quick wins, urgent ops work, or anything not part of a planned phase. Standalone missions are first-class — there is no quality penalty for skipping the phase field.
- **Phase missions** set `phase: <phase-id>`. The phase is **informational only**: it groups missions for reporting and progress views. Execution does not consult the phase field.
- A phase is "complete" when every mission claiming it is in `done` (or `canceled` with a justification). There is no separate phase-completion artifact.
- Re-assigning a mission to a different phase is allowed; bump `updated` and record the reason in the workpad.

The roadmap defines *intent*; missions define *execution*. The two are deliberately decoupled so a roadmap shuffle does not disturb in-flight work.

## Workpad protocol

The `## Workpad` section is an append-only execution log. It survives across agent sessions and provides continuity when a mission is paused, handed off, or resumed.

Rules:

1. **Append only.** Never delete, rewrite, or reorder prior entries. If a previous note is wrong, append a correction below it.
2. **Timestamp every entry.** Use the heading format `### YYYY-MM-DD HH:MM — <agent-role>` (24-hour UTC).
3. **One entry per work session.** Don't slice a single session into a dozen micro-entries.
4. **Be terse.** What was tried, what worked, what's blocked, what's next. No essays.
5. **Record decisions and their reasons.** A future agent should be able to reconstruct *why* the implementation looks the way it does.

Example:

```markdown
## Workpad

<!-- Updated by agent during execution. Append timestamped entries; do not delete prior entries. -->

### 2026-05-01 14:22 — builder
- Scaffolded route in `src/routes/todos.ts`; followed thin-handler pattern from `backend.md`.
- Validation schema in `src/schemas/todo.ts` using Zod (matches existing convention).
- Blocked: existing test fixture loader doesn't support POST bodies. Patched it; will discuss in review.

### 2026-05-01 16:10 — tester
- Added 6 unit tests for the route (happy + 5 validation cases). All green.
- L0/L1/L2/L2.5 pass locally. Evidence packet at `.planning/evidence/M-0001/`.
```

The workpad is also where acceptance criteria are checked off — see the next section.

## Acceptance criteria

Each item in the `acceptance` frontmatter array must be verified before a mission can transition `doing` → `review`. Verification means: there is concrete evidence (test output, screenshot, log, executed command) that the criterion holds.

To mark criteria as met, append a checklist to the workpad in the entry that submits the mission for review:

```markdown
### 2026-05-01 16:10 — tester
- [x] "Endpoint POST /todos returns 201 with created todo body" — verified by `todos.test.ts:42`
- [x] "Validation error returns 400 with field-level error messages" — verified by `todos.test.ts:71`
- [x] "New unit tests cover happy path and validation failure" — coverage report in evidence packet
```

Conventions:

- Use `- [x]` for met, `- [ ]` for not yet met. A submission entry must have all `[x]`.
- Quote the criterion text verbatim — copy from frontmatter, do not paraphrase.
- Cite the evidence: a file:line reference, a screenshot path, an evidence-packet entry. Unsubstantiated checks are grounds for review rejection.
- If a criterion turns out to be wrong (typo, ambiguity, no longer applicable), do **not** silently delete it. Append a workpad note proposing the change, then update the frontmatter `acceptance` array, then bump `updated`.

A reviewer reading the workpad alongside the evidence packet should be able to verify every claim without re-running the tests themselves.

## Anti-patterns

These are forbidden. CI hooks, reviewers, and skills should refuse to participate when they appear.

- **Editing missions in `done/`.** Done missions are immutable. If new information arrives, write a follow-up mission that references the done one in `depends_on`.
- **Skipping the `review` state.** Never `git mv` a file directly from `doing/` to `done/`. Review is where acceptance criteria are checked against evidence.
- **Modifying `id` after creation.** The ID is the mission's permanent name. Changing it breaks dependency lookups, branch naming, evidence packets, and the audit trail.
- **Creating a mission without acceptance criteria.** A mission with no `acceptance` is unverifiable, which means it is unfinishable. If the work is genuinely too small for criteria, it is too small for a mission — fold it into another mission's workpad.
- **Deleting a mission file.** Use the `canceled` state instead. The file and its history are part of the project's record.
- **Bundling unrelated work into one mission.** If two acceptance criteria do not share a single coherent outcome, they belong to two missions.
- **Editing prior workpad entries.** Append a correction below; do not rewrite history in place.
- **Using `done` as a holding pen for "almost done" work.** A mission in `done/` has merged, verified work behind it. "Almost done" stays in `review/`.
- **Re-using a canceled mission's ID.** IDs are sequential and never reused — even when canceled.

## Cross-references

- **`framework/skills/worktrees.md`** — How `workspace.branch` and `workspace.worktree` are materialized into an isolated git worktree for execution.
- **`framework/skills/evidence-packets.md`** — How verification output (test logs, coverage reports, screenshots) is captured and attached to a mission for review.
- **`framework/skills/testing.md`** — The verification pyramid (L0–L7) referenced by `verification.required_levels` and `verification.optional_levels`.
- **`framework/templates/mission-template.md`** — Canonical mission file template; copy when creating a new mission.
- **`ROADMAP.md`** (in the consuming project) — Source of phase IDs used in the optional `phase` field.
