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
node scripts/mission-cli.js list | node -e '
const fs = require("fs");
let buf = ""; process.stdin.on("data", d => buf += d).on("end", () => {
  const all = JSON.parse(buf).missions;

  function lastWorkpadTimestamp(body) {
    // Canonical: `### YYYY-MM-DD HH:MM`. Legacy: `... — <role>`. Anchored
    // at EOL so a stray `###` mid-line cannot match.
    const re = /^###\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+—\s+\S.*)?\s*$/gm;
    const ms = [...body.matchAll(re)];
    return ms.length ? ms[ms.length - 1][1] + " " + ms[ms.length - 1][2] : null;
  }
  function ageDays(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  console.log("=== Missions ===");

  // DOING
  console.log("");
  console.log(`Doing (${all.doing.length}):`);
  if (all.doing.length === 0) {
    console.log("  (none in flight)");
  } else {
    for (const m of all.doing) {
      const fm = m.frontmatter;
      const branch = (fm.workspace && fm.workspace.branch) || `feat/${m.id.toLowerCase()}`;
      const fileText = fs.readFileSync(m.path, "utf8");
      const wp = lastWorkpadTimestamp(fileText) || "(no workpad entry yet)";
      const age = ageDays(fm.updated);
      const ageStr = age === null ? "" : ` · ${age}d in doing`;
      console.log(`  ${m.id} p${fm.priority || 3} — ${m.title}`);
      console.log(`    branch: ${branch} · last workpad: ${wp}${ageStr}`);
    }
  }

  // REVIEW
  console.log("");
  console.log(`Review (${all.review.length}):`);
  if (all.review.length === 0) {
    console.log("  (none awaiting review)");
  } else {
    for (const m of all.review) {
      const packet = `.planning/missions/review/${m.id}/evidence/summary.md`;
      const has = fs.existsSync(packet) ? "evidence packet ✓" : "evidence packet MISSING";
      const moved = fs.statSync(m.path).mtime.toISOString().slice(0, 10);
      console.log(`  ${m.id} p${m.frontmatter.priority || 3} — ${m.title}`);
      console.log(`    ${has} · moved to review: ${moved}`);
    }
  }

  // TODO (top 5) with blocked-by markers
  console.log("");
  const todoTop = all.todo.slice(0, 5);
  console.log(`Todo (${all.todo.length} total, showing top ${todoTop.length}):`);
  const doneIds = new Set(all.done.map(m => m.id));
  if (todoTop.length === 0) {
    console.log("  (none queued)");
  } else {
    for (const m of todoTop) {
      const deps = m.frontmatter.depends_on || [];
      const unmet = deps.filter(d => !doneIds.has(d));
      const tag = unmet.length ? `  blocked by ${unmet.join(", ")}` : "";
      console.log(`  ${m.id} p${m.frontmatter.priority || 3} — ${m.title}${tag}`);
    }
  }

  // DONE this week
  console.log("");
  const cutoff = Date.now() - 7 * 86400000;
  const recent = all.done.filter(m => fs.statSync(m.path).mtime.getTime() >= cutoff);
  console.log(`Done this week (${recent.length}):`);
  if (recent.length === 0) {
    console.log("  (none completed in the last 7 days)");
  } else {
    recent.sort((a, b) => fs.statSync(b.path).mtime - fs.statSync(a.path).mtime);
    console.log("  " + recent.map(m => m.id).join(", "));
  }
});
'
```

The CLI's `list` returns `{ id, title, frontmatter, path }` per mission —
no body. For the last-workpad-timestamp scan in the Doing block, the
renderer reads each mission's file directly via `fs.readFileSync(m.path)`
since the body is the only place workpad headings live. This keeps the
lib's list contract narrow.

## Next Actions

Based on current state, suggest:

| Status                   | Suggestion                |
| ------------------------ | ------------------------- |
| No tasks                 | `/apes-build --prd [file] --ralph` |
| Tasks exist, not started | `/apes-build --prd [file] --ralph` |
| Task in progress         | Continue current task              |
| Phase complete           | `/apes-build --prd [file] --ralph` |
| All phases complete      | Ship it!                           |
