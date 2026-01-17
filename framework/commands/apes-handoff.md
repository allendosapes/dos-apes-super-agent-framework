---
description: Create handoff state for session break
---

# Handoff

Create a handoff document to preserve context for next session.

## Process

### Step 1: Capture Current State

```bash
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
BRANCH=$(git branch --show-current)
```

### Step 2: Create HANDOFF.md

```markdown
# Session Handoff

**Created:** [TIMESTAMP]
**Branch:** [BRANCH]

## Current Position

From STATE.md:
- Phase: [current phase]
- Task: [current task]
- Status: [status]

## Work In Progress

### Files Modified
```bash
git status --short
```

### Uncommitted Changes
```bash
git diff --stat
```

### Last Commits
```bash
git log --oneline -5
```

## Context

### What I Was Working On
[Describe the current task/problem]

### Progress Made
- [Completed step 1]
- [Completed step 2]
- [In progress: step 3]

### Key Decisions Made
- [Decision 1 and why]
- [Decision 2 and why]

### Blockers/Issues
- [Any blockers encountered]
- [Questions that need resolution]

## Next Steps

When resuming:
1. [First thing to do]
2. [Second thing to do]
3. [Third thing to do]

## Verification Status

| Check | Status |
|-------|--------|
| Build | [pass/fail] |
| Types | [pass/fail] |
| Lint | [pass/fail] |
| Tests | [pass/fail] |

## Resume Command

```bash
/apes-resume
```
```

### Step 3: Update STATE.md

Add to session log:
```markdown
## Session Log
- [TIMESTAMP]: Session handoff created
```

### Step 4: Commit Handoff (optional)

```bash
git add .planning/HANDOFF.md .planning/STATE.md
git commit -m "chore: session handoff"
```

## Output

```
📋 Handoff Created

Saved to: .planning/HANDOFF.md

Current position:
- Phase [N], Task [M]
- Branch: [branch]
- [X] uncommitted changes

Resume with: /apes-resume
```
