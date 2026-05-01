#!/bin/bash
# Check if documented files changed without doc updates (verification level L1.5)
# Run on Stop hook or pre-commit

START_MS=$(node -e "console.log(Date.now())" 2>/dev/null || echo "")

log_verification() {
  if [ -n "$START_MS" ]; then
    local NOW
    NOW=$(node -e "console.log(Date.now())" 2>/dev/null || echo "")
    if [ -n "$NOW" ]; then
      export VERIFICATION_DURATION_MS=$((NOW - START_MS))
    fi
  fi
  local DETAILS="${3-}"
  if [ -z "$DETAILS" ]; then DETAILS='{}'; fi
  node scripts/log-verification.js L1.5 "$1" "$2" "$DETAILS" 2>/dev/null || true
}

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
  log_verification fail "Source changed without doc updates" '{"src_changed":true,"doc_updated":false}'
elif [ "$SRC_CHANGED" = false ]; then
  log_verification skip "No source files changed in this diff" '{"src_changed":false}'
else
  log_verification pass "Source and docs updated together" '{"src_changed":true,"doc_updated":true}'
fi
