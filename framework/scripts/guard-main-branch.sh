#!/bin/bash
# PreToolUse hook: Block edits on main branch
BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo '{"block": true, "message": "Cannot edit files on main branch. Create a feature branch first."}' >&2
  exit 2
fi
