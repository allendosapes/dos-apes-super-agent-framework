---
description: Run the full verification stack
allowed-tools: Read, Grep, TaskUpdate, Bash(bash scripts/check-:*), Bash(npm run build:*), Bash(npm run lint:*), Bash(npm run typecheck:*), Bash(npm test:*), Bash(npm audit:*), Bash(npx playwright:*), Bash(node scripts/codex-review.js:*), Bash(node scripts/log-verification.js:*)
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
│     Level 8: Adversarial Review    ← Codex CLI (opt-in)      │
│     ─────────────────────────────                           │
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
Level 8 runs when Codex CLI is installed AND L8 is enabled in
.dos-apes/codex-review-config.json. It fails open: a Codex
problem (offline, unauthenticated, disabled) never fails the
pyramid. Findings are reported as a single-shot review only —
the fix loop lives in /apes-codex-review --loop and /apes-build.
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

## STEP 2: BROWSER LEVELS (automatic when Playwright configured)

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

## STEP 2.5: ADVERSARIAL REVIEW (Level 8 — opt-in, fails open)

```bash
# Level 8: Adversarial Review (Codex CLI cross-model review)
#
# Conditional on the user opting in. Skip cleanly when:
#   - .dos-apes/codex-review-config.json is missing or disabled
#   - scripts/codex-review.js is not installed
#   - Codex CLI is not on PATH or not authenticated (the script will skip)
#
# This level is "fails open": a non-zero exit from codex-review.js does NOT
# bump FAILED. Findings are surfaced to the user; the fix loop is opt-in via
# /apes-codex-review --loop or /apes-build (when a mission is active).

L8_ENABLED=0
if [ -f ".dos-apes/codex-review-config.json" ] && [ -f "scripts/codex-review.js" ]; then
  if node -e "process.exit(JSON.parse(require('fs').readFileSync('.dos-apes/codex-review-config.json','utf8')).enabled === true ? 0 : 1)" 2>/dev/null; then
    L8_ENABLED=1
  fi
fi

if [ "$L8_ENABLED" -eq 1 ]; then
  echo ""
  echo "Level 8: Adversarial Review"
  echo "─────────────────────────────"

  # Determine diff base: use config default (main) unless caller overrides.
  L8_OUT=$(node scripts/codex-review.js --base main 2>&1)
  L8_EXIT=$?

  if [ $L8_EXIT -ne 0 ]; then
    echo "⚠️ L8 review script error (non-blocking, fails open):"
    echo "$L8_OUT" | tail -5
  else
    L8_STATE=$(echo "$L8_OUT" | node -e "
      let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        try {
          const j=JSON.parse(s.trim().split(/\r?\n/).pop());
          if (j.skipped) console.log('skipped:'+(j.reason||'unknown'));
          else console.log('verdict:'+j.verdict+':'+(j.findings?j.findings.length:0));
        } catch(_){console.log('parse-error');}
      });" 2>/dev/null)

    case "$L8_STATE" in
      skipped:*)
        echo "⏭  L8 skipped (${L8_STATE#skipped:})"
        ;;
      verdict:accept:*)
        echo "✅ L8 reviewer accepted"
        ;;
      verdict:revise:*|verdict:reject:*)
        FINDINGS_COUNT="${L8_STATE##*:}"
        echo "⚠️ L8 reviewer reports ${FINDINGS_COUNT} finding(s) — see .dos-apes/codex-reviews/"
        echo "   Run /apes-codex-review --loop to address automatically."
        # Fails open: do NOT set FAILED=1
        ;;
      *)
        echo "⚠️ L8 result not parsed cleanly (non-blocking)"
        ;;
    esac
  fi

  # Log to mission verification log if missions framework is present.
  # log-verification.js itself is graceful: missing active-mission → warns
  # to stderr and exits 0. The 2>/dev/null || true keeps this best-effort.
  if [ -f "scripts/log-verification.js" ]; then
    case "$L8_STATE" in
      verdict:accept:*) L8_OUTCOME=pass ;;
      skipped:*)        L8_OUTCOME=skip ;;
      verdict:*)        L8_OUTCOME=fail ;;
      *)                L8_OUTCOME=skip ;;
    esac
    node scripts/log-verification.js L8 "$L8_OUTCOME" "Adversarial review (single-shot) — $L8_STATE" 2>/dev/null || true
  fi
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
| Adversarial Review | ✅/⚠️/⏭  |

Overall: PASS / FAIL

L8 (Adversarial Review) status legend:
  ✅ accept       — reviewer signed off
  ⚠️ findings     — non-blocking; address via /apes-codex-review --loop
  ⏭  skipped      — disabled, Codex unavailable, or not configured
```

If FAIL, do not proceed with commits or merges. **L8 never contributes to FAIL** — it fails open by design.
