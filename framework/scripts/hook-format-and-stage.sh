#!/bin/bash
# PostToolUse hook: Format file with prettier and stage for git
# Claude Code passes tool input on stdin as JSON
FILE_PATH=$(node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)

if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null || true
  git add "$FILE_PATH" 2>/dev/null || true
fi
