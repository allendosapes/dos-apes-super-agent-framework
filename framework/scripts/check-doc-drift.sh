#!/bin/bash
# Check if documented files changed without doc updates
# Run on Stop hook or pre-commit

MODIFIED=$(git diff --name-only HEAD 2>/dev/null)
DOC_UPDATED=false

for f in $MODIFIED; do
  case "$f" in
    docs/*|*.md|CLAUDE.md) DOC_UPDATED=true ;;
  esac
done

SRC_CHANGED=false
for f in $MODIFIED; do
  case "$f" in
    src/*|lib/*) SRC_CHANGED=true ;;
  esac
done

if [ "$SRC_CHANGED" = true ] && [ "$DOC_UPDATED" = false ]; then
  echo "⚠️ Source files changed but no documentation updated."
  echo "Consider updating docs/ or CLAUDE.md if behavior changed."
fi
