---
id: M-0002
title: Scope allowed-tools frontmatter across all commands and skills
priority: 1
labels: [security, dx, skills]
depends_on: [M-0001]  # least-privilege permissions policy
verification:
  required_levels: [L0, L1]
---

## Context

Twelve of fifteen commands declare bare `Bash` in `allowed-tools` frontmatter — each skill
grants itself unrestricted shell for its entire run, defeating the global policy the moment
any framework skill is active. Only `apes-map.md:3` scopes correctly. `allowed-tools`
*grants* (does not restrict) the listed tools while the skill is active, and for
project-checked-in skills takes effect only after workspace trust is accepted.
Analysis report §2.4.

## Scope

**In:** frontmatter of all files under `framework/commands/` and `framework/skills/`.

**Out:** command-body rewrites (compound-command hygiene is its own mission — this mission
changes only frontmatter). Directory-layout migration to `SKILL.md` form (P2 mission).

## Acceptance criteria

- [ ] No command or skill declares bare `Bash` in `allowed-tools`.
- [ ] Each frontmatter grants only tools/scopes exceeding the global baseline shipped by
      M-0001, per the split table in analysis report §2.4:
      build/feature/fix/refactor get branch-create + merge + npm run/test (no push, no tags);
      mission/evidence get their named `node scripts/*.js` entry points + `git commit`;
      codex-review gets the three codex script entry points only;
      verify/security/test-* get check-scripts + playwright + audit + semgrep + log-verification;
      board/metrics/status/help get read-only + `mission-cli list`;
      domain knowledge skills (backend, frontend, product, review, design-integration,
      architecture) get read-only sets — they are documents, not executors.
- [ ] `apes-map` reconciled with final M-0001 policy (reference patterns are not
      grandfathered); used as the reference pattern in the diff description.
- [ ] Fresh install smoke check: `/apes-mission list` and `/apes-status` run end-to-end with
      zero permission prompts, **except** the two known `node -e` pipelines
      (`apes-mission.md:123`, `apes-status.md:80`), which are M-0003 remediation scope
      (see `_planning/M-0003-scope-additions.md`); `/apes-build` on a sample mission
      prompts only at the intended ask points (push, reset, tag ops). The unqualified
      zero-prompt criterion holds at the 3.6.0 release level, not per-mission.

## References

Analysis report §2.4 table. Note the trust-dialog caveat: frontmatter grants activate only
after workspace trust — first-run UX still includes exactly one trust prompt by design.

## Workpad

### 2026-07-04 16:07

Task 0 accepted; flag decisions recorded in the Task 0 review (see PR discussion).
Verification note: **L1 is mechanized by the O1 drift-guard test** (frontmatter parse +
`allowed-tools` syntax validation + declaration/usage cross-check), committed under the
repo's test layout and running via `npm test` — not by a linter (none exists in this
zero-dep repo). The test also rides L0 (`npm test`). Known caveat, no action:
`scripts/log-verification.js` no-ops in this repo (`_planning/` vs `.planning/` — P3
dogfooding gap); verification evidence goes in workpad/PR text per M-0001 precedent.

### 2026-07-04 16:17

Task 1 correction: Task 0's scoping table wrongly listed `cat`, `wc`, `tail` as invoked
by apes-map's body (the row transcribed the existing grant list, not the body
extraction). Re-verified by grep: all three appear only on the frontmatter line. Trimmed
per rule 5 (declare only what the body invokes — same logic as board's dropped
mission-cli grant); keeping them would fail the accepted Task 6 drift-guard's
declarations-without-usage check. Final apes-map grants: `find`, `ls`, `head` + Read,
Grep, Glob. Consequence for Tasks 2–5: the table's "body invokes" column is a
hypothesis to re-verify per file, not ground truth.

### 2026-07-04 16:22

Task 2 re-verification found the Task 0 extraction bug: fenced blocks indented inside
numbered lists were skipped (fence regex anchored at column 0), so apes-feature's and
apes-refactor's git/npm workflows were missing from the table. All five build-family
bodies re-read in full. Corrections vs the table: apes-build's `npm run dev` is
template content (generated CLAUDE.md block at :687), not an invocation — not granted;
apes-fix directly invokes only `npm test` (build/typecheck/lint appear in a GATE task
description); apes-refactor invokes `npm run test:coverage` (:30), the one grant that
truly exceeds the M-0001 baseline. New body-vs-policy conflict found and ledgered:
`git push origin --delete` at apes-feature.md:249 / apes-build.md:415 hits an M-0001
deny rule. Task-tools usage found across all five bodies (TaskCreate/TaskUpdate/
TaskList) — held back from frontmatter pending FLAG-H-style ruling.

### 2026-07-04 16:25

Task 2 gate decisions applied. Q1: Task tools added per FLAG H — build gets
TaskCreate/TaskUpdate/TaskList; feature/fix/refactor get TaskCreate; gc gets TaskList
(line 45 "via TaskList" judged an invocation: the sweep's own executor calls it, unlike
the architecture.md hook-executed check-structure reference). Q2: fix stays lean
(`npm test` only). Q3: `Bash(npm run lint:*)` prefix-covers `lint:fix` — accepted as
deliberate overmatch under M-0001's documented overmatch policy (backstops must not
undermatch; here the prefix stays inside the lint-script family). Q4: deny-conflict
ledger entry upgraded to functional break + must-fix M-0003 AC. Root cause of the
Task 0 table gaps (column-0 fence parser, see 16:22 entry) is now a required
regression fixture for Task 6's extraction heuristic, ledgered in the non-M-0003
section. Timestamp note: the 16:22 entry was originally mis-stamped 16:29 (written
without checking the clock); corrected for monotonic order.

### 2026-07-04 16:40

Task 3 (mission-ops commands) body re-verification, all three read in full.
apes-mission: every §2.4 group-B grant is evidenced, including
`evidence-packet.js generate` (:212, the doing→review precondition); Edit/Write
dropped — all writes route through mission-cli. apes-evidence: group-B row applied
minus `mission-worktree.js` (never invoked by this body — rule-5 trim); gains its
first-ever allowed-tools line. apes-codex-review: three codex scripts per row; Edit
retained per approved row (config flips currently via inline `node -e`, M-0003
scope — Edit is the natural post-M-0003 mechanism); `codex --version` / `codex login`
prerequisites are baseline-covered. Held for gate: per-body read-only utilities not
in approved rows (`ls` apes-mission:164, `cat` apes-evidence:49,70 + codex-review
--status ×3) — recommend leaving un-granted; they sit inside compound/`node -e`
blocks that prompt regardless until M-0003.

Gate rulings: utilities stay un-granted — M-0003 owns migration-caused frontmatter
deltas and adds grants alongside its rewrites (distinct from apes-map's `ls`, a
standalone invocation the grant actually silences). **Deviation from §2.4's
codex-review row: Edit dropped.** Granting it today would be aspirational (the
config flips it would serve are still inline `node -e`) — a declarations-without-
usage failure against the Task 6 guard, same class as apes-map's cat/wc/tail;
M-0003 restores Edit in the same commit that migrates the flips. apes-mission's
Edit/Write drop justified by the body's own rule: "All filesystem changes pass
through the CLI, which calls `MissionTracker`" (apes-mission.md Notes).

### 2026-07-04 16:52

Task 4 (verification commands + read-only quartet), all nine bodies verified in full.
Rule-5 trims vs §2.4 group rows: verify loses `npx semgrep` (never invoked there);
security-scan loses playwright and log-verification (never invoked; notably the scan
does not log its own outcomes — possible future gap, not this mission);
test-e2e/-visual/-a11y keep only playwright. Evidence-based extensions (FLAG A/H
logic): verify gains the npm-run quartet it directly runs as L0–L2 plus
`codex-review.js` (:255, the L8 single-shot) and TaskUpdate (:312 gate update);
status gains TaskList (:12,:25), the npm-run quartet (:60–63), and keeps
`mission-cli list` (genuinely invoked at :80, unlike board's aspirational grant).
test-e2e keeps Write (test generation is its core function) and drops the stale
`Task` tool name (v1 artifact, same class M-0001 purged from settings). metrics
goes rule-5-lean (`Read, Grep, Glob`) — its entire executable body is
cat/ls/`node -e` pipelines, M-0003 scope; the shared-row mission-cli grant would
be aspirational. help: earlier gate ruling said "shared board-style row, no
minimal form," but every shared-row grant would be a declaration-without-usage
(help executes nothing) — the same class the later codex-review-Edit ruling
rejected. Applied lean pending explicit resolution at the Task 4 gate.

### 2026-07-04 17:49

Task 4 gate: all trims and extensions approved as presented. **Explicit reversal:**
the Task 0 ruling "apes-help gets the shared board-style row, no minimal form" is
superseded — it was a pre-evidence ruling, and body evidence governs (help executes
nothing; every shared-row grant would fail the Task 6 declarations-without-usage
guard, same class as the codex-review Edit correction). apes-help and apes-metrics
land at the lean `Read, Grep, Glob` floor. New Task 6 guard convention defined at
this gate and ledgered: `Read, Grep, Glob` is the permitted floor for prose-only
files — never flagged as unused; everything above the floor requires body evidence.

### 2026-07-04 17:58

Task 5 (all fifteen skills). Extraction re-run with fence parser fixed for indented
fences; that pass exposed a third formatting class — browser-verification.md uses
**unfenced indentation-style code**, invisible to both parsers. A repo-wide sweep for
that pattern found no other skill hiding commands the same way (only observability's
known curls). Task 6 fixture requirement extended accordingly (ledger updated).

Grants: six domain skills at the `Read, Grep, Glob` floor (review.md and product.md
already correct — untouched). orchestration drops bare Bash only (its `git tag`
examples hit ask by design). worktrees/missions/evidence-packets/testing scoped to
their named scripts. observability and devops read-only per FLAG I (curl prompts by
design; devops keeps `npx playwright` per the approved smoke-test add-on; its
`npm run build` invocation is baseline-covered, un-granted).

**Deliberate skill-scoped policy relaxation (FLAG J):** browser-verification gains
`Bash(agent-browser:*)` — the narrowest relaxation of M-0001's "printed suggestion"
stance; baseline stays clean. Requires explicit callout in the PR description and
L8 attention.

**Deviations found by re-verification (flagged at gate):** evidence-packets loses
`log-verification.js` from the approved row — reference-only (line 86 frames the
call as the check-script's job; the loader is instructed to run the *generator*,
which stays). cross-model-review loses all three codex scripts from its Task 0
approved row — the loader consumes findings files and fixes code (Edit evidenced,
`mission-cli show` :175 evidenced) but never runs the review scripts; the loop
driver and /apes-codex-review own those. Reference ≠ invocation, per the
architecture/check-structure precedent. New M-0003 pipeline site ledgered:
cross-model-review.md:175-176 (`mission-cli show | node -e`).

### 2026-07-04 18:12

Task 5 gate: approved as presented, both deviations included. **Evidence-based
reversals ratified:** (1) cross-model-review's Task 0-approved row (three codex
scripts) superseded by the full read — reference ≠ invocation governs, per the
gc/architecture precedent, the same way body evidence superseded the apes-help
shared-row ruling; (2) evidence-packets' row loses log-verification.js on the same
basis. File coverage complete: 18/18 commands + 15/15 skills scoped. Both fence-
format fixture requirements (indented-fence, unfenced-indented) confirmed present
in the ledger's Task 6 section. Next: Task 6 guard design gate before any code.

### 2026-07-04 18:35

Task 6 implemented per the approved design: `framework/scripts/allowed-tools-guard.test.js`
+ two pinned fixtures under `framework/scripts/fixtures/allowed-tools-guard/`. Wired
into `test:lib` (rides L0, constitutes L1). cli.test.js packaging group extended:
asserts no `fixtures/` path ships. Matcher replicates Claude Code semantics with the
bare-form quirk (header-commented with docs citation). Result: **104 guard checks
pass; full `npm test` green (all suites)**. Pin inventory: 1 expected-deny
(apes-feature:249 push --delete, cites ledger), 77 known-prompting (node-e/util/env/
fallback/policy/bare-form classes), 2 prose-justified (evidence-packets generator,
test-e2e playwright). Note: apes-build:415's push --delete is a prose policy bullet,
not extractable code — only the apes-feature site carries a mechanical deny pin; the
ledger entry covers both. **New policy finding:** the faithful matcher surfaced
bare-form gaps (bare `git status`/`git stash`/`git tag <name>`/argument-less
check-structure.sh unmatched by their space-star rules; bare `git tag` also bypasses
the `-a` ask rule) — ledgered for M-0003/M-0004. L1 for this mission is hereby
mechanized and passing.

### 2026-07-04 19:50

Task 6 correction gate. Three corrections applied: (1) Layer B's Task-tool check was
unfalsifiable — it scanned the full file, so the frontmatter declaration matched
itself; now runs both directions against a body-only slice, with synthetic negative
self-checks in the abort gate. **Its first falsifiable run caught drift introduced by
this mission's own Task 5 evidence defect (FLAG H):** the Task 5 "TOOL extraction"
grep had the same whole-file flaw, so product's TaskCreate/TaskUpdate and
orchestration's TaskList "disk evidence" was partly self-matching. Ruling: product/
TaskUpdate **trimmed** (weakest-citation pin would violate the pin table's
every-entry-cites contract; restore only with real evidence, same commit);
product/TaskCreate (:127) and orchestration/TaskList (:272) kept as cited prose
pins. (2) Layer C precedence reordered to deny → frontmatter → allow → ask
(frontmatter grants silence ask prompts — the M-0002 premise), documented in the
header. (3) Fence nesting verified corpus-wide: none nested, none unclosed, no
powershell/cmd blocks — header LIMITATION note instead of a third fixture; the
`npm run deploy` pin is satisfied by the real deployment step at apes-build:1109,
not the :687 template. Tracker §1 deny wording corrected (one executable site
feature:249, one prose bullet build:415 — 6920f34 predated the distinction).
Guard green post-trim: 108 passed (pins: 1 deny, 77 prompt, 2 prose, 2 task-tool).

### 2026-07-04 20:35

Guard file review complete; corrections approved as uploaded. Re-ledger ruling applied
to the bare-form entry: policy-side exact-form pairs go to the **deny-audit follow-up
thread**, not M-0004 — M-0004 inherits policy, it doesn't author it; pairs ride its
migration only if the deny-audit lands in 3.6.0. (The 18:35 entry's "M-0003/M-0004"
routing stands as written — workpad is append-only history; this entry supersedes it.)
Body-side fixes remain M-0003 sweep candidates. Correction-gate details are in the
19:50 entry. Task 6 commit proceeds; Task 7 closeout next, tracker as checklist.
