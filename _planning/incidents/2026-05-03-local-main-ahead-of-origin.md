# Incident: local main ahead of origin at mission-branch creation

**Date:** 2026-05-03
**Session:** M-0005 playbook P0 → P6 (codex review state mission-native, 3.4.0).
**Author:** Claude Opus 4.7 (1M context), as the agent that ran the playbook.
**Severity:** Low (no functional impact; minor audit-trail noise).
**Status:** Captured for future-playbook prevention; no remediation required for the affected release.

---

## Summary

The M-0005 mission branch was created from a local `main` that was 1 commit
ahead of `origin/main`. The pre-existing local-only commit (`cb02d84`,
"M-0002: extract MissionTracker (3.3.0)") was a re-squash of work that had
already shipped to npm as 3.3.0 from the corresponding origin commit
(`3788f05`). Because the M-0005 PR was opened with `head=mission/M-0005`
and `base=main`, GitHub's squash-merge diffed the mission branch against
`origin/main` (the pre-merge `3788f05`), so the resulting squash commit
on `origin/main` (`32610d3`) contains *both* the M-0002 re-squash *and*
the M-0005 work, under a subject that names only M-0005.

Public artifacts are correct: the npm 3.3.0 tarball already shipped with
M-0002 content; the npm 3.4.0 tarball ships with M-0005 + M-0002 content;
the public CHANGELOG entries for 3.3.0 and 3.4.0 each accurately describe
their respective version's contents. The git history on `origin/main` is
the only place the conflation is visible: a single commit titled "M-0005"
contains a diff that mixes M-0002 and M-0005 changes.

The P0 phase noted that local `main` was 1 ahead of origin and proceeded
on the (correct-at-the-time) reasoning "fresher, not stale, safe to branch."
What was missed: branching is fine, but *the unpushed delta will be folded
into the next squash-merge against origin*.

---

## What went wrong, in priority order

### 1. The P0 sync check accepted "ahead-of-origin" as safe.

The actual P0 verbatim instruction from the playbook was:

> Confirm the working tree is clean and on main at the latest 3.3.0 tag:
> ```
> git status
> git rev-parse --abbrev-ref HEAD
> git describe --tags --exact-match
> ```
> If any of these fail, stop and report. Do not proceed on a dirty tree
> or a stale main.

The check covered "dirty" and "stale" but not "ahead". For mission branches
that will eventually merge back to origin via PR + squash, "ahead" is a
real failure mode — the unpushed local commits get bundled into the next
squash diff against origin, polluting the merge commit's labelled scope.

### 2. The playbook's pre-flight covered the wrong axis of "main is ready".

"Stale" (behind origin) and "ahead" (local-only commits) are both
sync-failures, but only one was checked. A complete pre-flight needs both.

---

## Rule for future playbooks

Add this to **P0 (branch creation)** of every mission playbook, before
`git checkout -b mission/M-NNNN-...`:

```bash
git fetch origin
git status -uno   # expect: "up to date with 'origin/main'"
# if ahead:  git push origin main  BEFORE creating the mission branch
# if behind: git pull origin main  BEFORE creating the mission branch
# if both:   stop and resolve manually (rebase or merge), do not branch yet
```

The four states, decision matrix:

| Local vs origin/main          | Action before `git checkout -b mission/...`                      |
|-------------------------------|------------------------------------------------------------------|
| Up to date                    | Proceed.                                                         |
| Ahead by N                    | `git push origin main` first. Then proceed.                      |
| Behind by N                   | `git pull origin main` first. Then proceed.                      |
| Diverged (ahead AND behind)   | Stop. Resolve via rebase/merge with explicit human decision.     |

The check costs ~1 second; the cleanup if you skip it is what produced
this incident.

---

## What the agent should remember

1. **"Local fresher than origin" is not the same as "safe to branch from."**
   For any flow that ends in a PR + squash-merge against origin, unpushed
   local commits will be bundled into the next squash. Either push them
   first (so they squash on their own merits) or stop and ask.
2. **Pre-flight checks need to cover "ahead" *and* "behind"**, not just
   "behind / stale". Both produce different failure modes; a complete
   check covers both axes.
3. **`git status -uno` is the cheap one-liner** that surfaces both axes
   at once via the "Your branch is ahead of / behind / up to date with
   'origin/main' by N commits" line. It's faster to read than `git rev-list
   --count` and reads naturally to a human.

---

## Lessons for CLAUDE.md or framework-level docs

A new operational hazard worth ferrying to CLAUDE.md's "Operational
hazards" section:

> **Local main ahead of origin is a branching trap.** Before creating any
> branch that will eventually merge back via PR + squash, run
> `git fetch origin && git status -uno` and resolve any divergence first.
> Unpushed local commits will be folded into the next squash-merge
> against origin, conflating their scope with the new branch's scope.
> See `_planning/incidents/2026-05-03-local-main-ahead-of-origin.md`.

This sits naturally as item 4 in the existing list (after `rm -rf` chains,
deliverable tracking, and "judgment is not a protection").

---

## Affected release

`v3.4.0` (npm `dos-apes-super-agent@3.4.0`, tag `v3.4.0`, squash commit
`32610d3` on `origin/main`). No remediation planned — the public-facing
artifacts (CHANGELOG entries, npm tarball contents) are correct; only
the git-history label on the squash commit is impure.

If a future audit trips on the conflation, point at this incident.
