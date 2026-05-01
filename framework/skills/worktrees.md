---
name: worktrees
description: Mission worktree lifecycle, recovery, and cleanup. Load when creating, syncing, removing, or auditing the .worktrees/ directory used by missions.
allowed-tools: Read, Edit, Bash, Grep
---

# Worktrees Skill

## Overview

Every mission in the `doing` state runs in its own **git worktree** — a real working directory checked out from the same repo, on its own branch, sharing the same `.git/` object database as the main checkout. Mission worktrees live at `.worktrees/<M-NNNN>/` and are managed by `scripts/mission-worktree.js`.

A worktree is created when a mission transitions `todo` → `doing` and removed when the mission lands in `done` or `canceled`. While the mission is in flight, every operation (edit, test, commit) happens *inside* the worktree directory; the main checkout is left untouched.

The helper script is the **only** sanctioned way to create or remove mission worktrees. Hand-rolled `git worktree add` invocations bypass mission-ID validation, path sanitization, and base-branch detection.

## Why worktrees

Worktrees solve four problems at once:

1. **Parallel missions on the same repo.** Two missions can be in `doing` simultaneously without thrashing each other's working tree. No `git stash` dance.
2. **Session-resume safety.** A worktree survives across Claude Code sessions, machine reboots, and human-takeover. The on-disk state *is* the session.
3. **Branch isolation without clones.** Worktrees share the object database of the main repo, so they cost megabytes (working files only), not gigabytes.
4. **Hooks fire in the right scope.** `PostToolUse` / `Stop` hooks reading staged files via `git -C <worktree>` see only the mission's changes, not unrelated work in the main checkout.

Worktrees are **required**, not optional. The script enforces git ≥ 2.20 (introduced `git worktree` in its modern form) and exits non-zero on older versions.

## Lifecycle

All four verbs are invoked as `node scripts/mission-worktree.js <verb> [args]` from the repo root.

### create

```bash
node scripts/mission-worktree.js create M-0001
```

Reads `.planning/missions/<state>/M-0001-*.md`, extracts `workspace.branch` and `workspace.worktree` from frontmatter (defaulting to `feat/m-0001-<slug>` and `.worktrees/M-0001`), then runs `git worktree add`. Base ref is `origin/main` if available, otherwise `main`. Refuses if the worktree path already exists.

The mission file may be in any state when `create` runs — typically `todo` (about to start) or `doing` (already in flight). The script does not move the mission file; that is the orchestrator's job.

### sync

```bash
node scripts/mission-worktree.js sync M-0001
```

Fetches `origin/main` and rebases the worktree's branch on top of it. **Refuses** if the worktree has uncommitted changes (rebase would clobber them). On rebase conflict, runs `git rebase --abort` to restore the worktree to its pre-rebase state and exits non-zero — the worktree is *never* left in a partial-rebase state.

Use `sync` before submitting a mission to `review` so the diff lands cleanly on top of the latest `main`.

### remove

```bash
node scripts/mission-worktree.js remove M-0001
```

Removes the worktree directory and unregisters it from git. Two preconditions, both enforced:

1. The mission file must be in `done/` or `canceled/`. Anything else → exit non-zero.
2. The worktree must have no uncommitted changes. Anything else → exit non-zero.

If the worktree directory is already gone (manually deleted, machine wiped, etc.), `remove` runs `git worktree prune` to clean up the registry and exits zero.

### list

```bash
node scripts/mission-worktree.js list
```

Walks `git worktree list --porcelain`, filters to entries under `.worktrees/`, looks up each mission's current state, and prints a table:

```
ID      STATE   BRANCH                   PATH
M-0001  doing   feat/m-0001-add-todos    .worktrees/M-0001
M-0042  review  fix/m-0042-session-race  .worktrees/M-0042
```

Worktrees whose mission file cannot be located show `(unknown)` as state — that is a stale-worktree signal (see [Cleanup of stale worktrees](#cleanup-of-stale-worktrees)).

## Recovery from corrupt worktrees

A worktree can fall out of sync with git's bookkeeping in a few ways. Diagnose first; never `rm -rf` blindly.

**Symptom:** `git worktree list` shows the path but the directory is gone.
**Fix:** `git worktree prune`. Safe; only removes registry entries whose paths no longer exist. The `remove` verb does this automatically when the path is missing.

**Symptom:** The directory exists but `.git` inside it is missing or points to a deleted ref.
**Fix:** Check the mission state. If the mission is in `done/` or `canceled/`, run `mission-worktree.js remove M-NNNN`; the script will detect the missing `.git` and prune. If the mission is still active, manually delete the worktree directory, then run `git worktree prune`, then `mission-worktree.js create M-NNNN` to rebuild it on the original branch (which is preserved in `refs/heads/`).

**Symptom:** Branch was deleted while the worktree still exists.
**Fix:** Recreate the branch from the worktree's HEAD: `git -C .worktrees/M-NNNN checkout -b <original-branch>`. Then resume normally. If the branch's commits are also gone, treat it as a lost mission — escalate to a human.

**Symptom:** Worktree is mid-rebase (`.git/rebase-merge/` exists).
**Fix:** Inside the worktree, run `git rebase --abort`. The `sync` verb does this automatically on conflict; manual mid-rebase usually means a human intervened. Never `git rebase --continue` without understanding the conflicts.

**Symptom:** Worktree's branch was force-pushed and the local copy is stranded.
**Fix:** This is a destructive upstream change — coordinate with whoever did the force-push before recovering. If recovery is appropriate: `git -C .worktrees/M-NNNN fetch origin <branch> && git -C .worktrees/M-NNNN reset --hard origin/<branch>`. Lose any local-only commits this discards.

## Cleanup of stale worktrees

A **stale worktree** is one whose mission has moved to `done` or `canceled` but whose worktree directory was never removed — typically because the orchestrator crashed mid-transition or a human moved the file by hand and forgot to clean up.

Audit procedure:

1. `node scripts/mission-worktree.js list` — see what's on disk.
2. For each row, the mission state should be `doing` (or `todo` if pre-allocated). Anything in `done`, `canceled`, `review`, or `(unknown)` is a candidate for cleanup.
3. For each stale entry: `node scripts/mission-worktree.js remove M-NNNN`. The script enforces the safety preconditions (no dirty changes, mission state is done/canceled). If a stale worktree's mission is in `review` or `doing`, do **not** remove it — investigate first.

A periodic sweep (weekly, or before a release cut) keeps `.worktrees/` honest. A bloated `.worktrees/` is harmless to git but signals process drift.

`(unknown)` rows are special: the worktree exists but no mission file matches the directory name. Causes:
- Mission file was deleted (anti-pattern — should have been moved to `canceled/` instead).
- Directory was named manually outside the `M-NNNN` convention.
- Mission ID was renamed (anti-pattern — IDs are immutable).

Treat each `(unknown)` row as a bug; reconstruct the missing mission file or remove the worktree manually after confirming nothing of value is in it.

## Cross-platform notes

The helper script is pure Node and never invokes a shell, so the same code runs on Windows, macOS, and Linux. A few specifics worth knowing:

- **Git Bash on Windows.** The script does not depend on bash. Invoke it with `node scripts/mission-worktree.js ...` from PowerShell, cmd, or Git Bash interchangeably.
- **Path separators.** `workspace.worktree` in mission frontmatter must use forward slashes (`.worktrees/M-0001`). The validator rejects backslashes and other characters outside `[A-Za-z0-9._/-]`. Node normalizes to the platform separator internally; git accepts either.
- **Long paths on Windows.** A nested project path plus `.worktrees/M-NNNN/<deep>/<files>` can exceed Windows' 260-char default. Enable long-path support: `git config --global core.longpaths true`.
- **Case sensitivity.** The mission ID `M-0001` is case-significant. On case-insensitive filesystems (macOS default, Windows), git tolerates `m-0001/` but the validator and lookup use the canonical uppercase form. Don't mix.
- **Symlinks.** Worktrees use a `.git` *file* (not a symlink) pointing at the parent's git directory, so symlink permission quirks on Windows do not apply.
- **Antivirus / file locks.** Some Windows AV tools briefly lock files inside `.worktrees/` after writes. If `git worktree remove` reports "directory not empty" transiently, retry. The script does not auto-retry — that is the operator's call.

## Cross-references

- **`.claude/skills/missions.md`** — Mission file format and lifecycle. The `workspace.branch` and `workspace.worktree` fields documented there are the inputs to this script.
- **`framework/scripts/mission-worktree.js`** — The implementation. Errors are prefixed `mission-worktree:` and exit non-zero.
- **`.claude/skills/evidence-packets.md`** — Where verification output produced inside a worktree gets captured for review.
