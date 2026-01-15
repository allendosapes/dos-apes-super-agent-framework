# Quick Setup Guide

Get Dos Apes running in 2 minutes.

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
cp -r framework/ /path/to/your/project/.claude/
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
cp -r /path/to/dos-apes/framework .claude/

# 4. Create your PRD (or use template)
cp .claude/templates/PRD-TEMPLATE.md ./requirements.md
# Edit requirements.md with your product requirements

# 5. Start Claude Code
claude

# 6. Run Dos Apes
/apes:build --prd requirements.md --ralph
```

### For Existing Projects (Brownfield)

```bash
# 1. Navigate to your project
cd my-existing-app

# 2. Copy Dos Apes framework
cp -r /path/to/dos-apes/framework .claude/

# 3. Start Claude Code
claude

# 4. Map your codebase
/apes:map

# 5. Add features or fix bugs
/apes:feature "Add dark mode support"
/apes:fix "Login fails with special characters"
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
| `/apes:build --prd file.md --ralph` | Full autonomous build |
| `/apes:map` | Analyze existing codebase |
| `/apes:feature "description"` | Add a feature |
| `/apes:fix "description"` | Fix a bug |
| `/apes:status` | Show current progress |
| `/apes:resume` | Continue from last state |
| `/apes:verify` | Run verification suite |

---

## Configuration Options

### Claude Code Settings

Add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "stop": [".claude/hooks/stop.sh"],
    "postToolUse": {
      "Edit": [".claude/hooks/format.sh"],
      "Write": [".claude/hooks/format.sh"]
    }
  },
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(npx:*)"
    ]
  }
}
```

### Customizing Agents

Edit agent files in `.claude/agents/` to customize:
- Model selection (opus/sonnet/haiku)
- Tool permissions
- Specific guidelines

### Customizing Standards

Edit files in `.claude/standards/` to match your team's preferences.

---

## Verification

Test that setup works:

```bash
# Start Claude Code
claude

# Check commands are available
/apes:help

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
- For very large codebases, use `/apes:map` first to create summaries

### Build failures
```bash
# Run verification to see what's failing
/apes:verify

# Check gate status
.claude/hooks/gate-check.sh G4
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
