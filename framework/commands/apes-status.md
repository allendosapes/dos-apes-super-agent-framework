---
description: Show current project status and position
---

# Status

## Current State

Check active tasks and their status:

```
TaskList
```

## Progress Overview

```bash
echo "=== Roadmap Progress ==="
cat .planning/ROADMAP.md | grep -E "^## Phase|Status:|Tasks:"
```

## Active Work

```
TaskList
# Shows all tasks: pending, in_progress, completed
# With dependency information (blockedBy)
```

## Git Status

```bash
echo ""
echo "=== Git Status ==="
git branch --show-current
git status --short
```

## Worktrees

```bash
echo ""
echo "=== Active Worktrees ==="
git worktree list
```

## Verification Status

```bash
echo ""
echo "=== Quick Verification ==="
npm run build > /dev/null 2>&1 && echo "✅ Build" || echo "❌ Build"
npm run typecheck > /dev/null 2>&1 && echo "✅ Types" || echo "❌ Types"
npm run lint > /dev/null 2>&1 && echo "✅ Lint" || echo "❌ Lint"
npm test > /dev/null 2>&1 && echo "✅ Tests" || echo "❌ Tests"
```

## Next Actions

Based on current state, suggest:

| Status                   | Suggestion                |
| ------------------------ | ------------------------- |
| No tasks                 | `/apes-plan [phase]`      |
| Tasks exist, not started | `/apes-execute`           |
| Task in progress         | Continue current task     |
| Phase complete           | `/apes-plan [next-phase]` |
| All phases complete      | Ship it!                  |
