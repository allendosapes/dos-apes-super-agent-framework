#!/bin/bash
# SessionStart hook: Initialize metrics for this session
METRICS_FILE=".planning/metrics/session-$(date +%Y%m%d-%H%M%S).json"
mkdir -p .planning/metrics
cat > "$METRICS_FILE" << EOF
{
  "session_start": "$(date -Iseconds)",
  "branch": "$(git branch --show-current)",
  "tasks_completed": 0,
  "tasks_failed": 0,
  "files_modified": 0,
  "verification_runs": 0,
  "auto_review_issues": 0
}
EOF
echo "$METRICS_FILE" > /tmp/dos-apes-current-metrics.txt
