#!/bin/bash
# PostToolUse hook: Run TypeScript type checking when .ts/.tsx files are edited
# Claude Code passes tool input on stdin as JSON
FILE_PATH=$(node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)

case "$FILE_PATH" in
  *.ts|*.tsx)
    npx tsc --noEmit 2>&1 | head -20 || true
    ;;
esac
