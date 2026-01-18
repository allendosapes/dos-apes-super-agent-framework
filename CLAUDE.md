# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dos Apes is a unified AI coding framework that enables autonomous product building from PRDs. It combines multi-agent orchestration with git workflow management to take requirements and ship complete products without human intervention.

## Commands

```bash
# Run tests
npm test

# Install framework to a project (interactive)
npx dos-apes

# Install with flags
npx dos-apes --global    # Install to ~/.claude/
npx dos-apes --local     # Install to ./.claude/
npx dos-apes --greenfield  # New project mode
npx dos-apes --brownfield  # Existing project mode
```

## Architecture

### CLI Entry Point

- `bin/cli.js` - Node.js installer that copies framework files to target project's `.claude/` directory

### Framework Structure (`framework/`)

The framework is a collection of markdown files that get installed into a project's `.claude/` directory:

```
framework/
├── ORCHESTRATOR.md        # Master orchestration engine - the "brain"
├── agents/                # 12 specialized agent definitions
│   ├── orchestrator.md    # (Sonnet) Planning, git, coordination
│   ├── technical-architect.md  # (Opus) System design, ADRs
│   ├── backend-developer.md    # (Opus) APIs, database
│   ├── frontend-developer.md   # (Opus) React components, UI
│   ├── qa-engineer.md          # (Sonnet) Test execution, verification
│   └── ...
├── commands/              # Slash command definitions
│   ├── apes-build.md      # Full autonomous build
│   ├── apes-execute.md    # Phase execution
│   ├── apes-feature.md    # Add feature to existing codebase
│   ├── apes-fix.md        # Bug fixes
│   ├── apes-map.md        # Codebase analysis
│   └── ...
├── templates/             # Document templates (PRD, ADR, etc.)
├── standards/             # Coding and quality standards
└── skills/                # Domain knowledge documents
```

### Agent Orchestration Pattern

The framework uses agent handoffs for task execution:

1. Orchestrator reads task from PLAN.md
2. Determines appropriate agent based on task type
3. Loads agent context from `.claude/agents/[agent].md`
4. Agent executes task
5. QA Engineer verifies (build, types, lint, tests)
6. Orchestrator commits and continues

### State Management

Projects using the framework maintain state in `.planning/`:

- `PROJECT.md` - Vision, requirements (immutable)
- `ROADMAP.md` - All phases (status updated)
- `STATE.md` - Current position (constantly updated)
- `PLAN.md` - Current phase tasks
- `ISSUES.md` - Deferred problems
- `MEMORY.md` - Learnings, patterns

### Ralph Loop

The autonomous execution loop (enabled with `--ralph` flag):

- Iterates until all tasks/phases complete
- Retries on failure with failure context
- Stop hooks prevent premature exit
- Outputs `<promise>PRODUCT_COMPLETE</promise>` when done

### Git Workflow

- Feature branches per phase: `feat/phase-N-description`
- Squash merge to main on phase completion
- Git worktrees for parallel execution (`--parallel` flag)

## Key Conventions

### Agent Model Selection

- **Opus**: Technical Architect, Frontend/Backend Developers, Security Engineer, Code Reviewer (heavy lifting)
- **Sonnet**: Orchestrator, Product Manager, QA Engineer, Test Automation, DevOps, Tech Writer (coordination)

### Verification Stack

Every task passes through 5-level verification before commit:

1. Build passes
2. Types pass
3. Lint passes
4. Tests pass
5. UI integration verified (for frontend tasks)

### Context Engineering

Context quality degrades as usage increases. The framework manages this by:

- Splitting work into 2-3 task plans
- Fresh context per plan via subagents
- Frontmatter-based context assembly from SUMMARYs
