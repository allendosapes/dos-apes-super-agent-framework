#!/bin/bash
# PostToolUse hook: Track files modified in this session
# Used by Stop hook auto-reviewer to know what to review
mkdir -p .planning 2>/dev/null || true
MODIFIED_FILES=".planning/.modified-files.txt"
git diff --name-only HEAD 2>/dev/null >> "$MODIFIED_FILES" 2>/dev/null
git diff --name-only --staged 2>/dev/null >> "$MODIFIED_FILES" 2>/dev/null
# Deduplicate
sort -u "$MODIFIED_FILES" -o "$MODIFIED_FILES" 2>/dev/null
