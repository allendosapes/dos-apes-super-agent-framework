---
id: M-0001
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

## Workpad

### Docs verification (2026-07-02, live docs at code.claude.com/docs)

Sources: `/en/permissions`, `/en/settings`, `/en/hooks` (PreToolUse reference),
`/en/skills` (§ Restrict Claude's skill access), `/en/tools-reference`.

1. **allow/ask/deny** — all three lists supported under `permissions`. Evaluation order is
   deny → ask → allow; first match in that order wins and specificity does not change it
   (a broad deny beats a narrow allow; a matching ask prompts even when a narrower allow
   matches). Rules merge across settings scopes; a deny at any scope cannot be overridden
   by an allow at any other scope.

2. **`Bash(cmd:*)` vs `Bash(cmd *)`** — documented as equivalent: "The `:*` suffix is an
   equivalent way to write a trailing wildcard, so `Bash(ls:*)` matches the same commands
   as `Bash(ls *)`." Caveat: `:*` is only recognized at the *end* of a pattern; mid-pattern
   colons are literal. The permission dialog writes the space form. → Shipped colon-form
   rules (`Bash(codex:*)`, `Bash(node scripts/*.js:*)`) are valid; standardize new policy
   on the space form for consistency with what the dialog generates.

3. **Skill rules** — confirmed to exist: `Skill(name)` exact match, `Skill(name *)` prefix
   match with any arguments; usable in allow and deny. Name globs like `Skill(apes-*)` are
   NOT documented anywhere (the `*` in `Skill(name *)` covers arguments, not the name) —
   treat as unsupported. AC #2's approach stands: enumerate skill/command names at install
   time and emit one `Skill(name)` + `Skill(name *)` pair each.

4. **Read/Edit path scoping** — follows the gitignore spec with four anchors: `//path`
   (filesystem root), `~/path` (home), `/path` (project root), `path` or `./path` (cwd).
   A bare filename matches at any depth under cwd: `Read(.env)` ≡ `Read(**/.env)` — so the
   planned `Read(.env)` / `Read(.env.*)` deny rules cover nested `.env` files too, but not
   parent directories (use `Read(//**/.env)` for filesystem-wide). `Edit` rules apply to
   all built-in editing tools (Edit, Write, NotebookEdit), so `Edit(.claude/settings.json)`
   deny alone covers Write — keep the explicit Write rule anyway as documentation. Read/Edit
   deny rules also extend to recognized file commands in Bash (`cat`, `head`, `tail`, `sed`)
   but NOT to arbitrary subprocesses (a node script that opens `.env` itself is not blocked
   — only sandboxing gives OS-level enforcement). Windows paths are normalized to POSIX
   before matching (`C:\Users` → `/c/Users`).

5. **PreToolUse hook interface** — hook receives stdin JSON with `tool_name` and
   `tool_input.command` (full command string for Bash). Exit code 2 = blocking error,
   stderr is fed to Claude, tool call prevented. Alternative: exit 0 with
   `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision":
   "allow"|"deny"|"ask"|"defer", "permissionDecisionReason": "..."}}`. Ordering guarantees:
   a blocking hook (exit 2) takes precedence over allow rules; deny/ask permission rules
   are still evaluated even if a hook returns "allow". → `guard-forbidden-commands.sh`
   exit-2 design is sound and cannot be overridden by the allow list.

6. **Settings scope precedence** — managed > CLI args > `.claude/settings.local.json` >
   `.claude/settings.json` > `~/.claude/settings.json`. Permission rules merge across
   scopes rather than override; deny wins from any scope.

### Additional findings relevant to the policy

- **`TodoWrite` is disabled by default** since v2.1.142 (replaced by TaskCreate/TaskGet/
  TaskList/TaskUpdate, which require no permission). No tool named `Task` exists in the
  current tools reference (subagents are the `Agent` tool). Confirms AC #1: both allow
  entries are dead weight. Note: deny/ask rules with unknown tool names produce startup
  warnings; allow rules do not.
- **Built-in read-only command set** — `ls`, `cat`, `echo`, `pwd`, `head`, `tail`, `grep`,
  `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd`, and read-only git forms run without
  prompting in every mode, not configurable. Many current allow entries (`cat *`, `ls *`,
  `grep *`, …) are therefore redundant — dropping them from allow loses nothing.
- **Compound commands** — the permission layer splits on `&&`, `||`, `;`, `|`, `|&`, `&`,
  and newlines, and each subcommand must independently match a rule. Process wrappers
  `timeout`/`time`/`nice`/`nohup`/`stdbuf` and bare `xargs` are stripped before matching
  (so `Bash(xargs *)` in allow is both dangerous and unnecessary). `find -exec`/`-delete`
  and exec wrappers (`watch`, `setsid`, …) always prompt regardless of prefix rules.
- **Wildcard semantics** — a single `*` in Bash rules matches any sequence *including
  spaces* and can appear at any position; trailing ` *` enforces a word boundary
  (`Bash(ls *)` matches `ls -la` but not `lsof`).

### Task 2 decisions (2026-07-03, permissions block rewrite)

Rewrote `framework/settings.json` permissions to the §2.3 reviewed policy, with these
amendments and deviations, all reviewer-directed or surfaced here:

- **Space-wildcard form standardized** throughout allow/ask (`node scripts/mission-cli.js *`,
  `npm test *`, `npm audit fix *`, etc.). Exception, deliberate: deny rules keep
  boundary-free trailing `*` where the broader match is the point —
  `Bash(git push --force*)` also catches `--force-with-lease`, `Bash(git push -f*)`
  catches `-f`/`-force` spellings, and `Bash(rm -rf /*)` / `~*` / `..*` are path prefixes.
  Also kept boundary-free: `Bash(git mv .planning/missions/*)` (path prefix, a space
  before `*` would break it).
- **Dropped as redundant with the built-in read-only set** (never prompt in any mode,
  not configurable): `cat *`, `ls *`, `find *`, `grep *`, `wc *`, `head *`, `tail *`,
  `echo *`, `which *`, `pwd`. Kept because *outside* the documented set: `rg *`, `date *`,
  `sort *`, `uniq *`, `tr *`, `cut *`, `mkdir *`, `touch *`, `cp *`. Edge accepted: `find`
  with an unquoted glob still prompts (glob could expand to `-delete`) now that no explicit
  `find *` allow exists — acceptable, that prompt is protective.
- **Kept explicit git read-only rules** (`git status *`, `git diff *`, `git log *`, …)
  even though docs say "read-only forms of git" are in the built-in set: the docs don't
  enumerate which forms, and git is glob-sensitive, so the explicit rules prevent prompt
  regressions and document intent. Zero added risk.
- **Dropped entirely**: `Task`, `TodoWrite` (dead tool names — TodoWrite disabled by
  default since v2.1.142, no `Task` tool exists), `Bash(xargs *)` (bare xargs is stripped
  before matching, so the rule was unnecessary; flagged xargs is matched as xargs, so the
  rule was also an escape hatch), `Bash(yarn *)`, `Bash(pnpm *)`, `Bash(bun *)` (blanket
  package-manager escape hatches; npm is scoped instead), `Bash(mv *)`, `Bash(sed *)`,
  `Bash(awk *)` (awk `system()` is arbitrary exec), `Bash(chmod +x *)`, `Bash(bash *)`,
  `Bash(node *)`, `Bash(npm *)`, `Bash(npx *)`, `Bash(git push *)`, `Bash(git checkout *)`,
  `Bash(git rebase *)`, `Bash(git tag *)`, blanket `WebFetch`.
- **codex** scoped per AC #5: only `Bash(codex login)` and `Bash(codex --version)` in
  allow; all L8 invocations go through the allowlisted `node scripts/codex-*.js` entry
  points.
- **Skill rules shipped statically** in the template (18 `apes-*` commands × exact+args
  pair, 15 domain skills exact-only), verified against the live file inventory of
  `framework/commands/` and `framework/skills/`. Task for cli.js remains: *generate* these
  at install time from the installed file set so new skills auto-enroll (AC #2); the static
  list doubles as the fallback when generation is skipped.
- **`DOS_APES_VERSION`** bumped `2.0.0` → `3.5.1` (current package.json). Drift risk
  remains until `customizeSettings` stamps it from `package.json` at install time — do
  that in the cli.js task.
### Pre-Task-3 verification notes (2026-07-03, reviewer-directed; no settings changes — no check failed)

1. **Plain branch-switching in workflows — will now prompt.** Grep of `framework/` found
   no plain `git switch <branch>` anywhere, but plain `git checkout <existing-branch>`
   appears throughout the mission/build workflows: `apes-build.md:523,796,845,1022,1076,1249`
   (`git checkout main`, `git checkout feat/phase-N-slug`), `apes-feature.md:227`,
   `apes-fix.md:206`, `apes-refactor.md:180` (all `git checkout main`). With allow limited
   to `git checkout -b *` / `git switch -c *`, each branch-return step now prompts once.
   Branch-creation-only is therefore NOT sufficient for a prompt-free build loop.
   **Flagged for review:** `Bash(git switch *)` as a candidate ask rule (documents intent;
   an unmatched command prompts anyway, so the rule is declarative not behavioral). The
   real fix — migrating command files from `git checkout <branch>` to `git switch <branch>`
   and/or a scoped `git checkout main` allow — belongs to the compound-command-hygiene
   follow-up mission, not M-0001.

2. **`Bash(git mv .planning/missions/*)` scope is intentional.** The rule matches installed
   projects, where the CLI creates `.planning/missions/` — correct for the shipped template.
   It deliberately does NOT match this repo's own `_planning/` root: dogfooding moves (this
   repo consuming its own shipped policy) are out of scope for M-0001 and belong to the P3
   dogfooding mission.

3. **Deny-spelling audit — every entry matches its real invocation form.**
   - `npm publish` / `npm version`: exact + ` *` pair covers bare and argument forms.
   - `npm dist-tag *`: matches all subcommand forms (`add`/`rm`/`ls <pkg>`); bare
     `npm dist-tag` (implicit read-only `ls`) falls through — harmless.
   - `npm unpublish *`: matches any argument form incl. `--force`; bare `npm unpublish`
     refuses to run without `--force`, and `--force` matches the rule.
   - `npm deprecate *`: real form requires two args and matches; bare form errors in npm.
   - `git push --force*` / `-f*`: boundary-free `*` catches `--force-with-lease` and `-f`
     spellings when flag-first; the common `git push origin main --force` ordering falls
     through to ask `git push *` (still prompts) — known and by design, the Task 4
     `guard-forbidden-commands.sh` regex scan is the deterministic backstop (AC #7).
   - `git push origin --delete *` / `git push --delete *`: match the documented delete
     forms; other-remote deletes and refspec deletion (`git push origin :branch`) fall to
     ask (prompt) + guard hook.
   - `rm -rf /*` / `~*` / `..*`: boundary-free path prefixes as intended; alternate
     spellings (`rm -fr`, `rm -r -f`) fall to ask `Bash(rm *)` (prompt).
   - `Read(.env)` / `Read(.env.*)`: bare filename matches at any depth under cwd per the
     gitignore-spec anchoring (workpad docs-verification #4) — nested `.env` covered.
   - `Edit(.claude/settings.json)` / `Write(...)`: slash-containing pattern anchors at
     project root — exactly the installed path.
   Verdict: no deny entry is mis-spelled for its primary invocation; all known bypass
   spellings land on an ask rule (prompt) or the Task 4 guard hook. No changes made.

### Task 3 (2026-07-03, install-time Skill-rule generation — AC #2)

- `bin/cli.js`: new `generateSkillRules(commandsDir, skillsDir)` — enumerates `*.md`
  (excluding `README.md`, case-insensitive), commands get `Skill(name)` + `Skill(name *)`
  pairs, domain skills get `Skill(name)` only (preserves the Task 2 static-list semantics:
  commands are user-invoked with args, skills are teammate-loaded without). Sorted
  alphabetically per group, commands first — byte-identical to the static list today.
- `customizeSettings(config, frameworkDir = FRAMEWORK_DIR)`: strips all `Skill(...)`
  entries from `allow` and prepends the generated set; when enumeration yields zero names
  (missing/empty dirs), the static list is kept untouched and a warning prints — the
  fallback the Task 2 note promised. `frameworkDir` param added for testability.
- Also stamps `env.DOS_APES_VERSION` from `package.json` at install time (closes the
  drift risk recorded in Task 2; template value no longer load-bearing).
- `main()` gated behind `require.main === module` (M-0005 precedent) +
  `module.exports = { generateSkillRules, customizeSettings, patchHooksForWindows }`.
- `bin/cli.test.js`: 13 tests, hand-rolled zero-dep runner per house style. Includes a
  **drift guard**: generated rules from the real `framework/commands|skills` must equal
  the static Skill list in `framework/settings.json` — fails when a skill is added
  without regenerating the fallback.
- `package.json`: `files` narrowed `bin/` → `bin/cli.js` so the test doesn't ship
  (M-0005 deviation #2 precedent); `test:cli` script added and chained into `test`.
  `npm pack --dry-run`: 84 files, cli.js in, cli.test.js out.

### Queued for Task 5 — packaging finding from Task 3 review (2026-07-03)

`framework/scripts/codex-review-cwd-equivalence.test.js` ships in the npm tarball while
the four other test files are correctly excluded: the exclusion mechanism is
name-enumerated (`package.json` `files` lists production scripts explicitly, and that
test file was itself added to the whitelist — drift at addition time). Task 5 fix,
pattern-based rather than one more name:

- Verify against npm docs whether `.npmignore` patterns prune *within* directories (and
  alongside explicit entries) whitelisted by `files`; if so, add a `*.test.js` exclusion
  so future test files can't leak. Record the verified npm behavior here.
- Remove the test file's explicit `files` entry either way.
- Confirm `npm pack --dry-run` drops 84 → 83 files with `bin/cli.js` and all production
  `framework/scripts/*` still present.

- **Still owed by this mission** (later tasks):
  `scripts/guard-forbidden-commands.sh` + PreToolUse registration (AC #6/#7 backstop),
  settings-README rationale note for tag-mutation-as-ask (AC #6 — no settings README
  exists yet; needs a home, likely a new `framework/templates/` doc or README section),
  tarball test-file exclusion made pattern-based (Task 5, see above),
  fresh-install verification on Windows Git Bash (final AC).
