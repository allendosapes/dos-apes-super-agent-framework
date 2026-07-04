# M-0001 fresh-install smoke checklist (AC #9) — rev2

**Date:** 2026-07-03 · **Environment:** Windows 11, Git Bash, node v22+, npm tarball
`dos-apes-super-agent-3.5.1.tgz` (84 files) → extracted → `node package/bin/cli.js
--local --yes --greenfield` into a fresh `git init` project. 85 files installed.

> **rev2:** the first manual attempt surfaced a blocking finding — the
> `patchHooksForWindows` cmd-wrapper rewrite made ALL hooks silently inert
> (`/usr/bin/bash: line 1: scriptsrun-hook.cmd: command not found`), because
> current Claude Code executes hook commands through Git Bash natively on
> Windows. Fixed: rewrite removed, `run-hook.cmd` retired, hooks ship as
> `bash scripts/*.sh` cross-platform, reverse migration added for existing
> installs. The automated section below is the rerun against the rebuilt
> tarball, now exercising the REAL chain: `bash -c "<exact hook command from
> installed settings.json>"` with hook-shaped stdin — not a cmd.exe entry
> point the product doesn't use.

Automation script (reproducible): scratchpad `m0001-smoke-v2/verify-install.js`.

## Automated — 19/19 passed (2026-07-03, rev2)

Install shape:

- [x] All 18 `apes-*` commands got `Skill(name)` + `Skill(name *)` allow pairs,
      generated at install time from the shipped inventory
- [x] All 15 domain skills got `Skill(name)` rules; no stale Skill rules
- [x] Ask list is the exact specified set; deny list intact; no blanket allows
- [x] `DOS_APES_VERSION` = 3.5.1 (stamped from package.json)
- [x] Hook commands ship in plain `bash scripts/*.sh` form — no `run-hook.cmd`
      anywhere in the installed settings.json, scripts/, or the tarball
- [x] `.claude/settings.README.md` installed (and no longer references the
      retired wrapper); guard script installed under `scripts/`

Guard behavior through the REAL execution chain (`bash -c` on the exact
installed hook command, hook-shaped stdin, cwd = project root):

- [x] `npm publish` → exit 2, plain-text stderr block message
- [x] `npm dist-tag add pkg@1.0.0 latest` → exit 2
- [x] `git push origin main --force` (flag-last deny bypass) → exit 2
- [x] `git commit -m x && npm publish` (compound chain) → exit 2
- [x] Benign pass: `npm test`, `git push origin main` (ask's territory),
      `node scripts/mission-cli.js list`, `grep -r foo .` → exit 0
- [x] `guard-main-branch.sh` fires on the fresh project's main branch → exit 2
      (was also inert under the old wrapper; now verified through the real chain)

## Manual — PASSED IN FULL (re-attempt post-fix, 2026-07-03)

First attempt partial results (pre-fix): `/apes-help` and `/apes-status`
prompt-free (PASS); `/apes-status` internal pipeline prompted at its `node -e`
segment (known M-0003 item, declined — not an AC #9 failure); guard hook INERT
(the rev2 finding, fixed above).

Re-attempt results (fresh install, scratchpad `m0001-smoke-v2/fresh-project`):

- [x] `/apes-help` / `/apes-status` and other `apes-*` skills invoke **without
      a permission prompt**
- [x] `grep` and scoped `node scripts/mission-cli.js` run **without prompting**
- [x] `git push` **prompted** (ask rule) — declined
- [x] `git reset --hard HEAD` **prompted** (ask rule) — declined
- [x] `rm somefile` **prompted** (ask rule) — declined
- [x] `npm publish` **blocked**
- [x] `npm dist-tag add x@1 latest` **blocked**
      — *Layer attribution for the two blocks: not captured in the re-attempt
      report. Per the documented hook ordering (PreToolUse hooks evaluate
      before permission rules), the dos-apes guard text is the likely
      presenter, which would mean the deny rules were shadowed rather than
      exercised. **Open note for the deny-audit, non-blocking** — both layers
      enforce the identical policy; when the verbatim refusal text is
      available, record which layer presented and, if the guard, the exact
      attempted command string.*
- [x] `git push origin main --force` → **guard hook block** with the
      plain-text message, after human approval of the ask prompt
      (re-verified: this was the inert path in attempt 1)
- [x] Editing a file on `main` → **blocked by guard-main-branch.sh**
      (re-verified: also inert in attempt 1)
- [x] Sanity: `git checkout -b test-branch` prompt-free; `git checkout main`
      **prompted** (known, accepted — M-0003 territory, see Task 3 pre-notes)
- [x] `.claude/settings.README.md` present in the installed project

**AC #9: satisfied.** Marked in the mission workpad.
