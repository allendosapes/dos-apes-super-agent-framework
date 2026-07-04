# Dos Apes permission policy — why these rules

This file documents the `permissions` block in the sibling `settings.json`.
It is framework-owned and refreshed on every `npx dos-apes-super-agent`
install — don't edit it here; put personal permission additions in
`.claude/settings.local.json` (git-ignored), which merges with this policy.

## The allow/ask/deny philosophy

Rules evaluate **deny → ask → allow**; the first match wins, and a deny at any
settings scope cannot be overridden by an allow at any other scope.

- **allow** is least-privilege: the framework's own machinery (`Skill(apes-*)`
  rules are generated at install time from the installed command/skill set),
  scoped script entry points (`node scripts/mission-cli.js …`), read-only git,
  branch *creation*, commits, and common read-only utilities. No blanket
  `npm *`, `bash *`, `node *`, or `git push *` — a rule that pre-approves the
  dangerous case to save one prompt is the wrong trade. `npm run` is allowed
  only for enumerated quality-loop script names (`build`, `typecheck`, `lint`,
  `test:*`, …), never `npm run *`: package scripts are arbitrary code the
  permission layer and guard cannot see into, so a script named `publish`
  or `deploy` must prompt, not pass.
- **ask** marks operations that are legitimate but consequential: `git push`,
  branch/tag deletion, `git reset --hard`, `rm`, `npm audit fix`. You see a
  prompt, you decide. The ask list is deliberately short — anything unmatched
  prompts anyway; these entries document intent and survive broad allows you
  might add locally.
- **deny** is reserved for operations that are **human-only**: publishing to
  the npm registry in any form (`publish`, `version`, `dist-tag`, `unpublish`,
  `deprecate` — promoting `latest` is a publish decision, per SECURITY.md),
  force pushes, remote branch deletion, `rm -rf` aimed at `/`, `~`, or `..`,
  reading `.env` secrets into context, and rewriting this policy itself
  (`Edit/Write(.claude/settings.json)`).

## Why tag mutation is *ask*, not *deny*

`git tag -a` / `git tag -d` sit in the ask list even though tag mutation looks
deny-worthy. Reason: `/apes-build` creates and cleans **phase tags** as part of
its normal loop — a hard deny would break the build pipeline on every phase.

**Paired-promotion precondition:** promote tag mutation to deny **only when
`/apes-build` phase tags are replaced with a non-tag mechanism — never one
without the other.** Denying tags while the build loop still uses them breaks
builds; replacing phase tags while leaving tags at ask keeps a hole open. The
two changes ship together or not at all.

## The guard hook: deterministic deny backstop

Prefix-based deny rules can't catch every spelling — `git push origin main
--force` matches the *ask* rule (`git push *`), not the force-push deny,
because the flag comes last. `scripts/guard-forbidden-commands.sh` (PreToolUse,
matcher `Bash`) closes that gap: it regex-scans the **full command string,
including compound chains**, for npm registry mutation, force pushes in any
flag position or spelling, refspec deletion (`git push origin :branch`), and
recursive-force `rm` respellings aimed at `/`, `~`, or `..`. It blocks with
exit 2 and fails **closed** — an internal error blocks rather than passes.

**Documented false positive:** the guard deliberately overmatches into quoted
text, because quoted strings are where evasions live (`bash -c "npm publish"`).
That means a command that merely *quotes* a forbidden string is also blocked —
for example `git commit -m "docs: explain why npm publish is denied"`.
**Workaround:** rephrase the quoted text so it no longer spells the command
(e.g. `"docs: explain why publishing to npm is denied"`) and retry. This
trade-off is intentional: a backstop must never undermatch.

## Windows: Git Bash and hooks

Claude Code executes hook commands through Git Bash natively on Windows (per
the hooks docs: "`sh -c` on macOS and Linux, Git Bash on Windows"), so the
`bash scripts/*.sh` hook commands in settings.json work unchanged across
platforms. If your Git Bash lives somewhere unusual and hooks fail to run, set
`CLAUDE_CODE_GIT_BASH_PATH` — the variable Claude Code itself uses to locate
Git Bash — in your settings `env`:

```json
{
  "env": {
    "CLAUDE_CODE_GIT_BASH_PATH": "D:\\tools\\git\\bin\\bash.exe"
  }
}
```

**Git Bash is required for this policy on Windows.** Without it, Claude Code
switches to the PowerShell tool, where neither the `Bash(...)` permission
rules nor the Bash-matcher guard hook apply — the policy as shipped does not
cover PowerShell-tool sessions.
