# Dos Apes Framework Improvement Analysis — v3.5.1

**Date:** 2026-07-02
**Analyzed at:** tree content-identical to `origin/main@459abce`; addendum reflects `a89055b` (SECURITY.md).
**Scope:** permission friction audit, platform duplication audit, pure-SDLC-harness evaluation.
**Status:** proposals only — maintainer files accepted findings as missions.

---

## 1. Executive summary

1. **The shipped permission policy is inverted.** `framework/settings.json:93-168` pre-approves the dangerous operations (`Bash(rm *)`, `Bash(git push *)`, `Bash(npm *)` — which includes `npm publish` — `Bash(git tag *)`, `Bash(bash *)`, `Bash(node *)` = arbitrary code execution) while containing **zero `Skill(...)` rules**, so the framework's own machinery prompts on every first use but a destructive push to main does not.
2. **Existing installs never receive permission updates.** `bin/cli.js:690-839` migrates schema/shape of an existing `.claude/settings.json` but never merges the allowlist — any user whose settings predate the current list gets *none* of it, which is the likely root cause of the "grep/ls/node prompts constantly" class of friction.
3. **`Skill(apes-*)` name globs are not supported** (per https://code.claude.com/docs/en/permissions.md — allow-rule globs on tool names are skipped with a warning); the fix is one enumerated pair of rules per shipped skill, which the installer should generate from the file list so it never drifts.
4. **Compound-command semantics defeat the Bash allowlist by design**: `&&`, `|`, `;` split a command and each subcommand must independently match a rule (same doc page). Framework command files are full of `&&` chains, pipes into `node -e`, `$(...)` substitution, and env-prefixed invocations (`COVERAGE_THRESHOLD=90 bash ...` at `framework/skills/testing.md:176`) — each of these prompts regardless of the allowlist.
5. **The strategic split is already 80% done**: `framework/lib/*` + `mission-cli.js`/`mission-worktree.js`/`log-verification.js` are pure Node with no Claude Code imports; the only entanglements are `evidence-packet.js` reading `.claude/auto-reviews/` and `codex-review-loop.js` spawning `claude -p`. Recommendation: option (c) — formalize the CLI boundary in the next minor, split packages when the cloud tier is concrete.

Also flagged: `framework/settings.json:172` ships `DOS_APES_VERSION: "2.0.0"` (package is 3.5.1); `check-task-gates.sh` speaks the retired v2 state vocabulary (`READY/IN_PROGRESS/IN_REVIEW/IN_QA/VERIFIED/MERGED`) while the mission FSM is `todo/doing/review/done/canceled`; this repo's `CLAUDE.md` claims 13 commands / 7 skills / 10 scripts vs. the actual 18 / 16 / 23.

---

## 2. Part 1 — Permission friction audit

### 2.1 Why users see prompts (root-cause analysis)

**A. Skill invocation prompts.** Commands and skills are a unified system (https://code.claude.com/docs/en/skills.md: "Custom commands have been merged into skills... both create `/name` and work the same way"). Every model-driven invocation of an `apes-*` command or a domain skill goes through the Skill permission gate. The shipped settings contain no `Skill(...)` rules. Additionally, per-skill `allowed-tools` grants for **project-checked-in** skills only take effect after the user accepts the workspace trust dialog — a second prompt source on fresh installs.

**B. Compound commands.** Per https://code.claude.com/docs/en/permissions.md, `&&`, `||`, `;`, `|`, `&` and newlines split a Bash invocation and *each* subcommand must independently match an allow rule. Framework instances that prompt even under the current maximal allowlist:
- Chains containing an unmatched element, e.g. `git reset --hard` (no rule) — `framework/commands/apes-build.md:895,1242`
- `COVERAGE_THRESHOLD=90 bash scripts/check-coverage.sh` — `framework/skills/testing.md:176` (env-var prefix; command doesn't start with `bash`)
- `trap 'node scripts/mission-cli.js clear-active ...' EXIT` — `framework/commands/apes-build.md:362` (starts with `trap`)
- `git checkout $(git describe --tags ...)` — `framework/skills/devops.md:233` (command substitution)

**C. Existing installs have stale or absent permissions.** `bin/cli.js:685-689` writes the shipped settings only when no `.claude/settings.json` exists; the else-branch (`cli.js:690-839`) performs shape migrations but does *not* merge `permissions.allow`.

**D. Commands the framework needs but never allowlisted:** `git reset --hard` (`apes-build.md:895,1242`), `curl` (`devops.md:252`, `observability.md:92,137`), `agent-browser` (`browser-verification.md:14-19`), `gcloud`/`aws`/`az` unless the deploy-target question added one (`cli.js:373-379`), `semgrep` (only via `npx`).

### 2.2 Trigger inventory (condensed)

| Risk class | Representative triggers (file:line) | Matched by shipped rule today? |
|---|---|---|
| Read-only | `git status/diff/log/show/rev-parse`, `cat/ls/find/grep/rg/wc/head/tail`, `mission-cli.js list/show/deps/active`, `check-*.sh` | Yes (when not compound) |
| Repo-mutating (local) | `git add/commit/checkout -b/merge --squash/stash/worktree`, `mission-cli.js move/create/workpad` (does `git mv` via `execFileSync` — child processes are invisible to the permission layer), `evidence-packet.js generate`, `npm install`, `prettier` | Yes |
| Network | **`git push origin main`** (`apes-build.md:1079`, `apes-fix.md:210`, `apes-feature.md:247`, `apes-refactor.md:199`), `git push --tags` (`apes-build.md:1083`), `codex-review*.js` → `codex` CLI, `codex-review-loop.js:275` → nested `claude -p`, `npx @playwright/mcp@latest` (MCP auto-launch), `curl`, `gcloud`, `npm run deploy` (`apes-build.md:1109`) | Push/codex/npx: **yes — silently allowed**; curl/gcloud: no |
| Destructive | `git reset --hard` (`apes-build.md:895`), `git push origin --delete` (`apes-feature.md:249`), `git branch -D` + `git tag -d $(git tag -l "phase-2/*")` (`apes-build.md:1250-1251`), `rm` anywhere, `npm audit fix` | `rm`/`branch -D`/`tag -d`: **yes — silently allowed**; `reset --hard`: no |

The current file optimizes for zero prompts on the *dangerous* class and fails to suppress prompts on the *safe* class — backwards relative to "hooks over trust."

### 2.3 Proposed shipped `permissions` block

Verified syntax: `:*` ≡ trailing ` *`; `Bash(ls *)` does not match `lsof` but `Bash(ls*)` does; evaluation is **deny → ask → allow, first match wins**, so an ask rule shadows a narrower allow — the ask list below is deliberately minimal and most "ask" behavior is achieved by *not allowing* (unmatched commands prompt by default).

```json
{
  "permissions": {
    "allow": [
      "Skill(apes-board)",        "Skill(apes-board *)",
      "Skill(apes-build)",        "Skill(apes-build *)",
      "Skill(apes-codex-review)", "Skill(apes-codex-review *)",
      "Skill(apes-evidence)",     "Skill(apes-evidence *)",
      "Skill(apes-feature)",      "Skill(apes-feature *)",
      "Skill(apes-fix)",          "Skill(apes-fix *)",
      "Skill(apes-gc)",           "Skill(apes-gc *)",
      "Skill(apes-help)",         "Skill(apes-help *)",
      "Skill(apes-map)",          "Skill(apes-map *)",
      "Skill(apes-metrics)",      "Skill(apes-metrics *)",
      "Skill(apes-mission)",      "Skill(apes-mission *)",
      "Skill(apes-refactor)",     "Skill(apes-refactor *)",
      "Skill(apes-security-scan)","Skill(apes-security-scan *)",
      "Skill(apes-status)",       "Skill(apes-status *)",
      "Skill(apes-test-a11y)",    "Skill(apes-test-a11y *)",
      "Skill(apes-test-e2e)",     "Skill(apes-test-e2e *)",
      "Skill(apes-test-visual)",  "Skill(apes-test-visual *)",
      "Skill(apes-verify)",       "Skill(apes-verify *)",
      "Skill(architecture)", "Skill(backend)", "Skill(browser-verification)",
      "Skill(cross-model-review)", "Skill(design-integration)", "Skill(devops)",
      "Skill(evidence-packets)", "Skill(frontend)", "Skill(missions)",
      "Skill(observability)", "Skill(orchestration)", "Skill(product)",
      "Skill(review)", "Skill(testing)", "Skill(worktrees)",

      "Bash(git status*)", "Bash(git diff *)", "Bash(git log *)",
      "Bash(git show *)", "Bash(git rev-parse *)", "Bash(git describe *)",
      "Bash(git branch)", "Bash(git branch --show-current)", "Bash(git branch -l *)",
      "Bash(git branch -a)", "Bash(git tag -l*)", "Bash(git stash list)",
      "Bash(git worktree list)", "Bash(git merge-base *)", "Bash(git config --get *)",
      "Bash(git remote -v)", "Bash(git fetch *)",
      "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)",
      "Bash(grep *)", "Bash(rg *)", "Bash(find *)", "Bash(which *)", "Bash(pwd)",
      "Bash(date *)", "Bash(sort *)", "Bash(uniq *)", "Bash(tr *)", "Bash(cut *)",
      "Bash(echo *)", "Bash(mkdir *)", "Bash(touch *)", "Bash(cp *)",

      "Bash(node scripts/mission-cli.js:*)",
      "Bash(node scripts/mission-worktree.js:*)",
      "Bash(node scripts/evidence-packet.js:*)",
      "Bash(node scripts/log-verification.js:*)",
      "Bash(node scripts/codex-check.js:*)",
      "Bash(node scripts/codex-review.js:*)",
      "Bash(node scripts/codex-review-loop.js:*)",
      "Bash(bash scripts/check-coverage.sh*)",
      "Bash(bash scripts/check-secrets.sh*)",
      "Bash(bash scripts/check-structure.sh*)",
      "Bash(bash scripts/check-doc-drift.sh*)",
      "Bash(bash scripts/check-task-gates.sh*)",

      "Bash(npm run *)", "Bash(npm test*)", "Bash(npm ci)", "Bash(npm audit)",
      "Bash(npm install*)",
      "Bash(npx playwright *)", "Bash(npx semgrep *)",
      "Bash(tsc *)", "Bash(tsx *)", "Bash(vitest *)", "Bash(jest *)",
      "Bash(eslint *)", "Bash(prettier *)", "Bash(gitleaks *)",

      "Bash(git add *)", "Bash(git commit *)",
      "Bash(git checkout -b *)", "Bash(git switch -c *)",
      "Bash(git merge *)", "Bash(git pull)", "Bash(git pull origin *)",
      "Bash(git stash*)", "Bash(git worktree add *)", "Bash(git worktree prune)",
      "Bash(git mv .planning/missions/*)",
      "Bash(codex *)",

      "Read", "Edit", "Write", "Grep", "Glob"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(git branch -d *)", "Bash(git branch -D *)",
      "Bash(git tag -a *)", "Bash(git tag -d *)",
      "Bash(git reset --hard *)",
      "Bash(git worktree remove *)",
      "Bash(rm *)",
      "Bash(npm audit fix*)"
    ],
    "deny": [
      "Bash(npm publish)", "Bash(npm publish *)",
      "Bash(npm version)", "Bash(npm version *)",
      "Bash(git push --force*)", "Bash(git push -f*)",
      "Bash(git push origin --delete *)", "Bash(git push --delete *)",
      "Bash(rm -rf /*)", "Bash(rm -rf ~*)", "Bash(rm -rf ..*)"
    ]
  }
}
```

**Rationale per group:**
- **Skill rules**: name globs unsupported, so enumerate. `cli.js` should *generate* them at install time from `framework/commands/*.md` + `framework/skills/*.md` (change in `customizeSettings`, `cli.js:353-382`) — new skills auto-enroll.
- **Removed from allow**: `Bash(rm *)`, `Bash(mv *)`, `Bash(sed *)`, `Bash(bash *)`, `Bash(node *)`, `Bash(npm *)`, `Bash(npx *)`, `Bash(git push *)`, `Bash(git checkout *)` (plain checkout discards changes; only `-b`/`switch -c` stay), `Bash(git rebase *)`, `Bash(git tag *)`, `Bash(xargs *)`, `Bash(chmod +x *)`, blanket `WebFetch`, stale tool names `Task`/`TodoWrite`. `bash *` and `node *` alone were equivalent to "allow everything"; scoping them to `scripts/` is the single highest-leverage change.
- **Ask list is intentionally short** because ask shadows allow (deny → ask → allow, first match). E.g. ask `Bash(git mv *)` would defeat the `git mv .planning/missions/*` allow; out-of-tree `git mv` is handled by the default (no rule → prompt). The ask entries document intent and survive broad allows a user later adds in `settings.local.json`.
- **Two deliberate deviations from the stated constraints, surfaced:**
  1. *Tag creation/deletion is ask, not deny.* `/apes-build` creates phase tags (`apes-build.md:887`) and deletes them in cleanup (`apes-build.md:1251`). Deny would hard-break the shipped build flow. Either accept ask, or first ship a mission replacing phase tags with workpad entries — then promote to deny.
  2. *`rm` is ask, not "deny outside worktree".* Rules match command strings, not resolved paths. The deny entries block the catastrophic literal forms; the incident-#1 class (`cd "" && rm -rf framework`) is a compound command, which already fails to match any single rule and prompts. Deterministic backstop belongs in a hook.
- **Prefix-evasion caveat:** Bash rules are prefix matchers. `git push origin main --force` matches the *ask* `Bash(git push *)`, not the force-push deny. Ship a `PreToolUse` hook on `Bash` (`guard-forbidden-commands.sh`) that regex-scans the full command for `npm publish`, `npm version`, `--force`/`-f` after `git push`, and tag mutation anywhere in a compound, exiting 2 to block. Hooks can also **auto-approve** via `"permissionDecision": "allow"` (https://code.claude.com/docs/en/hooks.md) — the only deterministic fix for compound-command friction: a hook that parses the chain, verifies every subcommand against the framework's read-only list, and allows the whole. Fast follow, not a blocker.
- **Command-file hygiene fixes required for the rules to hold**: pass the coverage threshold as an argument instead of env prefix (`testing.md:176`); replace `cat ... | node -e '...'` pipelines (`apes-metrics.md:25`, `apes-status.md:80`, `missions.md:298-299`, `apes-codex-review.md:60-64`) with small `scripts/` helpers; drop the `trap '...' EXIT` idiom (`apes-build.md:362`).

**Shipped vs. `settings.local.json`:** the block ships in project `.claude/settings.json`. Installer should only *suggest* (print, not write): deploy-target CLIs (`Bash(gcloud *)` etc. — move the auto-append at `cli.js:373-379` from shipped settings to a printed suggestion), `WebFetch(domain:...)` scopes, `agent-browser *`/`curl *` for local L6/L7. Machine-wide `npm publish` deny in `~/.claude/settings.json` is worth one README line — deny at any scope wins over allow at every other scope (https://code.claude.com/docs/en/settings.md).

### 2.4 Per-skill `allowed-tools` recommendation

Docs-verified: `allowed-tools` frontmatter *grants* the listed tools while the skill is active (does not restrict), and for project-checked-in skills takes effect only after workspace trust is accepted (https://code.claude.com/docs/en/skills.md). Today 12 of 15 commands declare bare `Bash` — each skill grants itself unrestricted shell for its whole run. Only `apes-map.md:3` scopes correctly.

**Split:** global settings carry read-only + framework-script + verification rules; frontmatter carries only what exceeds that baseline:

| Skill | Current | Recommended |
|---|---|---|
| apes-build, apes-feature, apes-fix, apes-refactor | `Read, Edit, Write, Bash, Grep, Glob` | `Read, Edit, Write, Grep, Glob, Bash(git checkout -b :*), Bash(git merge :*), Bash(npm run :*), Bash(npm test:*)` — pushes/tags intentionally *not* granted |
| apes-mission, apes-evidence | bare `Bash` / none | `Read, Grep, Glob, Bash(node scripts/mission-cli.js:*), Bash(node scripts/evidence-packet.js:*), Bash(node scripts/mission-worktree.js:*), Bash(git commit:*)` |
| apes-codex-review | bare `Bash` | `Read, Edit, Grep, Glob, Bash(node scripts/codex-check.js:*), Bash(node scripts/codex-review.js:*), Bash(node scripts/codex-review-loop.js:*)` |
| apes-verify, apes-security-scan, apes-test-* | `Bash, Read` | `Read, Grep, Bash(bash scripts/check-:*), Bash(npx playwright :*), Bash(npm audit:*), Bash(npx semgrep :*), Bash(node scripts/log-verification.js:*)` |
| apes-map | scoped (correct) | keep |
| apes-board, apes-metrics, apes-status, apes-help | mixed/none | `Read, Grep, Glob, Bash(node scripts/mission-cli.js list:*), Bash(git branch --show-current)` |
| Domain skills (backend, frontend, product, review, design-integration, architecture) | mixed | Read-only sets (`Read, Grep, Glob`); knowledge documents, not executors |
| worktrees, missions, evidence-packets, testing, observability, devops, browser-verification, cross-model-review, orchestration | mixed bare Bash | Scope each to its named scripts |

### 2.5 Permission modes for `--ralph`

Modes (https://code.claude.com/docs/en/permission-modes.md): `default`, `acceptEdits`, `plan`, `auto` (research preview, v2.1.83+, classifier-gated), `dontAsk`, `bypassPermissions`.

- **Supervised local `--ralph`**: document `acceptEdits` as the floor, `auto` for v2.1.83+ users who accept a classifier — defensible *because* deny rules + guard hooks still bind.
- **Headless/CI** (`weekly-quality.yml` spawns `npx @anthropic-ai/claude-code -p`): `dontAsk` — only pre-approved rules execute, everything else fails closed.
- Never recommend `bypassPermissions` on developer machines.
- `/fewer-permission-prompts` exists as a bundled skill in current builds (scans transcripts, proposes project allowlist additions) — one README line as a post-install tuning step. No dedicated docs page found; cite as "bundled skill."

### 2.6 Windows check

- Rules match the literal command string. Framework files consistently write `node scripts/mission-cli.js ...` and `bash scripts/check-*.sh` with forward slashes; on Windows the agent shell is Git Bash, same literals — rules match on both platforms. No `node.exe` variants anywhere in `framework/`.
- `run-hook.cmd` routing is hook plumbing only — hooks never hit the permission system; the `patchHooksForWindows` rewrite (`cli.js:325-349`) has no interaction with the rules.
- `guard-main-branch.sh` outputs `{"block": true, ...}` on **stderr** with exit 2 (`guard-main-branch.sh:5-6`). Exit 2 is what blocks (documented); the JSON body is not the documented interface — spec wants plain-text stderr or `hookSpecificOutput.permissionDecision` JSON on stdout (https://code.claude.com/docs/en/hooks.md). Normalize it.

### 2.7 Migration for existing installs

Add `--update-permissions` to `bin/cli.js`:
1. If existing `permissions.allow` matches a known shipped historical list (fingerprint from git history), replace wholesale.
2. If user-modified: print a three-way diff and write the proposed block to `.claude/dos-apes-proposed-permissions.json` for manual merge. Never silently merge into a user-edited file.
3. Always safe regardless of user edits: **append the deny list** (deny at any level cannot be weakened) and append missing `Skill(...)` rules (pure prompt-reduction). Do in place with a printed notice.

---

## 3. Part 2 — Platform duplication audit

| Framework mechanism | Native capability (doc-verified) | Verdict | Notes |
|---|---|---|---|
| Flat `.claude/skills/*.md` (`cli.js:647-652`) | `.claude/skills/<name>/SKILL.md` is the documented form; flat files under `commands/` explicitly grandfathered; flat files under `skills/` **not explicitly documented as supported** (https://code.claude.com/docs/en/skills.md) | **Adopt** | Mechanical installer change + 16 file moves. Risk of staying: undocumented layout may stop registering. Cost: low. |
| Skill frontmatter (only `name`/`description`/`allowed-tools` used) | `disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, `hooks`, `paths`, `argument-hint` exist | **Adopt selectively** | Domain skills → `user-invocable: false`; `review.md` → `disable-model-invocation: true` (consumed by Stop hook); `context: fork` interesting for `apes-map`. Cost: low. |
| npx installer | Plugins bundle skills/agents/hooks/MCP with plugin-level trust (https://code.claude.com/docs/en/plugins.md) | **Hybrid** | Plugin eliminates per-skill trust prompts + gives `/plugin` update UX — but plugin `settings.json` supports only `agent`/`subagentStatusLine`, so it **cannot ship permissions**, can't scaffold `.planning/`, can't place `scripts/`+`lib/` in-repo. Target: plugin = commands/skills/hooks/MCP; slim `npx dos-apes init` = scaffolding + settings + scripts/lib. Cost: medium; after permissions fix. |
| Shell hook layer | Native hooks support `permissionDecision` allow/deny/ask JSON + `updatedInput` (https://code.claude.com/docs/en/hooks.md) | **Keep, modernize output** | The hook layer is the differentiation. Fix guard output; exploit PreToolUse **auto-approve** for compound framework commands. Cost: low. |
| `guard-main-branch.sh` | Edit/Write permission rules scope by *path*, not git branch | **Keep** | Canonical example of hook-only capability. |
| Team-assembly tables (`apes-build.md:44-50` etc.) | Agent teams **experimental, env-gated** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, https://code.claude.com/docs/en/agent-teams.md); subagents via `.claude/agents/*.md` stable | **Hybrid** | Tables are prompts, degrade gracefully. Consider shipping `.claude/agents/` definitions (stable surface) for builder/tester/reviewer instead of prose tables. Cost: medium, low urgency. |
| Mission system (`lib/`, `.planning/missions/`) | Native task list is team-scoped file coordination under `~/.claude/tasks/`, session-oriented, no git audit trail | **Keep** | The durable asset — git-native, engine-agnostic, survives sessions. CLAUDE.md's "Tasks API replaces STATE.md" oversells what's native. |
| `/apes-verify` + pyramid scripts | Bundled `/verify`, `/run`, `/code-review` skills exist | **Keep core, delegate launch** | `/verify` has no concept of levels, `verification.jsonl`, or evidence packets. L6 should leverage `/run`'s launch knowledge. Cost: low. |
| Stop-hook auto review (L0.5) | `/code-review` bundled skill | **Keep** | Stop hook is deterministic; `/code-review` invocational. Complementary. |
| `check-task-gates.sh` | — | **Rewrite or delete** | Internal drift, not duplication: gates the retired READY/IN_PROGRESS vocabulary while `mission-cli.js can-transition` enforces the real FSM. Rewrite as wrapper over `can-transition` or delete + drop `DOS_APES_GATE_SCRIPT` (`settings.json:173`). |

---

## 4. Part 3 — Pure SDLC harness

### 4.1 Dependency map

```
ENGINE-AGNOSTIC TODAY (pure Node + git via execFileSync; zero Claude imports)
  framework/lib/mission-schema.js      ── constants, validation, migration (no I/O)
  framework/lib/mission-parser.js      ── YAML/body parsing (no I/O)
  framework/lib/mission-tracker.js     ── FSM + git mv; "mutates tree, never commits"
  framework/scripts/mission-cli.js     ── JSON verbs, exit codes 0/1/2/3
  framework/scripts/mission-worktree.js── worktree lifecycle
  framework/scripts/log-verification.js── verification.jsonl appender
  framework/scripts/check-*.sh         ── level executors (bash, engine-blind)
  framework/scripts/codex-check.js     ── Codex-adapter prereqs

ENTANGLED (needs a seam, each small)
  framework/scripts/evidence-packet.js ── reads .claude/auto-reviews/ (lines 12, 166, 273)
                                          → parameterize the auto-review dir
  framework/scripts/codex-review-loop.js── fix step spawns `claude -p` (line 275)
                                          → extract fix-executor interface
  framework/scripts/check-task-gates.sh── stale vocabulary; rewrite against mission-cli

CLAUDE CODE ADAPTER (would move under adapters/claude-code/)
  framework/commands/*.md, framework/skills/*.md, framework/settings.json,
  framework/scripts/guard-main-branch.sh + hook-*.sh + track-modified-files.sh
  + metrics-*.sh + run-hook.cmd, framework/claude-desktop-skills/, bin/cli.js
```

### 4.2 Harness interface

Gate preconditions in `missions.md:111-137` + `MissionTracker.canTransition` are the spine. An adapter (Claude Code, Codex CLI, CI runner, human) must execute five operations:

| Operation | Contract | Exists as |
|---|---|---|
| `create` | mission in `todo/`, schema-validated frontmatter | `mission-cli create` |
| `start` (todo→doing) | deps in `done/`, workspace materialized | `mission-cli move` + `mission-worktree create` |
| `attest` | append `{timestamp, level, outcome, details}` to `verification.jsonl` | `log-verification.js` |
| `submit` (doing→review) | committed work + evidence packet covering all `verification.required_levels` | `evidence-packet.js generate` + `mission-cli move` (packet-exists precondition currently prose-only at `missions.md:119-121` — promote into `canTransition`) |
| `verdict` (review→done \| review→doing) | reviewer confirmation in workpad; L8 constraint (`codex.required` ⇒ `accepted`) | `mission-cli move` + `mission-cli workpad` |

The genuine API gap: `canTransition` should mechanically check evidence-packet existence + required-level passes for `doing→review`, and reviewer attestation for `review→done`. Once in the library, any engine shelling out to the CLI is held to the same gates.

### 4.3 Pyramid as engine-independent gates

Yes, cleanly. `LEVEL_IDS` frozen in `mission-schema.js:29-32`; `verification.jsonl` record shape in `log-verification.js:147-155` (nothing Claude-specific); executors are shell/Node scripts. Missing: declarative binding — `verification-levels.json` mapping level → `{executor, args, fail_open}`, per-engine overrides only where executors genuinely differ (L0.5 and L8 are the only engine-flavored levels). L8's schema (`framework/templates/codex-review-schema.json`) is already an engine-neutral review contract.

### 4.4 Pure harness: drops / adds

Drops from core: `commands/`, `skills/`, `settings.json`, hook wiring, `claude-desktop-skills/`, `run-hook.cmd` — all become the `claude-code` adapter. Adds: single **`dos-apes` bin** unifying the four entry points as subcommands (`dos-apes mission move`, `dos-apes attest L2 pass "…"`, `dos-apes evidence generate`), replacing skill-mediated knowledge of script paths. Also collapses seven permission rules into one (`Bash(dos-apes *)`).

### 4.5 Risks

- **Determinism loss real but bounded.** Claude Code hooks give *mid-session* enforcement; other engines only hit gates at *transition* time. Mitigation: transition-time gates (4.2) are the contract; mid-session hooks are an adapter-level enhancement, documented as Claude Code-only. CI (`post-merge-verify.yml`) is transition-time-only already.
- **Fail-open L8**: policy (`codex.required`, verdict enum, gate behavior) stays in core (`mission-schema.js`); availability detection and skip decisions stay in the L8 executor (`codex-check.js`/loop). Already the shape — don't let adapter code grow verdict policy.
- **Two-package overhead**: version skew, doubled releases — the argument against splitting now.

### 4.6 Recommendation: (c) — incremental

Formalize the CLI boundary in 3.6 (unified `dos-apes` bin, the two entanglement seams, gate-completeness in `canTransition`); keep one npm package; split when the cloud tier moves from roadmap to work. Option (a) forfeits the Q1 2027 items (evidence-packet generator, status dashboard, paid cloud tier — all consume mission/evidence/verification contracts, none want slash-command markdown); option (b) pays the two-package tax ~9 months early when the coupling is just two seams. The CLI boundary is exactly the surface a cloud API would wrap. (Q1 2027 roadmap items taken as given from the maintainer's brief — not recorded in this repo.)

### 4.7 Dogfooding

**Yes, with one code change as prerequisite.** Repo already half-dogfoods (`_planning/` has mission-numbered artifacts + incidents; CHANGELOG per-mission) but without the FSM — a credibility gap.

- **Blocker**: `mission-cli.js:107` hardcodes `.planning/missions`. Dogfooding under `_planning/missions/` needs `--root` flag or `DOS_APES_PLANNING_DIR` env (multi-repo configs want it too).
- **Contamination already handled**: `bin/cli.js` copies only from `framework/`; `package.json` `files` (`package.json:35-82`) excludes `_planning/`. No installer/packaging change needed.
- **Benefit**: repo becomes the permanent integration test for `lib/` — the v3.5.1 mission-parser YAML fix is exactly the bug class dogfooding catches early.
- **Residual risk**: underscore convention + one CLAUDE.md line keeps source missions distinct from the template.

---

## 5. Proposed missions

Proposals only; IDs allocated by maintainer.

```yaml
# ── P1 ──────────────────────────────────────────────────────────────
title: Replace shipped permissions with least-privilege allow/ask/deny policy
priority: 1
labels: [security, dx, permissions]
acceptance:
  - "framework/settings.json permissions block matches the reviewed policy: no rm/mv/sed/bash */node */npm */npx */git push */git checkout * in allow"
  - "cli.js generates Skill(name) + Skill(name *) allow rules from framework/commands/*.md and framework/skills/*.md at install time (no hand-maintained list)"
  - "deny list blocks npm publish, npm version, force push, remote branch deletion, rm -rf /|~|.."
  - "git push, branch deletion, tag mutation, git reset --hard, rm prompt (ask or default) — verified in a fresh test install on Windows Git Bash"
  - "guard-forbidden-commands.sh PreToolUse hook blocks publish/force-push spellings that evade prefix rules, exit 2"
  - "settings.json env DOS_APES_VERSION reads the real package version"
verification:
  required_levels: [L0, L1, L2]
---
title: Scope allowed-tools frontmatter across all 18 commands and 15 skills
priority: 1
labels: [security, dx, skills]
depends_on: [<permissions mission>]
acceptance:
  - "no command or skill declares bare Bash in allowed-tools"
  - "each frontmatter grants only tools/scopes exceeding the global baseline (table in analysis report)"
  - "compound-command hygiene: no env-prefix invocations, node -e pipelines, or trap idioms remain in command files"
verification:
  required_levels: [L0, L1]
---
title: Installer permission migration for existing installs (--update-permissions)
priority: 1
labels: [installer, dx]
depends_on: [<permissions mission>]
acceptance:
  - "install onto a project with the historical v2 allowlist replaces it wholesale (fingerprint match)"
  - "install onto a user-modified settings.json appends deny + Skill rules in place and writes proposed full block to .claude/dos-apes-proposed-permissions.json with printed diff"
  - "unparseable settings.json remains untouched"
verification:
  required_levels: [L0, L1, L2]

# ── P2 ──────────────────────────────────────────────────────────────
title: Migrate skills to directory SKILL.md layout with modern frontmatter
priority: 2
labels: [skills, platform-alignment]
acceptance:
  - "cli.js installs .claude/skills/<name>/SKILL.md; commands stay flat .md"
  - "reference-only skills carry user-invocable: false; review.md carries disable-model-invocation: true"
  - "fresh install on Windows: /apes-help lists all commands; domain skills absent from / menu"
verification:
  required_levels: [L0, L2]
---
title: Fix hook-layer drift (guard output format, check-task-gates vocabulary)
priority: 2
labels: [hooks, drift]
acceptance:
  - "guard-main-branch.sh emits documented output (plain stderr or hookSpecificOutput JSON on stdout) and still blocks Edit/Write on main"
  - "check-task-gates.sh is either a wrapper over mission-cli can-transition or deleted with DOS_APES_GATE_SCRIPT removed and references updated"
  - "this repo's CLAUDE.md counts (commands/skills/scripts) match the tree"
  - "SECURITY.md version references are current (see addendum)"
verification:
  required_levels: [L0, L2]
---
title: Document permission modes for autonomous runs (--ralph and CI)
priority: 2
labels: [docs, autonomy]
acceptance:
  - "README + apes-build.md document acceptEdits/auto for supervised --ralph and dontAsk for headless, with explicit risk statements"
  - "no framework doc recommends bypassPermissions on developer machines"
  - "weekly-quality.yml passes an explicit permission mode to its claude-code invocation"
verification:
  required_levels: [L1.5]

# ── P3 ──────────────────────────────────────────────────────────────
title: Unify framework scripts behind a single dos-apes CLI (harness boundary, option c)
priority: 3
labels: [architecture, harness]
acceptance:
  - "dos-apes bin exposes mission/worktree/evidence/attest subcommands delegating to existing modules; old entry points still work"
  - "evidence-packet.js auto-review directory parameterized; codex-review-loop.js fix step behind a fix-executor interface with claude -p default"
  - "canTransition enforces evidence-packet existence + required-level passes for doing→review"
  - "planning root configurable via flag/env (unblocks dogfooding)"
verification:
  required_levels: [L0, L1, L2, L2.5]
---
title: Dogfood the mission system in the framework repo (_planning/missions/)
priority: 3
labels: [process, credibility]
depends_on: [<dos-apes CLI mission>]
acceptance:
  - "_planning/missions/{todo,doing,review,done,canceled}/ exists and this backlog is filed in it"
  - "npm pack --dry-run confirms _planning/ is not shipped; CLAUDE.md documents source-vs-template distinction"
verification:
  required_levels: [L0]
---
title: Plugin distribution spike (commands/skills/hooks as a Claude Code plugin)
priority: 3
labels: [distribution, spike]
acceptance:
  - "working plugin bundling commands+skills+hooks+playwright MCP, installable via /plugin with --plugin-dir"
  - "written decision: what must remain in npx init (settings/permissions, scripts/, lib/, .planning scaffold) with trust-prompt delta measured"
verification:
  required_levels: [L0]
```

**Unverifiable-against-docs items:** whether flat `.md` files directly under `.claude/skills/` register as skills in current builds is not explicitly documented (only `commands/` flat files are documented as grandfathered) — test before assuming the current install layout keeps working; exact trigger timing of the workspace trust dialog is not documented; `/fewer-permission-prompts` is observable as a bundled skill but has no citable docs page; `auto` permission mode is a research preview requiring v2.1.83+ — gate the recommendation on version.

---

## 6. Addendum — 2026-07-02 repo sync

After the analysis, local `main` was found diverged from `origin/main` (local pre-PR commit `d743901` content-identical to origin's squash-merge `459abce`; origin additionally had `a89055b` adding `SECURITY.md`). Resolved via `git reset --hard origin/main` after verifying the clean tree and tree-identity — nothing lost; `d743901` recoverable from reflog. The divergence was a live instance of CLAUDE.md hazard #4 and motivates the proposal to encode the `git fetch && git status -uno` check into `/apes-build`'s branching step.

**Impact on the analysis: none substantive.** No `framework/`, `bin/`, or `package.json` content changed; all citations remain valid against current HEAD. Three interactions with the new `SECURITY.md`:

1. **Strengthens the P1 deny-list rationale** — the policy codifies human-managed publishing ("only the version published as `latest` receives security updates"), which the `npm publish`/`npm version` deny rules encode mechanically.
2. **SECURITY.md is itself stale** — line 17 says current beta is 3.4.0; the beta dist-tag is 3.5.1. Folded into the P2 drift mission's acceptance criteria.
3. **Raises stakes on the stale npm `latest` tag** — registry has `latest = 3.0.0`, `beta = 3.5.1`. Per the new policy, everything from 3.1 onward (including any permissions fix from this analysis) is formally unsupported until promoted to `latest`. Promotion is a human-only publish decision; flagged for the maintainer.
