# CLAUDE.md

This file provides guidance to Claude Code when working on the Dos Apes framework itself.

## What This Project Is

Dos Apes is a software engineering framework for Claude Code. It installs slash commands, skills, hook scripts, and CI workflows into a project's `.claude/` directory. Users run `npx dos-apes` to install, then use `/apes-build`, `/apes-feature`, etc. inside Claude Code.

This is NOT an application — it's a collection of markdown files, shell scripts, and a Node.js CLI installer.

## Commands

```bash
# Test the CLI locally
node bin/cli.js --help
node bin/cli.js --version

# Test installation in a temp directory
mkdir /tmp/test-project && cd /tmp/test-project && git init
node /path/to/dos-apes/bin/cli.js --local --yes

# Pack for local testing (without publishing)
npm pack
# Then in test project:
npx /path/to/dos-apes-super-agent-2.0.0.tgz

# Publish
npm publish
```

## Project Structure

```
dos-apes/
├── bin/cli.js              # CLI entry point (npx dos-apes)
├── package.json            # npm package config (v2.0.0)
├── framework/
│   ├── commands/           # 13 slash commands (.md files)
│   ├── skills/             # 7 domain skills + README
│   ├── scripts/            # 10 hook scripts (.sh files)
│   ├── ci/                 # 3 GitHub Actions workflows
│   ├── templates/          # CLAUDE-TEMPLATE, PRD, ADR, multi-repo-config
│   └── settings.json       # Hooks, permissions, MCP config
├── assets/banner.txt       # ASCII art banner for CLI
├── README.md               # User-facing documentation
├── ARCHITECTURE.md         # Technical architecture reference
├── CLAUDE.md               # This file (framework development guidance)
└── LICENSE                 # MIT
```

## How the CLI Works

`bin/cli.js` is a zero-dependency Node.js script that:

1. Prompts for install location (local `.claude/` or global `~/.claude/`)
2. Prompts for project type (greenfield/brownfield) and tech stack
3. Copies `framework/commands/` → `.claude/commands/`
4. Copies `framework/skills/` → `.claude/skills/`
5. Copies `framework/settings.json` → `.claude/settings.json`
6. Copies `framework/scripts/` → `scripts/` (unless `--no-hooks`)
7. Copies `framework/ci/` → `.github/workflows/` (unless `--no-ci`)
8. Generates `CLAUDE.md` from `framework/templates/CLAUDE-TEMPLATE.md` with tech stack substitution
9. Creates `.planning/` with PROJECT.md, ROADMAP.md, MEMORY.md stubs
10. Copies PRD and ADR templates to `docs/templates/`

Key behaviors:
- Won't overwrite existing CLAUDE.md, settings.json, or .planning/
- Strips v1 artifacts (_comment, contextFiles) from settings.json
- Auto-detects package manager from lockfiles (brownfield)
- chmod +x on shell scripts (Unix only, skipped on Windows)

## Architecture Decisions

### Skills replace agents
v1 had 12 agent definition files. v2 has 7 skill files that any Agent Teams teammate can load. The platform orchestrates; skills provide domain knowledge.

### Hooks replace trust
Quality gates fire deterministically via settings.json hooks and shell scripts. No agent cooperation needed for TypeScript checking, test running, main branch protection.

### Tasks API replaces STATE.md
Claude Code's native Tasks API handles task creation, dependency tracking, and status. No more manual XML-based PLAN.md or STATE.md files.

### Commands are team launchers
Each slash command assembles an appropriate Agent Teams configuration. `/apes-build` spawns architect + builder + tester + reviewer. `/apes-fix` spawns debugger + tester.

## Key Conventions

- All framework content is markdown or shell scripts — no build step, no compilation
- CLI has zero npm dependencies (uses only Node.js built-ins: fs, path, readline, os, child_process)
- Shell scripts must work in bash (Git Bash on Windows, native on Mac/Linux)
- settings.json hooks reference scripts via relative paths from project root
- Commands reference skills via relative paths from .claude/

## Maintainer-Gated Workflow

Work on this repo is gated by the maintainer at every step. When executing missions or multi-task work:

- **Present diffs and stop.** After completing a task (or a gate within a mission), show the resulting diff and stop. Do not roll forward into the next task on your own.
- **Commit only on explicit approval.** A diff being shown is not approval to commit. Wait for the maintainer to explicitly approve before running `git commit`.
- **Handoff steps one at a time.** When walking the maintainer through manual steps (e.g. PR creation, merges, publishing), give one step, wait for confirmation it's done, then give the next — not a full list up front.
- **`main` is PR-only.** Never commit directly to `main`. All changes land via a branch and pull request.
- **Merged mission branches stay on origin until 3.6.0 ships.** A squash-merge collapses the mission's commit trail into one commit on `main`, so the branch is the only place its cited SHAs (workpad entries, incident write-ups) resolve as browsable history. `delete_branch_on_merge` is kept `false` on the repo to enforce this; if a merge deletes a branch anyway, re-push it from the local ref.

## What NOT to Do

- Don't add npm dependencies to the CLI — it must remain zero-dep
- Don't create files outside `framework/` that get installed — the CLI copies from `framework/` only
- Don't reference v1 artifacts (ORCHESTRATOR.md, agents/, standards/, STATE.md, PLAN.md)
- Don't add `settings.local.json` to git — that's user-specific permissions

## Operational hazards

These rules are learned from real incidents in this codebase. Each is short, behavioral, and applies any time you're working on the framework. The full incident histories live in `_planning/incidents/`.

1. **`rm -rf` is never part of a chain.** Run it as its own single command, *after* explicitly confirming the target with `ls` or `pwd` in a separate prior call. Empty/unset variable expansion can silently change the target — a chained `cd "$VAR" && rm -rf framework` where `$VAR` is empty will run `rm -rf` in the current working directory, because `cd ""` is a bash no-op that returns 0. If the path is parameterized, confirm with the user before issuing. This applies even — *especially* — when "the path is obviously safe." See `_planning/incidents/2026-05-03-framework-destruction.md`.

2. **Phase deliverables get tracked at creation, not at completion.** `git add` a new file the first time you save it, even if it isn't ready to commit. Untracked files have no recovery path — not from `git stash`, not from `git checkout`, not from `git fsck`. The default-stash without `--include-untracked` will silently leave new work behind, and any subsequent destructive action (incident #1, `git clean`, branch switch) loses it permanently. The cost of `git add wip/` is zero; the cost of losing P5's work is hours.

3. **Protections that live only in agent judgment must be encoded in tool config or in CLAUDE.md — judgment alone is not a protection.** When you find yourself thinking "I should remember to X," that thought has a half-life of one context window. If the rule matters across sessions or across agents, it belongs in `settings.json` permissions, in a hook script, or in this file. The first incident postmortem in this repo (#1 above) was caused by an unwritten rule; the second won't be.

4. **Local main ahead of origin is a branching trap.** Before creating any branch that will eventually merge back via PR + squash, run `git fetch origin && git status -uno` and resolve any divergence first. Unpushed local commits get folded into the next squash-merge against origin, conflating their scope with the new branch's: the resulting commit on origin gets labelled with the new branch's title but contains a diff that mixes both missions. Decision matrix — ahead → push first, behind → pull first, diverged → stop and resolve manually. The check costs ~1 second; the cost of skipping it is a permanent git-history artifact (npm tarballs and CHANGELOG entries can still be correct, but the audit trail conflates two missions into one commit). See `_planning/incidents/2026-05-03-local-main-ahead-of-origin.md`.

5. **"Body invokes" columns in analysis tables are hypotheses — full-read re-verification per file is mandatory before acting on them.** Three extraction defects were found in one mission (M-0002): a fence parser anchored at column 0 silently skipped fenced blocks indented inside list items; browser-verification.md's commands live in *unfenced* indentation-style code invisible to fence parsers; and a whole-file token scan matched frontmatter declarations against themselves, manufacturing its own evidence. If a table says a file does X, the table is a lead, not a fact.

6. **Reference ≠ invocation.** Prose that *describes* a script or tool — or names a different executor (a hook, a loop driver, another command) — is not evidence that the reading agent runs it. Grants, permissions, and capability claims attach only to sites where the file's own executor is instructed to act. Litmus: "who runs this?" — if the answer isn't "the agent executing this file," it's a reference.

7. **Never grant ahead of body evidence.** A declared-but-unused grant is drift by definition and fails `allowed-tools-guard.test.js` (declarations-without-usage). Aspirational grants — "the mechanism this will migrate to" — are rejected; the grant lands in the same commit as the change that creates the evidence. Judgment-call exceptions live as cited pins in the guard, never as uncited frontmatter.

## Verification Pyramid (8 levels)

The framework teaches projects this verification stack:

```
L7: Visual Regression     ← Screenshot diff
L6: E2E / Browser         ← Playwright + agent-browser
L5: Security Scan         ← npm audit + gitleaks
L4: UI Integration        ← Component actually used?
L3: Integration Tests     ← API/E2E tests
L2.5: Coverage Gate       ← 80% threshold
L2: Unit Tests            ← Function tests
L1: Static Analysis       ← Types + Lint
L0.5: Auto Code Review    ← Stop hook
L0: Build                 ← Compiles?
```

L0–L2.5 enforced by hooks. L3–L5 by scripts. L6–L7 require Playwright MCP.

## npm Package

`package.json` `files` array controls what ships to npm:
- `bin/`, `framework/commands/`, `framework/skills/`, `framework/scripts/`, `framework/ci/`, `framework/templates/`, `framework/settings.json`, `assets/`, `README.md`, `LICENSE`

Test with `npm pack --dry-run` to verify included files before publishing.
