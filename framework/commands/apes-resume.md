---
description: Resume from last session handoff
---

# Resume

Restore context from previous session and continue work.

## Process

### Step 1: Load Handoff

```bash
if [ -f ".planning/HANDOFF.md" ]; then
    cat .planning/HANDOFF.md
else
    echo "No handoff file found."
    echo "Falling back to STATE.md..."
    cat .planning/STATE.md
fi
```

### Step 2: Restore Context

Load all planning documents:

- `.planning/PROJECT.md` - Project overview
- `.planning/ROADMAP.md` - Phase overview
- `.planning/STATE.md` - Current position
- `.planning/PLAN.md` - Current task plan (if exists)
- `.planning/HANDOFF.md` - Session handoff
- `CLAUDE.md` - Project conventions

### Step 3: Check Git State

```bash
echo "=== Git State ==="
git branch --show-current
git status --short
```

If there are uncommitted changes:

```
⚠️ Uncommitted changes detected from previous session.
Review changes before continuing.
```

### Step 4: Verify Environment

```bash
echo "=== Quick Check ==="
npm run build > /dev/null 2>&1 && echo "✅ Build" || echo "❌ Build"
npm run typecheck > /dev/null 2>&1 && echo "✅ Types" || echo "❌ Types"
```

### Step 5: Summarize Position

```
📍 Resuming Session

Previous session: [timestamp from handoff]

Current position:
- Phase: [N] - [Name]
- Task: [M] - [Name]
- Status: [status]
- Branch: [branch]

Last progress:
[From handoff "Progress Made" section]

Next steps:
[From handoff "Next Steps" section]

Blockers:
[From handoff "Blockers" section]
```

### Step 6: Update State

Update `.planning/STATE.md`:

```markdown
## Session Log

- [TIMESTAMP]: Session resumed from handoff
```

### Step 7: Archive Handoff

```bash
ARCHIVE_NAME=".planning/handoffs/$(date +%Y%m%d-%H%M%S)-handoff.md"
mkdir -p .planning/handoffs
mv .planning/HANDOFF.md $ARCHIVE_NAME
```

## Output

```
✅ Session Resumed

Position: Phase [N], Task [M]
Status: [status]

Recommended action:
/apes-execute [or specific command based on state]
```

## Continue Options

Based on restored state:

| State                     | Suggested Command     |
| ------------------------- | --------------------- |
| Task in progress          | Continue implementing |
| Task blocked              | Resolve blocker first |
| Task complete, more tasks | `/apes-execute`       |
| Phase complete            | `/apes-plan [next]`   |
| Verification failing      | Fix issues first      |
