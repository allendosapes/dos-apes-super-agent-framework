# M-0001: least-privilege permission policy, install-time Skill generation, guard-hook backstop

> **PR description for `mission/M-0001-least-privilege-permissions` → `main`.**
> Created by the M-0001 wrap-up (Task 8). Open the PR via:
> https://github.com/allendosapes/dos-apes-super-agent-framework/pull/new/mission/M-0001-least-privilege-permissions
> and paste this body in.

## Root cause

The shipped `framework/settings.json` permission policy was inverted since commit
`5fb19a1` (v1-era "comprehensive pre-approved permissions"): it pre-approved
`rm *`, `git push *`, `npm *` (including `npm publish`), `git tag *`, `bash *`,
`node *`, and `xargs *`, while containing zero `Skill(...)` rules — so the
framework's own machinery prompted on every first use, but a destructive push or
an accidental publish did not. Full analysis:
`_planning/2026-07-02-framework-improvement-analysis.md` §2.

## What this ships

**Least-privilege deny→ask→allow policy.** npm registry mutation (`publish`,
`version`, `dist-tag`, `unpublish`, `deprecate` — promoting `latest` is a publish
decision per SECURITY.md), force pushes, and remote branch deletion are **denied**;
`git push`, branch/tag deletion, `git reset --hard`, `rm`, and `npm audit fix`
**ask**; allow covers exactly the framework machinery (Skill rules, scoped script
entry points, enumerated quality-loop `npm run` names) plus read-only utilities.
Deny also protects secrets and the policy itself: `Read(.env)`, `Read(.env.*)`,
`Edit/Write(.claude/settings.json)`. Rationale ships with the policy as
`.claude/settings.README.md`, including the tag-mutation-as-ask paired-promotion
precondition (tags promote to deny only when `/apes-build` phase tags are
replaced — never one without the other).

**Install-time Skill-rule generation.** `bin/cli.js` enumerates the installed
command/skill inventory and emits `Skill(name)` + `Skill(name *)` pairs for
commands, exact rules for domain skills — new skills auto-enroll, no
hand-maintained list. The static template rules remain as fallback, kept honest
by a drift-guard test. `DOS_APES_VERSION` is stamped from `package.json`.

**Deterministic guard hook.** `scripts/guard-forbidden-commands.sh` (PreToolUse,
matcher `Bash`) regex-scans the full command string including compound chains for
the spellings prefix rules cannot express: flag-last force pushes,
`--force-with-lease`, `+refspec`, refspec deletion, recursive-force `rm`
respellings at `/`/`~`/`..`, and npm registry mutation with flags in any position
— including separated-value forms (`npm --registry <url> publish`), an L8 catch.
Exit 2, plain-text stderr, fail-closed ERR trap; corrupt-envelope raw-scan
fallback (overmatch, never undermatch); the quoted-text false positive is
documented with a rephrase hint in the block message.

**Smoke-test discovery: hooks were silently inert on Windows.** The manual
fresh-install smoke test found every hook failing non-blocking with
`scriptsrun-hook.cmd: command not found`. Current Claude Code executes hook
commands through Git Bash natively on Windows (docs `/en/hooks`); the installer's
`patchHooksForWindows` rewrite to a cmd-wrapper handed bash a backslash path and
targeted an execution model that no longer exists. Fix: rewrite removed, hooks
ship as `bash scripts/*.sh` cross-platform, `run-hook.cmd` retired, and a reverse
migration (`unpatchWindowsHooks`) un-breaks previously-patched installs on the
next installer run.

**Packaging hygiene.** Test files are excluded pattern-based: subdirectory
`.npmignore` (`*.test.js`) prunes even explicitly `files`-listed entries
(verified against npm docs and empirically), backed by a packaging drift-guard
test (no `*.test.js`, no `_planning/`, all production files present). Tarball: 84
files.

## L8 cross-model review (required, terminal verdict reached)

Three rounds (gpt-5.5, high reasoning, read-only sandbox, base `main`), highs
fixed in-session between rounds:

1. **High (security)**: separated-value npm flags bypassed the guard's pre-verb
   matcher — fixed (`c5abffa`), +5 fixtures.
2. **Two highs (security)**: blanket `Bash(npm run *)` let a package script named
   `publish` bypass the entire policy — fixed with enumerated script names
   (`fd7fa54`); and the reviewer caught **injection in its own prompt template**
   (a changed markdown file could close the 3-backtick diff fence and inject
   reviewer instructions) — hardened to a 10-backtick fence with untrusted-data
   framing; the dynamic-fence redesign is a recorded follow-up since the template
   predates this branch (v3.2.0).
3. **Terminal: `accepted`** — verdict `accept`, confidence 0.82, 0 loop-eligible
   findings. One medium reported unfixed by instruction (bare-form ask entries,
   see follow-ups).

## Accepted residuals (documented, not blockers)

- **PowerShell-tool gap**: without Git Bash, Claude Code uses the PowerShell
  tool, where `Bash(...)` rules and the Bash-matcher guard don't apply. Policy
  requires Git Bash on Windows (stated in settings.README.md).
- **Exit-127 fail-open**: a missing/deleted guard script is a non-blocking hook
  error; the retired runner's fail-closed discovery has no native equivalent.
- **Guard quoted-text overmatch**: commit messages quoting forbidden strings are
  blocked; the block message carries the rephrase workaround. Deliberate — a
  backstop must not undermatch.
- **Plain `git checkout main` prompts** in build workflows (branch-creation-only
  allow) — known, M-0003 territory.

## Follow-up missions on record (mission workpad, Task 7/8)

Guard-integrity mission (PowerShell gap + exit-127 fail-open); deny-audit
follow-up (npm-block layer attribution, bare-form ask entries — the L8 medium,
npm-run enumeration drift check); L8-infra dynamic diff fence; guard-main-branch
stderr-JSON cleanup; P3 dogfooding (mission-aware L8 over this repo's
`_planning/` layout — this PR bridges with repo-only `scripts/` shims).

## Test plan

- [x] `npm test` — 207 tests across 7 suites, all green
- [x] Fresh tarball install on Windows Git Bash — automated 19/19 through the
      real hook chain; manual checklist passed in full
      (`_planning/M-0001-smoke-checklist.md`)
- [x] `npm pack --dry-run` — 84 files, no test files, no `_planning/`
- [x] L8 codex review — terminal `accepted`, codex.required honored

🤖 Generated with [Claude Code](https://claude.com/claude-code)
