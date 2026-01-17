# MCP (Model Context Protocol) Integration Guide

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI assistants like Claude to external tools and data sources. It allows Claude to:

- Query databases directly
- Post messages to Slack
- Interact with GitHub APIs
- Access file systems
- Store persistent memory across sessions

## Why Use MCP with Dos Apes?

MCP integration supercharges autonomous builds:

| Use Case | Without MCP | With MCP |
|----------|-------------|----------|
| Database queries | Manual copy/paste | Direct SQL execution |
| Team notifications | Manual updates | Auto-post to Slack |
| GitHub operations | CLI commands only | Rich API access |
| Persistent memory | Lost between sessions | Retained knowledge |

## Quick Setup

### 1. Copy the Example Config

```bash
# Copy to your project root
cp .claude/templates/mcp.json.example .mcp.json
```

### 2. Configure Environment Variables

Create or update your `.env` file:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_TEAM_ID=T0000000000

# GitHub (for enhanced API access)
GITHUB_TOKEN=ghp_your_personal_access_token

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 3. Edit .mcp.json

Remove any servers you don't need and update paths:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 4. Restart Claude Code

MCP servers are loaded on startup:

```bash
claude
```

## Available MCP Servers

### Official Servers

| Server | Package | Purpose |
|--------|---------|---------|
| GitHub | `@modelcontextprotocol/server-github` | Issues, PRs, repos |
| Slack | `@modelcontextprotocol/server-slack` | Team messaging |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | Database queries |
| Filesystem | `@modelcontextprotocol/server-filesystem` | File access |
| Memory | `@modelcontextprotocol/server-memory` | Persistent storage |

### Community Servers

Find more at: https://github.com/modelcontextprotocol/servers

Popular additions:
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-puppeteer` - Browser automation
- `@modelcontextprotocol/server-sqlite` - SQLite databases

## Use Cases for Dos Apes

### 1. Slack Notifications on Phase Completion

```
[ORCHESTRATOR] Phase 1 complete!
[ORCHESTRATOR → MCP:Slack] Posting update...
> Posted to #dev-updates: "Phase 1 Foundation complete. 5 tasks done."
```

### 2. Database Schema Queries

```
[BACKEND DEVELOPER] Checking existing schema...
[BACKEND DEVELOPER → MCP:Postgres] SELECT table_name FROM information_schema.tables...
> Found 12 tables: users, projects, tasks...
```

### 3. GitHub Issue Tracking

```
[ORCHESTRATOR] Creating tracking issue...
[ORCHESTRATOR → MCP:GitHub] Creating issue on repo...
> Created issue #42: "Phase 2: Core Features"
```

### 4. Persistent Memory

```
[ORCHESTRATOR] Saving pattern...
[ORCHESTRATOR → MCP:Memory] Store: "This codebase uses barrel exports"
---
[Next session]
[ORCHESTRATOR → MCP:Memory] Recall: project patterns
> "This codebase uses barrel exports"
```

## Security Considerations

### Token Security

- **Never commit** `.mcp.json` with real tokens
- Use environment variables: `${VAR_NAME}`
- Add `.mcp.json` to `.gitignore` if it contains secrets

### Database Access

- Use read-only credentials when possible
- Limit access to specific tables/schemas
- Consider using a separate analytics user

### File System

- Restrict `server-filesystem` to specific directories
- Never allow access to system directories

## Troubleshooting

### Server Won't Start

```bash
# Check if the package can be installed
npx -y @modelcontextprotocol/server-github --help
```

### Environment Variables Not Loading

- Ensure `.env` is in project root
- Check variable names match exactly
- Restart Claude Code after changes

### Permission Errors

Some servers need specific permissions:
- GitHub: `repo`, `read:org` scopes
- Slack: Bot token with appropriate channel access

## Example: Full Setup for Team Projects

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

## Further Reading

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP Server Repository](https://github.com/modelcontextprotocol/servers)
- [Claude Code MCP Documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
