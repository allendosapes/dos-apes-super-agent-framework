#!/bin/bash
# Pathway Agent Framework - Verification Hook
# Runs before allowing task/phase completion

set -e

echo "🔍 Pathway Verification Suite"
echo "=============================="

# Track failures
FAILURES=0

# Level 1: Build
echo ""
echo "📦 Level 1: Build"
if npm run build > /dev/null 2>&1; then
    echo "   ✅ Build passed"
else
    echo "   ❌ Build failed"
    FAILURES=$((FAILURES + 1))
fi

# Level 2: Type Check
echo ""
echo "🔍 Level 2: Type Check"
if npm run typecheck > /dev/null 2>&1; then
    echo "   ✅ Types valid"
else
    echo "   ❌ Type errors found"
    FAILURES=$((FAILURES + 1))
fi

# Level 3: Lint
echo ""
echo "📝 Level 3: Lint"
if npm run lint > /dev/null 2>&1; then
    echo "   ✅ Lint passed"
else
    echo "   ❌ Lint errors found"
    FAILURES=$((FAILURES + 1))
fi

# Level 4: Tests
echo ""
echo "🧪 Level 4: Tests"
if npm test > /dev/null 2>&1; then
    echo "   ✅ All tests passed"
else
    echo "   ❌ Tests failed"
    FAILURES=$((FAILURES + 1))
fi

# Level 5: UI Integration Check
echo ""
echo "🖥️ Level 5: UI Integration"

# Check if there's a current plan with UI integration requirements
if [ -f ".planning/PLAN.md" ]; then
    # Extract component name from plan
    COMPONENT=$(grep -o '<component>[^<]*</component>' .planning/PLAN.md 2>/dev/null | sed 's/<[^>]*>//g' | head -1)
    
    if [ -n "$COMPONENT" ]; then
        # Check if component is used outside its own directory
        USAGE=$(grep -rn "$COMPONENT" src/ --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "src/components" | grep -v "\.test\." | wc -l)
        
        if [ "$USAGE" -gt 0 ]; then
            echo "   ✅ Component '$COMPONENT' integrated in UI"
        else
            echo "   ⚠️  Component '$COMPONENT' may not be integrated"
            echo "      Check that it's imported and used in a page/view"
            # Warning only, not failure
        fi
    else
        echo "   ⏭️  No component integration to check"
    fi
    
    # Check for route if specified
    ROUTE=$(grep -o '<route>[^<]*</route>' .planning/PLAN.md 2>/dev/null | sed 's/<[^>]*>//g' | head -1)
    
    if [ -n "$ROUTE" ]; then
        ROUTE_EXISTS=$(grep -rn "$ROUTE" src/ --include="*.tsx" --include="*.jsx" 2>/dev/null | wc -l)
        
        if [ "$ROUTE_EXISTS" -gt 0 ]; then
            echo "   ✅ Route '$ROUTE' exists"
        else
            echo "   ⚠️  Route '$ROUTE' not found"
        fi
    fi
else
    echo "   ⏭️  No plan file to check"
fi

# Summary
echo ""
echo "=============================="

if [ $FAILURES -eq 0 ]; then
    echo "✅ All verification passed!"
    echo ""
    exit 0
else
    echo "❌ $FAILURES verification level(s) failed"
    echo ""
    echo "Fix the issues above before marking complete."
    exit 1
fi
