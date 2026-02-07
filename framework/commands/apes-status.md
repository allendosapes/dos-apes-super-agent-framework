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

## Worktrees (Parallel Execution)

```bash
echo ""
echo "=== Active Worktrees ==="
WORKTREE_COUNT=$(git worktree list | wc -l)
git worktree list
if [ "$WORKTREE_COUNT" -gt 1 ]; then
  echo ""
  echo "Parallel tasks in progress. Each worktree is a teammate working independently."
  echo "These merge back to the phase branch when all complete."
else
  echo "(No parallel worktrees active — sequential execution)"
fi
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
| No tasks                 | `/apes-build --prd [file] --ralph` |
| Tasks exist, not started | `/apes-build --prd [file] --ralph` |
| Task in progress         | Continue current task              |
| Phase complete           | `/apes-build --prd [file] --ralph` |
| All phases complete      | Ship it!                           |
