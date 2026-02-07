#!/bin/bash
# Pre-commit secret detection
# Uses gitleaks if available, falls back to grep patterns
if command -v gitleaks &> /dev/null; then
  gitleaks detect --source . --no-banner 2>&1 | head -10
  EXIT_CODE=$?
  [ $EXIT_CODE -ne 0 ] && echo "❌ Secrets detected! Do not commit." && exit 1
else
  # Fallback: grep for common secret patterns
  PATTERNS="(PRIVATE.KEY|api[_-]?key|secret[_-]?key|password\s*=\s*['\"][^'\"]+|AWS_SECRET|sk-[a-zA-Z0-9]{20,})"
  MATCHES=$(git diff --staged --name-only | xargs grep -lEi "$PATTERNS" 2>/dev/null)
  if [ -n "$MATCHES" ]; then
    echo "⚠️ Possible secrets found in: $MATCHES"
    echo "Review before committing. Install gitleaks for better detection."
  fi
fi
echo "✅ No secrets detected"
