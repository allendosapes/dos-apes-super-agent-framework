# Publishing to GitHub

## Quick Start (5 minutes)

### 1. Create GitHub Repository

```bash
# Option A: GitHub CLI (if installed)
gh repo create dos-apes/dos-apes --public --description "AI Super Agent Framework - We ain't monkeying around with code!"

# Option B: Manual
# Go to https://github.com/new
# - Repository name: dos-apes
# - Description: AI Super Agent Framework - We ain't monkeying around with code!
# - Public
# - Do NOT initialize with README (we have one)
# - Click "Create repository"
```

### 2. Initialize and Push

```bash
# Navigate to your extracted dos-apes folder
cd dos-apes

# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "feat: initial release of Dos Apes Super Agent Framework

🦍🦍 We ain't monkeying around with code!

Features:
- Full autonomous build from PRD to shipped product
- 12 specialized agents with clear handoff protocols
- 6 blocking quality gates (G1-G6)
- Wave-based parallel execution (up to 4 concurrent)
- Context-aware execution (stays <50% for peak quality)
- Git workflow automation (branches, worktrees, merges)
- Ralph loop for iterative completion until PRODUCT_COMPLETE
- Verification stack (build, types, lint, tests, UI integration)
- Brownfield support (map 7 codebase docs, feature, fix)
- 7 coding standards documents
- 9 document templates (PRD, user stories, ADR, test plan, security review)
- Session continuity (handoff, resume from any point)

Built on: GSD, VibeKanban, Ralph Wiggum, Claude Code Showcase, AI Dev Framework"

# Add remote
git remote add origin https://github.com/dos-apes/dos-apes.git

# Push
git branch -M main
git push -u origin main
```

### 3. Verify Installation Works

```bash
# Test the npm installation
cd /tmp
npx dos-apes/dos-apes --local
```

---

## Optional: Publish to npm

If you want users to install via `npx dos-apes`:

### 1. Create npm Account (if needed)

```bash
npm login
```

### 2. Update package.json

Make sure `package.json` has:

```json
{
  "name": "dos-apes",
  "version": "1.0.0",
  "description": "AI Super Agent Framework - We ain't monkeying around with code!",
  "bin": {
    "dos-apes": "./bin/cli.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/dos-apes/dos-apes.git"
  },
  "keywords": ["ai", "claude", "agent", "automation", "code-generation"]
}
```

### 3. Publish

```bash
npm publish
```

### 4. Users Can Now Install

```bash
npx dos-apes
```

---

## Repository Settings (Recommended)

After pushing, configure these settings on GitHub:

### Branch Protection (Settings → Branches)

- Require pull request reviews before merging
- Require status checks to pass (if you add CI)
- Include administrators

### Topics (Main page → About → Edit)

Add topics for discoverability:

- `ai`
- `claude`
- `automation`
- `code-generation`
- `agent`
- `developer-tools`

### About Section

- Description: "AI Super Agent Framework - Feed it a PRD, walk away, come back to a shipped product 🦍🦍"
- Website: (optional documentation site)

---

## Adding CI/CD (Optional)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Test CLI
        run: node bin/cli.js --help || true

      - name: Verify structure
        run: |
          test -f README.md
          test -f bin/cli.js
          test -d framework/commands
          test -d framework/agents
          test -f framework/ORCHESTRATOR.md
```

---

## Versioning

When making updates:

```bash
# Patch (bug fixes): 1.0.0 → 1.0.1
npm version patch

# Minor (new features): 1.0.0 → 1.1.0
npm version minor

# Major (breaking changes): 1.0.0 → 2.0.0
npm version major

# Push with tags
git push --follow-tags
```

---

## Marketing / Sharing

### Social Post Template

```
🦍🦍 Introducing Dos Apes - AI Super Agent Framework

Feed it a PRD. Walk away. Come back to a shipped product.

✅ Multi-agent orchestration
✅ Autonomous iteration (Ralph loops)
✅ Git workflow automation
✅ Verification-first development

We ain't monkeying around with code!

https://github.com/dos-apes/dos-apes

#AI #ClaudeAI #DeveloperTools #Automation
```

### README Badges

Add to your README:

```markdown
[![npm version](https://badge.fury.io/js/dos-apes.svg)](https://www.npmjs.com/package/dos-apes)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

---

## Support

### Issues

Enable GitHub Issues for bug reports and feature requests.

### Discussions

Enable GitHub Discussions for Q&A and community support.

### Contributing

The `CONTRIBUTING.md` file is already included with contribution guidelines.

---

🦍🦍 **Dos Apes: We ain't monkeying around with code!**
