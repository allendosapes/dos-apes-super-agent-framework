# Changelog

All notable changes to the Dos Apes Super Agent Framework are documented in
this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] — 2026-05-01

The **missions release**. The framework gains a filesystem-backed mission
layer between strategic roadmap phases and tactical verification: the atomic
unit of work is now a mission file whose location on disk is its lifecycle
state, executed in an isolated git worktree, audited via a structured
verification log, and consumable by reviewers as a single evidence-packet
bundle.

### Added

- **Missions architecture.** Mission files at `.planning/missions/<state>/M-NNNN-<slug>.md`,
  where `<state>` is one of `todo`, `doing`, `review`, `done`, `canceled`.
  Transitions happen via `git mv`; audit trail is `git log --follow`.
- **Worktree workspaces.** Every `doing` mission runs in `.worktrees/M-NNNN/`
  on its own branch (`feat/m-nnnn-<slug>`). Created and managed by
  `scripts/mission-worktree.js` (zero-dep Node, `execFileSync` only — no
  shell, strict ID/path/branch validation, refuses to remove dirty
  worktrees). Requires git ≥ 2.20.
- **Structured verification log.** Each verification run appends a JSONL
  record to `.planning/missions/<state>/M-NNNN/verification.jsonl` via
  `scripts/log-verification.js`. Schema: `{ timestamp, level, level_name,
  outcome, duration_ms, details, summary }`. Helper resolves the active
  mission from `.planning/active-mission` and degrades gracefully (warns
  to stderr, exits 0) when no mission is active.
- **Evidence packets.** `scripts/evidence-packet.js generate <M-NNNN>`
  assembles `summary.md`, `verification.jsonl`, `diff-stats.txt`, `diff.patch`,
  `auto-review.md`, and `screenshots/` under `.planning/missions/review/M-NNNN/evidence/`.
  Idempotent (wipe + rewrite). **Refuses to generate if any
  `verification.required_levels` lacks a passing entry** — the validation moat.
- **`/apes-mission` command.** Five subcommands: `new`, `list`, `show`,
  `move`, `workpad`. Auto-allocates IDs by scanning all five state dirs
  for `max + 1`. Documents preconditions for every state transition.
- **`/apes-evidence` command.** Wraps the packet generator and prints the
  cover sheet on success.
- **`framework/skills/missions.md`** — Mission file format, lifecycle, FSM,
  naming conventions, dependency resolution, phase relationship, workpad
  protocol, acceptance criteria format, anti-patterns.
- **`framework/skills/worktrees.md`** — Worktree lifecycle, recovery from
  corrupt/stale worktrees, cross-platform notes.
- **`framework/skills/evidence-packets.md`** — Packet contents, reviewer
  checklist, refusal contract, idempotency.
- **`framework/templates/mission-template.md`** — Canonical mission file
  with documented frontmatter schema.
- **`framework/templates/ROADMAP-TEMPLATE.md`** — Phases with metadata
  blocks and an auto-tracked active-missions section.
- **L1.5 verification level** (Documentation Drift), wired through
  `check-doc-drift.sh`.

### Changed

- **`/apes-build` is mission-aware.** New `--mission <M-NNNN>` flag builds
  one mission end-to-end. With `--prd`/`--idea`, generates missions in
  `todo/` first; combined with `--ralph`, iterates through them in priority
  order. `--mission` is mutually exclusive with `--prd`/`--idea`. Default
  (no flags) picks the highest-priority unblocked mission. `.planning/active-mission`
  is cleaned up on every abort path.
- **`/apes-status` reads missions.** New "Missions" section groups by state
  (`Doing`, `Review`, `Todo` top-5, `Done this week`), sorts by priority
  then created date, flags blocked missions with their unmet dependencies,
  reports evidence-packet presence in `review/`, renders empty states
  gracefully. Existing git/progress/worktree sections are untouched.
- **`check-coverage.sh`, `check-secrets.sh`, `check-doc-drift.sh`** now
  call `log-verification.js` after their main work (levels L2.5, L5, L1.5
  respectively). Logging failures never block the verification pipeline.
- **CLI installer** scaffolds `.planning/missions/{todo,doing,review,done,canceled}/`
  with `.gitkeep` files on fresh installs (preserves an existing tree),
  copies `mission-template.md` to `docs/templates/`, and copies
  `ROADMAP-TEMPLATE.md` to `.planning/ROADMAP.md` (preserves an existing roadmap).
- **`testing.md` skill** documents the verification-log schema and the
  graceful-degradation contract for `log-verification.js`.
- **`CLAUDE-TEMPLATE.md`** gains a "Planning & Missions" section, an
  acceptance-criteria writing guide (Specific / Testable / Atomic), and the
  workpad convention with a fully worked example.
- **`README.md`** has a new "Missions" section with the lifecycle CLI, a
  "Why missions?" explainer distinguishing missions (atomic) from phases
  (strategic), updated command tables, and updated file-inventory tree.
- **`ARCHITECTURE.md`** gains a "Mission Layer" section between "Core
  Components" and "Verification Pyramid," an updated architecture diagram
  showing missions and worktrees, and an updated file inventory (53 files).

### Required

- **Git ≥ 2.20** for `git worktree` modern semantics. The worktree script
  exits non-zero with a clear message on older versions.
- **Node ≥ 18** (unchanged from prior releases).

### Notes — issues encountered during the playbook execution

The playbook ran end-to-end with two issues worth recording. Both were
detected and fixed within the same task; nothing leaked downstream.

#### Issue 1: Bash parameter-expansion default trap in verification scripts

**Where:** `check-coverage.sh`, `check-secrets.sh`, `check-doc-drift.sh`
during P5 integration testing.

**Symptom:** When the helper function used `"${3:-{}}"` to default the
details JSON to an empty object, Bash silently appended a stray `}` to any
non-empty value. The resulting string parsed as JSON in the simple case
(empty default `{}`) but failed parsing for every real call site, e.g.
`{"src_changed":true,"doc_updated":false}}`.

**Root cause:** Bash parameter expansion `${VAR:-WORD}` reads `WORD` until
the *first* unescaped `}` — that closes the expansion. The intended
default `{}` looks like `{` to the parser, and the trailing `}` becomes a
literal character appended after the expansion. This is documented Bash
behavior, not a Bash bug. The pattern is widely used and looks correct
unless you read it carefully.

**Fix:** Replaced the inline default with a temp variable:
```bash
local DETAILS="${3-}"
if [ -z "$DETAILS" ]; then DETAILS='{}'; fi
node scripts/log-verification.js LEVEL "$1" "$2" "$DETAILS" 2>/dev/null || true
```

**Why this matters going forward:** The verification log was being silently
truncated to argument-validation errors (exit 2) from `log-verification.js`,
which were swallowed by `2>/dev/null || true` — exactly the right
defensive posture for keeping the pipeline running, but it hid the bug
during the first integration round. Lesson: when wrapping a call in
`|| true`, run it without the wrapper at least once to verify the happy
path actually succeeds.

#### Issue 2: ROADMAP-TEMPLATE.md missing from npm package on first ship

**Where:** P3 created `framework/templates/ROADMAP-TEMPLATE.md` and wired
the CLI to copy it to `.planning/ROADMAP.md`. Surfaced in P10 when the
`npm pack --dry-run` check was added.

**Symptom:** On a real npm install (vs running CLI from a local checkout),
the template would be missing — the CLI's runtime fallback to a stub would
fire silently, hiding the failure.

**Root cause:** `package.json`'s `files` array enumerates each
template by name rather than including the whole `framework/templates/`
directory. P3 added the file to `framework/templates/` and wired the CLI,
but did not update the `files` allowlist. The CLI worked locally because
local development reads from disk, not from the packed tarball.

**Fix:** Added `framework/templates/ROADMAP-TEMPLATE.md` and
`framework/templates/mission-template.md` to `package.json` `files`. Verified
both ship via `npm pack --dry-run` in P10 and again in P12.

**Why this matters going forward:** Files-array enumeration is a
maintenance burden. Consider switching to `"framework/templates/"` as a
directory entry on the next release so new templates ship by default.
Tradeoff: that also ships any internal templates we don't intend to
publish, so it requires hygiene about what lives in that directory.

#### Non-issue: version-number question (2.1.0 vs 3.1.0)

The playbook (P1–P12) was authored against a v2.0 baseline; the codebase
had since shipped 3.0.0 (commit `36fb25b`, "release: v3.0.0"). The
playbook called for "2.1.0" throughout. After flagging the discrepancy,
the chosen version is **3.1.0** — the natural next minor after the
already-published 3.0.0. Going with 2.1.0 would have been numerically
publishable but semver-confusing: `npm install dos-apes-super-agent` would
still resolve to 3.0.0 as `latest`, leaving the missions release effectively
invisible to anyone not pinning a version.

---

## [3.0.0] — 2026-02

Product/orchestration roles, gate-enforced state machine, acceptance
criteria verification, four new skills, `/apes-board`, `/apes-gc`,
ExecPlans, architecture boundary enforcement, enhanced installer.

## [2.0.0] — 2025-02

Agent Teams rebuild, skills architecture, 8-level pyramid, hooks.

## [1.0.0] — 2025-02

Initial release with 12 agents, 5-level verification.
