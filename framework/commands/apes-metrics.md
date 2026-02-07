---
description: Show session and project metrics
allowed-tools: Bash, Read
---

# Metrics Dashboard

## Usage

```bash
/apes-metrics              # Current + historical metrics
/apes-metrics --current    # Current session only
```

## Steps

Read metrics from .planning/metrics/ and summarize:

### 1. Current Session

```bash
CURRENT=$(cat /tmp/dos-apes-current-metrics.txt 2>/dev/null)
if [ -n "$CURRENT" ] && [ -f "$CURRENT" ]; then
  echo "Current Session:"
  cat "$CURRENT" | node -e "
    const m = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log('  Started:    ' + m.session_start);
    console.log('  Branch:     ' + m.branch);
    console.log('  Tasks Done: ' + m.tasks_completed);
    console.log('  Tasks Failed: ' + m.tasks_failed);
    console.log('  Files Modified: ' + m.files_modified);
    console.log('  Verifications: ' + m.verification_runs);
    console.log('  Review Issues: ' + m.auto_review_issues);
  "
else
  echo "No active session metrics."
fi
```

### 2. Historical Summary

```bash
ls -t .planning/metrics/session-*.json | head -10
# Parse and summarize each session file
```

For each recent session, show:
- Duration (start to last_activity)
- Tasks completed vs failed
- Files modified
- Review issues found

### 3. Aggregate Stats

Calculate across all sessions:
- Average tasks per session
- Retry rate (tasks_failed / total)
- Most common failure points
- Coverage trend over last 5 sessions

## Output

```
═══════════════════════════════════════════════════════════════
📊 DOS APES METRICS
═══════════════════════════════════════════════════════════════

Current Session:
  Branch:          feat/phase-2-core
  Tasks Completed: 4
  Files Modified:  12
  Review Issues:   1

Last 5 Sessions:
  Avg Tasks/Session: 3.8
  Retry Rate:        12%
  Avg Files/Session: 9.2

═══════════════════════════════════════════════════════════════
```
