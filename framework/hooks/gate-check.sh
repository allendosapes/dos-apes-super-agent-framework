#!/bin/bash
# Dos Apes Super Agent Framework - Gate Check Hook
# Pre-merge quality gate verification
# Ensures all gate requirements are met before phase/merge completion

set -e

STATE_FILE=".planning/STATE.md"
PLANNING_DIR=".planning"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🚦 QUALITY GATE VERIFICATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Get current gate from argument or state
GATE="${1:-}"
if [ -z "$GATE" ]; then
  GATE=$(grep "^current_gate:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
fi

if [ -z "$GATE" ]; then
  echo "No gate specified. Usage: gate-check.sh [G1|G2|G3|G4|G5|G6]"
  exit 1
fi

# Track pass/fail
PASSED=0
FAILED=0
WARNINGS=0

check_pass() {
  echo -e "  ${GREEN}✅ $1${NC}"
  PASSED=$((PASSED + 1))
}

check_fail() {
  echo -e "  ${RED}❌ $1${NC}"
  FAILED=$((FAILED + 1))
}

check_warn() {
  echo -e "  ${YELLOW}⚠️  $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

check_file_exists() {
  if [ -f "$1" ]; then
    check_pass "Found: $1"
    return 0
  else
    check_fail "Missing: $1"
    return 1
  fi
}

check_file_not_empty() {
  if [ -s "$1" ]; then
    check_pass "Has content: $1"
    return 0
  else
    check_fail "Empty file: $1"
    return 1
  fi
}

# Gate-specific checks
case "$GATE" in
  G1)
    echo -e "${BLUE}Gate G1: Requirements Complete${NC}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    # Check for PRD
    if [ -f "$PLANNING_DIR/PROJECT.md" ]; then
      check_pass "PROJECT.md exists"

      # Check PRD has required sections
      if grep -q "## Vision\|## Problem\|## Goals" "$PLANNING_DIR/PROJECT.md" 2>/dev/null; then
        check_pass "PROJECT.md has required sections"
      else
        check_fail "PROJECT.md missing Vision/Problem/Goals sections"
      fi
    else
      check_fail "PROJECT.md not found"
    fi

    # Check for user stories or requirements
    if ls "$PLANNING_DIR"/phases/*/01-*-PLAN.md &>/dev/null; then
      check_pass "Phase plans exist"
    else
      check_fail "No phase plans found"
    fi

    # Check for MVP definition
    if grep -qi "mvp\|minimum viable\|phase 1" "$PLANNING_DIR/ROADMAP.md" 2>/dev/null; then
      check_pass "MVP defined in ROADMAP.md"
    elif grep -qi "mvp\|minimum viable" "$PLANNING_DIR/PROJECT.md" 2>/dev/null; then
      check_pass "MVP defined in PROJECT.md"
    else
      check_warn "MVP not explicitly defined"
    fi
    ;;

  G2)
    echo -e "${BLUE}Gate G2: Design Complete${NC}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    # Check for architecture decisions
    if [ -d "$PLANNING_DIR/codebase" ] || ls "$PLANNING_DIR"/*ARCHITECTURE* &>/dev/null 2>&1; then
      check_pass "Architecture documentation exists"
    else
      check_fail "No architecture documentation"
    fi

    # Check for tech stack decisions
    if grep -qi "tech.*stack\|framework\|language" "$PLANNING_DIR"/*.md 2>/dev/null; then
      check_pass "Tech stack documented"
    else
      check_warn "Tech stack not explicitly documented"
    fi

    # Check for threat model or security considerations
    if grep -qi "security\|threat\|auth" "$PLANNING_DIR"/*.md 2>/dev/null; then
      check_pass "Security considerations documented"
    else
      check_warn "Security not explicitly documented"
    fi
    ;;

  G3)
    echo -e "${BLUE}Gate G3: Implementation Ready${NC}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    # Check development environment
    if [ -f "package.json" ] || [ -f "requirements.txt" ] || [ -f "go.mod" ] || [ -f "Cargo.toml" ]; then
      check_pass "Project dependencies configured"
    else
      check_fail "No dependency file found"
    fi

    # Check for build/run scripts
    if [ -f "package.json" ] && grep -q '"scripts"' package.json; then
      check_pass "Build scripts configured"
    elif [ -f "Makefile" ]; then
      check_pass "Makefile exists"
    else
      check_warn "No build configuration found"
    fi

    # Check git initialized
    if [ -d ".git" ]; then
      check_pass "Git repository initialized"
    else
      check_fail "Git not initialized"
    fi

    # Check for gitignore
    if [ -f ".gitignore" ]; then
      check_pass ".gitignore exists"
    else
      check_warn ".gitignore missing"
    fi
    ;;

  G4)
    echo -e "${BLUE}Gate G4: Code Complete${NC}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    # Run build check
    echo "Checking build..."
    if npm run build &>/dev/null || make build &>/dev/null || cargo build &>/dev/null 2>&1; then
      check_pass "Build succeeds"
    else
      check_fail "Build fails"
    fi

    # Run type check if applicable
    if [ -f "tsconfig.json" ]; then
      echo "Checking types..."
      if npm run typecheck &>/dev/null || npx tsc --noEmit &>/dev/null; then
        check_pass "Type check passes"
      else
        check_fail "Type errors found"
      fi
    fi

    # Check for unit tests
    if ls **/*.test.* &>/dev/null 2>&1 || ls **/*_test.* &>/dev/null 2>&1 || ls tests/ &>/dev/null 2>&1; then
      check_pass "Unit tests exist"
    else
      check_fail "No unit tests found"
    fi

    # Check lint
    echo "Checking lint..."
    if npm run lint &>/dev/null || make lint &>/dev/null 2>&1; then
      check_pass "Lint passes"
    else
      check_warn "Lint issues found"
    fi
    ;;

  G5)
    echo -e "${BLUE}Gate G5: Test Complete${NC}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    # Run tests
    echo "Running tests..."
    if npm test &>/dev/null || pytest &>/dev/null || go test ./... &>/dev/null 2>&1; then
      check_pass "All tests pass"
    else
      check_fail "Tests failing"
    fi

    # Check coverage if available
    if [ -f "coverage/lcov.info" ] || [ -f "coverage.xml" ] || [ -f ".coverage" ]; then
      # Try to extract coverage percentage
      COVERAGE=$(grep -oP 'LF:\K\d+|<coverage[^>]*line-rate="\K[^"]+' coverage/* 2>/dev/null | head -1)
      if [ -n "$COVERAGE" ]; then
        echo "  Coverage: ${COVERAGE}%"
        if [ "${COVERAGE%.*}" -ge 80 ]; then
          check_pass "Coverage >= 80%"
        elif [ "${COVERAGE%.*}" -ge 70 ]; then
          check_warn "Coverage between 70-80%"
        else
          check_fail "Coverage below 70%"
        fi
      else
        check_warn "Coverage data found but unable to parse"
      fi
    else
      check_warn "No coverage data found"
    fi

    # Check for critical/blocker bugs
    if [ -f "$PLANNING_DIR/ISSUES.md" ]; then
      if grep -qi "critical\|blocker" "$PLANNING_DIR/ISSUES.md"; then
        check_fail "Critical/blocker issues exist in ISSUES.md"
      else
        check_pass "No critical/blocker issues"
      fi
    else
      check_pass "No issues file (assumed clean)"
    fi
    ;;

  G6)
    echo -e "${BLUE}Gate G6: Release Ready${NC}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    # Run all previous gates first
    echo "Verifying all previous gates..."
    for prev_gate in G4 G5; do
      echo ""
      echo "Checking $prev_gate..."
      if "$0" "$prev_gate" &>/dev/null; then
        check_pass "$prev_gate passes"
      else
        check_fail "$prev_gate incomplete"
      fi
    done
    echo ""

    # Check documentation
    if [ -f "README.md" ]; then
      check_pass "README.md exists"
      if grep -qi "install\|usage\|getting started" README.md; then
        check_pass "README has usage instructions"
      else
        check_warn "README may be incomplete"
      fi
    else
      check_fail "README.md missing"
    fi

    # Check for security review
    if grep -qi "security.*review\|reviewed.*security" "$PLANNING_DIR"/*.md 2>/dev/null; then
      check_pass "Security review documented"
    else
      check_warn "Security review not documented"
    fi

    # Check no console.log/print statements in production code
    if grep -rn "console\.log\|print(" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" 2>/dev/null | grep -v "test\|spec\|debug" | head -1 >/dev/null; then
      check_warn "Debug statements may exist in code"
    else
      check_pass "No obvious debug statements"
    fi

    # Check for deployment configuration
    if [ -f "Dockerfile" ] || [ -f "docker-compose.yml" ] || [ -f ".github/workflows/"* ] || [ -f "vercel.json" ]; then
      check_pass "Deployment configuration exists"
    else
      check_warn "No deployment configuration found"
    fi
    ;;

  *)
    echo "Unknown gate: $GATE"
    echo "Valid gates: G1, G2, G3, G4, G5, G6"
    exit 1
    ;;
esac

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SUMMARY: $GATE"
echo "═══════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}Passed:   $PASSED${NC}"
echo -e "  ${RED}Failed:   $FAILED${NC}"
echo -e "  ${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ GATE $GATE: FAILED${NC}"
  echo ""
  echo "Fix the issues above before proceeding."

  # Update state file if it exists
  if [ -f "$STATE_FILE" ]; then
    sed -i "s/^gate_status:.*/gate_status: failed/" "$STATE_FILE" 2>/dev/null || true
    sed -i "s/^failed_gate:.*/failed_gate: $GATE/" "$STATE_FILE" 2>/dev/null || true
  fi

  exit 1
else
  echo -e "${GREEN}✅ GATE $GATE: PASSED${NC}"

  # Update state file if it exists
  if [ -f "$STATE_FILE" ]; then
    sed -i "s/^gate_status:.*/gate_status: passed/" "$STATE_FILE" 2>/dev/null || true
    sed -i "s/^failed_gate:.*/failed_gate: none/" "$STATE_FILE" 2>/dev/null || true
    sed -i "s/^last_passed_gate:.*/last_passed_gate: $GATE/" "$STATE_FILE" 2>/dev/null || true
  fi

  if [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "Note: $WARNINGS warnings should be addressed before release."
  fi

  exit 0
fi
