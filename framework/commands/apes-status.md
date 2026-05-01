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
missions skill before interpreting:

```
Read .claude/skills/missions.md
```

Then run the script below to summarize. It groups by state, sorts by
priority (1 = highest, ascending) then by `created` ascending, and
gracefully renders empty states.

```bash
node -e '
const fs = require("fs");
const path = require("path");

const STATES = ["todo","doing","review","done","canceled"];
const ROOT = ".planning/missions";

function readFm(file) {
  const text = fs.readFileSync(file, "utf8");
  const parts = text.split(/^---\s*$/m);
  if (parts.length < 3) return { fm: "", body: text };
  return { fm: parts[1], body: parts.slice(2).join("---") };
}
function scalar(fm, key, dflt) {
  const m = fm.match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  return m ? m[1].trim().replace(/^[\"\x27]|[\"\x27]$/g, "") : dflt;
}
function nestedScalar(fm, parent, key) {
  const lines = fm.split(/\r?\n/);
  let inP = false;
  for (const line of lines) {
    if (/^[A-Za-z_]/.test(line)) { inP = line.startsWith(parent + ":"); continue; }
    if (!inP) continue;
    const m = line.match(new RegExp("^\\s{2}" + key + ":\\s*(.+)$"));
    if (m) return m[1].trim().replace(/^[\"\x27]|[\"\x27]$/g, "");
  }
  return null;
}
function listOf(fm, key) {
  const lines = fm.split(/\r?\n/);
  const items = [];
  let inList = false;
  for (const line of lines) {
    if (line.match(new RegExp("^" + key + ":\\s*$"))) { inList = true; continue; }
    if (!inList) continue;
    const m = line.match(/^\s{2}-\s+(.+)$/);
    if (m) { items.push(m[1].trim().replace(/^[\"\x27]|[\"\x27]$/g, "")); continue; }
    if (line.trim() === "") continue;
    if (/^\S/.test(line)) break;
  }
  return items;
}

function loadAll() {
  const out = {};
  for (const s of STATES) out[s] = [];
  if (!fs.existsSync(ROOT)) return out;
  for (const s of STATES) {
    const dir = path.join(ROOT, s);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^M-\d{4}-.*\.md$/.test(f)) continue;
      const file = path.join(dir, f);
      const { fm, body } = readFm(file);
      const id = scalar(fm, "id", f.match(/^M-\d{4}/)[0]);
      const title = scalar(fm, "title", "(no title)");
      const priority = parseInt(scalar(fm, "priority", "3"), 10);
      const created = scalar(fm, "created", "");
      const updated = scalar(fm, "updated", "");
      const phase = scalar(fm, "phase", "");
      const branch = nestedScalar(fm, "workspace", "branch") || ("feat/" + id.toLowerCase());
      const depends = listOf(fm, "depends_on");
      const labels = listOf(fm, "labels");
      // Last workpad timestamp: scan for ### YYYY-MM-DD HH:MM lines.
      const tsMatches = [...body.matchAll(/^###\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/gm)];
      const lastWorkpad = tsMatches.length ? tsMatches[tsMatches.length - 1][1] + " " + tsMatches[tsMatches.length - 1][2] : null;
      // Mtime of state file as a fallback "moved at" signal.
      const mtime = fs.statSync(file).mtime;
      out[s].push({ id, title, priority, created, updated, phase, branch, depends, labels, lastWorkpad, mtime, file });
    }
  }
  for (const s of STATES) {
    out[s].sort((a, b) => (a.priority - b.priority) || a.created.localeCompare(b.created));
  }
  return out;
}

function ageDays(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function blockers(m, doneIds) {
  const unmet = m.depends.filter((d) => !doneIds.has(d));
  return unmet;
}

const all = loadAll();
const doneIds = new Set(all.done.map((m) => m.id));

console.log("=== Missions ===");

// DOING
console.log("");
console.log("Doing (" + all.doing.length + "):");
if (all.doing.length === 0) {
  console.log("  (none in flight)");
} else {
  for (const m of all.doing) {
    const wp = m.lastWorkpad || "(no workpad entry yet)";
    const age = ageDays(m.updated);
    const ageStr = age === null ? "" : (" · " + age + "d in doing");
    console.log("  " + m.id + " p" + m.priority + " — " + m.title);
    console.log("    branch: " + m.branch + " · last workpad: " + wp + ageStr);
  }
}

// REVIEW
console.log("");
console.log("Review (" + all.review.length + "):");
if (all.review.length === 0) {
  console.log("  (none awaiting review)");
} else {
  for (const m of all.review) {
    const packet = ".planning/missions/review/" + m.id + "/evidence/summary.md";
    const has = fs.existsSync(packet) ? "evidence packet ✓" : "evidence packet MISSING";
    const moved = m.mtime.toISOString().slice(0, 10);
    console.log("  " + m.id + " p" + m.priority + " — " + m.title);
    console.log("    " + has + " · moved to review: " + moved);
  }
}

// TODO (top 5)
console.log("");
const todoTop = all.todo.slice(0, 5);
console.log("Todo (" + all.todo.length + " total, showing top " + todoTop.length + "):");
if (todoTop.length === 0) {
  console.log("  (none queued)");
} else {
  for (const m of todoTop) {
    const unmet = blockers(m, doneIds);
    const tag = unmet.length ? "  blocked by " + unmet.join(", ") : "";
    console.log("  " + m.id + " p" + m.priority + " — " + m.title + tag);
  }
}

// DONE THIS WEEK
console.log("");
const cutoff = Date.now() - 7 * 86400000;
const recent = all.done.filter((m) => m.mtime.getTime() >= cutoff);
console.log("Done this week (" + recent.length + "):");
if (recent.length === 0) {
  console.log("  (none completed in the last 7 days)");
} else {
  recent.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  console.log("  " + recent.map((m) => m.id).join(", "));
}
'
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
