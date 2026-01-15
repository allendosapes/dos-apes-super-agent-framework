#!/bin/bash
# Dos Apes Super Agent Framework - Stop Hook
# Enforces Ralph loop: blocks exit until product complete
# Enhanced with context usage tracking and quality gate awareness

STATE_FILE=".planning/STATE.md"
MEMORY_FILE=".planning/MEMORY.md"

# No state file = allow exit
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Parse state
RALPH_MODE=$(grep "^ralph_mode:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
ALL_COMPLETE=$(grep "^all_tasks_complete:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
CURRENT_PHASE=$(grep "^phase:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
CURRENT_TASK=$(grep "^task:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
PHASE_NAME=$(grep "^phase_name:" "$STATE_FILE" 2>/dev/null | cut -d'"' -f2)
STATUS=$(grep "^status:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
CONTEXT_USAGE=$(grep "^context_usage:" "$STATE_FILE" 2>/dev/null | awk '{print $2}' | tr -d '%')
GATE_STATUS=$(grep "^gate_status:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

# Not in Ralph mode = allow exit
if [ "$RALPH_MODE" != "true" ]; then
  exit 0
fi

# All complete = allow exit with celebration
if [ "$ALL_COMPLETE" = "true" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "🦍🦍 PRODUCT COMPLETE! 🦍🦍"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Dos Apes: We ain't monkeying around with code!"
  echo ""
  exit 0
fi

# Check for BLOCKED status
if [ "$STATUS" = "blocked" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "⚠️  BUILD BLOCKED - Human intervention required"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "See .planning/ISSUES.md for details"
  echo "Run /apes:resume after fixing"
  echo ""
  exit 0  # Allow exit when blocked
fi

# Check for gate failure
if [ "$GATE_STATUS" = "failed" ]; then
  FAILED_GATE=$(grep "^failed_gate:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "🚫 QUALITY GATE FAILED: $FAILED_GATE"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Gate requirements not met. Fix issues before proceeding."
  echo "Run: ./framework/hooks/gate-check.sh to see requirements"
  echo ""
  # Continue working - don't allow exit on gate failure
fi

# Context usage tracking and recommendations
if [ -n "$CONTEXT_USAGE" ]; then
  if [ "$CONTEXT_USAGE" -ge 70 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "⚠️  HIGH CONTEXT USAGE: ${CONTEXT_USAGE}%"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Quality may degrade. Consider:"
    echo "  1. Spawn subagent for remaining work"
    echo "  2. Save state and resume in fresh session"
    echo "  3. Complete current task then handoff"
    echo ""
    # Log to memory if file exists
    if [ -f "$MEMORY_FILE" ]; then
      TIMESTAMP=$(date +"%Y-%m-%d %H:%M")
      echo "- [$TIMESTAMP] Context reached ${CONTEXT_USAGE}% at phase $CURRENT_PHASE task $CURRENT_TASK" >> "$MEMORY_FILE"
    fi
  elif [ "$CONTEXT_USAGE" -ge 50 ]; then
    echo ""
    echo "📊 Context usage: ${CONTEXT_USAGE}% (approaching threshold)"
    echo "   Plan to hand off after current task"
    echo ""
  fi
fi

# Still work to do - block exit and continue
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🔄 RALPH MODE ACTIVE - Continuing..."
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Current Position:"
echo "  Phase: $CURRENT_PHASE - $PHASE_NAME"
echo "  Task:  $CURRENT_TASK"
echo "  Status: $STATUS"
echo ""

# Check iteration count
MAX_ITER=$(grep "^max_iterations:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
CURRENT_ITER=$(grep "^current_iteration:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

if [ -n "$MAX_ITER" ] && [ -n "$CURRENT_ITER" ]; then
  if [ "$CURRENT_ITER" -ge "$MAX_ITER" ]; then
    echo "⚠️  Max iterations ($MAX_ITER) reached"
    echo "Progress saved. Run /apes:resume to continue."
    echo ""
    exit 0  # Allow exit at max iterations
  fi
  
  # Increment iteration
  NEXT_ITER=$((CURRENT_ITER + 1))
  sed -i "s/^current_iteration:.*/current_iteration: $NEXT_ITER/" "$STATE_FILE"
  echo "Iteration: $NEXT_ITER / $MAX_ITER"
fi

echo ""
echo "Next action: Continue with current task"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Block exit - this will re-feed the prompt
exit 1
