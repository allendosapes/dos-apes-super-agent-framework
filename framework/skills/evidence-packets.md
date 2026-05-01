---
name: evidence-packets
description: Format, generation, and review of mission evidence packets — the proof-of-work artifact a reviewer reads before a mission can transition to done.
allowed-tools: Read, Edit, Bash, Grep, Glob
---

# Evidence Packets Skill

## Overview

An **evidence packet** is the bundle a reviewer reads before approving a mission. It pulls together everything that was verified (the structured log), what changed (the diff), what the auto-reviewer said, and any visual artifacts — into one directory the reviewer can browse without re-running tests.

Packets are produced by `scripts/evidence-packet.js generate <M-NNNN>` and live at:

```
.planning/missions/review/M-NNNN/evidence/
```

The output location is anchored to `review/` regardless of the mission's *current* state — a packet is a review artifact, not a mission-state artifact. Generation is idempotent; re-running wipes and rewrites the directory.

## When to generate

- **Before submitting `doing` → `review`.** The packet *is* the submission. If the generator refuses (because a required verification level didn't pass), the mission isn't ready to submit — fix the gap and re-run.
- **After a `review` → `doing` rejection,** when re-submitting. Regenerate cleanly so the packet reflects the latest commit, not the rejected one.
- **Never** after a mission lands in `done/` — the packet from the moment of approval is the historical record.

## Packet contents

```
.planning/missions/review/M-NNNN/evidence/
├── summary.md            ← Cover sheet (read this first)
├── verification.jsonl    ← Copy of the structured log
├── diff-stats.txt        ← `git diff --stat` against main
├── diff.patch            ← Full diff
├── auto-review.md        ← Most recent L0.5 auto-review (if any)
└── screenshots/          ← L7 visual artifacts (if any)
```

### `summary.md` — the cover sheet

The single page a reviewer reads first. It contains:

1. **Header** — mission ID, title, branch, current state, diff range against `main`.
2. **Acceptance criteria** — every entry from the mission's `acceptance` frontmatter, rendered as `- [x]` if a matching `- [x]` line exists in the workpad, otherwise `- [ ]`. A box that's still unchecked is a red flag.
3. **Verification levels** — table with one row per level (required ∪ optional ∪ logged). Columns: level ID, required/optional/no, latest outcome, summary line. The generator only commits to producing the packet when every required level has a `pass`, so this table should be all `pass` for required rows.
4. **Diff stats** — the output of `git diff --stat <merge-base>...<branch>`, with a link to the full patch.
5. **Auto-review** — pointer to and copy of the most recent `.claude/auto-reviews/M-NNNN-*.md` file, or a note that no auto-review was run.
6. **Screenshots** — file count and link to the `screenshots/` directory, or a note that no L7 artifacts exist.
7. **Verification log** — link to the raw JSONL.

### `verification.jsonl`

Verbatim copy of the mission's verification log. Format documented in `.claude/skills/testing.md` ("Verification Logs"). Reviewers can grep this for a specific level, parse it programmatically, or re-derive the summary table to confirm the cover sheet is accurate.

### `diff-stats.txt` and `diff.patch`

Computed against the merge-base of the mission branch and `main` (preferring `origin/main` when available). The diff is what would land in `main` if the branch were merged today — not the commit-by-commit history. Reviewers focus on the net change; commit history lives in git for spelunking.

### `auto-review.md`

The most-recently-modified file matching `.claude/auto-reviews/M-NNNN-*.md`. This is the L0.5 auto-reviewer's output (the JSON-emitting Stop hook captures findings here). If the auto-review found issues, those should be addressed in the workpad before the packet is submitted; a packet with a flagging auto-review is not automatically rejected, but the reviewer will look for a workpad entry explaining each finding.

### `screenshots/`

Copy of `.planning/missions/<state>/M-NNNN/screenshots/` if it exists. Populated by the L7 visual-regression run. Reviewers check that the screenshots correspond to the acceptance criteria — for example, an "endpoint X returns Y" criterion does not need a screenshot, but a "new dashboard renders the user's name" criterion does.

## What reviewers look for

Read `summary.md` top-to-bottom. In order of priority:

1. **All required acceptance criteria checked.** An unchecked required criterion blocks approval. Either add evidence in the workpad and regenerate the packet, or amend the criterion (rare; treat as a scope change).
2. **Required verification levels show `pass`.** The generator already enforces this for the levels listed in `verification.required_levels`. If a level is in the optional list and shows `fail` or `skip`, ask the author whether it should have been required.
3. **Diff size proportionate to the mission.** A four-line acceptance list with a thousand-line diff signals scope creep. A mission's diff should be reviewable without splitting attention.
4. **No surprise files.** Lockfile churn, generated files, unrelated config changes — flag for explanation.
5. **Auto-review concerns acknowledged.** If `auto-review.md` lists issues, the workpad should explain each (fixed, intentional, or false-positive with reasoning).
6. **Screenshots match the change.** When present, they should depict the new or modified UI in its intended state — not a pre-change snapshot or an unrelated page.

A reviewer who can't answer "did this mission deliver what it promised?" from `summary.md` alone should send it back with a workpad entry describing what's missing — the goal is that the packet contains its own verification.

## Refusal contract

The generator exits non-zero with `evidence-packet: missing required passing verification level(s): LX (status), LY (status)` if any of `verification.required_levels` lacks a `pass` entry in the verification log. Reasons this happens:

- The verification script for that level wasn't run.
- The script ran but failed; the latest log entry is `fail` or `skip`.
- The script ran successfully but never called `log-verification.js` (orchestration bug — file an issue).

Resolution: run the missing verification, confirm the log entry, regenerate the packet. Never edit the verification log to bypass the gate; that is auditable history.

## Idempotency

Re-running `evidence-packet.js generate <M-NNNN>` wipes `.planning/missions/review/M-NNNN/evidence/` and rewrites it from scratch. There is no merge or partial update — the packet is always a snapshot of "right now," derived from:

- The mission file's current frontmatter and workpad.
- The verification log as it exists at generation time.
- The branch's current `HEAD` against `main`'s merge-base.

If a reviewer needs to compare two versions of a packet (e.g., before and after a rejection), they should look at git history of the `evidence/` directory — every regeneration produces a commit-able state.

## Cross-references

- **`.claude/skills/missions.md`** — Mission lifecycle. The packet is the bridge between `doing` and `review`.
- **`.claude/skills/testing.md`** — Verification log format and pyramid level definitions.
- **`.claude/skills/worktrees.md`** — Where verification runs (always inside the mission's worktree).
- **`framework/scripts/evidence-packet.js`** — The generator. Errors are prefixed `evidence-packet:` and exit non-zero.
- **Slash command `/apes-evidence`** — Invokes the generator for the active mission.
