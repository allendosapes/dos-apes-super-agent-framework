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
- Strips ORCHESTRATOR.md contextFiles reference from settings.json (v1 artifact)
- Auto-detects package manager from lockfiles (brownfield)
- chmod +x on shell scripts (Unix only, skipped on Windows)

## Architecture Decisions

### Skills replace agents
v1 had 12 agent definition files. v2 has 6 skill files that any Agent Teams teammate can load. The platform orchestrates; skills provide domain knowledge.

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

## What NOT to Do

- Don't add npm dependencies to the CLI — it must remain zero-dep
- Don't create files outside `framework/` that get installed — the CLI copies from `framework/` only
- Don't reference v1 artifacts (ORCHESTRATOR.md, agents/, standards/, STATE.md, PLAN.md)
- Don't add `settings.local.json` to git — that's user-specific permissions

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
