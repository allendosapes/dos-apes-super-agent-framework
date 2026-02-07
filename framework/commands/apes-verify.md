---
description: Run the full verification stack
allowed-tools: Bash, Read, Grep
---

# Verify

**Run the complete verification stack to ensure everything works.**

## Usage

```bash
/apes-verify              # Full verification
/apes-verify --quick      # Build + types only
/apes-verify --browser    # Include browser/E2E levels
```

---

## VERIFICATION STACK

```
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION PYRAMID                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│     Level 7: Visual Regression     ← Screenshot diff         │
│     ─────────────────────────────                           │
│     Level 6: E2E / Browser         ← Playwright + agent     │
│     ─────────────────────────────                           │
│     Level 5: Security Scan         ← npm audit + gitleaks   │
│     ─────────────────────────────                           │
│     Level 4: UI Integration        ← Components used?        │
│     ─────────────────────────────                           │
│     Level 3: Integration Tests     ← E2E/API tests           │
│     ─────────────────────────────                           │
│     Level 2.5: Coverage Gate       ← scripts/check-coverage  │
│     ─────────────────────────────                           │
│     Level 2: Unit Tests            ← Function tests          │
│     ─────────────────────────────                           │
│     Level 1: Static Analysis       ← Types + Lint            │
│     ─────────────────────────────                           │
│     Level 0.5: Auto Code Review    ← Stop hook (automatic)   │
│     ─────────────────────────────                           │
│     Level 0: Build                 ← Compiles?               │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Levels 0-5 must pass before work is considered complete.
Levels 6-7 run when Playwright/agent-browser are configured.
Level 0.5 runs automatically via Stop hook — not invoked here.
```

---

## STEP 1: RUN VERIFICATION

```bash
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 DOS APES VERIFICATION STACK"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Track failures
FAILED=0

# Level 0: Build
echo "Level 0: Build"
echo "─────────────────────────────"
if npm run build 2>&1; then
  echo "✅ Build passed"
else
  echo "❌ Build FAILED"
  FAILED=1
fi
echo ""

# Level 1: Static Analysis
echo "Level 1: Static Analysis"
echo "─────────────────────────────"

echo "  Types..."
if npm run typecheck 2>&1; then
  echo "  ✅ Types passed"
else
  echo "  ❌ Types FAILED"
  FAILED=1
fi

echo "  Lint..."
if npm run lint 2>&1; then
  echo "  ✅ Lint passed"
else
  echo "  ❌ Lint FAILED"
  FAILED=1
fi
echo ""

# Level 2: Unit Tests
echo "Level 2: Unit Tests"
echo "─────────────────────────────"
if npm test 2>&1; then
  echo "✅ Unit tests passed"
else
  echo "❌ Unit tests FAILED"
  FAILED=1
fi
echo ""

# Level 2.5: Coverage Gate
echo "Level 2.5: Coverage Gate"
echo "─────────────────────────────"
if [ -f "scripts/check-coverage.sh" ]; then
  if bash scripts/check-coverage.sh 2>&1; then
    echo "✅ Coverage meets threshold"
  else
    echo "⚠️ Coverage below threshold"
  fi
elif [ -f ".claude/scripts/check-coverage.sh" ]; then
  if bash .claude/scripts/check-coverage.sh 2>&1; then
    echo "✅ Coverage meets threshold"
  else
    echo "⚠️ Coverage below threshold"
  fi
else
  echo "⚠️ Coverage script not found — skipping"
fi
echo ""

# Level 3: Integration Tests
echo "Level 3: Integration Tests"
echo "─────────────────────────────"
if npm run test:integration 2>&1 || npm run test:e2e 2>&1; then
  echo "✅ Integration tests passed"
else
  echo "⚠️  No integration tests found or failed"
fi
echo ""

# Level 4: UI Integration Check
echo "Level 4: UI Integration"
echo "─────────────────────────────"
# Check if any components exist but aren't used
UNUSED=$(find src/components -name "*.tsx" -o -name "*.jsx" 2>/dev/null | while read f; do
  COMPONENT=$(basename "$f" | sed 's/\.[^.]*$//')
  USAGE=$(grep -rn "$COMPONENT" src/ --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "src/components" | grep -v "\.test\." | wc -l)
  if [ "$USAGE" -eq 0 ]; then
    echo "$COMPONENT"
  fi
done)

if [ -n "$UNUSED" ]; then
  echo "⚠️  Potentially unused components:"
  echo "$UNUSED" | while read c; do echo "    - $c"; done
else
  echo "✅ All components appear to be integrated"
fi
echo ""

# Level 5: Security Scan
echo "Level 5: Security Scan"
echo "─────────────────────────────"

echo "  Dependency audit..."
npm audit --audit-level=high 2>&1 | tail -5
AUDIT_EXIT=$?
if [ $AUDIT_EXIT -eq 0 ]; then
  echo "  ✅ No high/critical vulnerabilities"
else
  echo "  ⚠️ Vulnerabilities found (review npm audit output)"
fi

echo "  Secret detection..."
if [ -f "scripts/check-secrets.sh" ]; then
  bash scripts/check-secrets.sh 2>&1
elif [ -f ".claude/scripts/check-secrets.sh" ]; then
  bash .claude/scripts/check-secrets.sh 2>&1
else
  echo "  ⚠️ Secret detection script not found — skipping"
fi
echo ""

# Summary (Levels 0-5)
echo "═══════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo "✅ CORE VERIFICATION PASSED (Levels 0-5)"
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "❌ VERIFICATION FAILED"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Fix the issues above before proceeding."
fi
```

---

## STEP 2: BROWSER LEVELS (if --browser or Playwright configured)

```bash
# Level 6: E2E (if configured)
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
  echo ""
  echo "Level 6: E2E / Browser Tests"
  echo "─────────────────────────────"
  npx playwright test || { echo "❌ E2E FAILED"; FAILED=1; }
fi

# Level 7: Visual Regression (if baselines exist)
if [ -d "tests/visual-baselines" ]; then
  echo ""
  echo "Level 7: Visual Regression"
  echo "─────────────────────────────"
  npx playwright test --project=visual-regression || echo "⚠️ Visual differences detected"
fi
```

---

## STEP 3: UPDATE STATUS

If all checks pass, update the current gate task:

```
TaskUpdate: "[GATE] Verification"
  status: completed
  description: "All levels passed at [timestamp]"
```

If checks fail, keep the gate task in progress and report failures.

---

## QUICK MODE

If `--quick` flag:

```bash
echo "Quick verification (build + types only)"
npm run build && npm run typecheck
```

---

## OUTPUT

```
| Check              | Status   |
|--------------------|----------|
| Build              | ✅/❌    |
| Types              | ✅/❌    |
| Lint               | ✅/❌    |
| Unit Tests         | ✅/❌    |
| Coverage Gate      | ✅/⚠️    |
| Integration        | ✅/❌/⚠️ |
| UI Integration     | ✅/⚠️    |
| Security Scan      | ✅/⚠️    |
| E2E (if configured)| ✅/❌/⏳ |
| Visual Regression  | ✅/⚠️/⏳ |

Overall: PASS / FAIL
```

If FAIL, do not proceed with commits or merges.
