---
description: Show current project status and position
---

# Status

## Current State

Read and display `.planning/STATE.md`:

```bash
cat .planning/STATE.md
```

## Progress Overview

```bash
echo "=== Roadmap Progress ==="
cat .planning/ROADMAP.md | grep -E "^## Phase|Status:|Tasks:"
```

## Active Work

```bash
echo ""
echo "=== Current Plan ==="
if [ -f ".planning/PLAN.md" ]; then
    head -50 .planning/PLAN.md
else
    echo "No active plan. Run /apes-plan [phase] to create one."
fi
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

| Status | Suggestion |
|--------|------------|
| No plan | `/apes-plan [phase]` |
| Plan exists, not started | `/apes-execute` |
| Task in progress | Continue current task |
| Phase complete | `/apes-plan [next-phase]` |
| All phases complete | 🎉 Ship it! |
