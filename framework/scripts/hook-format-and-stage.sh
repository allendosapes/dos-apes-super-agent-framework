#!/bin/bash
# PostToolUse hook: Format file with prettier and stage for git
# Claude Code passes tool input on stdin as JSON
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)
fi

if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null || true
  git add "$FILE_PATH" 2>/dev/null || true
fi
