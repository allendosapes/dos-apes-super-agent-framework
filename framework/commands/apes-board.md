---
description: Kanban-style board view of all tasks and project progress
allowed-tools: Read, Grep, Glob, TaskList, Bash(git branch --show-current)
---

# Board

**Visual kanban board showing task state, critical path, and phase progress.**

```bash
/apes-board
```

No team assembled — this is a lead-only command.

---

## Step 1: Gather State

```
TaskList
```

Read `.planning/ROADMAP.md` and `.planning/PROJECT.md` for project and phase context.

```bash
PROJECT_NAME=$(head -1 .planning/PROJECT.md 2>/dev/null | sed 's/^# //' || echo "Project")
CURRENT_BRANCH=$(git branch --show-current)
GIT_DIRTY=$(git status --porcelain 2>/dev/null | head -1)
LAST_COMMIT_AGO=$(git log -1 --format="%cr" 2>/dev/null || echo "unknown")
```

## Step 2: Classify Tasks

Map each task's status to a board column:

| Tasks API Status | Board Column | Symbol |
|-----------------|--------------|--------|
| `pending` + has `blockedBy` | BACKLOG | `□` |
| `pending` + no blockers | READY | `■` |
| `in_progress` | IN_PROGRESS | `▶` |
| `in_progress` + task subject contains `[APPROVAL]` | IN_REVIEW | `⚠️` |
| `in_progress` + task subject contains `[GATE]` | IN_QA | `◆` |
| `completed` + not yet merged to main | VERIFIED | `✓` |
| `completed` + merged to main | MERGED | `●` |

To determine VERIFIED vs MERGED: check if the task's git tag exists on the main branch:

```bash
# If the task tag is reachable from main, it's merged
git merge-base --is-ancestor "phase-N/task-M-complete" main 2>/dev/null
```

If tag doesn't exist or the check fails, treat completed tasks as VERIFIED (conservative).

## Step 3: Display Board

Render the board with columns. Fit as many columns per row as the terminal allows (typically 3-4 per row at 80 chars).

```
═══════════════════════════════════════════════════════════════════
🦍 DOS APES BOARD — [Project Name] — Phase [N]: [Phase Name]
═══════════════════════════════════════════════════════════════════

BACKLOG (3)     READY (1)      IN_PROGRESS (1)  IN_REVIEW (0)
───────────     ─────────      ───────────────  ────────────
□ Auth flow     ■ API layer    ▶ DB schema
□ Notifications
□ Settings page

IN_QA (0)       VERIFIED (2)   MERGED (4)
─────────       ────────────   ──────────
                ✓ Project init  ● Scaffolding
                ✓ Type defs     ● ESLint config
                                ● Folder structure
                                ● Base components

═══════════════════════════════════════════════════════════════════
Critical Path: DB schema → API layer → Auth flow
Blocked: None
Phase Progress: 4/10 tasks merged (40%)
═══════════════════════════════════════════════════════════════════
```

For `[APPROVAL]` tasks, highlight with `⚠️`:

```
IN_REVIEW (1)
────────────
⚠️ Architecture review (waiting for human)
```

## Step 4: Show Context Footer

After the board, display:

```
Branch: feat/phase-2-core-features (dirty — 3 uncommitted files)
Last commit: 12 minutes ago
Phase: 2 of 4 — Core Features
Progress: 4/10 merged (40%) · 1 in progress · 0 blocked
```

## Step 5: Critical Path

Identify the longest dependency chain from any READY or IN_PROGRESS task to the phase gate:

1. Start from the `[GATE]` task at the end of the phase
2. Walk `blockedBy` links backward
3. The longest chain is the critical path
4. Display as: `Task A → Task B → Task C → [GATE]`

If no dependencies exist, show: `Critical Path: All tasks independent`

## Step 6: Blocked Tasks

List any tasks where all `blockedBy` tasks are NOT completed:

```
Blocked:
  □ Auth flow — waiting on: DB schema (in progress), API layer (ready)
  □ Settings page — waiting on: Auth flow (backlog)
```

If nothing is blocked: `Blocked: None`

---

## Output

The board is purely informational — no state changes, no commits, no file writes. It reads Tasks API and git state, then prints the board to the console.
