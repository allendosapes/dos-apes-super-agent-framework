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
  dangerous case to save one prompt is the wrong trade.
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

## Windows: nonstandard Git Bash installs

Hooks run through `scripts/run-hook.cmd`, which locates Git Bash via the
standard install paths and a PATH probe. If your Git Bash lives somewhere
unusual and hooks report "Git Bash not found", set
`CLAUDE_CODE_GIT_BASH_PATH` — the same variable Claude Code itself uses — in
your settings `env`:

```json
{
  "env": {
    "CLAUDE_CODE_GIT_BASH_PATH": "D:\\tools\\git\\bin\\bash.exe"
  }
}
```

Note: when Git Bash can't be found at all, blocking `guard-*` hooks fail
closed (commands are blocked) rather than silently skipping — a blocking hook
that can't block is worse than none.
