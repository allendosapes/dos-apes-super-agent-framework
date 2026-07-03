---
id: M-XXXZ  # renumber on filing
title: Compound-command hygiene in command and skill files
priority: 1
labels: [dx, permissions, commands]
depends_on: [M-XXXX]  # least-privilege permissions policy
verification:
  required_levels: [L0, L1]
---

## Context

Split from the allowed-tools mission: the failure modes and verification differ, and the
combined surface (frontmatter policy + body rewrites across 18 command files) exceeded
single-mission scope.

Bash permission rules match single commands; `&&`, `||`, `;`, `|`, `&`, and newlines split
an invocation and each subcommand must independently match a rule. Env-var prefixes,
`trap` idioms, and `$(...)` substitution also fall outside prefix matching. The framework's
command files use all of these, so they prompt regardless of any allowlist — the "grep and
other commands keep asking" class of friction persists after M-XXXX unless the command
bodies are cleaned. Analysis report §2.1-B, §2.3 hygiene list.

## Scope

**In:** command/skill body text under `framework/commands/` and `framework/skills/`; small
new helper scripts under `framework/scripts/` where pipelines are replaced.

**Out:** frontmatter (previous mission); the PreToolUse auto-approve hook for verified
read-only chains (fast-follow, tracked separately — hooks can return
`permissionDecision: allow`, the only deterministic fix for chains that must remain).

## Acceptance criteria

- [ ] No env-prefix invocations remain (e.g. `COVERAGE_THRESHOLD=90 bash scripts/...` at
      `framework/skills/testing.md:176` becomes an argument:
      `bash scripts/check-coverage.sh --threshold 90`, with the script updated to accept it).
- [ ] No `cat ... | node -e '...'` pipelines remain (`apes-metrics.md:25`,
      `apes-status.md:80`, `missions.md:298-299`, `apes-codex-review.md:60-64`) — each
      replaced by a named helper under `scripts/` covered by the M-XXXX scoped allow rules.
- [ ] No `trap '...' EXIT` idioms remain (`apes-build.md:362`) — cleanup expressed as an
      explicit final step or moved into the relevant script.
- [ ] Chains containing unmatched elements are either decomposed into sequential single
      commands or their elements added to the reviewed policy with rationale
      (`git reset --hard` at `apes-build.md:895,1242` stays ask — decompose, don't allow).
- [ ] Grep audit passes: no occurrences of `&&`-chained commands mixing allow-listed and
      unlisted elements in any command file (audit script or documented grep procedure
      included in the PR).
- [ ] `/apes-build` dry-run on a sample mission on Windows Git Bash: zero prompts outside
      the intended ask points.

## References

Analysis report §2.1-B (four concrete prompting idioms with file:line), §2.3
"command-file hygiene fixes required for the rules to hold."
