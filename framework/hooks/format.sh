#!/bin/bash
# Dos Apes Super Agent Framework - Format Hook
# PostToolUse hook for automatic code formatting after edits
# Triggered after Edit, Write, or NotebookEdit tools

set -e

# Configuration
STATE_FILE=".planning/STATE.md"
AUTO_FORMAT=${AUTO_FORMAT:-true}

# Only run if auto-format is enabled
if [ "$AUTO_FORMAT" != "true" ]; then
  exit 0
fi

# Get the file that was just modified (passed as argument)
MODIFIED_FILE="$1"

if [ -z "$MODIFIED_FILE" ]; then
  exit 0
fi

# Skip non-code files
case "$MODIFIED_FILE" in
  *.md|*.txt|*.json|*.yaml|*.yml|*.env*|*.gitignore|*.lock)
    exit 0
    ;;
esac

# Detect project type and format accordingly
format_file() {
  local file="$1"
  local ext="${file##*.}"

  case "$ext" in
    # TypeScript/JavaScript - use Prettier if available
    ts|tsx|js|jsx|mjs|cjs)
      if command -v npx &> /dev/null && [ -f "node_modules/.bin/prettier" ]; then
        npx prettier --write "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (Prettier)"
      elif command -v npx &> /dev/null && [ -f "package.json" ]; then
        # Try to run prettier via npx even if not installed locally
        npx prettier --write "$file" 2>/dev/null || true
      fi
      ;;

    # Python - use Black or Ruff if available
    py)
      if command -v black &> /dev/null; then
        black --quiet "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (Black)"
      elif command -v ruff &> /dev/null; then
        ruff format "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (Ruff)"
      fi
      ;;

    # Go - use gofmt
    go)
      if command -v gofmt &> /dev/null; then
        gofmt -w "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (gofmt)"
      fi
      ;;

    # Rust - use rustfmt
    rs)
      if command -v rustfmt &> /dev/null; then
        rustfmt "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (rustfmt)"
      fi
      ;;

    # CSS/SCSS/LESS - use Prettier
    css|scss|sass|less)
      if command -v npx &> /dev/null && [ -f "node_modules/.bin/prettier" ]; then
        npx prettier --write "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (Prettier)"
      fi
      ;;

    # HTML - use Prettier
    html|htm)
      if command -v npx &> /dev/null && [ -f "node_modules/.bin/prettier" ]; then
        npx prettier --write "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (Prettier)"
      fi
      ;;

    # Shell scripts - use shfmt if available
    sh|bash)
      if command -v shfmt &> /dev/null; then
        shfmt -w "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (shfmt)"
      fi
      ;;

    # SQL - use sql-formatter if available
    sql)
      if command -v sql-formatter &> /dev/null; then
        sql-formatter "$file" > "${file}.tmp" && mv "${file}.tmp" "$file" 2>/dev/null || true
        echo "✨ Formatted: $file (sql-formatter)"
      fi
      ;;

    *)
      # Unknown extension, skip silently
      ;;
  esac
}

# Format the modified file
format_file "$MODIFIED_FILE"

# Run project-wide lint fix if configured
FIX_ON_SAVE=$(grep "^fix_on_save:" "$STATE_FILE" 2>/dev/null | awk '{print $2}')
if [ "$FIX_ON_SAVE" = "true" ]; then
  if [ -f "package.json" ] && grep -q '"lint:fix"' package.json 2>/dev/null; then
    npm run lint:fix -- --fix "$MODIFIED_FILE" 2>/dev/null || true
  fi
fi

exit 0
