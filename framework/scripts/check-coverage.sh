#!/bin/bash
# Coverage enforcement gate
# Thresholds configurable via env vars, defaults to 80%
THRESHOLD=${COVERAGE_THRESHOLD:-80}

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
  exit 1
fi

if [ $? -ne 0 ]; then
  echo "⚠️ Tests failed ($RUNNER) — coverage not measured"
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

  [ "$FAIL" = "1" ] && exit 1
  echo "✅ Coverage meets ${THRESHOLD}% threshold"
else
  echo "⚠️ No coverage report generated"
fi
