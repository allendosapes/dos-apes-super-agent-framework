#!/bin/bash
# Dos Apes Super Agent Framework - Git Automation Helper
# Detects current state and determines required git action
# Called by stop.sh to automate git workflow

STATE_FILE=".planning/STATE.md"
PLAN_FILE=".planning/PLAN.md"

# Output format: ACTION|MESSAGE|DETAILS
# ACTION: commit|merge|push|none
# MESSAGE: commit/merge message
# DETAILS: additional info

# Get git state
get_git_state() {
  local branch
  branch=$(git branch --show-current 2>/dev/null)

  local staged
  staged=$(git diff --cached --name-only 2>/dev/null | wc -l)

  local unstaged
  unstaged=$(git diff --name-only 2>/dev/null | wc -l)

  local untracked
  untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)

  echo "$branch|$staged|$unstaged|$untracked"
}

# Get current task info from STATE.md
get_task_info() {
  if [ ! -f "$STATE_FILE" ]; then
    echo "none|0|0|unknown"
    return
  fi

  local task_name
  task_name=$(grep "^task_name:" "$STATE_FILE" 2>/dev/null | cut -d'"' -f2)

  local task_num
  task_num=$(grep "^task:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

  local phase_num
  phase_num=$(grep "^phase:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

  local phase_name
  phase_name=$(grep "^phase_name:" "$STATE_FILE" 2>/dev/null | cut -d'"' -f2)

  echo "$task_name|$task_num|$phase_num|$phase_name"
}

# Check if verification passed
verification_passed() {
  if [ ! -f "$STATE_FILE" ]; then
    return 1
  fi

  # Check all verification fields
  local build
  build=$(grep "^build:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
  local types
  types=$(grep "^types:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
  local lint
  lint=$(grep "^lint:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
  local tests
  tests=$(grep "^tests:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

  # If any exist and are pass, consider verification done
  if [ "$build" = "pass" ] && [ "$types" = "pass" ]; then
    return 0
  fi

  return 1
}

# Check if all phase tasks are complete
phase_complete() {
  if [ ! -f "$STATE_FILE" ]; then
    return 1
  fi

  local progress
  progress=$(grep "^current_phase_tasks:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

  if [ -z "$progress" ]; then
    return 1
  fi

  # Parse N/M format
  local current
  current=$(echo "$progress" | cut -d'/' -f1)
  local total
  total=$(echo "$progress" | cut -d'/' -f2)

  if [ "$current" = "$total" ] && [ "$total" != "0" ]; then
    return 0
  fi

  return 1
}

# Check if all phases complete (product done)
product_complete() {
  if [ ! -f "$STATE_FILE" ]; then
    return 1
  fi

  local all_complete
  all_complete=$(grep "^all_tasks_complete:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')

  [ "$all_complete" = "true" ]
}

# Generate commit message from state
generate_commit_message() {
  local task_info
  task_info=$(get_task_info)

  local task_name
  task_name=$(echo "$task_info" | cut -d'|' -f1)
  local task_num
  task_num=$(echo "$task_info" | cut -d'|' -f2)
  local phase_num
  phase_num=$(echo "$task_info" | cut -d'|' -f3)
  local phase_name
  phase_name=$(echo "$task_info" | cut -d'|' -f4)

  # Determine commit type from task name
  local commit_type="feat"
  if echo "$task_name" | grep -qi "fix\|bug"; then
    commit_type="fix"
  elif echo "$task_name" | grep -qi "test"; then
    commit_type="test"
  elif echo "$task_name" | grep -qi "doc"; then
    commit_type="docs"
  elif echo "$task_name" | grep -qi "refactor"; then
    commit_type="refactor"
  fi

  # Build commit message
  local scope="phase-${phase_num}"
  local subject
  subject=$(echo "$task_name" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//')

  echo "${commit_type}(${scope}): ${subject}

Task ${task_num} complete - ${phase_name}
Verified: build, types, lint, tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
}

# Generate merge message for phase completion
generate_merge_message() {
  local task_info
  task_info=$(get_task_info)

  local phase_num
  phase_num=$(echo "$task_info" | cut -d'|' -f3)
  local phase_name
  phase_name=$(echo "$task_info" | cut -d'|' -f4)

  # Get completed tasks from plan file
  local tasks=""
  if [ -f "$PLAN_FILE" ]; then
    tasks=$(grep -oP '(?<=<task[^>]*name=")[^"]+(?=.*complete="true")' "$PLAN_FILE" 2>/dev/null | head -5 | sed 's/^/- /')
  fi

  echo "feat: Complete Phase ${phase_num} - ${phase_name}

Completed tasks:
${tasks:-No task details available}

All verification passed.
Ready for next phase.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
}

# Main logic - determine action needed
determine_action() {
  local git_state
  git_state=$(get_git_state)

  local branch
  branch=$(echo "$git_state" | cut -d'|' -f1)
  local staged
  staged=$(echo "$git_state" | cut -d'|' -f2)
  local unstaged
  unstaged=$(echo "$git_state" | cut -d'|' -f3)
  local untracked
  untracked=$(echo "$git_state" | cut -d'|' -f4)

  # On main branch - nothing to do
  if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
    echo "none||On main branch - create feature branch first"
    return
  fi

  # Check for product completion first
  if product_complete; then
    echo "push||Product complete - final push needed"
    return
  fi

  # Check for phase completion
  if phase_complete; then
    local merge_msg
    merge_msg=$(generate_merge_message)
    echo "merge|$merge_msg|Phase complete - merge to main"
    return
  fi

  # Check if we have changes and verification passed
  local total_changes=$((staged + unstaged + untracked))

  if [ "$total_changes" -gt 0 ] && verification_passed; then
    local commit_msg
    commit_msg=$(generate_commit_message)
    echo "commit|$commit_msg|Task verified - commit needed"
    return
  fi

  # Check if clean state
  if [ "$total_changes" -eq 0 ]; then
    echo "none||Working directory clean"
    return
  fi

  # Changes exist but verification not done
  echo "none||Changes exist but verification pending"
}

# Execute based on mode
case "${1:-detect}" in
  detect)
    determine_action
    ;;
  commit-msg)
    generate_commit_message
    ;;
  merge-msg)
    generate_merge_message
    ;;
  state)
    echo "Git: $(get_git_state)"
    echo "Task: $(get_task_info)"
    echo "Verified: $(verification_passed && echo yes || echo no)"
    echo "Phase Complete: $(phase_complete && echo yes || echo no)"
    echo "Product Complete: $(product_complete && echo yes || echo no)"
    ;;
  *)
    echo "Usage: git-auto.sh [detect|commit-msg|merge-msg|state]"
    exit 1
    ;;
esac
