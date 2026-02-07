#!/bin/bash
# Coverage enforcement gate
# Thresholds configurable via env vars, defaults to 80%
THRESHOLD=${COVERAGE_THRESHOLD:-80}

npx jest --coverage --coverageReporters=json-summary 2>/dev/null
if [ $? -ne 0 ]; then
  echo "⚠️ Tests failed — coverage not measured"
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
  [ "$(echo "$LINES < $THRESHOLD" | bc -l)" = "1" ] && echo "❌ Lines below $THRESHOLD%" && FAIL=1
  [ "$(echo "$BRANCHES < $THRESHOLD" | bc -l)" = "1" ] && echo "❌ Branches below $THRESHOLD%" && FAIL=1
  [ "$(echo "$FUNCTIONS < $THRESHOLD" | bc -l)" = "1" ] && echo "❌ Functions below $THRESHOLD%" && FAIL=1

  [ "$FAIL" = "1" ] && exit 1
  echo "✅ Coverage meets ${THRESHOLD}% threshold"
else
  echo "⚠️ No coverage report generated"
fi
