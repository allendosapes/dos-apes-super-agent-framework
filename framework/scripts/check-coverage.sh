#!/bin/bash
# Coverage enforcement gate (verification level L2.5)
# Thresholds configurable via env vars, defaults to 80%
THRESHOLD=${COVERAGE_THRESHOLD:-80}

START_MS=$(node -e "console.log(Date.now())" 2>/dev/null || echo "")

log_verification() {
  # log_verification <outcome> <summary> [details-json]
  # Failures here are silent — verification logging never blocks the pipeline.
  if [ -n "$START_MS" ]; then
    local NOW
    NOW=$(node -e "console.log(Date.now())" 2>/dev/null || echo "")
    if [ -n "$NOW" ]; then
      export VERIFICATION_DURATION_MS=$((NOW - START_MS))
    fi
  fi
  local DETAILS="${3-}"
  if [ -z "$DETAILS" ]; then DETAILS='{}'; fi
  node scripts/log-verification.js L2.5 "$1" "$2" "$DETAILS" 2>/dev/null || true
}

# Detect test runner and run coverage
if grep -q '"vitest"' package.json 2>/dev/null; then
  RUNNER="vitest"
  npx vitest run --coverage --coverage.reporter json-summary 2>/dev/null
elif grep -q '"jest"' package.json 2>/dev/null; then
  RUNNER="jest"
  npx jest --coverage --coverageReporters=json-summary 2>/dev/null
elif [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ] || [ -f "vitest.config.mts" ]; then
  RUNNER="vitest"
  npx vitest run --coverage --coverage.reporter json-summary 2>/dev/null
elif [ -f "jest.config.ts" ] || [ -f "jest.config.js" ] || [ -f "jest.config.mjs" ]; then
  RUNNER="jest"
  npx jest --coverage --coverageReporters=json-summary 2>/dev/null
else
  echo "⚠️ No test runner detected (looked for vitest and jest in package.json and config files)"
  log_verification skip "No test runner detected" '{"reason":"no-runner"}'
  exit 1
fi

if [ $? -ne 0 ]; then
  echo "⚠️ Tests failed ($RUNNER) — coverage not measured"
  log_verification fail "Tests failed under $RUNNER — coverage not measured" "{\"runner\":\"$RUNNER\"}"
  exit 1
fi

# Parse coverage from json-summary
COVERAGE_FILE="coverage/coverage-summary.json"
if [ -f "$COVERAGE_FILE" ]; then
  LINES=$(node -e "console.log(require('./$COVERAGE_FILE').total.lines.pct)")
  BRANCHES=$(node -e "console.log(require('./$COVERAGE_FILE').total.branches.pct)")
  FUNCTIONS=$(node -e "console.log(require('./$COVERAGE_FILE').total.functions.pct)")

  echo "Coverage: Lines=$LINES% Branches=$BRANCHES% Functions=$FUNCTIONS%"

  FAIL=0
  node -e "process.exit($LINES < $THRESHOLD ? 1 : 0)" || { echo "❌ Lines below $THRESHOLD%"; FAIL=1; }
  node -e "process.exit($BRANCHES < $THRESHOLD ? 1 : 0)" || { echo "❌ Branches below $THRESHOLD%"; FAIL=1; }
  node -e "process.exit($FUNCTIONS < $THRESHOLD ? 1 : 0)" || { echo "❌ Functions below $THRESHOLD%"; FAIL=1; }

  DETAILS="{\"runner\":\"$RUNNER\",\"threshold\":$THRESHOLD,\"lines\":$LINES,\"branches\":$BRANCHES,\"functions\":$FUNCTIONS}"

  if [ "$FAIL" = "1" ]; then
    log_verification fail "Coverage below ${THRESHOLD}% (lines=$LINES branches=$BRANCHES functions=$FUNCTIONS)" "$DETAILS"
    exit 1
  fi
  echo "✅ Coverage meets ${THRESHOLD}% threshold"
  log_verification pass "Coverage ${THRESHOLD}% threshold met (lines=$LINES branches=$BRANCHES functions=$FUNCTIONS)" "$DETAILS"
else
  echo "⚠️ No coverage report generated"
  log_verification skip "No coverage report generated" "{\"runner\":\"$RUNNER\"}"
fi
