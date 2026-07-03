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
- Confirm `npm pack --dry-run` drops to **84** files (maintainer correction: Task 4's
  guard script moved the baseline 84 → 85, so removing the leaked test file lands on 84,
  not the originally stated 83) with `bin/cli.js` and all production
  `framework/scripts/*` still present.

### Task 4 (2026-07-03, guard-forbidden-commands.sh — AC #7)

- **`guard-main-branch.sh` drift CONFIRMED** (the known candidate): it emits
  `{"block": true, "message": "..."}` JSON on **stderr** with exit 2. Exit-2 + stderr is
  the documented blocking mechanism, but that JSON shape is not the documented interface —
  JSON decisions belong on stdout with exit 0 as `hookSpecificOutput.permissionDecision`,
  and `{"block": ...}` isn't even that shape (v1-era relic). It still blocks (exit code
  governs); Claude just receives raw JSON as opaque stderr text. The new guard uses
  plain-text stderr per the documented interface. Fixing guard-main-branch.sh's output is
  a small cleanup **not** done here (out of Task 4 scope) — flagged for a follow-up.
- **`run-hook.cmd` degraded-mode CONFLICT — flagged, deliberately not resolved.** When
  Git Bash is not at one of its four probe paths (Program Files ×2, LocalAppData, scoop),
  run-hook.cmd prints "Hook skipped" and **exits 0** — on such a box the blocking guard
  silently cannot block, while the Bash tool may still work (e.g. Git Bash on PATH from a
  nonstandard install). The new hook is registered identically to guard-main-branch.sh
  (`bash scripts/guard-forbidden-commands.sh`, no `|| true`) and patchHooksForWindows
  routes both through run-hook.cmd, so both guards share the gap. Maintainer options:
  (a) accept — Claude Code's Bash tool itself requires Git Bash, so the window is
  nonstandard-install-location only; (b) add a PATH probe (`where bash.exe`) to
  run-hook.cmd and/or make it exit 2 when the script name starts with `guard-`;
  (c) a `--strict` runner flag used only by guard hooks. Not chosen silently per
  Task 4 instruction (3).
- **AC #7 deviation, surfaced: tag mutation is NOT in the hook's forbidden set.** AC #7's
  text lists "tag mutation" among the scanned patterns, but AC #6 makes tag mutation
  ask-not-deny by design (`/apes-build` creates and cleans phase tags — a hard block
  would break the build loop, and a hook block outranks any allow/ask rule). The hook
  covers exactly the deny-audit fall-through set per the Task 4 instruction. Promote tag
  mutation into the hook + deny together, when phase tags are replaced.
- **Guard design**: extracts `tool_input.command` from stdin JSON via node (hard framework
  dependency; raw-JSON scan fallback if node missing — may overmatch, never undermatches).
  Full-string scan for npm registry mutation (`publish|version|dist-tag|unpublish|deprecate`,
  flags allowed between `npm` and verb); per-segment scan (split on `&&`/`||`/`;`/`|`/`&`/
  newlines) for force push in any flag position/spelling (`--force`, `--force-with-lease[=]`,
  `--force-if-includes`, short-bundle `-f`/`-fu`, `+refspec`), refspec deletion
  (`git push origin :branch`), and recursive+force rm respellings (`-fr`, `-r -f`,
  `-Rf`, `--recursive --force`) aimed at `/`, `~`, or `..` targets — mirroring the deny
  rules' target set exactly, so hook and deny stay policy-consistent.
- **Overmatch policy documented in the script header**: backstop prefers false block over
  false pass; quotes count as token boundaries, so `bash -c "npm publish"` is blocked
  (real evasion) and `echo "npm publish"` is too (rare, harmless loss). Fail-closed: an
  internal script error exits 2 (blocks) via ERR trap rather than failing open.
- **Tests**: `guard-forbidden-commands.test.js`, 46 fixture cases through real bash with
  hook-shaped stdin JSON — includes the required compound case
  (`git commit -m x && npm publish`) and flag-last force push
  (`git push origin main --force`), plus allowed-side guards against false positives
  (`npm run version`, `npm run publish-docs`, `git push origin HEAD:main`,
  `rm -rf ./build`). Chained into `test:lib`; script added to `files` (ships), test not.
- **Review amendments (accepted-with-amendments, 2026-07-03)**: (1) JSON parse failure in
  the node extractor now emits the RAW input instead of empty, so the raw-scan overmatch
  applies — the previous empty-emit exited 0, a fail-open inconsistent with the no-node
  fallback and the header's no-undermatch policy; fixtures added for corrupt-envelope-with-
  forbidden-string (blocked) and benign corrupt envelope (allowed). (2) The accepted
  overmatch is pinned by fixture: `git commit -m "docs: explain why npm publish is denied"`
  asserts blocked, commented as the documented false-positive trade-off; the block message
  now ends with a rephrase hint for quoted-text false positives. 49 fixture cases total.
- **Placement decision — tag-mutation-as-ask rationale doc**: a new
  `framework/settings.README.md`, installed to `.claude/settings.README.md` next to
  settings.json. Rationale: settings.json cannot carry comments, so the README must live
  where the policy lives to be found when someone questions a prompt; `docs/templates/`
  is for authoring templates, ARCHITECTURE.md is repo-only (not installed). Costs one
  `files` entry + one copy line in cli.js. To be written in the owed settings-README task.

### Task 4b (2026-07-03, run-hook.cmd fail-closed for guards — maintainer Decision 1)

- **Env var verified against live docs first** (`/en/setup`, § Set up on Windows):
  `CLAUDE_CODE_GIT_BASH_PATH` is the documented variable Claude Code itself uses when it
  can't find Git Bash, set via settings.json `env` — which is exactly the env applied to
  hook processes, so honoring it in run-hook.cmd is coherent. Checked FIRST in discovery
  (explicit user config outranks probing).
- **PATH probe added as last resort**: `where bash.exe`, skipping any hit under
  `\Windows\` — the WSL bash shim lives in System32 and is precisely what this runner
  exists to avoid; a naive PATH probe would have reintroduced it.
- **Fail-closed split on discovery failure**: hook args matching `guard-` exit 2 with
  clear stderr (names the env var fix); all other hooks keep the exit-0 "Hook skipped"
  so non-blocking quality hooks stay best-effort. Closes the Task 4 flagged gap per
  maintainer Decision 1. Runner diff kept minimal: two inserted stanzas, existing four
  probe paths untouched.
- **`guard-` detection is substring-over-the-full-argument-line, overmatching toward
  fail-closed by design**: on a bashless machine, an inline `-c` command whose TEXT
  happens to contain "guard-" also exits 2 rather than skipping. Accepted — the failure
  direction is safe (a spurious block on a machine where no hook can run anyway), and
  the alternative (parsing the script path out of `%*` in batch) buys precision only in
  that degenerate state.
- **Tests**: `run-hook.test.js`, 8 cases, Windows-only (skips with a message elsewhere,
  so the test:lib chain stays green cross-platform). Simulates discovery failure via a
  stripped env (probe vars absent, PATH=System32 only) — verifies guard-* exits 2 /
  non-guard exits 0; positive path verifies the env-var override, the PATH probe, exit-
  code propagation (bash `exit 2` → runner exit 2 — blocking fidelity end-to-end), and
  stdin flowing through to the real guard script (full envelope → block). Test file not
  shipped; run-hook.cmd already in `files`. Tarball steady at 85.

### Task 5 (2026-07-03, L0–L2 pass + pattern-based tarball exclusion)

- **npm behavior VERIFIED, docs + empirically**: npm docs (`package.json` § files):
  "You can also provide a .npmignore file in the root of your package or in
  subdirectories... At the root of your package it will not override the 'files' field,
  but in subdirectories it will." Empirical confirmation in this repo: with
  `framework/scripts/.npmignore` containing `*.test.js` and the explicit
  `codex-review-cwd-equivalence.test.js` entry STILL in `files`, `npm pack --dry-run`
  dropped 85 → 84 and the test file vanished — a subdirectory .npmignore prunes even an
  explicitly files-listed file. Root .npmignore would NOT have worked.
- **Implementation**: `*.test.js` .npmignore added to the three code dirs that hold test
  files (`bin/`, `framework/lib/`, `framework/scripts/`); the stale explicit
  `codex-review-cwd-equivalence.test.js` entry removed from `files` (dead weight once
  ignored — and the drift vector this finding was about).
- **Second layer, deliberate** (belt-and-suspenders per standing feedback): a packaging
  drift-guard group in `bin/cli.test.js` runs `npm pack --dry-run --json` and asserts
  (a) no `*.test.js` ships, (b) nothing from `_planning/` ships, (c) cli.js, both guard
  scripts, run-hook.cmd, and settings.json ship, (d) every explicitly whitelisted
  production file ships. This also covers the directory-whitelisted `files` entries
  (framework/commands|skills|ci, assets) that carry no .npmignore, and catches future
  drift in either mechanism.
- **L0–L2 pass, all suites**: L0 — `node bin/cli.js --version` (3.5.1) and `--help` OK.
  L1 — `node --check` clean on all JS (bin, lib, scripts), `bash -n` clean on all shell
  scripts, settings.json + package.json parse. L2 — 205 tests green across 8 suites
  (31+51+14+30+4 lib/codex, 49 guard, 8 run-hook, 18 cli incl. packaging).
- **Tarball confirmed**: 84 files exactly (maintainer-corrected expectation); all 21
  `framework/scripts/` production entries present; nothing from `_planning/`; zero
  `.test.js`.

### Acceptance criteria walkthrough (2026-07-03, end of Task 5)

- **AC #1 — permissions block matches reviewed policy**: **satisfied** (Task 2 rewrite,
  diff-reviewed; Task 3 pre-notes re-verified branch-switching scope, `git mv` scope,
  and deny spellings against the shipped block).
- **AC #2 — install-time Skill-rule generation, no hand-maintained list**: **satisfied**
  (Task 3: `generateSkillRules` + `customizeSettings` swap with static-list fallback;
  drift-guard test keeps the fallback synced; 13 dedicated tests).
- **AC #3 — deny blocks npm publish/version/dist-tag/unpublish/deprecate, force-push,
  remote delete, rm -rf /* ~* ..***: **satisfied** (Task 2 rules; Task 3 deny-spelling
  audit confirmed real invocation forms; Task 4 hook backstops the fall-through
  spellings).
- **AC #4 — deny protects secrets and the policy itself**: **satisfied** (Task 2:
  `Read(.env)`, `Read(.env.*)`, `Edit/Write(.claude/settings.json)`; rule syntax
  verified against live docs in Task 1, incl. bare-filename ≡ any-depth anchoring).
- **AC #5 — no blanket codex in allow**: **satisfied** (only `codex login` and
  `codex --version`; L8 runs through allowlisted `node scripts/codex-*.js`).
- **AC #6 — ask list exact + tag-mutation rationale in settings README**: **partially
  satisfied** — ask list matches the specified set exactly (Task 2). The settings README
  carrying the rationale is NOT yet written; home decided (Task 4 note:
  `framework/settings.README.md` → `.claude/settings.README.md`), owed as the next task.
- **AC #7 — guard-forbidden-commands.sh PreToolUse backstop**: **satisfied** (Tasks 4 +
  4b; 49 + 8 fixture tests), with one surfaced deviation: tag mutation deliberately
  excluded from the hook because AC #6 makes it ask-by-design — recorded in the Task 4
  notes, promote hook+deny together when phase tags are replaced.
- **AC #8 — DOS_APES_VERSION reads the real package version**: **satisfied** (static
  value corrected in Task 2; stamped from package.json at install time in Task 3 so it
  cannot drift again).
- **AC #9 — fresh install on Windows Git Bash (skills prompt-free, read-onlies
  prompt-free, push/reset/rm prompt, publish/dist-tag blocked)**: **awaiting-smoke-test**
  (final mission task, after the settings README).
- **Mission verification block (`required_levels: [L0, L1, L2, L8]`, codex required)**:
  L0–L2 **satisfied** this task (see pass above); L8 codex cross-model review
  **awaiting-L8** — must reach a real verdict, no skipped terminal, per frontmatter.

### Settings README task (2026-07-03, AC #6 remainder)

- `framework/settings.README.md` written per the Task 4 placement decision; installed
  beside the policy as `.claude/settings.README.md`. Content: allow/ask/deny philosophy,
  tag-mutation-as-ask rationale with the **paired-promotion precondition** (tags promote
  to deny only when `/apes-build` phase tags are replaced — never one without the other),
  the guard hook's deny-backstop role incl. the documented quoted-text false positive and
  its rephrase workaround, and the `CLAUDE_CODE_GIT_BASH_PATH` note for nonstandard Git
  Bash installs.
- **Installer verified: it would NOT have shipped.** cli.js copies only enumerated paths
  (commands/, skills/, scripts/, lib/, explicit template list, claude-desktop-skills/,
  ci/) and *writes* settings.json via customizeSettings — a framework-root sibling .md is
  never copied. Fixed with a new step 5b: unconditional copy to
  `.claude/settings.README.md` (framework-owned doc, refreshed each install so the
  rationale tracks the installed version — unlike user-owned settings.json, which is
  preserved). Added to the `files` whitelist.
- Tests: presence assertion in the packaging drift-guard; content test pinning the six
  required topics (whitespace-normalized — the paired-promotion phrase wraps a line).
  cli suite now 19; **tarball baseline 84 → 85** with the README shipping at 4.2kB.
- AC #6 now **fully satisfied** (ask list exact since Task 2; rationale documented).

### Task 6 (2026-07-03, fresh-install smoke test — AC #9)

- **True tarball path exercised**, not a repo-direct install: `npm pack` (85 files) →
  extract → `node package/bin/cli.js --local --yes --greenfield` into a fresh `git init`
  project on Windows Git Bash. 86 files installed, no prompts, no errors.
- **Automated portion: 15/15 passed** against the installed tree — Skill-rule generation
  (18 command pairs + 15 skills, zero stale rules), exact ask set, deny set intact, no
  blanket allows, `DOS_APES_VERSION` stamped 3.5.1, guard hook registered and
  Windows-routed, settings README installed, and guard behavior end-to-end through the
  INSTALLED `run-hook.cmd`: `npm publish` / `npm dist-tag add` / flag-last force push /
  compound-chain publish all exit 2; benign commands (incl. plain `git push`, ask's
  territory) exit 0.
- **Checklist location: `_planning/M-0001-smoke-checklist.md`** — automated results
  recorded; manual section lists the live-session items (prompt-vs-no-prompt behavior
  for skills, read-onlies, push/reset/rm; deny-by-rule for publish/dist-tag; hook block
  for the flag-last force push; the known `git checkout main` prompt). AC #9 stays
  **awaiting-smoke-test** until the maintainer runs the manual section in a live
  session — prompting is permission-layer behavior only observable there.
- Verification script preserved in scratchpad (`m0001-smoke/verify-install.js`) and
  referenced from the checklist for reproduction.

### Task 6b (2026-07-03, BLOCKING smoke finding: hooks silently inert on Windows)

- **Finding (manual smoke attempt 1)**: every PreToolUse hook — including the guard —
  failed non-blocking in a live session with `/usr/bin/bash: line 1: scriptsrun-hook.cmd:
  command not found`. Root cause: `patchHooksForWindows` rewrote hook commands to
  `scripts\run-hook.cmd …`, but current Claude Code executes hook commands through
  **Git Bash natively** on Windows — bash consumed the backslash as an escape, and the
  cmd-wrapper targets an execution model that no longer exists. The error path is
  non-blocking, so the whole hook layer was silently inert in installed projects.
- **Docs verification**: hooks reference (`/en/hooks`): "The `command` string is passed
  to a shell: `sh -c` on macOS and Linux, **Git Bash on Windows**, or PowerShell when
  Git Bash isn't installed"; per-hook `shell` field exists for overrides. The public
  changelog has **no dated entry** for this behavior — "since when" is unresolvable from
  the changelog; current docs plus the live-session error both confirm bash-native
  execution today. (Historical note: the wrapper predates this mission; whether it was
  ever load-bearing is moot — it is provably harmful now.)
- **Fix**: `patchHooksForWindows` deleted; hooks ship in their original
  `bash scripts/*.sh` form on every platform. The existing-settings migration block now
  runs `unpatchWindowsHooks` (reverse migration, unconditional — the damage lives in the
  settings file, not the installer's platform): `scripts\run-hook.cmd scripts/foo.sh` →
  `bash scripts/foo.sh`, inline `-c "escaped"` → original unescaped command. 4 unit
  tests (both forms, no-change case, no-wrapper-in-output on any platform).
- **run-hook.cmd RETIRED** (decision + rationale): nothing else invokes it (verified by
  repo-wide grep — only patchHooksForWindows generated invocations); it duplicates Git
  Bash discovery the product now does itself, including the `CLAUDE_CODE_GIT_BASH_PATH`
  override honored in Task 4b. Deleted with its 8-case test suite; `files` and test:lib
  entries removed; tarball 85 → 84. **The Task 4b work is superseded**, not wasted: its
  docs-verified env-var finding moved into settings.README.md and README troubleshooting,
  and its fail-closed intent transfers to the residual-risk note below.
- **Residual risk #1, follow-up mission candidate**: on a Git-Bash-less Windows box,
  Claude Code switches to the **PowerShell tool** — where `Bash(...)` permission rules
  and the Bash-matcher guard hook do not apply at all. The policy as shipped requires
  Git Bash on Windows (now stated in settings.README.md); a PowerShell-matcher guard +
  rule set is a separate mission.
- **Residual risk #2, accepted (maintainer, 2026-07-03), same follow-up mission**: under
  bash-native hook execution, a missing or deleted `guard-forbidden-commands.sh` yields
  exit **127** (command not found), which Claude Code treats as a **non-blocking**
  hook error — silent fail-open. The guard's internal ERR trap only protects a script
  that runs; the retired runner's fail-closed *discovery* check (guard-* → exit 2 when
  the chain can't execute) has **no equivalent** in the native model, and Claude Code
  offers no per-hook on-missing-fail-closed knob. Belongs with residual #1 in one
  follow-up mission — scope: **guard integrity**, the conditions under which the
  backstop is silently absent (wrong tool, missing script, unrunnable interpreter).
- **Docs updated**: settings.README.md Windows section rewritten (native execution,
  env var, Git-Bash-required statement); README.md "Hooks not firing" rewritten incl.
  re-run-installer migration note, version-neutral.
- **Smoke rerun (rev2)**: tarball rebuilt (84 files), fresh install (85 files installed),
  verification rewritten to exercise the REAL chain — `bash -c` on the exact hook command
  string from the installed settings.json with hook-shaped stdin, no cmd.exe entry point.
  **19/19 passed**, including a new check that `guard-main-branch.sh` fires (it was
  equally inert under the wrapper). Checklist updated to rev2:
  `_planning/M-0001-smoke-checklist.md`; script at scratchpad
  `m0001-smoke-v2/verify-install.js`.
- **Partial manual results recorded (attempt 1, pre-fix)**: `/apes-help` and
  `/apes-status` Skill invocations prompt-free — PASS; `/apes-status` internal pipeline
  prompted at its `node -e` segment — known M-0003 item, declined, not an AC #9 failure;
  guard hook inert — the finding above, fixed. Prompt-behavior results stay valid;
  hook-behavior items flagged for re-verification in the manual rerun.

- **Still owed by this mission**:
  manual half of the smoke checklist, re-attempt post-fix (AC #9, live session,
  maintainer),
  L8 codex review (mission verification block).
  Flagged follow-ups, out of mission scope: guard-main-branch.sh stderr-JSON cleanup;
  PowerShell-tool permission coverage (see Task 6b residual risk).
