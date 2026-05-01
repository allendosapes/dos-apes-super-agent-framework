#!/bin/bash
# Pre-commit secret detection (verification level L5)
# Uses gitleaks if available, falls back to grep patterns

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
  node scripts/log-verification.js L5 "$1" "$2" "$DETAILS" 2>/dev/null || true
}

if command -v gitleaks &> /dev/null; then
  gitleaks detect --source . --no-banner 2>&1 | head -10
  EXIT_CODE=${PIPESTATUS[0]}
  if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Secrets detected! Do not commit."
    log_verification fail "gitleaks detected potential secrets" '{"tool":"gitleaks"}'
    exit 1
  fi
  log_verification pass "gitleaks: no secrets detected" '{"tool":"gitleaks"}'
else
  # Fallback: grep for common secret patterns
  PATTERNS="(PRIVATE.KEY|api[_-]?key|secret[_-]?key|password\s*=\s*['\"][^'\"]+|AWS_SECRET|sk-[a-zA-Z0-9]{20,})"
  MATCHES=$(git diff --staged --name-only | xargs grep -lEi "$PATTERNS" 2>/dev/null)
  if [ -n "$MATCHES" ]; then
    echo "⚠️ Possible secrets found in: $MATCHES"
    echo "Review before committing. Install gitleaks for better detection."
    # Encode files into a JSON array using node to avoid quoting issues.
    DETAILS=$(node -e "console.log(JSON.stringify({tool:'grep-fallback',files:process.argv.slice(1)}))" $MATCHES 2>/dev/null || echo '{"tool":"grep-fallback"}')
    log_verification fail "grep-fallback flagged possible secrets" "$DETAILS"
    exit 0
  fi
  log_verification pass "grep-fallback: no secrets detected" '{"tool":"grep-fallback"}'
fi
echo "✅ No secrets detected"
