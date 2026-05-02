# Changelog

All notable changes to the Dos Apes Super Agent Framework are documented in
this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] — 2026-05-02

The **adversarial review release**. Adds L8 to the verification pyramid: a
second model (the OpenAI Codex CLI, default `gpt-5.5`) reviews the diff
produced by the first model (Claude) and emits structured findings against a
JSON schema. A feedback-loop driver addresses high/critical findings
automatically up to a configurable iteration cap. Everything is opt-in,
capability-gated, and fails open — the framework remains fully functional
without Codex installed.

### Added

- **L8 — Adversarial Review.** New top of the verification pyramid.
  Cross-model review of the current branch's diff via the Codex CLI.
  Disabled by default; flip on with `/apes-codex-review --enable`.
- **`scripts/codex-check.js`** — prerequisite verifier. Confirms `codex` is
  on PATH, the user is authenticated, and the configured model honors
  `--output-schema` by running an actual structured-output round-trip (not
  a string-pattern model-name check). Caches the verified capability to
  `.dos-apes/codex-capabilities.json` with a 24-hour TTL keyed on model;
  changing the configured model invalidates the cache automatically.
  Documented exit codes: `0` ready, `1` CLI missing, `2` not authenticated,
  `3` model lacks structured-output support, `4` network/timeout. Zero
  npm dependencies; Node built-ins only.
- **`scripts/codex-review.js`** — single-shot review primitive. Computes
  the diff vs `--base`, substitutes mission/diff into the prompt template,
  invokes Codex with `--output-schema` and `--output-last-message`, parses
  and validates the result against the four required top-level keys
  (`verdict`, `confidence`, `summary`, `findings`), filters findings
  against `skip_paths` globs, and writes the review to disk. Tolerant of
  Codex being unavailable (skips with a JSON envelope rather than
  failing). Optional `--mission <id>` integrates with the mission
  verification log.
- **`scripts/codex-review-loop.js`** — review-fix-review loop driver. Runs
  `codex-review.js`, evaluates findings against `loop_on_severity` (default
  `["high", "critical"]`), writes per-iteration feedback packets to
  `.dos-apes/codex-reviews/iteration-N/`, spawns Claude Code to address
  them, and repeats up to `max_iterations` (default 3). Six terminal
  states, all reachable in code: `accepted`, `partial-success`,
  `findings-reported` (`--no-fix`), `exhausted`, `no-progress`, `skipped`.
  Detects no-progress by comparing `git rev-parse HEAD` before and after
  each fix attempt. Appends a workpad entry to the active mission file
  per the missions-skill convention.
- **`/apes-codex-review` slash command.** Subcommands: default (single-shot
  review), `--loop` (full feedback loop), `--mission <id>`, `--enable`,
  `--disable`, `--status`. Loads `cross-model-review.md` in its preamble.
  Worked example output for clean accept, findings-with-suggestion, loop
  accepted, loop exhausted, and loop no-progress.
- **`framework/skills/cross-model-review.md`** — the consumer protocol.
  Verdict semantics, severity-by-verdict eligibility table, sort order
  (`severity_rank, file, line`), fix protocol with the documented commit
  format `fix(codex-review): address iteration N findings`, anti-pattern
  list, mission-composition rules, and the three loop-termination
  conditions mapped to terminal states.
- **`framework/templates/codex-review-config.json`** — opt-in config
  template (9 fields). Defaults: `enabled:false`, `model:"gpt-5.5"`,
  `reasoning_effort:"high"`, `sandbox:"read-only"`, `max_iterations:3`,
  `loop_on_severity:["high","critical"]`, `diff_base:"main"`,
  `timeout_seconds:300`, conservative `skip_paths`.
- **`framework/templates/codex-review-config.README.md`** — field-by-field
  reference plus exit-code table for `codex-check.js`. Documents the
  `gpt-5-codex` `--output-schema` issue and why the default is `gpt-5.5`.
- **`framework/templates/codex-review-prompt.md`** — reviewer prompt with
  scope rules, citation requirement, severity definitions, and four
  documented placeholders (`{{MISSION_CONTEXT}}`, `{{ACCEPTANCE_CRITERIA}}`,
  `{{DIFF_STATS}}`, `{{DIFF}}`).
- **`framework/templates/codex-review-schema.json`** — JSON Schema (draft
  2020-12) for the structured findings. Locked down with
  `additionalProperties: false` at root, `findings[]`, and `line_range`.
- **Enforcement-tiers section in `testing.md`.** Formalizes the existing
  groupings (Deterministic / Automated / Comprehensive) and adds a fourth
  tier — **External** — for L8.

### Changed

- **Verification pyramid expanded from 8 to 9 levels.** Updated diagrams
  and counts in `testing.md`, `apes-verify.md`, `README.md`, and
  `ARCHITECTURE.md`.
- **`/apes-verify`** runs L8 as a single-shot review (no loop) after the
  browser-tier levels. Conditional on `enabled:true` in
  `.dos-apes/codex-review-config.json` AND `scripts/codex-review.js` being
  installed. **L8 never contributes to FAIL** — it fails open.
- **`/apes-build`** invokes the L8 loop for the active mission between
  L0–L7 verification and evidence-packet generation. Same enabled-flag
  guard. Branches on all six terminal states; `exhausted` and
  `no-progress` set `codex_findings_unresolved: true` in the mission
  frontmatter and still proceed to packet generation (the packet is the
  audit artifact — surfacing unresolved findings beats hiding them).
- **`scripts/log-verification.js`** recognizes `L8` as `Adversarial Review`
  in `LEVEL_NAMES`. Pre-3.2.0 versions reject `L8` as an unknown level
  (exit 2); `codex-review.js` tolerates that defensively (warns and
  continues) so users who upgrade the Codex pieces without re-running the
  installer see clear stderr output instead of silent data loss. Both
  defenses stay — belt and suspenders.
- **`package.json` description** mentions the 9-level pyramid.
- **`package.json` `files` array** extended with the four new templates.

### Required (optional)

- **Codex CLI** for L8 functionality. Install via
  `npm install -g @openai/codex` and run `codex login` once per machine
  (auth via ChatGPT account; no API key required). The framework remains
  **fully functional without it** — every L8 entry point fails open.
- **Node ≥ 18, Git ≥ 2.20** (unchanged from prior releases).

### Notes — issues encountered during the playbook execution

The playbook (P1–P7) ran end-to-end with three deviations from the spec
worth recording. Each is intentional, documented in code, and was approved
by the user during the review pass.

#### Deviation 1: P3 hybrid positional/stdin prompt routing

**Where:** `framework/scripts/codex-review.js` `spawnCodex()`.

**Spec said:** "Pass the prompt as a positional argument (not via stdin)
for cross-platform reliability — PowerShell's stdin handling differs from
bash's, and the playbook needs to work on both."

**Why deviated:** On Windows where the Codex CLI installs as a `.cmd`
shim (the `npm install -g` default), the resolved binary forces routing
through `cmd.exe`, whose argv ceiling is ~8 KB. A 500-line diff produces
an ~80 KB prompt — silently truncated under strict positional-only.
Verified with `codex.cmd` on the maintainer's machine: routed-through-cmd
fails the acceptance criterion "diff substitution works with at least one
~500-line diff."

**Resolution:** Hybrid — positional arg under a 7 KB threshold, switches
to spawnSync's `input` option (with `-` as the positional) above. Critical
nuance: spawnSync's stdin handling writes to the child's stdin via OS
APIs with **no shell involvement**, so the cross-platform concern the
spec raised (PowerShell-vs-bash piping behavior) does not apply here —
that concern is about *shell-level* piping (`Get-Content | codex`),
not Node-mediated stdin. Documented in the file header.

**Why this matters going forward:** Spec rules that conflict with real
platform constraints should produce visible deviations with reasoning,
not silent truncation. The framework's "L8 fails open" contract would
not save us here — a 7 KB prompt that succeeds and an 80 KB prompt that
silently delivers ~7 KB worth of diff would both look like "L8 ran
green." Hard to debug; better to surface the routing decision in code.

#### Deviation 2: P6 version-bump correction (2.2.0 → 3.2.0)

**Where:** `package.json`, `CHANGELOG.md`, `ARCHITECTURE.md`.

**Spec said:** "Bump package.json version to 2.2.0."

**Why deviated:** The codebase had already shipped `3.0.0` (commit
`36fb25b`) and `3.1.0` (commit `010ff3a`). Bumping to `2.2.0` would have
been a downgrade — semver-confusing (`npm install dos-apes-super-agent`
would still resolve to `3.1.0` as `latest`, leaving the L8 release
effectively invisible) and a regression of the `version` field. There
is direct precedent: the 3.1.0 changelog (line 158, "Non-issue:
version-number question") records the same situation from the prior
playbook (called for `2.1.0` against a 3.0.0 baseline; bumped to
`3.1.0`).

**Resolution:** Bumped to **3.2.0** — the next minor from the actual
current version. Documented here so a future spec author updating the
playbook from a stale baseline gets a clean diff.

#### Deviation 3: P6 pyramid-diagram-in-apes-build is non-applicable

**Where:** `framework/commands/apes-build.md`.

**Spec said:** "Update the pyramid ASCII diagram in apes-verify.md and
apes-build.md to show L8."

**Why deviated:** `apes-build.md` does not have its own pyramid ASCII
diagram. It explicitly delegates: "The verification pyramid runs as
documented in `.claude/skills/testing.md`" (line 156, pre-P6). The
canonical diagram lives in `testing.md` and is updated there.

**Resolution:** Updated `testing.md` and `apes-verify.md`. Did not add a
duplicate diagram to `apes-build.md` — duplication invites drift, and
`apes-build.md` already routes readers to the canonical source. If a
future contributor wants symmetry, the right move is to remove the
delegation prose from `apes-build.md` and add a single canonical
diagram, not to maintain two.

#### Operational note: TODO[P5] for Claude Code CLI invocation

`framework/scripts/codex-review-loop.js`'s `spawnClaudeFix()` carries a
clearly-flagged `TODO[P5]` block listing four specific things to verify
against the live Claude Code CLI: the non-interactive flag (currently
`-p`), explicit-vs-description-match skill loading, allowed-tools
inheritance, and exit-code contract. The loop's defensive paths (ENOENT,
timeout, non-zero exit, no-HEAD-advance) all route to the `no-progress`
terminal state, so a CLI flag drift surfaces visibly rather than
corrupting the loop. Validation deferred to real use — see
`/apes-codex-review --loop` against an intentional-bugs branch.

---

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
