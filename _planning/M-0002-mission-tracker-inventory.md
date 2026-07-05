# M-0002 — Inventory: mission-state operations across the framework

**Purpose:** Catalog every place in the framework that touches mission state,
frontmatter, or filesystem layout, so the upcoming `MissionTracker` API
(planned in P2) is sized to actually replace the duplication.

**Scope:** `bin/`, `framework/scripts/`, `framework/commands/`,
`framework/skills/`, `framework/templates/`. Documentation-only references in
`README.md`, `ARCHITECTURE.md`, and `CHANGELOG.md` are noted at the bottom but
not catalogued line-by-line — they describe behavior, not perform it.

**Files-affected count:** 11 operational files contain extractable
mission-touching logic (5 scripts + 5 commands + 1 CLI scaffolder). 7
additional files (4 skills + 1 mission template + 1 CLAUDE template + 1 prompt
template) reference the conventions but contain no code that needs to be
rewritten when MissionTracker lands — they're documentation/prose.

---

## How to read this

Each row is a single operation site:

- **File** — path relative to repo root
- **Lines** — line range (approximate; bumps when files change)
- **Operation** — what is being done in mission terms
- **API group** — proposed MissionTracker bucket (P/I/S/D/W/A/V — see
  "Categorization")
- **Disposition** — `extract` (logic moves into MissionTracker) or `callsite`
  (logic stays where it is but is rewritten to call the new API)

The seven proposed API groups:

| Code | Group              | What it owns                                                                                  |
|------|--------------------|-----------------------------------------------------------------------------------------------|
| P    | Parsing            | Read mission file, extract frontmatter scalars/lists/nested fields, extract body sections     |
| I    | Identity           | Generate next ID, validate ID format, locate mission file by ID across all states, slug/defaults |
| S    | State              | List by state, get current state, validate transition, perform transition (mv + frontmatter)  |
| D    | Dependencies       | Read `depends_on`, resolve which deps are unmet against `done/`                               |
| W    | Workpad            | Append timestamped entry to `## Workpad` section                                              |
| A    | Active mission     | Read/write/clear `.planning/active-mission`                                                   |
| V    | Verification log   | Locate a mission's `verification.jsonl` (writes stay in `log-verification.js`)                |

---

## 1. Operational sites — scripts (`framework/scripts/`)

### 1.1 `framework/scripts/mission-worktree.js`

> **MIGRATED in P4.** `parseMissionId` now delegates to `tracker.isValidId`;
> `findMissionFile` and `readMissionMeta` route through `tracker.findMissionById`
> and `parser.parseFrontmatter`. `defaultBranch`, `defaultWorktree`,
> `validateBranchName`, `validateWorktreeRel`, `resolveInsideRepo`, and
> `pickBaseRef` stay local — they are worktree/git-specific, not mission
> concerns. Smoke test: `mission-worktree.js list` in a temp git repo printed
> `mission-worktree: no mission worktrees` and exited 0.


| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 23        | `STATES = ["todo","doing","review","done","canceled"]` constant         | I     | extract     |
| 70–75     | `parseMissionId` — `/^M-\d{4}$/` regex validation                        | I     | extract     |
| 118–135   | `findMissionFile(id)` — scan all five state dirs for `M-NNNN-*.md`       | I     | extract     |
| 137–155   | `readMissionMeta` — split frontmatter, extract `id`, `title`, nested `workspace.branch` and `workspace.worktree` via regex | P | extract |
| 157–164   | `defaultBranch(id, title)` — slug build + `feat/m-nnnn-<slug>`           | I     | extract     |
| 166–168   | `defaultWorktree(id)` — `.worktrees/${id}`                               | I     | extract     |
| 245–248   | `cmdRemove` precondition: mission state must be `done` or `canceled`     | S     | callsite    |
| 286–294   | `cmdList` row construction reads each worktree path's mission state      | I + S | callsite    |

### 1.2 `framework/scripts/evidence-packet.js`

> **MIGRATED in P4.** Removed local `STATES`, `parseMissionId`,
> `findMissionFile`, `splitFrontmatter`, `getScalar`, `getNestedScalar`,
> `getList`, `getNestedList`, `readMissionMeta`. Replaced with
> `tracker.findMissionById(id)` (returns parsed frontmatter and body in one
> call) and `tracker.getVerificationLogPath(id)`. Kept local: `defaultBranch`
> (different from mission-worktree's variant — discrepancy 6.1 not yet
> resolved by lib), `acceptanceStatus` (substring matching is
> evidence-packet-specific and richer than `parser.parseAcceptanceCriteria`),
> diff/auto-review/screenshot helpers (not mission concerns). Smoke test:
> `evidence-packet.js generate M-0001` produced a valid `summary.md` with
> acceptance, verification table, diff (correctly fell back to "branch not
> found" for the test repo's missing main), and exit 0.


| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 34        | `STATES` constant duplicate                                              | I     | delete      |
| 70–75     | `parseMissionId` duplicate                                               | I     | delete      |
| 77–92     | `findMissionFile` duplicate                                              | I     | delete      |
| 96–101    | `splitFrontmatter` — split on `^---$`                                    | P     | extract     |
| 103–108   | `getScalar` — top-level scalar field                                     | P     | extract     |
| 110–124   | `getNestedScalar` — `parent: ` then `  key: value`                       | P     | extract     |
| 126–150   | `getList` — top-level YAML list                                          | P     | extract     |
| 152–184   | `getNestedList` — list under a parent block                              | P     | extract     |
| 186–198   | `readMissionMeta` — composes the above for `id/title/state/workspace.branch/acceptance/verification.required_levels/verification.optional_levels` + body | P | extract |
| 200–202   | `defaultBranch(id)` — `feat/${id.toLowerCase()}` (note: simpler than mission-worktree.js's variant — discrepancy flagged) | I | extract |
| 206–222   | `readVerificationLog` — read JSONL from `.planning/missions/<state>/<id>/verification.jsonl` | V | extract |
| 235–243   | `acceptanceStatus` — match `acceptance` items against `- [x]` lines in body | P? / Acceptance | flagged — see uncategorized list |
| 419       | Looks up mission state to compute output path                            | I     | callsite    |
| 449       | Builds `.planning/missions/<state>/<id>/` per-mission directory path     | I     | callsite    |
| 453       | Always anchors output to `review/` regardless of state                   | I     | callsite    |

### 1.3 `framework/scripts/log-verification.js`

> **MIGRATED in P4.** Removed local `STATES`, `readActiveMission`,
> `findMissionState`. Replaced with `tracker.getActiveMission()`,
> `tracker.findMissionById(id)`, and `tracker.getVerificationLogPath(id)` for
> the JSONL path. The graceful-degradation contract is preserved: missing
> active-mission, missing mission file, or write errors all warn to stderr
> and exit 0; argument-validation errors still exit 2. `appendRecord` retains
> its file-write logic (the actual JSONL append is the script's job; the
> tracker only resolves the path). `LEVEL_NAMES` constant kept local —
> intentional, since the lib does not export human-readable level names.
> Smoke test: appended a record, `cat verification.jsonl` showed the correct
> JSONL line; exit 0.


| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 46        | `STATES` constant duplicate                                              | I     | delete      |
| 69–85     | `readActiveMission(root)` — read `.planning/active-mission`, validate ID | A     | extract     |
| 80        | ID format regex `/^M-\d{4}$/` duplicate                                  | I     | delete      |
| 87–102    | `findMissionState(root, id)` — variant of findMissionFile that returns state, not full path | I | extract |
| 104–120   | `appendRecord` — write JSONL to per-mission verification.jsonl           | V     | keep here   |

> **Note:** the requirement explicitly says "delegate to `log-verification.js`,
> do not duplicate that helper's logic." MissionTracker's V (Verification log)
> group exposes only `getVerificationLogPath(id)` and a high-level
> `readVerificationLog(id)`. The append code stays put; MissionTracker calls
> into it where convenient but does not reimplement it.

### 1.4 `framework/scripts/codex-review.js`

> **MIGRATED in P4.** `loadMission` now uses `tracker.findMissionById(id)` for
> the canonical `M-NNNN-<slug>.md` form and `parser.parseFrontmatter` for
> body extraction. A small `findLegacyMissionFile` helper retains the more
> permissive lookup for legacy filename shapes (`<id>.md`, `<id>_<slug>.md`)
> so existing missions written before the slug convention still work.
> Acceptance Criteria section extraction stays inline (uses `## ` *or* `### `
> headings; the lib's `extractBodySection` is `## `-only). Smoke test:
> require-and-call probe of `loadMission("M-0042")` returned the full body
> (377 chars) and the correct Acceptance Criteria section content.


| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 274–333   | `loadMission(missionId)` — locate mission across states, strip frontmatter, extract `## Acceptance Criteria` section by heading | P + I | callsite (uses MissionTracker.findFile + MissionTracker.parse) |
| 275       | `STATES` constant duplicate                                              | I     | delete      |
| 314       | Strip leading frontmatter via regex                                      | P     | callsite    |
| 482–515   | `logMissionVerification` — shells out to `log-verification.js`           | V     | callsite    |

### 1.5 `framework/scripts/codex-review-loop.js`

> **MIGRATED in P4.** Removed local `findMissionFile` and the inline
> `appendMissionWorkpad` body. Now uses `tracker.findMissionById(id)` (probe
> for existence) and `tracker.appendWorkpadEntry(id, note)`. **Workpad format
> changed to the canonical P3 form** (`### YYYY-MM-DD HH:MM` heading; no
> `UTC` suffix; no `— codex-loop` role marker). The `codex-loop` attribution
> moved into the first line of the note body so readers still see at a
> glance which subsystem wrote the entry. Smoke test: probe-invoked
> `appendMissionWorkpad` against a fixture mission produced the expected
> heading + multi-line note (terminal state, verdict, summary, findings,
> message), preserved prior workpad content, and bumped the frontmatter
> `updated` field.


| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 273–293   | `findMissionFile(missionId)` duplicate                                   | I     | delete      |
| 274       | `STATES` constant duplicate                                              | I     | delete      |
| 295–337   | `appendMissionWorkpad(payload)` — locate workpad section, append `### YYYY-MM-DD HH:MM — codex-loop` block | W | callsite (uses MissionTracker.workpad.append) |
| 304       | Detects/creates `## Workpad` section if missing                          | W     | callsite    |
| 310–313   | Timestamp format `YYYY-MM-DD HH:MM UTC` for workpad heading              | W     | extract (canonical formatter belongs in W) |

---

## 2. Operational sites — slash commands (`framework/commands/`)

These contain inline shell + Node snippets that re-implement parsing and
state operations. P2 should rewrite these as either thin wrappers around
the new API, or — preferably — as named scripts the command body invokes.

### 2.1 `framework/commands/apes-mission.md`

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 45–64     | `new` — generate next ID via inline `node -e` (scan all states for max)  | I     | callsite    |
| 66–68     | `new` — slug build (lowercase, ASCII, ≤60 chars)                          | I     | callsite    |
| 69–87     | `new` — copy template, substitute frontmatter fields, write to `todo/`   | A* (authoring) | flagged — see uncategorized list |
| 102–120   | `list` — read each mission frontmatter and filter by state/phase/label   | P + S | callsite    |
| 134–136   | `show` — `find .planning/missions -name "$ID-*.md"` lookup                | I     | callsite    |
| 138–140   | Per-mission directory listing                                            | I     | callsite    |
| 156–165   | Allowed-transitions table (FSM source of truth in prose)                 | S     | extract (canonical FSM moves into S) |
| 169–202   | Preconditions per transition (deps satisfied / required levels passing / evidence packet exists / cancellation reason workpad) | S + D + V + W | callsite (validateTransition orchestrates) |
| 209–212   | `git mv` between state directories                                       | S     | callsite    |
| 214–220   | Optional `git mv` of per-mission directory                               | S     | callsite    |
| 222–229   | Frontmatter `state` + `updated` mutation, then `git commit`              | S + P (write) | flagged — frontmatter writes |
| 257–264   | `workpad` subcommand — find file, locate `## Workpad`, append block, bump `updated`, commit | W + I | callsite |

### 2.2 `framework/commands/apes-build.md`

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 75–94     | Resolve target mission: validate ID, check current state, check unmet deps | I + S + D | callsite |
| 113–121   | `git mv` from `todo/` to `doing/` + per-mission dir + frontmatter update + commit | S | callsite |
| 127       | `mission-worktree.js create` invocation                                  | (worktree) | callsite |
| 136       | `echo "$TARGET" > .planning/active-mission`                              | A     | callsite    |
| 146–154   | Workpad append after each significant action                             | W     | callsite    |
| 159–160   | References to `.planning/missions/doing/${TARGET}/verification.jsonl`    | V     | callsite    |
| 213–244   | Inline `node -e` that locates mission file, parses frontmatter, sets `codex_findings_unresolved: true` field | P + I + (frontmatter write) | flagged — frontmatter writes |
| 263       | `evidence-packet.js generate` invocation                                 | (delegated) | callsite |
| 273–276   | `git mv` from `doing/` to `review/` + frontmatter + commit               | S     | callsite    |
| 282       | `rm -f .planning/active-mission`                                         | A     | callsite    |
| 305       | `trap 'rm -f .planning/active-mission' EXIT` cleanup contract            | A     | callsite    |
| 313–323   | Failure-path table — many entries call out active-mission cleanup        | A     | (doc only)  |

### 2.3 `framework/commands/apes-evidence.md`

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 21–28     | Argument fallback: read `.planning/active-mission` for ID                | A     | callsite    |
| 35        | `evidence-packet.js generate` invocation                                 | (delegated) | callsite |
| 49        | `cat ".planning/missions/review/$MISSION_ID/evidence/summary.md"` — assumes `review/` location | I | callsite |
| 55–59     | "Move with `git mv` and update `state` frontmatter in same commit"       | S     | (doc only)  |
| 67        | References per-mission `verification.jsonl` location                     | V     | callsite    |

### 2.4 `framework/commands/apes-status.md`

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 80–155    | Massive inline node script: `STATES`, frontmatter parse (scalar / nested-scalar / list), per-mission load loop, sort by priority+created — full re-implementation of parsing | P + I + S | callsite (replace with `MissionTracker.list({groupBy: "state"})`) |
| 84        | `STATES` constant duplicate                                              | I     | delete      |
| 87–92     | `readFm` duplicate of splitFrontmatter                                   | P     | delete      |
| 93–96     | `scalar` duplicate of getScalar                                          | P     | delete      |
| 97–107    | `nestedScalar` duplicate of getNestedScalar                              | P     | delete      |
| 108–121   | `listOf` duplicate of getList                                            | P     | delete      |
| 142–145   | Last-workpad-timestamp parser: regex `^###\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})` against body | P + W | extract (canonical workpad parsing) |
| 164–167   | `blockers(m, doneIds)` — depends_on resolution                           | D     | extract     |
| 196       | Evidence packet path probe `.planning/missions/review/${id}/evidence/summary.md` | I | callsite |

### 2.5 `framework/commands/apes-verify.md`

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 293–301   | Calls `log-verification.js L8 ...` to record adversarial-review outcome  | V     | callsite    |

### 2.6 `framework/commands/apes-codex-review.md`

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| —         | All mission-touching logic delegated to `codex-review.js` and `codex-review-loop.js`. No direct extraction targets. | — | (no change) |

---

## 3. CLI installer (`bin/cli.js`)

| Lines     | Operation                                                                | Group | Disposition |
|-----------|--------------------------------------------------------------------------|-------|-------------|
| 886–907   | Scaffolds `.planning/missions/{todo,doing,review,done,canceled}/` with `.gitkeep` files when absent. Hard-codes the five-state list. | I (state list) | callsite (could import from MissionTracker.STATES) |

---

## 4. Documentation / templates (no extraction targets, but track)

These files document the conventions extracted into MissionTracker. After
P2 lands, every doc needs to point at the new API as the source of truth
instead of restating the rules:

- `framework/skills/missions.md` — the canonical spec for everything
  MissionTracker enforces. Will be updated to say "the rules in this skill
  are enforced by MissionTracker; do not hand-roll."
- `framework/skills/worktrees.md` — references `workspace.branch` /
  `workspace.worktree` parsing.
- `framework/skills/evidence-packets.md` — references the `review/` anchor
  and verification log layout.
- `framework/skills/testing.md` — verification log format and active-mission
  resolution contract.
- `framework/skills/cross-model-review.md` — references active-mission
  resolution and workpad append.
- `framework/templates/mission-template.md` — frontmatter schema (the canonical
  shape MissionTracker parses).
- `framework/templates/CLAUDE-TEMPLATE.md` — explainer prose for end users.
- `framework/templates/codex-review-prompt.md` — names `{{MISSION_CONTEXT}}`
  placeholder; resolution lives in `codex-review.js`.
- `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` — descriptive only.

---

## 5. Operations that don't fit the seven proposed groups

These need API-design discussion **before** P2 starts extracting. Each is a
real operation found in the inventory that doesn't have an obvious home in
P/I/S/D/W/A/V as scoped today.

### 5.1 Frontmatter mutation (writing back changed fields)

**Sites:**

- `apes-mission.md` lines 222–229 — set `state` + `updated` during transition.
- `apes-build.md` lines 213–244 — set `codex_findings_unresolved: true`.
- `apes-mission.md` line 264 — bump `updated` after workpad append.
- (Implied in many places) — `acceptance` array edits, `phase` reassignments.

**Why it doesn't fit:** Group P (Parsing) is read-only. None of the proposed
groups own *writing* frontmatter back. The current code uses ad-hoc regex
substitution (see the inline `node -e` in apes-build line 232–243 — it
preserves YAML structure by pattern-matching, no real serializer).

**Design question:** Two options.

1. **Add a write surface to P.** Rename group to "Frontmatter" with `read*`
   and `set*` verbs. Implementation needs a YAML-preserving editor since the
   templates have comments and ordering that must survive a round-trip.
2. **Bundle the common writes into S.** State transitions always touch
   `state` + `updated` — make `transitionState` do both implicitly. Leave
   the rare cases (`codex_findings_unresolved`) to a single
   `setFrontmatterField(id, key, value)` escape hatch.

Recommend option 2 with the escape hatch — option 1 invites callers to
edit anything, which is the current sprawl in slightly cleaner clothes.

> **Resolution (approved):** Three methods on group **S**, all running schema
> validation before writing:
>
> - `moveMissionState(repoRoot, id, to)` — atomic state + file location
>   (runs `git mv`, updates `state` and `updated`, moves per-mission directory
>   if present).
> - `updateFrontmatter(repoRoot, id, updates)` — shallow merge of top-level
>   scalar fields; bumps `updated` automatically.
> - `setFrontmatterField(repoRoot, id, key, value)` — single-field
>   convenience (delegates to `updateFrontmatter`).
>
> Schema validation rejects `id` changes (immutable), invalid `state` values,
> invalid date formats, out-of-range `priority`, and nested keys (dot-notation
> not supported in v1 — callers edit nested fields by hand).

### 5.2 Git interaction (does the library shell out, or hand back a plan?)

**Sites:**

- All state transitions: `git mv` + `git commit`.
- Mission scaffolding: no git, just file write.
- Active-mission file: no git (it's gitignored — confirm — or it's tracked?
  `bin/cli.js` doesn't currently scaffold it; verify in P1.5 if relevant).

**Why it doesn't fit:** S (State) describes *what* but not *who*. Two
patterns possible: MissionTracker invokes git directly (couples library to
git binary; mission-worktree.js already does this); or returns
`{ from, to, frontmatter }` and the caller (a shell command body or a
wrapper script) runs git.

**Design question:** Pick one and apply consistently. mission-worktree.js's
existing precedent (uses `execFileSync("git", ...)`) is fine and avoids the
"caller must remember to commit" footgun. Recommend: MissionTracker performs
the `git mv` and stages files, but does **not** `git commit` — let the
caller decide commit boundaries (a state transition might be one of several
related changes).

> **Resolution (approved):** MissionTracker mutates the working tree. It
> never creates commits, branches, tags, or worktrees. The library calls
> `git mv` (which stages the rename) but leaves the commit boundary to the
> caller. This principle is documented at the top of `mission-tracker.js` so
> future contributors don't drift it.

### 5.3 Mission scaffolding / authoring

**Site:** `apes-mission new` — `apes-mission.md` lines 45–87. Steps:
1. Allocate next ID.
2. Build slug from title.
3. Copy `framework/templates/mission-template.md` (or installed
   `docs/templates/mission-template.md`) to `.planning/missions/todo/`.
4. Edit frontmatter to substitute `id`, `title`, `state: todo`, `created`,
   `updated`, optional `priority`/`phase`/`depends_on`/`labels`,
   `workspace.branch`, `workspace.worktree`.
5. Print created path.

**Why it doesn't fit:** Pieces map to multiple groups (I generates ID; the
template-copy + frontmatter-fill is its own thing). No proposed group owns
"create a new mission file from scratch."

**Design question:** Add an eighth group **Authoring** with one verb:
`createMission({ title, phase?, priority?, dependsOn?, labels? }) → { id, path }`.
Internal implementation calls Identity.allocateId, copies template, runs
P-write subset to fill frontmatter. Slug logic stays in I (used by both
authoring and `defaultBranch`).

> **Resolution (approved):** Eighth group **Authoring** added. Owns:
> - `createMission(repoRoot, options) → { id, file }` — generates a fresh
>   mission file from scratch (no template coupling); fills required
>   frontmatter and any provided optional fields; writes to `todo/`.
> - `scaffoldMissionDirectory(repoRoot)` — creates the five state dirs with
>   `.gitkeep` files (replaces the inline scaffold in `bin/cli.js`).
> - `cloneMissionAsTemplate` — reserved for a future iteration; not in P2.
>
> Identity stays focused on lookups and ID generation; it does not own
> authoring.

### 5.4 Acceptance-checkbox parsing (workpad → checked criteria)

**Site:** `evidence-packet.js` lines 235–243. Reads body for `- [x]` lines
that contain criterion text from `acceptance` frontmatter array.

**Why it doesn't fit:** Touches both P (parse body) and W (workpad section
contains the checkboxes). Recommend folding into P as
`getCheckedAcceptance(id) → string[]`. It's parsing, period — no separate
group needed.

> **Resolution (approved):** Folds into Parsing as
> `parseAcceptanceCriteria(body) → [{ text, checked }]`. Returns the full
> list (checked and unchecked) so callers can decide what to do with each.

### 5.5 Per-mission directory location (companion to the .md file)

**Sites:**

- `evidence-packet.js` line 449 — screenshots/, verification.jsonl live here.
- `log-verification.js` lines 104–120 — creates and writes the directory.
- `apes-mission.md` lines 138–140, 217–220 — list contents and move on
  state transition.
- `apes-build.md` lines 117–119, 274 — move on state transition.
- `apes-evidence.md` line 67 — references the verification.jsonl path.

**Why it doesn't fit:** Identity returns `<state>/M-NNNN-<slug>.md`, but
the per-mission directory `<state>/M-NNNN/` (no slug, no `.md`) is a
parallel artifact. State transitions move both atomically.

**Design question:** Identity should expose **two** paths:
`getMissionPaths(id) → { file, dir, state }`. State.transition moves both.
This is a small extension to I; flagging because the requirement framed I
as "locate mission file by ID" — not "locate mission file *and* its
companion directory."

> **Resolution (approved):** Identity's `findMission(repoRoot, id)` returns
> `{ file, dir, state }`. A separate `getMissionDir(repoRoot, id)` helper
> covers callers that only want the directory path. `State.moveMissionState`
> moves both file and directory atomically.

### 5.6 Worktree-path validation (security-sensitive)

**Site:** `mission-worktree.js` lines 83–114 —
`validateWorktreeRel`, `resolveInsideRepo`, `validateBranchName`. Whitelist
char check, no `..` traversal, `git check-ref-format` shell-out.

**Why it doesn't fit:** Path validation is security-critical and lives next
to the worktree machinery, not the mission machinery. Recommend: I exposes
the *defaults* (`defaultBranch`, `defaultWorktree`); mission-worktree.js
keeps validation. Document this as the explicit boundary.

> **Resolution (approved):** Worktree path validation stays in
> `mission-worktree.js`. Only the default-path generators
> (`defaultBranch(id, title)`, `defaultWorktree(id)`, `buildSlug(title)`)
> move into Identity as pure functions. mission-worktree.js calls into
> Identity for the defaults and validates the result before passing to git.

### 5.7 State-machine FSM rules

**Site:** `apes-mission.md` lines 156–165 (table) and `missions.md`
lines 84–135 (state diagram + transition prose). The allowed transitions
are documented as English prose, not encoded as data anywhere.

**Why it fits group S but isn't called out:** Recommend extracting the FSM
as a constant inside MissionTracker —
`ALLOWED_TRANSITIONS = { todo: ['doing'], doing: ['review','canceled'], review: ['done','doing','canceled'], done: [], canceled: [] }` —
plus per-edge precondition validators. The skill stays the prose source of
truth, but `validateTransition(id, to)` consults the constant.

> **Resolution (approved):** FSM lives as a frozen `TRANSITIONS` constant in
> `mission-schema.js`. The prose rules from `framework/skills/missions.md`
> are reproduced as a comment immediately above the constant so a reader
> sees both the executable rule and the human explanation in one place.
> `State.isValidTransition(from, to)` and `State.validateTransition` consult
> the constant.

---

## 6. Discrepancies discovered during inventory

Worth noting up-front so P2 doesn't paper over them:

1. **`defaultBranch` differs between scripts.** `mission-worktree.js`
   produces `feat/m-nnnn-<slug-of-title>` (line 157–164).
   `evidence-packet.js` produces `feat/m-nnnn` with no slug (line 200–202).
   Mission frontmatter pins the canonical value via `workspace.branch`, so
   in practice the difference only matters when frontmatter is missing —
   but the helpers shouldn't disagree. Pick one (the slug version, since
   that's what mission templates also produce) and centralize.

2. **`STATES` is duplicated in 7 files.** Already flagged for deletion.

3. **Frontmatter parsers vary in robustness.** `apes-status.md`'s inline
   parser does not handle `getNestedList` (only top-level lists), so it
   silently drops `verification.required_levels` if a phase or label
   filter is used. `evidence-packet.js`'s parser is the most complete —
   take it as the baseline for the extracted P group.

4. **Workpad append format is named in 3 places** but the timestamp
   convention drifts. `apes-mission.md` says `### YYYY-MM-DD HH:MM —
   <agent-role>` (24-hour UTC). `codex-review-loop.js` line 310 produces
   `YYYY-MM-DD HH:MM UTC` (with a literal "UTC" suffix). The apes-status
   parser expects no suffix (regex line 144). Pick one canonical heading
   and have W enforce it.

5. **The "review/" anchor for evidence packets** is hard-coded in three
   places (`evidence-packet.js` line 453, `apes-mission.md` line 188,
   `apes-status.md` line 196). Belongs in I as `getEvidenceDir(id)`.

---

## 7. Counts

- Operational files with extraction targets: **11**
  (5 scripts + 5 commands + bin/cli.js)
- Documentation/template files referencing the conventions: **9**
  (4 skills + 3 templates + 2 root docs counted as ARCHITECTURE/CHANGELOG/
  README — the three root docs only describe behavior, not perform it,
  but are listed for completeness when prose updates are scheduled)
- Distinct duplications of the `STATES` constant: **7**
- Distinct re-implementations of frontmatter parsing: **5**
  (mission-worktree.js, evidence-packet.js, apes-status.md, codex-review.js,
  apes-build.md inline)
- Distinct re-implementations of `findMissionFile`: **5**
  (mission-worktree.js, evidence-packet.js, log-verification.js,
  codex-review-loop.js, codex-review.js)
- Sites that read or write `.planning/active-mission`: **5**
  (log-verification.js read, apes-build.md write/clear/trap,
  apes-evidence.md read; testing.md and cross-model-review.md describe but
  don't perform)

---

## 8. Approved P2 plan

All seven flagged items resolved (see boxed `**Resolution (approved):**`
notes inline above). Eighth group **Authoring** added. P2 ships two new
files:

- `framework/scripts/mission-schema.js` — frozen constants and tiny pure
  helpers. No I/O. No git. Section 9 lists what's in it.
- `framework/scripts/mission-tracker.js` — eight API groups. Mutates the
  working tree (file writes, `git mv`); never creates commits, branches,
  tags, or worktrees.

Group surface (final):

| Group           | Methods                                                                                         |
|-----------------|-------------------------------------------------------------------------------------------------|
| Parsing         | `splitFrontmatter`, `getScalar`, `getNestedScalar`, `getList`, `getNestedList`, `parseMission`, `parseAcceptanceCriteria`, `parseWorkpadEntries` |
| Identity        | `validateMissionId`, `buildSlug`, `defaultBranch`, `defaultWorktree`, `generateNextId`, `findMission` (`{ file, dir, state }`), `getMissionFile`, `getMissionDir`, `getEvidenceDir` |
| State           | `listMissions`, `getMissionState`, `isValidTransition`, `validateTransition`, `moveMissionState`, `updateFrontmatter`, `setFrontmatterField` |
| Dependencies    | `readDependencies`, `resolveUnmetDependencies`                                                  |
| Workpad         | `appendEntry`, `readLastTimestamp`                                                              |
| Active          | `read`, `write`, `clear`                                                                        |
| VerificationLog | `getLogPath`, `read`, `latestByLevel`                                                           |
| Authoring       | `createMission`, `scaffoldMissionDirectory` (cloneMissionAsTemplate reserved for later)        |

Callsite rewrites (P3) come after this; P2 only ships the library.

## 9. Constants centralized in `mission-schema.js`

Each addresses an inventory finding:

| Export                    | Type             | Replaces / addresses                                          |
|---------------------------|------------------|---------------------------------------------------------------|
| `STATES`                  | frozen string[]  | 7 duplicate definitions (discrepancy 6.2)                     |
| `LEVEL_IDS`               | frozen string[]  | Implicit list scattered across `log-verification.js` and docs |
| `LEVEL_NAMES`             | frozen object    | The mapping currently inside `log-verification.js`            |
| `TRANSITIONS`             | frozen FSM       | Prose-only rules in `apes-mission.md` and `missions.md` (5.7) |
| `DEFAULT_BRANCH`          | string `"main"`  | `"main"` literals scattered through `apes-build.md`, `evidence-packet.js`, `mission-worktree.js` |
| `EVIDENCE_DIR_NAME`       | string `"review"`| Hard-coded `"review"` anchor in 3 places (discrepancy 6.5)    |
| `WORKPAD_TIMESTAMP_FORMAT`| string token     | Drift between writers (`YYYY-MM-DD HH:MM` vs `... UTC` suffix) (discrepancy 6.4) |
| `WORKPAD_HEADING_REGEX`   | frozen RegExp    | Used by both writers (`Workpad.appendEntry`) and parsers (`Parsing.parseWorkpadEntries`, `apes-status.md`) |
| `MISSION_ID_REGEX`        | frozen RegExp    | 4 duplicate `/^M-\d{4}$/` regexes                             |
| `formatWorkpadTimestamp(date)` | function    | Single canonical formatter; complements the regex             |
| `isValidMissionId(id)`    | function         | Tiny convenience around the regex                             |
| `isValidState(state)`     | function         | Tiny convenience around STATES                                |
| `isValidTransition(from, to)` | function     | Tiny convenience around TRANSITIONS                           |

> **P3 reconciliation note:** The library that actually shipped (`framework/lib/mission-schema.js`) is a narrower P3-spec subset of the table above. Currently exported: `CURRENT_SCHEMA_VERSION`, `STATES`, `LEVEL_IDS`, `validateFrontmatter`, `migrateFrontmatter`. The other constants in the table (`LEVEL_NAMES`, `TRANSITIONS`, `DEFAULT_BRANCH`, `EVIDENCE_DIR_NAME`, `WORKPAD_TIMESTAMP_FORMAT`, `WORKPAD_HEADING_REGEX`, `MISSION_ID_REGEX`, `formatWorkpadTimestamp`, `isValidMissionId`, `isValidState`, `isValidTransition`) live inside `mission-tracker.js` (sometimes as private constants, sometimes as instance methods like `tracker.isValidId`). Functionally equivalent; leaving the surface choice to a follow-up if any direct consumers need to be added later.

---

## 10. P4 migration log (summary)

All five candidate scripts in section 1 were migrated to call `MissionTracker`
in P4. Per-file MIGRATED notes are attached to each script's section above.

**Verification:**
- `npm run test:lib` — 31 parser + 32 tracker = 63 tests pass post-migration.
- Smoke tests for each script ran in a fresh temp git repo and produced
  identical-or-better output:
  - `log-verification.js` — appended a valid JSONL record; exit 0.
  - `mission-worktree.js list` — printed `no mission worktrees`; exit 0.
  - `evidence-packet.js generate M-0001` — produced `summary.md` with the
    expected acceptance, verification, diff, auto-review, and screenshots
    sections; exit 0.
  - `codex-review.js loadMission(M-0042)` — probed via in-process require;
    returned full body and Acceptance Criteria section content.
  - `codex-review-loop.js appendMissionWorkpad(payload)` — probed via
    in-process require; produced canonical-format workpad entry, preserved
    prior content, bumped `updated`.
- **Distribution verification (added at P4 close):** `npm pack --dry-run`
  output includes `framework/lib/mission-parser.js` (15.3kB),
  `framework/lib/mission-schema.js` (7.4kB), and
  `framework/lib/mission-tracker.js` (19.4kB) in the tarball contents; no
  `*.test.js` files appear (filtered out by listing specific files in
  `package.json` `files` instead of the directory). End-to-end install
  simulation: ran `bin/cli.js --local --greenfield --yes` against a fresh
  temp repo, the printed install summary now includes a "Library" line, the
  resulting `<project>/lib/` directory contains the three production files,
  and `node -e "require('./lib/mission-tracker.js')"` resolves cleanly.

**Behavior change to flag (intentional, aligned with P3 canonical format):**

`codex-review-loop.js` workpad entries previously used the heading
`### YYYY-MM-DD HH:MM UTC — codex-loop`. They now use the canonical
`### YYYY-MM-DD HH:MM` form (no UTC marker, no role suffix). The
`codex-loop` attribution is preserved as the first line of the note body
(`**codex-loop** — L8 cross-model review terminal state: ...`).

**Wire-format coupling discovered + resolved in P4:**

The above format change broke the implicit contract between writer
(`tracker.appendWorkpadEntry` and migrated `codex-review-loop.js`) and
reader (`apes-status.md`'s inline workpad-timestamp regex). To avoid
shipping `main` with a writer/reader mismatch, the inline regex in
`apes-status.md` line 144 was tightened to explicitly accept both shapes:

```js
/^###\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+—\s+\S.*)?\s*$/gm
```

— anchored at end-of-line, with an optional non-capturing group for the
legacy role suffix. The capture groups (date, time) are unchanged so
downstream code that uses `lastWorkpad` is unaffected. Verified against
canonical, legacy-with-role, legacy-with-codex-loop-role samples (all
match) plus mid-line/malformed/heading-only negatives (all rejected). P5
will rewrite `apes-status.md` more thoroughly to call the tracker
directly; this fix preserves parity in the meantime.

**Discrepancies NOT yet resolved:**

- 6.1 `defaultBranch` divergence — `mission-worktree.js` uses
  `feat/<id>-<slug>`, `evidence-packet.js` uses `feat/<id>` (no slug). P3
  did not add `defaultBranch` to MissionTracker, so each script keeps its
  own variant for now. A future phase could centralize.
- LEVEL_NAMES dictionary still local to `log-verification.js` —
  `mission-schema.js` only exports `LEVEL_IDS`. If any other script ever
  needs the human-readable names, hoist them then.

**Distribution fix (folded into P4 close):**

- `package.json` `files` array now lists the three production lib modules
  by name (`framework/lib/mission-parser.js`, `framework/lib/mission-schema.js`,
  `framework/lib/mission-tracker.js`). Listing files individually rather than
  the whole directory keeps `*.test.js` out of the npm tarball without
  needing `.npmignore`.
- `bin/cli.js` gained a `copyDir(FRAMEWORK_DIR/lib, installBase/lib, "lib")`
  call directly after the existing scripts copy, gated by the same
  `--no-hooks` flag (the lib has no consumers when scripts aren't installed).
  The install summary now prints a "Library" line.
- Verified by `npm pack --dry-run` (3 lib files in tarball, no test files)
  and an end-to-end install simulation (`<project>/lib/` populated,
  `require()` resolves cleanly post-install).

**DEFERRED to P5 (commands):**

- `apes-mission.md`, `apes-build.md`, `apes-status.md`, `apes-evidence.md`,
  `apes-verify.md`, `apes-codex-review.md` — all retain inline mission
  logic. These are markdown instruction templates that Claude Code reads at
  runtime (not Node scripts), so the migration shape is different. P5 will
  rewrite the inline `node -e` blocks to call the now-installed scripts and
  the tracker library directly.

---

## 11. M-0002 final accounting

This section closes the M-0002 mission. It captures what shipped, what it
cost, and the honest ROI assessment so future refactor decisions in this
codebase have a real baseline to compare against.

### 11.1 Diff totals

#### P5+P6 working tree (since the M-0002 commit `3788f05`)

```
 ARCHITECTURE.md                       |  66 ++++++-
 CHANGELOG.md                          | 215 ++++++++++++++++++++++
 CLAUDE.md                             |  10 +
 README.md                             |   7 +-
 _planning/M-0002-inventory.md         | 138 ++++++++++++++
 framework/commands/apes-build.md      | 147 ++++++++-------
 framework/commands/apes-evidence.md   |  22 ++-
 framework/commands/apes-mission.md    | 336 +++++++++++++++++-----------------
 framework/commands/apes-status.md     | 233 +++++++++--------------
 framework/lib/mission-tracker.js      |  97 ++++++++++
 framework/lib/mission-tracker.test.js |  70 +++++++
 framework/settings.json               |   1 +
 framework/skills/missions.md          |  40 ++++
 package.json                          |   4 +-
 14 files changed, 988 insertions(+), 398 deletions(-)
```

(The 138-line bump on this inventory file is *this* "Final accounting"
section — the document records its own footprint.)

Plus untracked artifacts produced in P6:

| Path | Lines | Purpose |
|---|---:|---|
| `framework/scripts/mission-cli.js` | 537 | Reconstruction of the lost P5 deliverable; shell-friendly JSON wrapper |
| `_planning/incidents/2026-05-03-framework-destruction.md` | 271 | Postmortem from the P6 smoke-test incident |

**Net P5+P6:** 13 files modified (+850 / −398), 2 files added (808 lines).

#### Whole M-0002 mission (P1–P6 cumulative, vs `e3f3777` v3.2.0 baseline)

```
 _planning/M-0002-inventory.md         | ~810 +++++++++++ (P1 + this section)
 _planning/incidents/...               |  271 ++++       (P6 postmortem)
 ARCHITECTURE.md                       |   66 ++++       (P6)
 CHANGELOG.md                          |  215 ++++       (P6)
 CLAUDE.md                             |   10 ++         (P6)
 README.md                             |    7 ++         (P6)
 bin/cli.js                            |   13 ++         (P3 install lib)
 framework/commands/apes-build.md      |  147 ↔          (P5 migrate)
 framework/commands/apes-evidence.md   |   22 ↔          (P5 migrate)
 framework/commands/apes-mission.md    |  336 ↔          (P5 migrate)
 framework/commands/apes-status.md     |  233 ↔          (P5 migrate)
 framework/lib/mission-parser.js       |  456 +++++      (P3 new)
 framework/lib/mission-parser.test.js  |  442 +++++      (P3 new)
 framework/lib/mission-schema.js       |  192 +++++      (P3 new)
 framework/lib/mission-tracker.js      |  617 +++++      (P3+P5 new)
 framework/lib/mission-tracker.test.js |  569 +++++      (P3+P5 new)
 framework/scripts/codex-review-loop.js|   85 ↔          (P4 migrate)
 framework/scripts/codex-review.js     |   87 ↔          (P4 migrate)
 framework/scripts/evidence-packet.js  |  192 ↔ (−)      (P4 migrate; net deletion)
 framework/scripts/log-verification.js |   60 ↔          (P4 migrate)
 framework/scripts/mission-cli.js      |  537 +++++      (P5 new, P6 reconstructed)
 framework/scripts/mission-worktree.js |   77 ↔          (P4 migrate)
 framework/settings.json               |    1 ++         (P5 permission)
 framework/skills/missions.md          |   40 ++         (P6 Programmatic API)
 package.json                          |    8 ++         (P3 lib + P6 version + test)
```

### 11.2 Test count delta

| Stage | Lib parser tests | Lib tracker tests | Total |
|---|---:|---:|---:|
| Pre-M-0002 (`e3f3777`, v3.2.0 baseline) | 0 | 0 | **0** |
| Post-M-0002 commit (`3788f05`) | 31 | 32 | 63 |
| Post-P5+P6 (working tree) | 31 | 37 | **68** |

Net: **+68 lib tests** under all mission operations where there were
zero before. Five additional tracker tests were added during P5
migration as edge cases surfaced from real call sites.

`npm test` (which previously executed a nonexistent `test/test.js` and
errored) now runs the lib suite. From "broken script" to "68 green
tests" is part of the delta.

### 11.3 Cost vs delivered — honest accounting

**What it cost.** Six phases of work spread across multiple sessions.
Roughly 3,500 lines of new code across the lib (~1,265), tests
(~1,011), CLI (~537), inventory (~810), and postmortem (~270). Five
scripts and four slash commands rewritten. One mid-mission incident
(framework-directory destruction during P6 smoke testing) that cost
~30 minutes of recovery work and lost one untracked file
(`mission-cli.js`), reconstructed from a header docstring read into
context shortly before the loss. The reconstruction passed a 45/45
verb-by-verb sweep but cannot be byte-verified against the original.

**What was delivered.** Seven duplicate `STATES` constants collapsed
to one frozen export. Five duplicate `findMissionFile` implementations
collapsed to `tracker.findMissionById`. Five duplicate frontmatter
parsers collapsed to `mission-parser.js` with full edge-case test
coverage. Inline `node -e` blocks in four slash commands replaced with
`mission-cli.js` invocations. Schema-versioning infrastructure
(`CURRENT_SCHEMA_VERSION`, `migrateFrontmatter`, `MIGRATIONS` array) in
place, even though no migrations are needed today — adding one is now
a one-record append rather than a callsite sweep. Pluggable storage
backend shape established (the `MissionTracker` API surface admits a
Linear or GitHub-Issues backend without changing call sites). 68 tests
under all mission operations.

**ROI assessment.** The consolidation pays back the moment a future
mission-touching change lands — instead of editing five files with
hand-rolled regex (and missing one), the change is in `mission-tracker.js`
with tests. The schema-versioning and pluggable-backend infrastructure
are *unrealized* value today: neither has a consumer. If neither lands
a real use case in the next 2–3 releases, they should be reconsidered
as YAGNI carry-cost rather than treated as accomplishments — the lib
will keep working without them. The CLI (`mission-cli.js`) has clear
near-term value: external tooling and shell automation can now call
mission ops without ever loading Node modules.

**One thing to do differently next refactor.** Track new files in git
on creation, even as `wip/`. Untracked deliverables have no recovery
path. `mission-cli.js` going untracked from P5 close to P6 destruction
is the only reason this section talks about a "reconstruction" instead
of "the original P5 file." Cost: hours. Mitigation cost: `git add`. See
`_planning/incidents/2026-05-03-framework-destruction.md` § "What
changes prevent recurrence."

### 11.4 Verification at close

- `npm test` → 68 lib tests pass.
- `npm pack --dry-run` → tarball includes `framework/lib/{mission-parser,mission-schema,mission-tracker}.js` and `framework/scripts/mission-cli.js`; no `*.test.js` files leak.
- 45-case CLI sweep against `mission-cli.js` (read-only happy paths, invalid input, not-found, precondition, --help, mutating happy paths) — all 45 pass. Harness lives at `$env:TEMP\dosapes-cli-sweep\sweep.ps1` and rebuilds the fixture on every run.
- Smoke tests: `evidence-packet.js generate` produces a valid packet; `mission-worktree.js list/create/remove` works (create correctly refuses without a `main` branch); `log-verification.js` writes valid JSONL.
- Pre-existing edge case observed (not introduced by M-0002): `move` of a mission whose per-mission directory contains only untracked files (e.g. unstaged `verification.jsonl`) fails with "git mv: source directory is empty." Same shape exists in pre-P5 `apes-mission.md`. Worth a follow-up mission, not a release blocker.

M-0002 is closed. Next mission picks up from a clean library API.
