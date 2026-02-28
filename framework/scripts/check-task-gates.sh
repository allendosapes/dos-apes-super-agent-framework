#!/bin/bash
# Gate check for task state transitions
# Usage: bash scripts/check-task-gates.sh <TASK_ID> <TARGET_STATE>
# Valid states: READY, IN_PROGRESS, IN_REVIEW, IN_QA, VERIFIED, MERGED
#
# Fail open for missing metadata, fail closed for failed checks.
# Called explicitly by the orchestrator at transition points.

TASK_ID="$1"
TARGET_STATE="$2"
FAIL=0
FAIL_REASON=""
FAIL_DETAILS=""

# --- Helpers ---

print_fail() {
  echo ""
  echo "═══ GATE CHECK FAILED ═══"
  echo "Task: $TASK_ID"
  echo "Transition: → $TARGET_STATE"
  echo "Failed check: $FAIL_REASON"
  echo "Details: $FAIL_DETAILS"
  echo "══════════════════════════"
  echo ""
}

print_pass() {
  echo "✅ Gate passed: $TASK_ID → $TARGET_STATE"
}

fail_gate() {
  FAIL=1
  FAIL_REASON="$1"
  FAIL_DETAILS="$2"
  print_fail
  exit 1
}

warn_skip() {
  echo "⚠️  $1 — skipping check (fail open)"
}

# Detect package manager
detect_pm() {
  if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
    echo "bun"
  elif [ -f "pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "yarn.lock" ]; then
    echo "yarn"
  elif [ -f "package-lock.json" ]; then
    echo "npm"
  elif [ -f "package.json" ]; then
    echo "npm"
  else
    echo ""
  fi
}

run_pm() {
  PM=$(detect_pm)
  if [ -z "$PM" ]; then
    return 1
  fi
  $PM run "$@" 2>&1
}

# Check if a npm script exists in package.json
has_script() {
  if [ ! -f "package.json" ]; then
    return 1
  fi
  node -e "var p=require('./package.json'); process.exit(p.scripts && p.scripts['$1'] ? 0 : 1)" 2>/dev/null
}

# --- Argument Validation ---

if [ -z "$TASK_ID" ] || [ -z "$TARGET_STATE" ]; then
  echo "Usage: bash scripts/check-task-gates.sh <TASK_ID> <TARGET_STATE>"
  echo "Valid states: READY, IN_PROGRESS, IN_REVIEW, IN_QA, VERIFIED, MERGED"
  exit 1
fi

case "$TARGET_STATE" in
  READY|IN_PROGRESS|IN_REVIEW|IN_QA|VERIFIED|MERGED) ;;
  *)
    echo "Invalid state: $TARGET_STATE"
    echo "Valid states: READY, IN_PROGRESS, IN_REVIEW, IN_QA, VERIFIED, MERGED"
    exit 1
    ;;
esac

# --- Locate task metadata ---
# Look for task description in .planning/tasks/TASK_ID.md or similar locations
TASK_FILE=""
if [ -f ".planning/tasks/${TASK_ID}.md" ]; then
  TASK_FILE=".planning/tasks/${TASK_ID}.md"
elif [ -f ".planning/tasks/task-${TASK_ID}.md" ]; then
  TASK_FILE=".planning/tasks/task-${TASK_ID}.md"
fi

# --- Gate: READY ---
gate_ready() {
  # Check 1: Task has acceptance criteria
  if [ -n "$TASK_FILE" ]; then
    if grep -qiE "(GIVEN .+ WHEN .+ THEN|Acceptance Criteria)" "$TASK_FILE" 2>/dev/null; then
      echo "  ✓ Acceptance criteria found in $TASK_FILE"
    else
      fail_gate "Missing acceptance criteria" \
        "Task file $TASK_FILE does not contain GIVEN/WHEN/THEN or 'Acceptance Criteria' section"
    fi
  else
    warn_skip "No task file found at .planning/tasks/${TASK_ID}.md"
  fi

  # Check 2: Dependencies resolved (check for blockedBy markers)
  if [ -n "$TASK_FILE" ]; then
    BLOCKED=$(grep -i "blockedBy" "$TASK_FILE" 2>/dev/null | grep -v "none" | grep -v "^\s*$")
    if [ -n "$BLOCKED" ]; then
      # Check if blocked tasks are marked as done
      BLOCKING_IDS=$(echo "$BLOCKED" | grep -oE '[A-Za-z0-9_-]+' | tail -n +2)
      for BID in $BLOCKING_IDS; do
        BFILE=""
        if [ -f ".planning/tasks/${BID}.md" ]; then
          BFILE=".planning/tasks/${BID}.md"
        elif [ -f ".planning/tasks/task-${BID}.md" ]; then
          BFILE=".planning/tasks/task-${BID}.md"
        fi
        if [ -n "$BFILE" ]; then
          if grep -qi "status.*VERIFIED\|status.*MERGED\|status.*completed\|status.*done" "$BFILE" 2>/dev/null; then
            echo "  ✓ Dependency $BID resolved"
          else
            fail_gate "Unresolved dependency" "Task $BID is not yet completed/verified"
          fi
        fi
      done
    else
      echo "  ✓ No blocking dependencies"
    fi
  fi
}

# --- Gate: IN_PROGRESS ---
gate_in_progress() {
  # Check 1: Task has an assigned agent role
  if [ -n "$TASK_FILE" ]; then
    if grep -qiE "(agent|role|assigned).*:" "$TASK_FILE" 2>/dev/null; then
      echo "  ✓ Agent role assigned"
    else
      warn_skip "No agent role found in task file (may be assigned via Tasks API)"
    fi
  else
    warn_skip "No task file found — agent assignment not verified"
  fi

  # Check 2: Branch exists or can be created
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [ -n "$BRANCH" ]; then
    echo "  ✓ On branch: $BRANCH"
  else
    warn_skip "Not in a git repo or detached HEAD"
  fi
}

# --- Gate: IN_REVIEW ---
gate_in_review() {
  if [ ! -f "package.json" ]; then
    warn_skip "No package.json found — cannot run build checks"
    return
  fi

  # L0: Build passes
  if has_script "build"; then
    echo "  Running L0: build..."
    BUILD_OUTPUT=$(run_pm build 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L0 Build failed" "$BUILD_OUTPUT"
    fi
    echo "  ✓ L0: Build passes"
  else
    warn_skip "No 'build' script in package.json"
  fi

  # L1: Typecheck passes
  if has_script "typecheck"; then
    echo "  Running L1: typecheck..."
    TC_OUTPUT=$(run_pm typecheck 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L1 Typecheck failed" "$TC_OUTPUT"
    fi
    echo "  ✓ L1: Typecheck passes"
  elif has_script "type-check"; then
    echo "  Running L1: type-check..."
    TC_OUTPUT=$(run_pm type-check 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L1 Typecheck failed" "$TC_OUTPUT"
    fi
    echo "  ✓ L1: Typecheck passes"
  elif command -v tsc > /dev/null 2>&1 && [ -f "tsconfig.json" ]; then
    echo "  Running L1: tsc --noEmit..."
    TC_OUTPUT=$(tsc --noEmit 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L1 Typecheck failed" "$TC_OUTPUT"
    fi
    echo "  ✓ L1: Typecheck passes"
  else
    warn_skip "No typecheck script or tsconfig.json found"
  fi

  # L2: Tests pass
  if has_script "test"; then
    echo "  Running L2: tests..."
    TEST_OUTPUT=$(run_pm test 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L2 Tests failed" "$TEST_OUTPUT"
    fi
    echo "  ✓ L2: Tests pass"
  else
    warn_skip "No 'test' script in package.json"
  fi

  # L2.5: Coverage gate
  if [ -f "scripts/check-coverage.sh" ]; then
    echo "  Running L2.5: coverage gate..."
    COV_OUTPUT=$(bash scripts/check-coverage.sh 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L2.5 Coverage gate failed" "$COV_OUTPUT"
    fi
    echo "  ✓ L2.5: Coverage gate passes"
  else
    warn_skip "scripts/check-coverage.sh not found"
  fi
}

# --- Gate: IN_QA ---
gate_in_qa() {
  # Check review confidence scores
  SCORES_FILE=".planning/review-scores.json"
  if [ -f "$SCORES_FILE" ]; then
    # Check for critical issues (confidence >= 90)
    CRITICAL=$(node -e "
      var s = require('./$SCORES_FILE');
      var task = s['$TASK_ID'] || s;
      var issues = (task.issues || []).filter(function(i) { return i.confidence >= 90; });
      if (issues.length > 0) {
        console.log(issues.length + ' critical issues (confidence >= 90)');
        issues.forEach(function(i) { console.log('  - ' + i.category + ': ' + i.description); });
        process.exit(1);
      }
      process.exit(0);
    " 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "Critical review issues unresolved" "$CRITICAL"
    fi
    echo "  ✓ No critical review issues"

    # Check overall review score
    SCORE=$(node -e "
      var s = require('./$SCORES_FILE');
      var task = s['$TASK_ID'] || s;
      var score = task.confidence || task.score || 0;
      console.log(score);
      process.exit(score >= 80 ? 0 : 1);
    " 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "Review confidence below threshold" "Score: $SCORE (minimum: 80)"
    fi
    echo "  ✓ Review confidence: $SCORE (>= 80)"
  else
    warn_skip "No review scores file at $SCORES_FILE"
  fi
}

# --- Gate: VERIFIED ---
gate_verified() {
  # Run coverage check
  if [ -f "scripts/check-coverage.sh" ]; then
    echo "  Running coverage verification..."
    COV_OUTPUT=$(bash scripts/check-coverage.sh 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "Coverage verification failed" "$COV_OUTPUT"
    fi
    echo "  ✓ Coverage verification passes"
  else
    warn_skip "scripts/check-coverage.sh not found"
  fi

  # Run secrets check
  if [ -f "scripts/check-secrets.sh" ]; then
    echo "  Running secrets scan..."
    SEC_OUTPUT=$(bash scripts/check-secrets.sh 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "Secrets scan failed" "$SEC_OUTPUT"
    fi
    echo "  ✓ Secrets scan passes"
  else
    warn_skip "scripts/check-secrets.sh not found"
  fi

  # Run full L0-L2 again to confirm nothing regressed
  if [ -f "package.json" ]; then
    if has_script "build"; then
      echo "  Running regression check: build..."
      BUILD_OUT=$(run_pm build 2>&1)
      if [ $? -ne 0 ]; then
        fail_gate "Regression: build failed" "$BUILD_OUT"
      fi
      echo "  ✓ Build still passes"
    fi

    if has_script "test"; then
      echo "  Running regression check: tests..."
      TEST_OUT=$(run_pm test 2>&1)
      if [ $? -ne 0 ]; then
        fail_gate "Regression: tests failed" "$TEST_OUT"
      fi
      echo "  ✓ Tests still pass"
    fi
  fi
}

# --- Gate: MERGED ---
gate_merged() {
  # Check that we're on the phase branch (not a feature branch)
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [ -z "$BRANCH" ]; then
    warn_skip "Cannot determine current branch"
  fi

  # Full pyramid verification
  echo "  Running full verification pyramid..."

  # L0: Build
  if has_script "build"; then
    echo "  Running L0: build..."
    BUILD_OUT=$(run_pm build 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L0 Build failed on merge branch" "$BUILD_OUT"
    fi
    echo "  ✓ L0: Build passes"
  fi

  # L1: Types
  if has_script "typecheck"; then
    echo "  Running L1: typecheck..."
    TC_OUT=$(run_pm typecheck 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L1 Typecheck failed on merge branch" "$TC_OUT"
    fi
    echo "  ✓ L1: Typecheck passes"
  fi

  # L2: Tests
  if has_script "test"; then
    echo "  Running L2: tests..."
    TEST_OUT=$(run_pm test 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L2 Tests failed on merge branch" "$TEST_OUT"
    fi
    echo "  ✓ L2: Tests pass"
  fi

  # L2.5: Coverage
  if [ -f "scripts/check-coverage.sh" ]; then
    echo "  Running L2.5: coverage..."
    COV_OUT=$(bash scripts/check-coverage.sh 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L2.5 Coverage failed on merge branch" "$COV_OUT"
    fi
    echo "  ✓ L2.5: Coverage passes"
  fi

  # L5: Secrets
  if [ -f "scripts/check-secrets.sh" ]; then
    echo "  Running L5: secrets scan..."
    SEC_OUT=$(bash scripts/check-secrets.sh 2>&1)
    if [ $? -ne 0 ]; then
      fail_gate "L5 Secrets scan failed on merge branch" "$SEC_OUT"
    fi
    echo "  ✓ L5: Secrets scan passes"
  fi

  echo "  ✓ Full pyramid passes on merge branch"
}

# --- Run the appropriate gate ---

echo "Checking gate: $TASK_ID → $TARGET_STATE"
echo ""

case "$TARGET_STATE" in
  READY)        gate_ready ;;
  IN_PROGRESS)  gate_in_progress ;;
  IN_REVIEW)    gate_in_review ;;
  IN_QA)        gate_in_qa ;;
  VERIFIED)     gate_verified ;;
  MERGED)       gate_merged ;;
esac

# If we get here, all checks passed
print_pass
exit 0
