#!/bin/bash
# PostToolUse hook: Run related tests when test/spec files are edited
# Claude Code passes tool input on stdin as JSON
FILE_PATH=$(node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)

case "$FILE_PATH" in
  *.test.*|*.spec.*)
    npm test -- --related 2>&1 | tail -10 || true
    ;;
esac
