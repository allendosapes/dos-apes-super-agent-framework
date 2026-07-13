---
description: Show current project status and position
allowed-tools: Read, Grep, Glob, TaskList, Bash(node scripts/mission-cli.js list:*), Bash(git branch --show-current), Bash(npm run build:*), Bash(npm run lint:*), Bash(npm run typecheck:*), Bash(npm test:*)
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

## Missions

Mission state lives at `.planning/missions/<state>/M-NNNN-*.md`. Read the
missions skill if you need the lifecycle rules:

```
Read .claude/skills/missions.md
```

The dashboard pulls everything from `mission-cli list` (one JSON object
covering all five state buckets) and renders the four standard groupings.
No frontmatter parsing in this command — the CLI owns that.

```bash
node scripts/mission-cli.js list | node scripts/mission-dashboard.js
```

The CLI's `list` returns `{ id, title, frontmatter, path }` per mission —
no body. The L8 codex block lives in `frontmatter.codex` (M-0005) and is
already in scope for free; the renderer just reads it. For the
last-workpad-timestamp scan in the Doing block, the renderer reads each
mission's file directly via `fs.readFileSync(m.path)` since the body is
the only place workpad headings live. This keeps the lib's list contract
narrow — listing remains metadata-only, deep operations (body scans,
verification logs) read on demand. If the renderer ever becomes slow with
many missions, the right fix is batched reads, not contract expansion.

The codex line renders as `codex: <last_verdict>, <unresolved> unresolved`
when a mission has a codex block. Missions without one render exactly as
before — no extra line. The Review section also surfaces the legacy
`codex_findings_unresolved: true` flag (set by `/apes-build` for
`exhausted` / `no-progress` terminals) so reviewers see both the new and
backward-compat signals together.

## Next Actions

Based on current state, suggest:

| Status                   | Suggestion                |
| ------------------------ | ------------------------- |
| No tasks                 | `/apes-build --prd [file] --ralph` |
| Tasks exist, not started | `/apes-build --prd [file] --ralph` |
| Task in progress         | Continue current task              |
| Phase complete           | `/apes-build --prd [file] --ralph` |
| All phases complete      | Ship it!                           |
