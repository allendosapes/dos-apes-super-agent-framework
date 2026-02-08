#!/bin/bash
# PostToolUse hook: Run related tests when test/spec files are edited
# Claude Code passes tool input on stdin as JSON
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)
fi

case "$FILE_PATH" in
  *.test.*|*.spec.*)
    npm test -- --related 2>&1 | tail -10 || true
    ;;
esac
