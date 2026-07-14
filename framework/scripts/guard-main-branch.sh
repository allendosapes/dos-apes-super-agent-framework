#!/bin/bash
# PreToolUse hook: block Edit/Write when the TARGET file's containing git
# checkout has main/master checked out (M-0004 AC-1).
#
# The signal is the branch of the checkout CONTAINING THE TARGET PATH, never
# the session cwd: the shipped worktree flow writes into .worktrees/<id>
# (mission branch checked out there) while the primary checkout sits on
# main — a cwd-keyed check blocks the framework's own flow (M-0003 AC-9
# finding; "hooks keyed to session-cwd state instead of target-path state"
# defect class).
#
# Input: hook JSON on stdin; target = .tool_input.file_path (Edit/Write).
# Fail-open ladder:
#   - no target resolvable from stdin -> legacy session-cwd check
#     (pre-M-0004 behavior; still guards something on a malformed payload)
#   - no branch resolvable for the target (outside any repo, detached
#     HEAD, git missing) -> allow; this rail must not brick editing.

INPUT=$(cat 2>/dev/null)
if command -v jq >/dev/null 2>&1; then
  TARGET=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  TARGET=$(echo "$INPUT" | node -e "process.stdout.write((JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input||{}).file_path||'')" 2>/dev/null)
fi

if [ -n "$TARGET" ]; then
  # Windows-safe: normalize backslashes so dirname sees path components.
  TARGET=${TARGET//\\//}
  DIR=$(dirname "$TARGET")
  # A Write may create nested directories — walk up to the nearest one
  # that exists so `git -C` has a real cwd to resolve from.
  while [ ! -d "$DIR" ]; do
    PARENT=$(dirname "$DIR")
    [ "$PARENT" = "$DIR" ] && break
    DIR="$PARENT"
  done
  BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
else
  # Legacy fallback: payload carried no target path.
  BRANCH=$(git branch --show-current 2>/dev/null)
fi

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo '{"block": true, "message": "Cannot edit files on main branch. Create a feature branch first, or write inside the mission worktree (.worktrees/<id>)."}' >&2
  exit 2
fi
exit 0
