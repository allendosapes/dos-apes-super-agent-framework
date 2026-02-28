#!/usr/bin/env bash
# check-structure.sh — Enforce architectural boundary rules
# Reads .planning/ARCHITECTURE_RULES.md and verifies import directions.
# Exit 0 if clean or no rules file. Exit 1 on violations.

set -euo pipefail

RULES_FILE=".planning/ARCHITECTURE_RULES.md"

# If no rules file, nothing to enforce
if [ ! -f "$RULES_FILE" ]; then
  exit 0
fi

# Optional: check a single file, or scan all .ts/.tsx files
TARGET_FILE="${1:-}"

# ─── Parse Rules ────────────────────────────────────────────────────────────

DIRECTION_RULES=()
BOUNDARY_WALLS=()

current_section=""
while IFS= read -r line; do
  # Detect section headers
  if echo "$line" | grep -q "^## Dependency Direction"; then
    current_section="direction"
    continue
  elif echo "$line" | grep -q "^## Boundary Walls"; then
    current_section="boundary"
    continue
  elif echo "$line" | grep -q "^## "; then
    current_section=""
    continue
  fi

  # Skip comments and blank lines
  case "$line" in
    "#"*|"") continue ;;
  esac

  # Parse rules based on section
  if [ "$current_section" = "direction" ]; then
    DIRECTION_RULES+=("$line")
  elif [ "$current_section" = "boundary" ]; then
    BOUNDARY_WALLS+=("$line")
  fi
done < "$RULES_FILE"

# If no rules parsed, exit clean
if [ ${#DIRECTION_RULES[@]} -eq 0 ] && [ ${#BOUNDARY_WALLS[@]} -eq 0 ]; then
  exit 0
fi

# ─── Build Lookup Tables ────────────────────────────────────────────────────

# Associative arrays: dir -> allowed deps (for direction rules)
# and source -> forbidden target (for boundary walls)
# Bash 3 (macOS default) lacks associative arrays, so use flat lists + grep

DIRECTION_ENTRIES=""
for rule in "${DIRECTION_RULES[@]}"; do
  src_dir=$(echo "$rule" | sed 's/ *->.*$//' | sed 's/^ *//;s/ *$//')
  allowed=$(echo "$rule" | sed 's/^.*-> *//')
  # Normalize: strip spaces, handle (none)
  if echo "$allowed" | grep -q "(none)"; then
    allowed=""
  fi
  DIRECTION_ENTRIES="${DIRECTION_ENTRIES}${src_dir}|${allowed}
"
done

WALL_ENTRIES=""
for rule in "${BOUNDARY_WALLS[@]}"; do
  src_dir=$(echo "$rule" | sed 's/ *->.*$//' | sed 's/^ *//;s/ *$//')
  tgt_dir=$(echo "$rule" | sed 's/^.*-> *//' | sed 's/^ *//;s/ *$//')
  WALL_ENTRIES="${WALL_ENTRIES}${src_dir}|${tgt_dir}
"
done

# ─── Collect Files ──────────────────────────────────────────────────────────

if [ -n "$TARGET_FILE" ]; then
  if [ ! -f "$TARGET_FILE" ]; then
    exit 0
  fi
  FILES="$TARGET_FILE"
else
  FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null || true)
  if [ -z "$FILES" ]; then
    exit 0
  fi
fi

# ─── Check Imports ──────────────────────────────────────────────────────────

violations=0

check_import() {
  local file="$1"
  local import_path="$2"

  # Only check relative or src/ imports — skip node_modules / packages
  case "$import_path" in
    ./*|../*|src/*) ;;
    @/*) # Handle @/ alias → src/
      import_path="src/${import_path#@/}"
      ;;
    *) return 0 ;;
  esac

  # Resolve relative imports to directory
  local file_dir
  file_dir=$(dirname "$file")

  local resolved="$import_path"
  if [ "${import_path:0:1}" = "." ]; then
    # Relative import: resolve against file directory
    # Simple resolution: combine file_dir + import_path
    resolved=$(cd "$file_dir" 2>/dev/null && cd "$(dirname "$import_path")" 2>/dev/null && pwd) || return 0
    # Make relative to project root
    resolved=$(echo "$resolved" | sed "s|^$(pwd)/||")
  fi

  # Extract the source directory of the file being checked
  local src_dir=""
  # Match the most specific directory from the rules
  local best_match=""
  local best_len=0
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    local dir="${entry%%|*}"
    if echo "$file" | grep -q "^${dir}/\|^${dir}$"; then
      local len=${#dir}
      if [ "$len" -gt "$best_len" ]; then
        best_match="$dir"
        best_len=$len
      fi
    fi
  done <<< "$DIRECTION_ENTRIES"
  src_dir="$best_match"

  # Extract the target directory from the import
  local tgt_dir=""
  local tgt_best=""
  local tgt_len=0
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    local dir="${entry%%|*}"
    if echo "$resolved" | grep -q "^${dir}/\|^${dir}$"; then
      local len=${#dir}
      if [ "$len" -gt "$tgt_len" ]; then
        tgt_best="$dir"
        tgt_len=$len
      fi
    fi
  done <<< "$DIRECTION_ENTRIES"
  tgt_dir="$tgt_best"

  # Same directory imports are always allowed
  if [ "$src_dir" = "$tgt_dir" ]; then
    return 0
  fi

  # ── Check boundary walls ──
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    local wall_src="${entry%%|*}"
    local wall_tgt="${entry#*|}"
    if [ "$src_dir" = "$wall_src" ] && [ "$tgt_dir" = "$wall_tgt" ]; then
      echo ""
      echo "═══ STRUCTURE VIOLATION ═══"
      echo "File: $file"
      echo "Import: $import_path"
      echo "Rule: $src_dir cannot import from $tgt_dir"
      echo "═══════════════════════════"
      violations=$((violations + 1))
      return 0
    fi
  done <<< "$WALL_ENTRIES"

  # ── Check dependency direction ──
  if [ -n "$src_dir" ] && [ -n "$tgt_dir" ]; then
    # Look up allowed deps for src_dir
    local allowed=""
    while IFS= read -r entry; do
      [ -z "$entry" ] && continue
      local dir="${entry%%|*}"
      if [ "$dir" = "$src_dir" ]; then
        allowed="${entry#*|}"
        break
      fi
    done <<< "$DIRECTION_ENTRIES"

    # If we have direction rules for this source dir, check the target
    if [ -n "$allowed" ] || echo "$DIRECTION_ENTRIES" | grep -q "^${src_dir}|"; then
      # Check if tgt_dir is in the allowed list
      if ! echo "$allowed" | grep -q "$tgt_dir"; then
        echo ""
        echo "═══ STRUCTURE VIOLATION ═══"
        echo "File: $file"
        echo "Import: $import_path"
        echo "Rule: $src_dir can only import from [$allowed] — $tgt_dir is not allowed"
        echo "═══════════════════════════"
        violations=$((violations + 1))
      fi
    fi
  fi
}

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # Extract import paths from import/require statements
  # Handles: import ... from "path", import "path", require("path")
  imports=$(grep -oE "(from ['\"]([^'\"]+)['\"]|import ['\"]([^'\"]+)['\"]|require\(['\"]([^'\"]+)['\"]\))" "$file" 2>/dev/null | \
    sed "s/from ['\"]//;s/import ['\"]//;s/require(['\"]//;s/['\"])\\{0,1\\}//;s/['\"]$//" || true)

  while IFS= read -r imp; do
    [ -z "$imp" ] && continue
    check_import "$file" "$imp"
  done <<< "$imports"
done <<< "$FILES"

# ─── Summary ────────────────────────────────────────────────────────────────

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "Found $violations architectural boundary violation(s)."
  exit 1
fi

exit 0
