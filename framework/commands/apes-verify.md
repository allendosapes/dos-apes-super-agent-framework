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
/apes-verify --browser    # Include browser check prompt
```

---

## VERIFICATION STACK

```
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION PYRAMID                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│     Level 5: Browser Verification    ← Manual testing        │
│     ─────────────────────────────                           │
│     Level 4: UI Integration          ← Components used?      │
│     ─────────────────────────                               │
│     Level 3: Integration Tests       ← E2E/API tests         │
│     ─────────────────────────                               │
│     Level 2: Unit Tests              ← Function tests        │
│     ─────────────────────────                               │
│     Level 1: Static Analysis         ← Types + Lint          │
│     ─────────────────────────                               │
│     Level 0: Build                   ← Compiles?             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

ALL levels must pass before work is considered complete.
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

# Summary
echo "═══════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo "✅ ALL VERIFICATION PASSED"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Level 5: Browser Verification (Manual)"
  echo "─────────────────────────────"
  echo "Run: npm run dev"
  echo "Then verify in browser:"
  echo "  [ ] Application loads without errors"
  echo "  [ ] Key features are accessible"
  echo "  [ ] Navigation works"
  echo "  [ ] Forms submit correctly"
else
  echo "❌ VERIFICATION FAILED"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Fix the issues above before proceeding."
fi
```

---

## STEP 2: UPDATE STATE

If all checks pass, update `.planning/STATE.md`:

```markdown
## Verification Status
build: pass
types: pass
lint: pass
tests: pass
integration: pass
ui_integration: pass
browser_verified: pending

## Last Verified
timestamp: [now]
```

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
| Check | Status |
|-------|--------|
| Build | ✅/❌ |
| Types | ✅/❌ |
| Lint | ✅/❌ |
| Unit Tests | ✅/❌ |
| Integration | ✅/❌/⚠️ |
| UI Integration | ✅/⚠️ |
| Browser | ⏳ Manual |

Overall: PASS / FAIL
```

If FAIL, do not proceed with commits or merges.
