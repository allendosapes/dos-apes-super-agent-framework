#!/bin/bash
# PostToolUse hook: Run TypeScript type checking when .ts/.tsx files are edited
# Claude Code passes tool input on stdin as JSON
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)
fi

case "$FILE_PATH" in
  *.ts|*.tsx)
    npx tsc --noEmit 2>&1 | head -20 || true
    ;;
esac
