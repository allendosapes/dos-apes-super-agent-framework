---
id: M-0006
title: Installer permission migration for existing installs (--update-permissions)
priority: 1
labels: [installer, dx]
depends_on: [M-0001]  # least-privilege permissions policy (done)
codex:
  required: true  # touches user-owned settings files; adversarial review must complete
verification:
  required_levels: [L0, L1, L2, L8]
---

> **Release gating:** Gates latest-tag promotion; does not block the 3.6.0
> beta publish. (Refiled from the M-0004 placeholder stub at M-0003
> closeout; the M-0004 ID belongs to the worktree-guard mission per the
> committed M-0003 ledger dispositions.)

## Context

`bin/cli.js:685-689` writes shipped settings only when no `.claude/settings.json` exists;
the else-branch (`cli.js:690-839`) migrates shape but never merges `permissions`. Every
existing install therefore keeps the inverted v1-era allowlist (or none) forever — the
likely majority of real-world friction, and after M-XXXX ships, the majority of real-world
*exposure*, since existing users silently retain `git push *` / `npm *` in allow.
Analysis report §2.7, executive summary #2.

## Scope

**In:** `bin/cli.js` — new `--update-permissions` flag and its invocation path; fingerprints
of historical shipped allowlists (from git history of `framework/settings.json`).

**Out:** any change to the policy content itself (M-XXXX owns that); automatic runs without
the flag (migration is explicit, never a side effect of reinstall).

## Acceptance criteria

- [ ] Running `npx dos-apes-super-agent --update-permissions` on a project whose
      `permissions` block fingerprint-matches a known historical shipped list replaces the
      block wholesale with the current policy, with a printed summary of removals/additions.
- [ ] On a user-modified `permissions` block: never silently merge or replace. Two safe
      in-place appends only — the deny list (deny at any scope cannot be weakened by other
      rules) and missing `Skill(...)` rules (pure prompt reduction) — each with a printed
      notice. The full proposed block is written to
      `.claude/dos-apes-proposed-permissions.json` with a printed three-way diff for manual
      adoption.
- [ ] Unparseable `.claude/settings.json` is left untouched; exit with a clear message and
      nonzero code.
- [ ] `settings.local.json` is never read or written by this path.
- [ ] Unit tests cover: fingerprint match, user-modified append-only path, unparseable file,
      idempotency (second run is a no-op with "already current" message).
- [ ] Zero new npm dependencies (CLI remains built-ins only).
- [ ] Documented in README under upgrading, including one line recommending a machine-wide
      `npm publish` deny in `~/.claude/settings.json`.

## References

Analysis report §2.7; deny-scope precedence per settings docs (re-verify at implementation).
