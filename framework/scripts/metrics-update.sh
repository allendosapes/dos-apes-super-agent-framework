#!/bin/bash
# PostToolUse hook: Update session metrics (pure bash — no Node.js overhead)
METRICS_FILE=$(cat .planning/.current-metrics.txt 2>/dev/null)
[ -z "$METRICS_FILE" ] || [ ! -f "$METRICS_FILE" ] && exit 0

# Count modified files
FILES=$(git diff --name-only HEAD 2>/dev/null | wc -l | tr -d ' ')
TIMESTAMP=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)

# Read existing values with grep (fast, no JSON parser needed)
SESSION_START=$(grep -o '"session_start": "[^"]*"' "$METRICS_FILE" | cut -d'"' -f4)
BRANCH=$(grep -o '"branch": "[^"]*"' "$METRICS_FILE" | cut -d'"' -f4)
TASKS_COMPLETED=$(grep -o '"tasks_completed": [0-9]*' "$METRICS_FILE" | grep -o '[0-9]*$')
TASKS_FAILED=$(grep -o '"tasks_failed": [0-9]*' "$METRICS_FILE" | grep -o '[0-9]*$')
VERIFICATION_RUNS=$(grep -o '"verification_runs": [0-9]*' "$METRICS_FILE" | grep -o '[0-9]*$')
REVIEW_ISSUES=$(grep -o '"auto_review_issues": [0-9]*' "$METRICS_FILE" | grep -o '[0-9]*$')

# Rewrite the file (avoids sed cross-platform issues, file is ~200 bytes)
cat > "$METRICS_FILE" << EOF
{
  "session_start": "${SESSION_START}",
  "branch": "${BRANCH}",
  "tasks_completed": ${TASKS_COMPLETED:-0},
  "tasks_failed": ${TASKS_FAILED:-0},
  "files_modified": ${FILES},
  "verification_runs": ${VERIFICATION_RUNS:-0},
  "auto_review_issues": ${REVIEW_ISSUES:-0},
  "last_activity": "${TIMESTAMP}"
}
EOF
