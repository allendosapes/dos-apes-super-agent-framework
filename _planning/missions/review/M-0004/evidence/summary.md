# Evidence Packet: M-0004 — Worktree write guard, mission-move companions, CLAUDE.md batch

> Generated 2026-07-13T18:43:17Z for review.

- **Mission state at packet time:** doing
- **Branch:** `mission/M-0004-worktree-guard-and-move-fixes`
- **Diff range:** `defe991bad94...mission/M-0004-worktree-guard-and-move-fixes` (against `origin/main`)

## Acceptance criteria

_No acceptance criteria declared in mission frontmatter._

## Verification levels

| Level | Required | Outcome | Summary |
|---|---|---|---|
| L0 | yes | pass | Full npm test 352 passed / 0 failed at closeout (Git Bash). Mission commits: 5edd191 (open + AC-5 M-0003 done-transition), b5bab43 (AC-1/AC-2), 691e397 (AC-3), fd33401 (AC-8 red-then-green), 86a4f1c (AC-4 CLAUDE.md hazards 8-10). |
| L1 | yes | pass | allowed-tools-guard 108 passed / 0 failed at closeout (prompt pins 53). AC-6 in-use re-run: PASS with method-limitation accounting (details + ac6-result.json). AC-8: red-then-green packaging assertion. |
| L2 | yes | pass | All unit suites green inside npm test (31, 56 tracker incl. 5 new AC-3, 14, 30, 4, 20, 54 codex, 10 new guard-main-branch, 108 guard, 25 CLI incl. AC-8 reverse assertion = 352/0). |

## Diff stats

```
 CLAUDE.md                                          |  16 +-
 _planning/M-0002-process-notes-for-claude-md.md    |  32 ----
 _planning/M-0004-charter-and-playbook.md           | 141 ++++++++++++++++++
 _planning/M-0004-ledger.md                         |  67 +++++++++
 .../doing/M-0004-worktree-guard-and-move-fixes.md  | 108 ++++++++++++++
 .../{review => done}/M-0003-body-hygiene.md        |   8 +
 ...md => M-0006-installer-permission-migration.md} |   9 +-
 bin/cli.test.js                                    |  25 ++++
 framework/commands/apes-build.md                   |   6 +-
 framework/lib/mission-tracker.js                   | 137 ++++++++++++++---
 framework/lib/mission-tracker.test.js              | 104 +++++++++++++
 framework/scripts/allowed-tools-guard.test.js      |   8 +-
 framework/scripts/guard-main-branch.sh             |  46 +++++-
 framework/scripts/guard-main-branch.test.js        | 163 +++++++++++++++++++++
 framework/settings.json                            |   3 +-
 package.json                                       |   8 +-
 16 files changed, 810 insertions(+), 71 deletions(-)
```

Full patch: [`diff.patch`](./diff.patch)

## Auto code review (L0.5)

_No auto-review file found in `.claude/auto-reviews/`._

## Screenshots

_No L7 visual artifacts captured for this mission._

## Verification log

Full machine-readable record: [`verification.jsonl`](./verification.jsonl)
