#!/bin/bash
# Dos Apes Super Agent Framework - Stop Hook
# Enforces Ralph loop: blocks exit until product complete
# Enhanced with git automation, context tracking, and quality gates

STATE_FILE=".planning/STATE.md"
MEMORY_FILE=".planning/MEMORY.md"
GIT_AUTO_SCRIPT="framework/hooks/git-auto.sh"

# No state file = allow exit
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# GIT AUTOMATION SECTION
# ═══════════════════════════════════════════════════════════════

execute_git_automation() {
  # Check if git-auto.sh exists
  if [ ! -f "$GIT_AUTO_SCRIPT" ]; then
    return 0
  fi

  # Get action from git-auto
  local action_result
  action_result=$(bash "$GIT_AUTO_SCRIPT" detect 2>/dev/null)

  local action
  action=$(echo "$action_result" | cut -d'|' -f1)
  local message
  message=$(echo "$action_result" | cut -d'|' -f2)
  local details
  details=$(echo "$action_result" | cut -d'|' -f3)

  case "$action" in
    commit)
      echo ""
      echo "═══════════════════════════════════════════════════════════════"
      echo "🔄 AUTO-COMMIT: Task verification passed"
      echo "═══════════════════════════════════════════════════════════════"
      echo ""

      # Stage any remaining files
      git add -A 2>/dev/null

      # Commit with generated message
      if git commit -m "$message" 2>/dev/null; then
        echo "✅ Committed: $(git log --oneline -1)"

        # Update STATE.md with commit hash
        local commit_hash
        commit_hash=$(git rev-parse --short HEAD 2>/dev/null)
        if [ -f "$STATE_FILE" ]; then
          if grep -q "^last_commit:" "$STATE_FILE"; then
            sed -i "s/^last_commit:.*/last_commit: $commit_hash/" "$STATE_FILE"
          else
            echo "last_commit: $commit_hash" >> "$STATE_FILE"
          fi
          if grep -q "^pending_push:" "$STATE_FILE"; then
            sed -i "s/^pending_push:.*/pending_push: true/" "$STATE_FILE"
          else
            echo "pending_push: true" >> "$STATE_FILE"
          fi
        fi

        echo ""
        return 0
      else
        echo "⚠️  Commit failed or nothing to commit"
        return 1
      fi
      ;;

    merge)
      echo ""
      echo "═══════════════════════════════════════════════════════════════"
      echo "🔄 AUTO-MERGE: Phase complete - merging to main"
      echo "═══════════════════════════════════════════════════════════════"
      echo ""

      local current_branch
      current_branch=$(git branch --show-current 2>/dev/null)

      # Checkout main
      if ! git checkout main 2>/dev/null; then
        echo "❌ Failed to checkout main"
        return 1
      fi

      # Pull latest
      git pull origin main 2>/dev/null || true

      # Squash merge
      if git merge --squash "$current_branch" 2>/dev/null; then
        if git commit -m "$message" 2>/dev/null; then
          echo "✅ Merged to main: $(git log --oneline -1)"

          # Push to remote
          echo ""
          echo "Pushing to remote..."
          if git push origin main 2>/dev/null; then
            echo "✅ Pushed to origin/main"

            # Update STATE.md
            if [ -f "$STATE_FILE" ]; then
              sed -i "s/^pending_push:.*/pending_push: false/" "$STATE_FILE" 2>/dev/null
              sed -i "s/^last_push:.*/last_push: $(date +%Y-%m-%d_%H:%M)/" "$STATE_FILE" 2>/dev/null
            fi

            # Clean up feature branch
            git branch -d "$current_branch" 2>/dev/null || true

            echo ""
            echo "✅ Phase merge complete!"
          else
            echo "⚠️  Push failed - manual push required"
          fi
        fi
      else
        echo "❌ Merge failed - resolve conflicts"
        git checkout "$current_branch" 2>/dev/null
        return 1
      fi

      echo ""
      return 0
      ;;

    push)
      echo ""
      echo "═══════════════════════════════════════════════════════════════"
      echo "🔄 AUTO-PUSH: Final push for product completion"
      echo "═══════════════════════════════════════════════════════════════"
      echo ""

      if git push origin main 2>/dev/null; then
        echo "✅ Final push complete!"
        sed -i "s/^pending_push:.*/pending_push: false/" "$STATE_FILE" 2>/dev/null
      else
        echo "⚠️  Push failed - manual push required"
      fi
      echo ""
      ;;

    none)
      # No git action needed
      ;;
  esac
}

# Run git automation first
execute_git_automation

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
  echo "Run /apes-resume after fixing"
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

# Show git state
BRANCH=$(git branch --show-current 2>/dev/null)
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l)
UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l)
echo "Git State:"
echo "  Branch: $BRANCH"
echo "  Staged: $STAGED files"
echo "  Unstaged: $UNSTAGED files"
echo ""

# Check iteration count
MAX_ITER=$(grep "^max_iterations:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
CURRENT_ITER=$(grep "^current_iteration:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

if [ -n "$MAX_ITER" ] && [ -n "$CURRENT_ITER" ]; then
  if [ "$CURRENT_ITER" -ge "$MAX_ITER" ]; then
    echo "⚠️  Max iterations ($MAX_ITER) reached"
    echo "Progress saved. Run /apes-resume to continue."
    echo ""
    exit 0  # Allow exit at max iterations
  fi

  # Increment iteration
  NEXT_ITER=$((CURRENT_ITER + 1))
  sed -i "s/^current_iteration:.*/current_iteration: $NEXT_ITER/" "$STATE_FILE"
  echo "Iteration: $NEXT_ITER / $MAX_ITER"
fi

# Explicit next-action instructions
echo ""
echo "───────────────────────────────────────────────────────────────"
echo "NEXT ACTION REQUIRED:"
echo "───────────────────────────────────────────────────────────────"

# Determine what to tell Claude to do next
if [ "$STATUS" = "verifying" ]; then
  echo "  1. Check verification results"
  echo "  2. If passed: Task will auto-commit"
  echo "  3. If failed: Fix issues and re-verify"
elif [ "$STATUS" = "executing" ]; then
  echo "  1. Complete current task implementation"
  echo "  2. Run verification: npm run build && npm run typecheck && npm test"
  echo "  3. Update STATE.md status to 'verifying'"
elif [ "$STATUS" = "planning" ]; then
  echo "  1. Create/update PLAN.md for current phase"
  echo "  2. Update STATE.md status to 'executing'"
  echo "  3. Begin first task"
else
  echo "  1. Continue with task: $CURRENT_TASK"
  echo "  2. Run verification when complete"
fi

echo "───────────────────────────────────────────────────────────────"
echo ""

# Block exit - this will re-feed the prompt
exit 1
