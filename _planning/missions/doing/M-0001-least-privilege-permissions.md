---
id: M-XXXX  # renumber on filing
title: Replace shipped permissions with least-privilege allow/ask/deny policy
priority: 1
labels: [security, dx, permissions]
depends_on: []
codex:
  required: true  # security-critical change; L8 must reach a real verdict, no skipped terminal
verification:
  required_levels: [L0, L1, L2, L8]
---

## Context

The shipped `framework/settings.json:93-168` permission policy is inverted: it pre-approves
dangerous operations (`Bash(rm *)`, `Bash(git push *)`, `Bash(npm *)` — which includes
`npm publish` — `Bash(git tag *)`, `Bash(bash *)`, `Bash(node *)`) while containing zero
`Skill(...)` rules, so the framework's own machinery prompts on every first use but a
destructive push does not. Root cause traces to commit `5fb19a1` (v1-era "comprehensive
pre-approved permissions"), unrevisited since. Full analysis:
`2026-07-02-framework-improvement-analysis.md` §2.

## Scope

**In:** `framework/settings.json` permissions block; `bin/cli.js` `customizeSettings`
(~lines 353-382) Skill-rule generation; new `scripts/guard-forbidden-commands.sh` PreToolUse
hook; `DOS_APES_VERSION` env value.

**Out:** per-skill `allowed-tools` frontmatter (follow-up mission), compound-command hygiene
in command files (follow-up mission), existing-install migration (follow-up mission).

## Acceptance criteria

- [ ] `framework/settings.json` permissions block matches the reviewed policy: no `rm`,
      `mv`, `sed`, `bash *`, `node *`, `npm *`, `npx *`, `git push *`, plain `git checkout *`,
      `git rebase *`, `git tag *`, `xargs *`, blanket `WebFetch`, or stale `Task`/`TodoWrite`
      entries in allow. Framework scripts allowed only via scoped forms
      (`Bash(node scripts/mission-cli.js:*)` etc.).
- [ ] `bin/cli.js` generates `Skill(name)` + `Skill(name *)` allow rules at install time by
      enumerating `framework/commands/*.md` and `framework/skills/*.md` — no hand-maintained
      list; new skills auto-enroll. (Name globs like `Skill(apes-*)` are unsupported per
      current permissions docs — verify against live docs at implementation time.)
- [ ] Deny list blocks, at minimum: `npm publish`, `npm version`, `npm dist-tag *`,
      `npm unpublish *`, `npm deprecate *`, `git push --force*` / `-f*`,
      `git push origin --delete *` / `--delete *`, `rm -rf /*` / `~*` / `..*`.
      (dist-tag/unpublish/deprecate encode SECURITY.md's human-only publishing policy —
      promoting `latest` is a publish decision.)
- [ ] Deny list protects secrets and the policy itself: `Read(.env)`, `Read(.env.*)`,
      `Edit(.claude/settings.json)`, `Write(.claude/settings.json)` — an agent must not be
      able to read credentials into context or rewrite its own permission policy. Verify
      current rule syntax for Read/Edit path scoping against live docs before implementing.
- [ ] `Bash(codex *)` is NOT in allow. Only `Bash(codex login)` and `Bash(codex --version)`
      are allowed; all framework L8 invocations already run through allowlisted
      `node scripts/codex-*.js` entry points (child processes are invisible to the
      permission layer, so a broad codex rule adds risk without reducing prompts).
- [ ] Ask list contains exactly: `git push *`, `git branch -d/-D *`, `git tag -a/-d *`,
      `git reset --hard *`, `git worktree remove *`, `rm *`, `npm audit fix*`. Rationale for
      tag-mutation-as-ask (not deny) is documented in the settings README: `/apes-build`
      creates and cleans phase tags; promote to deny only after phase tags are replaced.
- [ ] New `scripts/guard-forbidden-commands.sh` PreToolUse hook on Bash regex-scans the full
      command string (including compound chains) for `npm publish`, `npm version`,
      `npm dist-tag`, force-push spellings, and tag mutation, exiting 2 to block — the
      deterministic backstop for prefix-rule evasion (`git push origin main --force` matches
      the ask rule, not the force-push deny).
- [ ] `framework/settings.json` env `DOS_APES_VERSION` reads the real package version
      (currently hardcoded `"2.0.0"` at line 172 against package 3.5.1).
- [ ] Fresh test install on Windows Git Bash: all `apes-*` skills invoke without prompting;
      `grep`/`ls`/`cat`/`node scripts/mission-cli.js list` run without prompting;
      `git push`, `git reset --hard`, `rm` prompt; `npm publish` and `npm dist-tag add`
      are blocked.

## References

Analysis report §2.2 (trigger inventory), §2.3 (proposed block + rationale + deviations),
§2.6 (Windows check). Docs to re-verify at implementation time: permissions rule syntax,
hooks permissionDecision interface, settings scope precedence.
