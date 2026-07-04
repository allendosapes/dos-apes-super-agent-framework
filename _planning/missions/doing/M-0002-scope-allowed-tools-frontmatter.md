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
