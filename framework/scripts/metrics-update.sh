#!/bin/bash
# PostToolUse hook: Increment file modification counter
METRICS_FILE=$(cat /tmp/dos-apes-current-metrics.txt 2>/dev/null)
[ -z "$METRICS_FILE" ] && exit 0
# Update files_modified count
FILES=$(git diff --name-only HEAD 2>/dev/null | wc -l)
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('$METRICS_FILE'));
  m.files_modified = $FILES;
  m.last_activity = new Date().toISOString();
  fs.writeFileSync('$METRICS_FILE', JSON.stringify(m, null, 2));
" 2>/dev/null
