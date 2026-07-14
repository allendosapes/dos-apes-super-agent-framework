---
id: M-0004
schema_version: 2
title: Worktree write guard, mission-move companions, CLAUDE.md batch
state: review
created: 2026-07-13
updated: 2026-07-13
priority: 1
depends_on:
  - M-0003
labels:
  - hooks
  - worktrees
  - missions
codex:
  required: false
verification:
  required_levels:
    - L0
    - L1
    - L2
workspace:
  branch: mission/M-0004-worktree-guard-and-move-fixes
  worktree: .worktrees/M-0004
---

## Context

M-0003's AC-9 live-fire dry-run surfaced two release-blocking defects and
a bundled grant gap, all ledgered with dispositions at the M-0003 closeout
(`_planning/M-0003-scope-additions.md`, 2026-07-13 entries): the
guard-main-branch hook blocks the framework's own worktree flow, the
mission-move transition breaks on untracked companion files, and the
EnterWorktree escape hatch is ungranted. M-0004 fixes the defects, ships
the grant, lands the queued CLAUDE.md hazard batch, and re-runs the
dry-run to prove the flagship flow no longer fights its own policy.
Charter + execution playbook: `_planning/M-0004-charter-and-playbook.md`.
3.6.0 beta publish is gated on AC-1 through AC-3 and AC-6.

## Acceptance criteria

- [ ] **AC-1 (blocking):** `guard-main-branch.sh` resolves the branch of
      the **target path's containing worktree**, not the session cwd.
      Writes into the framework's worktree directories succeed when that
      worktree has a mission branch checked out; direct writes to
      main-checked-out paths remain blocked. Regression tests cover both
      directions (worktree write from main cwd passes; main write still
      blocked).
- [ ] **AC-2 (blocking, ships with AC-1):** `EnterWorktree` granted in
      the shipped `settings.json` allow-list; allowed-tools guard
      covering-declaration bookkeeping updated in the same commit.
- [ ] **AC-3 (blocking):** `mission-cli.js move` succeeds when the
      mission has untracked companion files and/or a pre-existing
      destination directory: `git mv` for tracked files, plain-rename
      fallback for untracked companions, tolerate existing `review/<id>/`.
      Tests cover the exact M-0003 failure shape (tracked mission file +
      untracked evidence dir + pre-created destination).
- [ ] **AC-4:** CLAUDE.md updated with the queued hazard batch: the three
      entries from `_planning/M-0002-process-notes-for-claude-md.md`
      (retire that file once absorbed), the session-cwd-vs-target-path
      hook defect-class note, and the RM-staging hazard (git mv stages
      the rename; later content edits need their own add; verify
      committed contents post-commit). Stay under the CLAUDE.md token
      budget — prune if needed.
- [ ] **AC-5:** M-0003's `review → done` transition rides this branch's
      **first commit**.
- [ ] **AC-6 (blocking):** In-use verification — re-run the AC-9-style
      headless `/apes-build` dry-run (Task 3a probe method, Git Bash
      runner). Expected: the three Write denials, the improvised-fallback
      cascade, and the EnterWorktree prompt are gone. Remaining
      acceptable denials: only the parked cd-prefixed-chain class and, if
      it recurs, the parked mkdir anomaly (evidence appended, still no
      fix).
- [ ] **AC-7:** Final state — allowed-tools guard test and full npm test
      green at final HEAD.
- [ ] **AC-8 (blocking, absorbed 2026-07-13):** Packaging completeness —
      the six M-0003 AC-4 helper scripts added to package.json's `files`
      whitelist, plus a REVERSE packaging assertion in cli.test.js's
      packaging group: every `scripts/*.js|sh` invoked by shipped
      command/skill bodies (and present in `framework/scripts/`) must
      ship. Proven red against the pre-fix whitelist (exactly the six
      helpers), then green post-fix. (M-0004 ledger 2026-07-13, ABSORBED
      per CPO ruling.)

## Out of scope

The installer permission migration (`--update-permissions`) — refiled as
M-0006 at this mission's opening; it gates `latest` promotion, not the
3.6.0 beta publish. Also out: the parked mkdir anomaly (optional bounded
probe only), the parked template-hygiene candidate, the parked
cd-prefixed-chain class, and anything not enumerated above. New
discoveries get appended to the ledger with file:line evidence, never
fixed in-mission.

## References

`_planning/M-0004-charter-and-playbook.md` (charter + playbook);
`_planning/M-0003-scope-additions.md` (AC-9 candidates + dispositions,
2026-07-13); `_planning/missions/review/M-0003/evidence/ac9-result.json`
(the denial log AC-6 compares against);
`framework/scripts/guard-main-branch.sh`; `framework/lib/mission-tracker.js`
(moveMissionState); `framework/scripts/mission-cli.js`.

## Workpad

<!-- Append timestamped entries; do not delete prior entries. -->

### 2026-07-13 — Closeout

1. **Commits:** 5edd191 (mission open, M-0006 refile, AC-5 M-0003
   review → done), b5bab43 (AC-1 target-path guard + AC-2 EnterWorktree
   grant, 10 new regression tests), 691e397 (AC-3 move hardening, 5 new
   tests incl. the required non-atomicity fixture), fd33401 (AC-8
   packaging: six helpers whitelisted, reverse assertion proven
   red-then-green), 86a4f1c (AC-4 CLAUDE.md hazards 8-10 + packaging
   enforcement note + M-0002 queue retired + mkdir anomaly closed),
   plus this closeout commit.
2. **AC-6: PASS with method-limitation accounting** (full disposition in
   `_planning/M-0004-ledger.md`). Worktree-write 3 → 0 and
   improvisation-cascade ~6 → 0, live, against the 12-denial adjusted
   M-0003 baseline (2 environmental mkdir denials excluded).
3. **Intended-ask-point discovery:** path-form EnterWorktree fires a
   harness-native confirmation ("moves the session's … write access …
   and loads project configuration") that no permission allow can or
   should silence — a new intended-approval class alongside the ask
   rules, one-click in real interactive installs, unanswerable headless.
   Three-probe diagnostic, verdict A; apes-build Step 4 now presents the
   confirmation as expected flow. Two deny-audit parks
   (acceptance-assert gap, `git -C` invisibility) and one future-intake
   park (Windows-native paths for EnterWorktree) recorded in the ledger.
4. **AC-7:** allowed-tools-guard 108/0 (prompt pins 53); full npm test
   352/0. Git Bash runner.
5. Mission doing → review executed VIA THE MISSION TOOLING
   (`moveMissionState`) with this mission's own tracked + untracked
   evidence companion and pre-existing `review/M-0004/` destination —
   the exact AC-3 failure shape, as the live verification. Result
   recorded in the next workpad entry post-move.

### 2026-07-13 — AC-3 live-fire evidence (recorded post-move)

`moveMissionState('M-0004','review')` succeeded on the exact shape that
broke M-0003's closeout: companion `doing/M-0004/` holding a TRACKED
`ac6-result.json` (staged, git-mv path) plus an UNTRACKED
`verification.jsonl` (rename path), merged entry-by-entry into the
PRE-EXISTING `review/M-0004/` (which already held `evidence/` from the
packet generator), `doing/M-0004/` removed, mission file moved with
`state: review` written in the same operation. Zero manual completion,
zero agent improvisation. Under the pre-AC-3 code this exact call
failed with "source directory is empty" and stranded a half-moved
mission (reproduction recorded at the AC-3 gate).
