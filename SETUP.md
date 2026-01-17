# Quick Setup Guide

Get Dos Apes running in 2 minutes.
git branch -M main
---

## Prerequisites

- **Claude Code** CLI installed ([install guide](https://docs.anthropic.com/en/docs/claude-code))
- **Git** installed
- **Node.js** 18+ (for most projects)

---

## Installation

### Option 1: Clone and Use (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR-ORG/dos-apes.git

# Navigate to framework
cd dos-apes

# Copy framework to your project
mkdir -p /path/to/your/project/.claude && cp -r framework/* /path/to/your/project/.claude/
```

### Option 2: Direct Download

Download the `framework/` folder and place it in your project's `.claude/` directory.

---

## Project Setup

### For New Projects (Greenfield)

```bash
# 1. Create project directory
mkdir my-new-app && cd my-new-app

# 2. Initialize git
git init

# 3. Copy Dos Apes framework
mkdir -p .claude && cp -r /path/to/dos-apes/framework/* .claude/

# 4. Create your PRD (or use template)
cp .claude/templates/PRD-TEMPLATE.md ./requirements.md
# Edit requirements.md with your product requirements

# 5. Start Claude Code
claude

# 6. Run Dos Apes
/apes-build --prd requirements.md --ralph
```

### For Existing Projects (Brownfield)

```bash
# 1. Navigate to your project
cd my-existing-app

# 2. Copy Dos Apes framework
mkdir -p .claude && cp -r /path/to/dos-apes/framework/* .claude/

# 3. Start Claude Code
claude

# 4. Map your codebase
/apes-map

# 5. Add features or fix bugs
/apes-feature "Add dark mode support"
/apes-fix "Login fails with special characters"
```

---

## Directory Structure After Setup

Your project should look like this:

```
my-project/
├── .claude/
│   ├── agents/              # 12 specialized agents
│   │   ├── orchestrator.md
│   │   ├── product-manager.md
│   │   ├── technical-architect.md
│   │   ├── ui-ux-designer.md
│   │   ├── frontend-developer.md
│   │   ├── backend-developer.md
│   │   ├── security-engineer.md
│   │   ├── qa-engineer.md
│   │   ├── test-automation.md
│   │   ├── devops-engineer.md
│   │   ├── code-reviewer.md
│   │   └── tech-writer.md
│   ├── commands/            # Slash commands
│   │   ├── apes-build.md
│   │   ├── apes-map.md
│   │   ├── apes-feature.md
│   │   ├── apes-fix.md
│   │   └── ...
│   ├── hooks/               # Automation hooks
│   │   ├── stop.sh
│   │   ├── verify.sh
│   │   ├── format.sh
│   │   └── gate-check.sh
│   ├── standards/           # Quality standards
│   │   ├── coding-standards.md
│   │   ├── security-guidelines.md
│   │   └── ...
│   ├── templates/           # Document templates
│   │   ├── PRD-TEMPLATE.md
│   │   ├── user-story-template.md
│   │   └── ...
│   ├── skills/              # Domain knowledge (optional)
│   │   └── README.md
│   └── ORCHESTRATOR.md      # Master orchestration spec
├── .planning/               # Created during execution
│   ├── PROJECT.md
│   ├── ROADMAP.md
│   ├── STATE.md
│   └── ...
└── src/                     # Your code (created by Dos Apes)
```

---

## Quick Command Reference

| Command | What It Does |
|---------|--------------|
| `/apes-help` | Show all commands and usage |
| `/apes-build --prd file.md --ralph` | Full autonomous build |
| `/apes-init --prd file.md` | Initialize project from PRD |
| `/apes-plan [phase]` | Create detailed task plan for a phase |
| `/apes-execute [phase]` | Execute phase with agent orchestration |
| `/apes-map` | Analyze existing codebase |
| `/apes-feature "description"` | Add a feature |
| `/apes-fix "description"` | Fix a bug |
| `/apes-refactor "description"` | Refactor existing code |
| `/apes-status` | Show current progress |
| `/apes-resume` | Continue from last state |
| `/apes-verify` | Run verification suite |
| `/apes-handoff` | Create handoff for session break |

---

## Configuration Options

### Claude Code Settings

The framework includes a pre-configured `settings.json` that gets copied to `.claude/settings.json`. It includes:

- **Context Files**: Automatically loads ORCHESTRATOR.md
- **Pre-tool Hooks**: Prevents edits on main branch
- **Post-tool Hooks**: Auto-formats code after edits
- **Permissions**: Pre-approved commands for uninterrupted workflow

#### Pre-Approved Permissions

The settings include comprehensive permissions so Claude doesn't stop to ask for approval on common, safe operations:

**Git Operations:**
- `git status`, `git diff`, `git log`, `git branch`
- `git checkout`, `git add`, `git commit`, `git push`, `git pull`
- `git merge`, `git rebase`, `git stash`, `git worktree`

**Package Managers:**
- `npm`, `npx`, `yarn`, `pnpm`, `bun`

**Build & Test Tools:**
- `node`, `tsc`, `tsx`, `vitest`, `jest`, `eslint`, `prettier`

**File Operations:**
- `cat`, `ls`, `find`, `grep`, `mkdir`, `cp`, `mv`, `rm`, `touch`
- `head`, `tail`, `wc`, `sort`, `chmod +x`

**Claude Tools:**
- `Read`, `Edit`, `Write`, `Grep`, `Glob`, `Task`, `TodoWrite`, `WebFetch`

This enables autonomous workflow without constant permission prompts while maintaining security for unknown commands.

To customize, edit `.claude/settings.json` after installation.

#### Long-Running Autonomous Tasks

For fully autonomous builds where you don't want any interruptions:

```bash
# Option 1: Use pre-approved permissions (recommended)
# Already configured in .claude/settings.json

# Option 2: Don't ask for any permissions (use in sandboxed environments only)
claude --permission-mode=dontAsk

# Option 3: Accept all edits automatically
claude --permission-mode=acceptEdits
```

**Warning:** Only use `--permission-mode=dontAsk` in isolated/sandboxed environments.
The pre-configured permissions in settings.json provide a safer alternative.

### Customizing Agents

Edit agent files in `.claude/agents/` to customize:
- Model selection (opus/sonnet/haiku)
- Tool permissions
- Specific guidelines

### Customizing Standards

Edit files in `.claude/standards/` to match your team's preferences.

### Skills (Optional)

Skills are domain knowledge documents that teach Claude project-specific patterns. The framework includes a starter `skills/` directory with documentation.

To add project-specific skills, create files in `.claude/skills/` following the format in `.claude/skills/README.md`.

---

## Verification

Test that setup works:

```bash
# Start Claude Code
claude

# Check commands are available
/apes-help

# Should see list of available commands
```

---

## Troubleshooting

### "Command not found"
- Ensure `.claude/commands/` exists with the command files
- Restart Claude Code

### "Permission denied" on hooks
```bash
chmod +x .claude/hooks/*.sh
```

### "Context too long"
- The framework manages context automatically
- For very large codebases, use `/apes-map` first to create summaries

### Build failures
```bash
# Run verification to see what's failing
/apes-verify

# Check gate status
.claude/hooks/gate-check.sh G4
```

---

## Tips for Maximum Productivity

### Investment ROI

Setting up the framework takes 1-2 hours initially but saves 5-10 hours per feature after implementation.

### Parallel Sessions

Run multiple Claude instances simultaneously:
- Use different terminal windows for different phases
- Each instance has its own context window
- Git worktrees prevent conflicts between parallel work

### Model Selection

The framework uses Opus for heavy lifting (architecture, implementation) and Sonnet for coordination. For maximum quality:
- Let the framework choose models per agent
- Override only if you need faster iteration on simple tasks

### Verification is Key

> "Give Claude a way to verify its work. If Claude has that feedback loop, it will 2-3x the quality of the final result."

The framework includes 5-level verification:
1. Build passes
2. Types pass
3. Lint passes
4. Tests pass
5. UI integration verified

### MCP Integration

For enhanced capabilities (Slack notifications, database queries, GitHub API), see the [MCP Guide](.claude/templates/MCP-GUIDE.md).

### GitHub Actions

The framework includes CI/CD templates:
- `.claude/templates/github-workflows/ci.yml` - Standard CI pipeline
- `.claude/templates/github-workflows/claude-docs.yml` - Auto-update CLAUDE.md on PRs

Copy to your project:
```bash
mkdir -p .github/workflows
cp .claude/templates/github-workflows/*.yml .github/workflows/
```

---

## Next Steps

1. **Read the PRD template** - Understand what makes a good requirements doc
2. **Try a simple build** - Start with a small project to learn the flow
3. **Customize for your team** - Adjust standards and agents to your needs
4. **Join the community** - Share feedback and improvements

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/YOUR-ORG/dos-apes/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR-ORG/dos-apes/discussions)
- **Documentation**: See `framework/` folder for detailed docs

---

**Dos Apes: We ain't monkeying around with code!**
